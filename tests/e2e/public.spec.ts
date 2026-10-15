import { test, expect } from "@playwright/test";

test.describe("public browsing without login", () => {
  test("home, standings, schedule, events, rules are readable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await page.goto("/standings");
    await expect(page.getByRole("heading", { name: "Standings" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("tab", { name: "Mon" }).click();
    await expect(page.getByRole("table")).toContainText("Old Pucks");
    await page.goto("/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: /vs/ }).first()).toBeVisible();
    await page.goto("/events");
    await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
    await page.goto("/rules");
    await expect(page.getByText("Table Shuffleboard Rules")).toBeVisible();
    await page.goto("/history");
    await expect(page.getByText("Spring 2026")).toBeVisible();
  });
  test("protected pages redirect to sign in", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/sign-in/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/sign-in/);
  });
  test("manifest and service worker are served", async ({ request }) => {
    const m = await request.get("/manifest.webmanifest");
    expect(m.ok()).toBeTruthy();
    expect((await m.json()).display).toBe("standalone");
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
    const h = await request.get("/api/health");
    expect([200, 503]).toContain(h.status());
  });
});
