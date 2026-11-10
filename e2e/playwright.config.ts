import { defineConfig } from "@playwright/test";

if (process.env.E2E_LIVE === "1") {
  const missing = ["E2E_BASE_URL", "E2E_TENANT_ID", "E2E_LEAD_EMAIL", "E2E_LEAD_PASSWORD", "E2E_STAFF_EMAIL", "E2E_STAFF_PASSWORD"].filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Fehlende Live-Test-Konfiguration: ${missing.join(", ")}`);
}

export default defineConfig({
  testDir: ".", timeout: 180_000, expect: { timeout: 20_000 }, workers: 1, retries: 0,
  outputDir: "../work/e2e-results",
  reporter: [["list"], ["html", { outputFolder: "../work/e2e-report", open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173",
    browserName: "chromium",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
    cwd: "..", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI, timeout: 60_000,
  },
  projects: [
    { name: "knowledge", testMatch: "knowledge.spec.ts", use: { trace: "off", video: "off" } },
    { name: "admin-mocked", testMatch: "admin-mocked.spec.ts", use: { trace: "off", video: "off" } },
    { name: "public", testMatch: "public.spec.ts", use: { trace: "retain-on-failure" } },
    // Keine Traces/Session-Dateien mit Anmeldung oder JWTs als CI-Artefakte speichern.
    { name: "live", testMatch: "selftest-live.spec.ts", use: { trace: "off", video: "off" } },
  ],
});
