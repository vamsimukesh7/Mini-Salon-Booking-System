# Atelier · Mini Salon Booking & Billing

A React/TypeScript + FastAPI salon application built for the GURU AI Technologies
assessment. The original repository had no commits or files. Requirements are mapped
to all six assessment pages in [docs/requirements.md](docs/requirements.md).

## Run locally

Prerequisites: Python 3.12, Node 22+ and npm. Use the existing checkout; cloud tasks
already have isolation and do not need a Git worktree.

```sh
python -m venv .venv
.venv/bin/pip install -r backend/requirements.lock.txt
npm ci --prefix frontend
npm ci
cp backend/.env.example backend/.env
```

Edit **backend/.env**: replace `ADMIN_PASSWORD` with your own long private password.
Do not use the example placeholder. `LLM_API_KEY` is optional for local development,
but **required for a complete assessment submission with real AI**. Never put keys
in a `VITE_` variable. Backend `.env` must stay untracked.

Terminal one:

```sh
cd backend
../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal two:

```sh
npm --prefix frontend run dev
```

Vite proxies API calls to the backend. For a production-like single server, run
`npm --prefix frontend run build` **before** starting/restarting the backend, then
FastAPI serves the built frontend and API together on port 8000. `/health` checks
storage connectivity; `/docs` provides the interactive API schema. No cloud preview
URL is supplied by this repository.

## Configuration

| Variable | Default / purpose |
|---|---|
| `DATABASE_URL` | `sqlite:///./data/salon.db` relative to backend working directory. Persistent local file, not `/tmp`. Production: Neon/Supabase PostgreSQL URL with `sslmode=require`. |
| `ADMIN_PASSWORD` | No built-in password. Owner operations return 503 until configured. Change invalidates owner sessions. |
| `SALON_TIMEZONE` | `Asia/Kolkata`; all appointment dates/times are salon-local, independent of browser timezone. |
| `SALON_OPEN`, `SALON_CLOSE` | `09:00`, `19:00`, every day. |
| `SLOT_MINUTES` | `15`; slot-start grid, not a rounded service duration. |
| `LLM_API_KEY` | Backend-only OpenAI-compatible provider key. Missing key activates labelled basic fallback. |
| `LLM_BASE_URL`, `LLM_MODEL` | `https://api.openai.com/v1`, `gpt-4o-mini`; provider must support JSON chat completions. |
| `CORS_ORIGINS` | Comma-separated exact frontend origins. Default `http://localhost:5173`; no wildcard. |
| `VITE_API_URL` | Optional frontend build-time API origin; empty for same-origin/Vite proxy. Never contains secrets. |

## Architecture and invariants

- `frontend/src`: responsive booking, confirmation, owner day view, billing and chat.
- `backend/app/main.py`: HTTP/auth/invoice endpoints and static production serving.
- `domain.py`: availability, booking creation, state transitions, rescheduling, seed.
- `db.py`: SQLAlchemy tables, persistent connections and serialized transactions.
- `chat.py`: runtime catalogue grounding, provider classification and factual rendering.
- `schemas.py`: strict input models reject unknown fields and client prices.

The booking form retrieves services, then date-specific availability. Submission
revalidates availability and inserts under the **same transaction**. One provider
is assumed: intervals overlap when `start < existing_end AND end > existing_start`.
SQLite `BEGIN IMMEDIATE` serializes writers across connections/processes;
PostgreSQL uses a fixed transaction advisory lock shared by every application writer.
All booking mutations use the same lock. External/manual SQL writers must respect
this protocol; a PostgreSQL exclusion constraint is a future hardening option.
Bookings may start every 15 minutes and must finish by closing. No past dates,
elapsed same-day slots, or dates beyond 365 days. Done visits occupy their historical
interval; Cancelled visits release it. No staff capacity, holidays or payment gateway
is assumed. These are documented assumptions, not claims about a real salon.

New requests are **Pending**, with truthful saved confirmation. Allowed transitions:
Pending → Confirmed/Cancelled; Confirmed → Done/Cancelled. Terminal statuses cannot
be reopened or rescheduled. Owner rescheduling preserves the most recent prior slot.
Idempotency keys prevent duplicate retry submissions; a key reused with different
input returns 409. The UI also blocks duplicate submission.

