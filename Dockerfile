FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
# Optional build-only CA supports verified downloads behind an HTTPS proxy.
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.lock.txt /app/backend/requirements.lock.txt
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca; fi; \
    pip install --no-cache-dir -r /app/backend/requirements.lock.txt
COPY --chown=10001:10001 backend /app/backend
COPY --chown=10001:10001 docs /app/docs
COPY --from=frontend --chown=10001:10001 /build/dist /app/frontend/dist
WORKDIR /app/backend
RUN mkdir -p /app/backend/data && chown 10001:10001 /app/backend/data
USER 10001:10001
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
