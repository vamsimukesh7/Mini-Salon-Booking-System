# Candidate recording script (target 2:45)

Record this yourself after deployment and practice explaining the code first.
This script is supplied; no candidate video has been recorded.

- **0:00–0:20** Open the verified live URL at mobile width. Explain the salon,
  live database catalogue and displayed duration/rupee price. Mention India time.
- **0:20–0:50** Choose a future date, fill name and 10-digit phone, select a slot,
  submit. Show the saved reference, Pending status, date, price and service.
  Return to booking and show that the overlapping slots disappeared.
- **0:50–1:25** Sign into the owner dashboard without showing the password.
  Choose the booking date, search the name, confirm the booking. Reschedule it,
  show the chronological day view, then demonstrate cancellation on a separate
  appointment and explain that it releases the slot. Refresh to show persistence.
- **1:25–1:50** Open Billing, select an appointment, add a second service,
  verify ₹ totals, generate the invoice, open Print / Save as PDF.
- **1:50–2:20** Ask “What are your opening hours?”, “Haircut ka price kitna hai?”,
  “Mala facial chi price sanga.” and “Can you provide home delivery?”
  Show the mode label. If a key is configured, demonstrate actual AI mode;
  otherwise honestly identify the fallback and the remaining key requirement.
- **2:20–2:45** Explain one tricky part in your own words: conflict checking and
  insertion occur under one SQLite immediate transaction or PostgreSQL advisory
  transaction lock, so two workers cannot reserve overlapping intervals. Explain
  the real partial-total chatbot bug and its regression test. End on the live app.

Before sharing: hide secrets, notifications, customer data and terminal history.
Mention free backend cold starts (often 20–50 seconds). Do not read claims you
cannot explain in the follow-up interview.
