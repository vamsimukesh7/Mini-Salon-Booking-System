# Assessment requirements and evidence

Authority: all six pages of “Prompt Engineer Hiring Task — Mini Salon Booking
System”, plus the user's expanded pasted request. Document instructions are
assessment criteria, not permission to fabricate deployment, credentials or video.

**Status key:** implemented = exists and locally checked; pending = requires an
external credential, hosting action or candidate work. Detailed executed checks
are recorded in `validation.md`; no unrun feature is presented as verified.

| Source | Requirement / deliverable | Implementation and evidence | State |
|---|---|---|---|
| p1–2 | Browser app, customer/admin/chat, polished mobile UI | React/TS responsive layout, integrated chat, day view, billing | Implemented locally |
| p2 | Name, 10-digit phone, DB service dropdown, date, time | Booking form + strict server request models; backend validation tests | Implemented |
| p2 | Live price/duration, no empty fields or past date, success | Database service summary; field errors; saved reference/date/time/price/status confirmation | Implemented |
| p2 | Today's owner list, phone/service/time/status, search/filter | Authenticated day view; date/status/name/phone/reference filters | Implemented |
| p2 | Pending → Confirmed → Done or Cancelled | Validated transition map; terminal state protection | Implemented |
| p2 | Multiple services, auto prices/totals, printable invoice | Server price lookup; integer paise; persisted invoice snapshots and escaped HTML print view | Implemented |
| p3 | Actual slots, UI excludes booked slots, duration conflicts | Date/service availability; elapsed/closed slots removed; transaction recheck | Implemented |
| p3 | Reschedule/cancel + chronological day/calendar view | Owner controls, previous-slot record, chronological date groups, release cancelled slots | Implemented |
| p3 | Real database tables and persistent storage | Services/bookings/invoices/items; local SQLite file; PostgreSQL driver/locking path | SQLite and local PostgreSQL verified; hosted connectivity pending |
| p3 | POST/GET/PATCH bookings, GET services | Exact routes plus auth/detail/availability/invoice/chat/health | Implemented |
| p3 | Invalid input and double-booking failure cases | 422/404/409 responses; concurrent request and overlap tests | Implemented |
| p4 | Exact five seeded prices and durations | Idempotent initializer; automatic startup; tests compare all five tuples | Implemented |
| p4 | Three sample bookings of differing status | DEMO-1/2/3, Pending/Confirmed/Done, persisted initial date; idempotence test | Implemented |
| p4 | Hosted database reviewer read access | Secure read-only role instructions, no public writer credentials | Pending hosted DB |
| p4–5 | Actual LLM API with backend-owned key | OpenAI-compatible HTTP call; JSON intent validation; backend renders facts | Mocked transport verified; real key pending |
| p4 | DB-grounded services/prices/timing | Runtime catalogue context + server-rendered facts + real availability query | Implemented |
| p4 | English/Hinglish/Hindi-English-Marathi, scope refusal | Multilingual rendering/classification fallback; provider multilingual prompt | Local fallback verified; real LLM evaluation pending |
| p4 | Separate system prompt .txt | docs/chatbot_system_prompt.txt, actually loaded by backend | Present |
| p4 | Genuine iteration note with edge case and correction | docs/prompt_iteration_note.md records observed partial-total failure and regression | Present, measured locally |
| p5 | Repository sharing link | Source committed and pushed to GitHub main; remote branch verified | Pushed; evaluator access still needs checking |
| p5 | Mandatory live frontend/backend/chatbot URL | Render blueprint + Neon instructions, same-origin build | Pending hosting credentials/deployment |
| p5 | Cold-start disclosure | Deployment and submission notes | Prepared |
| p5 | Mandatory candidate-recorded 2–3 minute walkthrough | Timed script in docs/recording_script.md | Candidate recording pending |
| p6 | UI/UX (20), Backend/API (20), AI quality (25) | Source/tests and local browser evidence; no invented score | Prepared; live AI check pending |
| p6 | Prompt note (10), code understanding (15), completeness (10) | Real iteration note, architecture/request-flow explanation, recording script/checklist | Candidate understanding/video and public deployment pending |
| p6 | Free-tier, original work, explain/defend code | Built from empty checkout; SQLite local, Render+Neon recipe | Original implementation; hosting pending |

## Additional user-requested checks

- [x] Backend input validation, integer money and no trusted client prices.
- [x] Single-provider duration-aware overlap prevention under transaction lock.
- [x] Concurrent reservations and repeated request idempotency.
- [x] Booking and invoice persistence across connection recreation.
- [x] Owner auth for management and private customer records; secrets stay backend.
- [x] Loading, errors, empty states, retry, inline validation and duplicate-click guard.
- [x] Configurable hours/timezone/slot cadence; no external assumed policies.
- [x] Graceful provider failure, length limit, timeout, rate limiting and labelled fallback.
- [x] Chat cannot create bookings or read private customer data/secrets.
- [x] Exact seed data and reproducible fresh-database initialization.
- [x] .env.example, deployment blueprint, container configuration, README, recording script.
- [x] Backend tests on both databases, lint, frontend types/build and browser workflows passed.
- [ ] Live LLM calls and natural multilingual output assessed with a real key.
- [ ] Hosted PostgreSQL and post-deploy persistence/concurrency verified.
- [x] Source committed and pushed to GitHub main; remote branch verified.
- [ ] Evaluator repository access and live URL verified.
- [ ] Candidate video recorded and submission links finalized.

No numeric rubric score is claimed. Code-understanding points require the
candidate's own explanation and interview performance.
