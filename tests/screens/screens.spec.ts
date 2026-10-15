import { test } from "@playwright/test";
import fs from "node:fs";
import { signIn, fixture } from "../e2e/helpers";

const PUBLIC = ["/", "/standings", "/standings/power", "/schedule", "/schedule?view=results", "/events", "/rules", "/history", "/playoffs", "/stats", "/install", "/quickstart", "/sign-in"];
const SIGNED = ["/", "/chat", "/chat/league", "/notifications", "/profile", "/settings", "/subs", "/join", "/onboarding", "/more"];
const ADMIN = ["/admin", "/admin/seasons", "/admin/teams", "/admin/schedule", "/admin/results", "/admin/import", "/admin/posters", "/admin/moderation", "/admin/dues"];

test("shoot every screen", async ({ page }, info) => {
  const dir = `screenshots/${info.project.name}`;
  fs.mkdirSync(dir, { recursive: true });
  const theme = info.project.name.endsWith("light") ? "light" : "dark";
  await page.context().addCookies([{ name: "theme", value: theme, url: info.project.use.baseURL ?? "http://localhost:3001" }]);
  const shoot = async (path: string, name: string) => {
    await page.goto(path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  };
  for (const p of PUBLIC) await shoot(p, "public" + p.replace(/[/?=]/g, "_"));
  const f = await fixture();
  await shoot(`/matches/${f.matchId}`, "public_match");
  await shoot(`/teams/${f.homeTeamId}`, "public_team");
  await signIn(page, f.captainHome, "/");
  for (const p of SIGNED) await shoot(p, "player" + p.replace(/[/?=]/g, "_"));
  await shoot(`/matches/${f.matchId}/score`, "player_scorekeeper");
  await shoot(`/matches/${f.matchId}/quick`, "player_quick_entry");
  await signIn(page, "commissioner@example.com", "/admin");
  for (const p of ADMIN) await shoot(p, "admin" + p.replace(/[/?=]/g, "_"));
});
