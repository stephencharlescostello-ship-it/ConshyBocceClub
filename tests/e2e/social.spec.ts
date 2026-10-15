import { test, expect } from "@playwright/test";
import { fixture, newSignedInPage, signIn, sql } from "./helpers";

test.describe("chat, events, subs", () => {
  test("a chat message appears in real time in another session and an @mention triggers a push/inbox notification", async ({ browser }) => {
    const f = await fixture();
    const [{ display_name: target }] = await sql<{ display_name: string }>(`select display_name from players where email=$1`, [f.captainAway]);
    const a = await newSignedInPage(browser, f.captainHome, "/chat/league");
    const b = await newSignedInPage(browser, f.captainAway, "/chat/league");
    const text = `Hey @${target} good luck tonight ${Date.now()}`;
    await expect(b.page.getByLabel("Message")).toBeVisible();
    await a.page.waitForTimeout(1500); // let both realtime sockets join
    await expect(async () => {
      await a.page.getByLabel("Message").fill(text);
      await a.page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(a.page.getByText(text)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    await expect(b.page.getByText(text)).toBeVisible({ timeout: 15000 });
    // mention → inbox notification (push is attempted to any subscribed devices)
    const [{ n }] = await sql<{ n: string }>(`select count(*) n from notifications where type='mention' and player_id=(select id from players where email=$1) and body like $2`, [f.captainAway, `%${text}%`]);
    expect(Number(n)).toBe(1);
    await b.page.goto("/notifications");
    await expect(b.page.getByText(/mentioned you/).first()).toBeVisible();
    // reactions
    await b.page.goto("/chat/league");
    const bubble = b.page.locator("div.group", { hasText: text }).last();
    await bubble.getByRole("button", { name: "React" }).click();
    await b.page.getByRole("button", { name: "React 🔥" }).click();
    await expect(bubble.getByRole("button", { name: /🔥 1/ })).toBeVisible({ timeout: 15000 });
    await a.ctx.close(); await b.ctx.close();
  });

  test("RSVP to an event", async ({ page }) => {
    await signIn(page, "commissioner@example.com", "/events");
    await page.getByRole("link", { name: /Halloween/ }).click();
    await expect(async () => {
      await page.getByRole("button", { name: "Going" }).click();
      await expect(page.getByRole("button", { name: "Going" })).toHaveAttribute("aria-pressed", "true", { timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await page.reload();
    await expect(page.getByRole("button", { name: "Going" })).toHaveAttribute("aria-pressed", "true");
  });

  test("a sub request gets claimed and confirmed", async ({ browser }) => {
    const f = await fixture();
    const captain = await newSignedInPage(browser, f.captainHome, "/subs");
    await expect(async () => {
      await captain.page.getByRole("button", { name: "Post a sub request" }).click();
      await expect(captain.page.getByLabel("When")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await captain.page.getByLabel("When").fill("2030-01-01T19:00");
    await captain.page.getByLabel("Note").fill("E2E sub needed");
    await captain.page.getByRole("button", { name: /Post & notify/ }).click();
    await expect(captain.page.getByText("E2E sub needed")).toBeVisible();
    const sub = await newSignedInPage(browser, f.captainAway, "/subs");
    const card = sub.page.locator("li", { hasText: "E2E sub needed" });
    await card.getByRole("button", { name: "I can sub" }).click();
    await expect(card.getByText("Claimed", { exact: true })).toBeVisible();
    await captain.page.reload();
    await captain.page.locator("li", { hasText: "E2E sub needed" }).getByRole("button", { name: /Confirm/ }).click();
    await expect(captain.page.locator("li", { hasText: "E2E sub needed" }).getByText("Confirmed")).toBeVisible();
    const [{ status }] = await sql<{ status: string }>(`select status from sub_requests where note='E2E sub needed' order by created_at desc limit 1`);
    expect(status).toBe("confirmed");
    await sql(`delete from team_memberships where role='sub' and team_id=$1 and player_id=(select id from players where email=$2)`, [f.homeTeamId, f.captainAway]);
    await sql(`delete from sub_requests where note='E2E sub needed'`);
    await captain.ctx.close(); await sub.ctx.close();
  });
});
