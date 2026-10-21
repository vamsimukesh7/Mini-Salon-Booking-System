import { useState, useEffect } from "react";
import { ReceiptText, Printer, Plus, Minus } from "lucide-react";
import {
  api,
  base,
  money,
  errorText,
  type Service,
  type Booking,
  type Invoice,
} from "../api";
import ErrorBox from "./ErrorBox";
export default function Billing({ services }: { services: Service[] }) {
  const [bookings, setBookings] = useState<Booking[]>([]),
    [history, setHistory] = useState<Invoice[]>([]),
    [booking, setBooking] = useState(""),
    [quantities, setQuantities] = useState<Record<number, number>>({}),
    [invoice, setInvoice] = useState<Invoice | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    Promise.all([api<Booking[]>("/bookings"), api<Invoice[]>("/invoices")])
      .then(([b, i]) => {
        setBookings(b);
        setHistory(i);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const total = services.reduce(
    (sum, s) => sum + s.price_paise * (quantities[s.id] || 0),
    0,
  );
  const print = async (id: string) => {
    const win = window.open("about:blank", "_blank");
    if (!win) {
      setError("Allow pop-ups to open the printable invoice.");
      return;
    }
    try {
      const res = await fetch(base + "/invoices/" + id + "/print", {
        headers: {
          Authorization: "Bearer " + sessionStorage.getItem("atelier-token"),
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok)
        throw new Error("Could not load invoice. Please sign in and retry.");
      const blob = new Blob([await res.text()], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      win.close();
      setError(errorText(e));
    }
  };
  return (
    <section className="workspace">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">THE FINISHING TOUCH</span>
          <h1>A good visit, beautifully billed.</h1>
          <p>Simple, transparent billing. Just like your service.</p>
        </div>
        <ReceiptText size={40} strokeWidth={1} />
      </div>
      <ErrorBox message={error} />
      {loading ? (
        <p className="loading">Loading customers and invoices…</p>
      ) : (
        <div className="billing-layout">
          <div className="panel">
            <h2>Create an invoice</h2>
            <label>
              Customer / appointment
              <select
                value={booking}
                onChange={(e) => {
                  const b = bookings.find((b) => b.id === e.target.value);
                  setBooking(e.target.value);
                  setInvoice(null);
                  setQuantities(b ? { [b.service_id]: 1 } : {});
                }}
              >
                <option value="">Select an appointment</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.customer_name} · {b.date} · {b.service_name} · {b.status}
                  </option>
                ))}
              </select>
            </label>
            <h3 className="section-label">Services & quantities</h3>
            {services.map((s) => (
              <div className="invoice-line" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small>{money(s.price_paise)} each</small>
                </div>
                <div className="quantity">
                  <button
                    aria-label={"Remove " + s.name}
                    disabled={!quantities[s.id]}
                    onClick={() =>
                      setQuantities((q) => ({
                        ...q,
                        [s.id]: Math.max(0, (q[s.id] || 0) - 1),
                      }))
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <span>{quantities[s.id] || 0}</span>
                  <button
                    aria-label={"Add " + s.name}
                    disabled={(quantities[s.id] || 0) >= 20}
                    onClick={() =>
                      setQuantities((q) => ({
                        ...q,
                        [s.id]: (q[s.id] || 0) + 1,
                      }))
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <b>{money(s.price_paise * (quantities[s.id] || 0))}</b>
              </div>
            ))}
            <div className="booking-total">
              <span>
                Total <small>No additional taxes or fees</small>
              </span>
              <strong>{money(total)}</strong>
            </div>
            <button
              className="primary"
              disabled={busy || !booking || !total}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await api<Invoice>("/invoices", {
                    method: "POST",
                    body: JSON.stringify({
                      booking_id: booking,
                      items: Object.entries(quantities)
                        .filter(([, q]) => q > 0)
                        .map(([id, quantity]) => ({
                          service_id: Number(id),
                          quantity,
                        })),
                    }),
                  });
                  setInvoice(result);
                  setHistory((h) => [result, ...h]);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Creating invoice…" : "Generate invoice"}
              <ReceiptText size={17} />
            </button>
          </div>
          <div>
            <div className="invoice-preview panel">
              {invoice ? (
                <>
                  <span className="eyebrow">INVOICE CREATED</span>
                  <h2>{invoice.id}</h2>
                  <p>
                    {invoice.customer_name} · {invoice.issued_at.slice(0, 10)}
                  </p>
                  {invoice.items?.map((i, n) => (
                    <div className="invoice-line" key={n}>
                      <span>
                        {i.quantity} × {i.name}
                      </span>
                      <strong>{money(i.unit_price_paise * i.quantity)}</strong>
                    </div>
                  ))}
                  <div className="booking-total">
                    <span>Total</span>
                    <strong>{money(invoice.total_paise)}</strong>
                  </div>
                  <button
                    className="primary"
                    onClick={() => void print(invoice.id)}
                  >
                    <Printer size={16} /> Print / Save as PDF
                  </button>
                </>
              ) : (
                <div className="empty">
                  <ReceiptText size={35} />
                  <h2>A tidy end to every visit.</h2>
                  <p>
                    Choose a customer and services to create an itemised,
                    printable invoice.
                  </p>
                </div>
              )}
            </div>
            <div className="panel history">
              <h2>Recent invoices</h2>
              {history.length ? (
                history.map((i) => (
                  <button
                    key={i.id}
                    className="history-item"
                    onClick={() => void print(i.id)}
                  >
                    <span>
                      <strong>{i.customer_name}</strong>
                      <small>
                        {i.id} · {i.issued_at.slice(0, 10)}
                      </small>
                    </span>
                    <b>{money(i.total_paise)}</b>
                    <Printer size={15} />
                  </button>
                ))
              ) : (
                <p className="muted">Your invoices will appear here.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