Services/prices are seeded exactly as the PDF specifies: ₹200/30m Haircut,
₹100/15m Beard Trim, ₹800/45m Hair Spa, ₹500/40m Facial, ₹5,000/120m Bridal Makeup.
Initialization creates missing tables and inserts missing services plus three clearly
named `DEMO-*` appointments in Pending/Confirmed/Done states on first-run date.
It never overwrites existing records or duplicates seed rows on restart. It does
not move sample visits to every new day. Use All dates to find older samples.
`cd backend && ../.venv/bin/python -c 'from app.domain import initialize; initialize()'`
reruns the idempotent initializer. `create_all` initializes fresh schemas; future
schema changes require a versioned migration, not deleting production data.

Amounts are integer **paise**. Bookings capture their quoted price; invoices capture
current database prices and item names so later price changes do not rewrite bills.
Invoice totals are computed exclusively on the server. No extra tax is assumed.
Print view supports browser Print → Save as PDF and escapes customer-supplied HTML.

Owner login returns an HMAC-signed, eight-hour bearer token. The UI keeps it in
sessionStorage, never stores the password, and clears expired authentication.
Admin lists/details, status changes, rescheduling and invoices require authorization.
Use HTTPS publicly. Limits on login/chat/booking requests are per process and IP;
place shared rate limiting upstream for production scale. This is lightweight demo
auth, without user accounts/password recovery/MFA.

## Chatbot honesty and scope

The backend supplies **current database** services and configured hours/local date
to the real LLM API. The model returns structured intent, service IDs, language and
optional date/time. Validated output drives server queries/rendering. Model prose
is never passed through as an authoritative price, slot or confirmation. No model
has booking-write access, customer lists or secret-reading tools. Chat does not
book; it directs to the validated form. Unknown policies are explicitly unavailable.

If no key is configured, a provider fails/times out (12 seconds), or the classification
is malformed, the UI labels a **basic database assistant**. It recognizes common
English/Hinglish/Marathi phrases and literal catalogue names; it is not a simulated
LLM and is not a substitute for live multilingual evaluation. The assistant is
single-turn; it does not retain conversation context server-side. Explicit AM/PM
is requested for ambiguous fallback time expressions. Unsupported services and
scope/injection attempts are rejected; the backend is the security boundary.

See [the actual system prompt](docs/chatbot_system_prompt.txt) and
[the real failure/fix note](docs/prompt_iteration_note.md).

## Verification

```sh
.venv/bin/pytest backend/tests -q
.venv/bin/ruff check backend
.venv/bin/ruff format --check backend
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
# Browser tests manage a separate backend and isolated DB automatically:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
# Or install Playwright Chromium and omit CHROMIUM_PATH:
npx playwright install chromium
npm run test:e2e
```

On proxy-managed cloud machines, local browser tests may need:
`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy CHROMIUM_PATH=/usr/bin/chromium node node_modules/@playwright/test/cli.js test`.
Only local test traffic needs this; do not disable TLS validation or bypass network
policy for external installation. npm cache can be placed under `/tmp/atelier-npm`
using `--cache` if the machine's default cache is read-only.

Backend tests use temporary SQLite databases (or isolated PostgreSQL databases with
`TEST_POSTGRES_URL`, see docs/validation.md) and cover concurrency, duration overlap,
validation, idempotency, state transitions, persistence through engine replacement,
filters, invoices, grounding, multilingual queries, injection and mocked provider
success/failure. Browser tests cover booking → refresh-safe owner management →
rescheduling → invoice print → cancellation → chat at desktop/mobile widths.
See [validation results](docs/validation.md) for exactly what was executed.

## Deployment and submission

Follow [docs/deployment.md](docs/deployment.md) for Render + Neon free-tier setup,
or container hosting with a persistent database. **Never use Render's ephemeral
SQLite filesystem for authoritative production bookings.** The blueprint requires
an external PostgreSQL connection. No live deployment or live provider verification
has been performed in this workspace. Source is published on `main` at https://github.com/vamsimukesh7/Mini-Salon-Booking-System; evaluator access still needs checking.

Use [docs/recording_script.md](docs/recording_script.md) to record your own mandatory
2–3 minute walkthrough. [docs/submission.md](docs/submission.md) lists remaining
manual steps and a submission template. A deployed live URL and candidate video
are mandatory PDF deliverables and remain outstanding until actually created.
