import { defineConfig, devices } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3001";

/** Shoots every screen in dark and light at iPhone and Pixel sizes into ./screenshots. */
export default defineConfig({
  testDir: "tests/screens",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: BASE },
  projects: [
    { name: "iphone-dark", use: { ...devices["iPhone 15"], browserName: "chromium", colorScheme: "dark" } },
    { name: "iphone-light", use: { ...devices["iPhone 15"], browserName: "chromium", colorScheme: "light" } },
    { name: "pixel-dark", use: { ...devices["Pixel 7"], browserName: "chromium", colorScheme: "dark" } },
    { name: "pixel-light", use: { ...devices["Pixel 7"], browserName: "chromium", colorScheme: "light" } },
  ],
  webServer: process.env.E2E_NO_SERVER ? undefined : { command: "npm run dev", url: BASE, reuseExistingServer: true, timeout: 120_000 },
});
