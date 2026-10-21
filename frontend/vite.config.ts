import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      [
        "/services",
        "/bookings",
        "/availability",
        "/config",
        "/auth",
        "/invoices",
        "/chat",
        "/health",
      ].map((p) => [p, "http://127.0.0.1:8000"]),
    ),
  },
});
