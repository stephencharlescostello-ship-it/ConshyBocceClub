import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3001);
export const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: BASE, trace: "retain-on-failure", screenshot: "only-on-failure", permissions: ["notifications"] },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"], browserName: "chromium", permissions: ["notifications"] } },
    { name: "pixel", use: { ...devices["Pixel 7"], browserName: "chromium", permissions: ["notifications"] } },
  ],
  webServer: process.env.E2E_NO_SERVER ? undefined : { command: "npm run dev", url: BASE, reuseExistingServer: true, timeout: 120_000 },
});
