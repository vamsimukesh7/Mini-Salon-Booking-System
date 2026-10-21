# Final submission checklist

Local source and documentation are prepared. Do not submit this as complete before
filling the external deliverables below. The authoritative page-by-page audit is
[requirements.md](requirements.md).

- [x] Customer booking with actual availability and clear saved confirmation.
- [x] Duration-aware conflict protection and concurrent-request tests.
- [x] Owner dashboard, chronological day view, filters and status transitions.
- [x] Owner reschedule/cancel workflow and released availability.
- [x] Persistent services/bookings and exact idempotent sample data.
- [x] Billing with multiple services, backend totals and printable PDF-capable view.
- [x] Real-provider integration implemented; grounded and labelled fallback tested.
- [x] Separate chatbot prompt and genuine measured iteration note.
- [x] Setup/API/architecture/testing/deployment documentation and .env examples.
- [x] Local SQLite/PostgreSQL, browser workflows, build/type/lint checks passed.
- [ ] Set a real LLM key securely and verify live multilingual/injection tests.
- [ ] Commit and push reviewed source to the target GitHub repository.
- [ ] Make the repository public or grant evaluator access through GitHub settings.
- [ ] Deploy Render + Neon, test hosted persistence/concurrency and record live URL.
- [ ] Share read-only hosted database inspection access securely if required.
- [ ] Record/upload the candidate's own mandatory 2–3 minute video.
- [ ] Replace all placeholders in the submission message below; verify each link.

## GitHub publication instructions

The known target is `https://github.com/vamsimukesh7/Mini-Salon-Booking-System`.
It was empty when inspected. Code is currently local and uncommitted; the URL does
not yet establish that this implementation can be cloned. Review `git status` and
ignored secrets before committing. Publish your reviewed initial commit to `main`
using your authorized GitHub workflow. If private, open repository Settings →
Collaborators and invite the evaluator's supplied identity. No evaluator address
was provided, and no invitations or submission messages have been sent.

## Submission message template — not sent

Hello GURU AI Technologies team,

My Mini Salon Booking & Billing System submission is available here:

- Repository: https://github.com/vamsimukesh7/Mini-Salon-Booking-System
  [Verify the code is pushed and reviewer access works before sending.]
- Live application: [ADD ACTUAL VERIFIED HTTPS URL]
- Candidate walkthrough (2–3 minutes): [ADD ACTUAL VIDEO URL]
- Chatbot prompt: `docs/chatbot_system_prompt.txt`
- Prompt design / tested failure and fix: `docs/prompt_iteration_note.md`

The app includes database-backed availability, duration-aware conflict protection,
rescheduling/cancellation, an owner day view, status management and printable
itemised invoices. Local backend tests passed on SQLite and PostgreSQL, and browser
flows passed at desktop/mobile widths. [Describe actual live LLM verification only
after it has been performed.]

The free backend may sleep while idle; its first request can take 20–50 seconds to
wake. [ADD SECURE READ-ONLY DATABASE REVIEW ACCESS INSTRUCTIONS IF HOSTED.]

Thank you.
