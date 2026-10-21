# Prompt design and a measured correction

The system prompt treats the model as an intent interpreter rather than an authority
on prices or bookings. Each request includes the current database catalogue, salon
hours and local date. The model returns a constrained JSON classification. The
server validates its topic, language and service IDs, retrieves actual availability,
and renders the factual response. This keeps model-generated prose from inventing
prices, policies or booking confirmations. It also means prompt injection cannot
give the model database-write privileges. No booking tools or secrets are exposed.
The prompt explicitly supports English, Hinglish and Marathi mixed with English;
responses use the requested language with service names preserved.

A real failure occurred in the first automated run of
`test_chat_unknown_combination_regression`: with no provider key configured,
“Haircut aur manicure ka total kitna hai?” returned
“Haircut: ₹200 · 30 min / Kul: ₹200 / Booking form mein service chunein.”
This was a misleading partial total: manicure is not in the service catalogue.
The initial fallback matched a known service and ignored the unknown one.

The fix was **application-level**, not a claimed improvement to a live model:
combined requests with unrecognized vocabulary are now routed to the missing-information response
before the fallback totals known services, and this guard also precedes model calls.
The same regression now passes and says that the information is unavailable,
without quoting ₹200 as a combined total. The prompt separately instructs the
model to classify unknown services as unknown, never inventing catalogue entries.
The guard removes the current database service names and checks the remaining
combination vocabulary conservatively; a follow-up test covers an unknown eyebrow
tint and adding Manicure to the database, which then correctly totals ₹550. It does
not maintain a hardcoded supported-service list. The fallback remains limited to
recognizable names/phrases and asks for clarification for unfamiliar wording.

The full local backend suite also covers current-price changes, combined known
services (Hair Spa + Facial = ₹1,300), Hinglish durations, Marathi pricing,
real availability before/after booking, ambiguous times, home delivery, secret
requests, and provider success/failure through HTTP transport mocks. Browser tests
exercise the widget. No live LLM quality claim is made: no provider key was present.
Live multilingual/adversarial evaluation remains required after configuration.
