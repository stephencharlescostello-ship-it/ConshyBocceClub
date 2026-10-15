import { test, expect } from "@playwright/test";
import { sql, signIn } from "./helpers";

test.describe("sign in and join a team", () => {
  test("magic-link email flow shows the code step and dev login lands on onboarding", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByLabel("6-digit code")).toBeVisible();
  });
  test("a new player joins a team with the join code", async ({ page }) => {
    const email = `joiner-${Date.now()}@example.com`;
    await signIn(page, email, "/onboarding");
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
    await page.getByRole("link", { name: "Join my team" }).click();
    const [{ join_code, name }] = await sql<{ join_code: string; name: string }>(`select s.join_code, t.name from team_secrets s join teams t on t.id = s.team_id where t.season_id = (select id from seasons where status='active') limit 1`);
    await page.getByLabel("Team join code").fill(join_code);
    await page.getByRole("button", { name: "Join team" }).click();
    await expect(page).toHaveURL(/\/teams\//);
    await expect(page.getByText("You're on the team")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await sql(`delete from team_memberships where player_id = (select id from players where email=$1)`, [email]);
  });
});
