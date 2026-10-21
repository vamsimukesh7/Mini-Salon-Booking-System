import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const testDatabase = join(
  mkdtempSync(join(tmpdir(), "atelier-e2e-")),
  "salon.db",
);
export default defineConfig({
  testDir: "./frontend/tests",
  workers: 1,
  timeout: 45000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:8001",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: `cd backend && DATABASE_URL=sqlite:///${testDatabase} ADMIN_PASSWORD=e2e-owner-password ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001`,
    url: "http://127.0.0.1:8001/health",
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
