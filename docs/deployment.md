# Free-tier deployment: one Render service + Neon PostgreSQL

This configuration is prepared, not deployed. Hosting and provider accounts are not
connected to this workspace. Check current provider free-tier limits before use.

1. Review the source/tests. Create the first commit locally, then push to
   `https://github.com/vamsimukesh7/Mini-Salon-Booking-System` on `main` with your
   normal authorized Git workflow. Share the repository publicly or grant reviewer
   access privately. The workspace does not claim to have pushed this code.
2. Create a Neon free PostgreSQL project. Copy its pooled connection URL securely;
   retain `sslmode=require`. Never paste the connection string into an issue, chat,
   README or commit. The SQLAlchemy layer supports `postgresql://` or
   `postgresql+psycopg://`; Render will hold it as `DATABASE_URL`.
3. In Render, create a Blueprint from the GitHub repository using `render.yaml`.
   Choose the free web-service plan. This serves React and API from one origin.
4. Configure `DATABASE_URL` from Neon, a long random `ADMIN_PASSWORD`, and your
   `LLM_API_KEY` in Render's secure environment-variable UI. The model must be
   accessible under your provider account. Set `LLM_MODEL` or `LLM_BASE_URL` only
   when needed. API keys stay on the server. Never store a service-role key in Vite.
5. Build installs pinned Python dependencies, runs `npm ci`, and builds React.
   Start runs Uvicorn from `backend/` with the host-assigned `$PORT`. Startup creates
   fresh tables and idempotent seeds. A single worker avoids concurrent schema
   initialization; booking mutation locking also supports multiple runtime workers.
6. Verify the assigned HTTPS URL: `/health` returns `{"status":"ok"}`; `/services`
   contains five exact seeded rows. Open the homepage and test the complete workflow
   in the recording script. Check LLM answers are labelled **Live database assistant**,
   not fallback. Check the provider dashboard confirms a real successful request.
7. Restart/redeploy the Render service, then confirm an appointment and invoice
   remain. Test two simultaneous overlap attempts against PostgreSQL and confirm
   one succeeds and one returns 409. SQLite and local PostgreSQL concurrency are verified;
   this hosted PostgreSQL check remains required before claiming deployment readiness.
8. Restrict Neon access appropriately and share reviewer **read-only** database
   access securely if requested by the assessment. Create a dedicated read-only
   role through the provider; never publish your application writer connection URL.
9. Record the actual deployed URL and first-request cold-start warning (free
   backends may sleep and take roughly 20–50 seconds to wake) in the submission.

## Separate frontend (optional)

Vercel/Netlify can build `frontend/` using `npm ci && npm run build` and publish
`dist`. Set frontend **build-time** `VITE_API_URL=https://your-backend-host` without
a trailing slash. Configure backend `CORS_ORIGINS=https://your-frontend-host` with
the exact scheme/host, and redeploy both. Current UI navigation uses state, not
nested paths, so no deep-route rewrite is required. Never add secrets to frontend
variables. One-origin Render deployment is simpler and is the supplied default.

## Container / SQLite alternative

Build `docker build -t atelier .` (BuildKit enabled; standard on recent Docker). The image runs as a non-root numeric user. Run with server variables and PostgreSQL for
free/ephemeral compute hosts. If using SQLite on a host with a **durable volume**,
mount a private writable volume at `/app/backend/data` and use
`DATABASE_URL=sqlite:///./data/salon.db`. Maintain backups; containers without a
volume lose the database when replaced. A durable host/volume may cost money;
it is not required by the free Render + Neon recipe. Hosted PostgreSQL connectivity has not been run here; see validation.md for local checks.

No payment gateway, tax compliance or production high-availability claim is made.


For HTTPS-intercepting corporate/cloud proxies, provide the trusted CA only during
build: `docker build --secret id=build_ca,src=/path/to/trusted-ca.pem --build-arg HTTP_PROXY --build-arg HTTPS_PROXY -t atelier .`.
The build secret is not copied into the final image. If a proxy hostname only exists
in the task machine's host mappings, supply an equivalent `--add-host hostname:IP`
to the build. Do not disable TLS/certificate verification. Runtime provider calls
still need the host platform's supported HTTPS proxy and trusted CA configuration.
