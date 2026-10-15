import { test, expect } from "@playwright/test";
import { fixture, newSignedInPage, resetMatch, signIn, sql } from "./helpers";

test.describe.serial("scoring, confirmation, disputes", () => {
  test("live-score a full match on one device while another watches it update, then confirm → standings", async ({ browser }) => {
    const f = await fixture();
    await resetMatch(f.matchId);
    const scorer = await newSignedInPage(browser, f.captainHome, `/matches/${f.matchId}/score`);
    const watcher = await newSignedInPage(browser, f.playerHome, `/matches/${f.matchId}`);
    const s = scorer.page;
    await expect(s.getByRole("button", { name: `${f.homeName} plus 3` })).toBeVisible();
    // game 1: home 15 (3+3+3, 3+3), game 2: away 15 (4+4+4+3), game 3: home 15 (4+4+4+4=16)
    const home = (n: number) => s.getByRole("button", { name: `${f.homeName} plus ${n}` });
    const away = (n: number) => s.getByRole("button", { name: `${f.awayName} plus ${n}` });
    const next = () => s.getByRole("button", { name: /next frame/i }).click();
    await home(3).click(); await home(3).click(); await home(3).click(); await next();
    await home(3).click(); await home(3).click(); await next();
    await expect(s.getByText(/Game 1 to/)).toBeVisible();
    // the watcher sees game 1 scored 15
    await expect(watcher.page.locator("text=Games 1").first()).toBeVisible({ timeout: 15000 });
    await s.getByRole("button", { name: `${f.awayName} hanger, 4 points` }).click({ clickCount: 3 });
    await away(3).click(); await next();
    await expect(s.getByText(/Game 2 to/)).toBeVisible();
    const hang = s.getByRole("button", { name: `${f.homeName} hanger, 4 points` });
    await hang.click(); await hang.click(); await hang.click(); await hang.click(); await next();
    await expect(s.getByText(`${f.homeName} win 2–1`)).toBeVisible();
    await s.getByRole("button", { name: "Submit result" }).click();
    await expect(s).toHaveURL(new RegExp(`/matches/${f.matchId}$`));
    await expect(s.getByText(/waiting for the opposing captain/i)).toBeVisible();
    const [m] = await sql<{ status: string; home_games: number; away_games: number; home_points: number }>(`select status, home_games, away_games, home_points from matches where id=$1`, [f.matchId]);
    expect(m.status).toBe("submitted");
    expect(m.home_games).toBe(2);
    expect(m.away_games).toBe(1);
    expect(m.home_points).toBe(31);
    // the opposing captain got a notification and confirms
    const opp = await newSignedInPage(browser, f.captainAway, "/notifications");
    await expect(opp.page.getByText("Confirm your match result").first()).toBeVisible();
    await opp.page.goto(`/matches/${f.matchId}/confirm`);
    await opp.page.getByRole("button", { name: "Confirm result" }).click();
    await expect(opp.page).toHaveURL(new RegExp(`/matches/${f.matchId}$`));
    const [after] = await sql<{ status: string }>(`select status from matches where id=$1`, [f.matchId]);
    expect(after.status).toBe("confirmed");
    // standings reflect the win (team record includes this match)
    const [{ wins }] = await sql<{ wins: number }>(`select wins from team_records where team_id=$1`, [f.homeTeamId]);
    const [{ n }] = await sql<{ n: string }>(`select count(*) n from matches where winner_team_id=$1 and status in ('confirmed','forfeit') and playoff_round is null`, [f.homeTeamId]);
    expect(wins).toBe(Number(n));
    await opp.page.goto(`/standings?night=${f.nightSlug}`);
    await expect(opp.page.getByRole("table")).toContainText(f.homeName);
    // bot posted the final
    const [{ n: bot }] = await sql<{ n: string }>(`select count(*) n from messages where is_bot and channel_id=(select id from channels where match_id=$1)`, [f.matchId]);
    expect(Number(bot)).toBe(1);
    await scorer.ctx.close(); await watcher.ctx.close(); await opp.ctx.close();
    await resetMatch(f.matchId);
  });

  test("a dispute is filed and an admin resolves it", async ({ browser }) => {
    const f = await fixture();
    await resetMatch(f.matchId);
    const cap = await newSignedInPage(browser, f.captainHome, `/matches/${f.matchId}/quick`);
    const p = cap.page;
    await expect(p.getByRole("heading", { name: "Quick entry" })).toBeVisible();
    // game 1 default is 15-0; add game 2 15-0
    await p.getByRole("button", { name: "+ Add game" }).click();
    await p.getByRole("button", { name: "Submit result" }).click();
    await expect(p).toHaveURL(new RegExp(`/matches/${f.matchId}$`));
    const opp = await newSignedInPage(browser, f.captainAway, `/matches/${f.matchId}/confirm`);
    await expect(opp.page.getByRole("button", { name: "Confirm result" })).toBeVisible();
    await expect(async () => {
      await opp.page.getByRole("button", { name: /Something's wrong/ }).click();
      await expect(opp.page.getByRole("button", { name: "File dispute" })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await opp.page.getByLabel("Note (optional)").fill("Game 2 was 15-11, not 15-0");
    await opp.page.getByRole("button", { name: "File dispute" }).click();
    await expect(opp.page.getByText(/disputed and waiting for the commissioner/i)).toBeVisible();
    const admin = await newSignedInPage(browser, f.adminEmail, "/admin/results?tab=disputes");
    await expect(admin.page.getByText("Game 2 was 15-11")).toBeVisible();
    await admin.page.getByRole("link", { name: new RegExp(f.homeName) }).first().click();
    await admin.page.getByLabel(`Game 2 ${f.awayName}`).fill("11");
    await admin.page.getByRole("button", { name: "Correct to scores below" }).click();
    await expect(admin.page.getByText("Resolved").first()).toBeVisible();
    const [m] = await sql<{ status: string; away_points: number }>(`select status, away_points from matches where id=$1`, [f.matchId]);
    expect(m.status).toBe("confirmed");
    expect(m.away_points).toBe(11);
    await cap.ctx.close(); await opp.ctx.close(); await admin.ctx.close();
    await resetMatch(f.matchId);
  });

  test("admin generates a season schedule (preview) and the generator is balanced", async ({ page }) => {
    await signIn(page, "commissioner@example.com", "/admin/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(async () => {
      // the seeded season already has a schedule, so preview the regenerated one
      await page.getByLabel("Replace existing unplayed matches").check();
      await page.getByRole("button", { name: "Preview" }).click();
      await expect(page.getByText(/matches over 10 weeks/).first()).toBeVisible({ timeout: 8000 });
    }).toPass({ timeout: 60000 });
    await expect(page.getByText(/double-booked 0/).first()).toBeVisible();
    await expect(page.getByText(/meetings per pair 2/).first()).toBeVisible();
  });
});
