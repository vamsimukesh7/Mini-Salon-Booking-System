from contextlib import asynccontextmanager
from collections import defaultdict, deque
from pathlib import Path
import hashlib
import hmac
import html
import secrets
import time
from fastapi import FastAPI, Depends, Header, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from . import db, domain, schemas, chat
from .config import settings


@asynccontextmanager
async def lifespan(app):
    if settings.slot_minutes <= 0 or domain.minutes(
        settings.salon_close
    ) <= domain.minutes(settings.salon_open):
        raise RuntimeError("Invalid salon hours or slot interval")
    domain.initialize()
    yield


app = FastAPI(title="Atelier Salon API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key"],
)
limits = defaultdict(deque)


def limit(request, group, maximum):
    key = (request.client.host, group)
    stamps = limits[key]
    current = time.monotonic()
    while stamps and stamps[0] < current - 60:
        stamps.popleft()
    if len(stamps) >= maximum:
        raise HTTPException(429, "Too many requests. Try again in a minute.")
    stamps.append(current)


def sign(value):
    return hmac.new(
        settings.admin_password.encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def admin(authorization: str = Header(default="")):
    if not settings.admin_password:
        raise HTTPException(
            503, "Admin access is not configured. Set ADMIN_PASSWORD on the server."
        )
    token = authorization.removeprefix("Bearer ")
    try:
        expiry, nonce, signature = token.split(".")
        if int(expiry) < time.time() or not hmac.compare_digest(
            signature, sign(expiry + "." + nonce)
        ):
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(401, "Please sign in to the owner dashboard.") from None


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    return JSONResponse(
        status_code=503,
        content={"detail": "Storage is temporarily unavailable. Please retry shortly."},
    )


@app.get("/health")
def health():
    with db.engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.post("/auth/login")
def login(payload: schemas.LoginInput, request: Request):
    limit(request, "login", 8)
    if not settings.admin_password:
        raise HTTPException(503, "Set ADMIN_PASSWORD on the server first.")
    if not secrets.compare_digest(
        payload.password.encode(), settings.admin_password.encode()
    ):
        raise HTTPException(401, "Incorrect owner password.")
    value = str(int(time.time()) + 8 * 3600) + "." + secrets.token_hex(16)
    return {"token": value + "." + sign(value)}


@app.get("/config")
def config():
    return {
        "name": "Atelier",
        "timezone": settings.salon_timezone,
        "open": settings.salon_open,
        "close": settings.salon_close,
        "slot_minutes": settings.slot_minutes,
        "today": domain.now().date().isoformat(),
        "policy": "Contact the salon owner to reschedule or cancel active bookings. Refund and cancellation-fee policies are not available.",
    }


@app.get("/services")
def services():
    with db.engine.connect() as conn:
        return [
            dict(s)
            for s in conn.execute(
                select(db.services).where(db.services.c.active.is_(True))
            ).mappings()
        ]


@app.get("/availability")
def availability(
    date: str,
    service_id: int,
    exclude_id: str | None = None,
    authorization: str = Header(default=""),
):
    if exclude_id:
        admin(authorization)
    with db.engine.connect() as conn:
        return {
            "date": date,
            "service_id": service_id,
            "slots": domain.availability(conn, date, service_id, exclude_id),
        }


@app.post("/bookings", status_code=201)
def create_booking(
    payload: schemas.BookingInput,
    request: Request,
    idempotency_key: str | None = Header(default=None, max_length=100),
):
    limit(request, "booking", 30)
    return domain.create_booking(payload, idempotency_key)


@app.get("/bookings", dependencies=[Depends(admin)])
def bookings(
    date: str | None = None,
    status: str | None = None,
    search: str = Query(default="", max_length=100),
):
    query = select(db.bookings).order_by(db.bookings.c.date, db.bookings.c.time)
    if date:
        try:
            from datetime import date as Date

            Date.fromisoformat(date)
        except ValueError:
            raise HTTPException(422, "Invalid date filter.") from None
        query = query.where(db.bookings.c.date == date)
    if status:
        if status not in domain.STATUSES:
            raise HTTPException(422, "Invalid status filter.")
        query = query.where(db.bookings.c.status == status)
    with db.engine.connect() as conn:
        rows = [
            domain.serialize_booking(conn, b) for b in conn.execute(query).mappings()
        ]
    return [
        b
        for b in rows
        if not search
        or search.lower() in (b["customer_name"] + b["phone"] + b["id"]).lower()
    ]


@app.get("/bookings/{booking_id}", dependencies=[Depends(admin)])
def booking(booking_id: str):
    with db.engine.connect() as conn:
        return domain.serialize_booking(conn, domain.get_booking(conn, booking_id))


@app.patch("/bookings/{booking_id}", dependencies=[Depends(admin)])
def patch_booking(booking_id: str, payload: schemas.BookingUpdate):
    return domain.update_booking(booking_id, payload)


@app.post("/invoices", status_code=201, dependencies=[Depends(admin)])
def create_invoice(payload: schemas.InvoiceInput):
    with db.transaction() as conn:
        booking = domain.get_booking(conn, payload.booking_id)
        items = []
        for line in payload.items:
            service = domain.get_service(conn, line.service_id)
            items.append(
                {
                    "service_id": service["id"],
                    "name": service["name"],
                    "quantity": line.quantity,
                    "unit_price_paise": service["price_paise"],
                }
            )
        total = sum(i["quantity"] * i["unit_price_paise"] for i in items)
        invoice = {
            "id": "INV-" + secrets.token_hex(6).upper(),
            "booking_id": booking["id"],
            "customer_name": booking["customer_name"],
            "phone": booking["phone"],
            "issued_at": domain.now().isoformat(),
            "total_paise": total,
        }
        conn.execute(db.invoices.insert().values(**invoice))
        conn.execute(
            db.invoice_items.insert(),
            [i | {"invoice_id": invoice["id"]} for i in items],
        )
        return invoice | {"items": items}


def invoice_data(conn, ident):
    row = (
        conn.execute(select(db.invoices).where(db.invoices.c.id == ident))
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(404, "Invoice not found.")
    return dict(row) | {
        "items": [
            dict(i)
            for i in conn.execute(
                select(db.invoice_items).where(db.invoice_items.c.invoice_id == ident)
            ).mappings()
        ]
    }


@app.get("/invoices", dependencies=[Depends(admin)])
def invoices():
    with db.engine.connect() as conn:
        return [
            dict(i)
            for i in conn.execute(
                select(db.invoices).order_by(db.invoices.c.issued_at.desc())
            ).mappings()
        ]


@app.get("/invoices/{ident}", dependencies=[Depends(admin)])
def invoice(ident: str):
    with db.engine.connect() as conn:
        return invoice_data(conn, ident)


@app.get(
    "/invoices/{ident}/print",
    response_class=HTMLResponse,
    dependencies=[Depends(admin)],
)
def print_invoice(ident: str):
    with db.engine.connect() as conn:
        inv = invoice_data(conn, ident)

    def esc(value):
        return html.escape(str(value))

    def money(value):
        return f"₹{value / 100:,.2f}"

    rows = "".join(
        f"<tr><td>{esc(i['name'])}</td><td>{i['quantity']}</td><td>{money(i['unit_price_paise'])}</td><td>{money(i['quantity'] * i['unit_price_paise'])}</td></tr>"
        for i in inv["items"]
    )
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{esc(ident)} · Atelier</title><style>body{{font:16px system-ui;color:#182b29;max-width:760px;margin:60px auto;padding:24px}}h1{{font:48px Georgia}}table{{width:100%;border-collapse:collapse;margin:40px 0}}td,th{{text-align:left;padding:16px 8px;border-bottom:1px solid #ddd}}.total{{text-align:right;font-size:22px}}button{{padding:12px 24px;background:#183f36;color:white;border:0;border-radius:8px}}@media print{{button{{display:none}}body{{margin:0}}}}</style><h1>Atelier<span style="color:#9c663d">.</span></h1><p>SALON & SELF CARE · INVOICE</p><hr><h2>{esc(ident)}</h2><p>Issued: {esc(inv["issued_at"][:10])}<br>Booking: {esc(inv["booking_id"])}</p><p>Billed to <strong>{esc(inv["customer_name"])}</strong><br>{esc(inv["phone"])}</p><table><thead><tr><th>Service</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{rows}</tbody></table><p class="total">Subtotal: {money(inv["total_paise"])}<br><strong>Total: {money(inv["total_paise"])}</strong></p><p>Thank you for choosing Atelier. No additional taxes or fees applied.</p><button onclick="window.print()">Print / Save as PDF</button></html>"""


@app.post("/chat")
async def chatbot(payload: schemas.ChatInput, request: Request):
    limit(request, "chat", 20)
    return await chat.respond(payload.message)


# One same-origin production service; API routes are registered before the SPA.
dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
