import { describe, it, expect, beforeAll } from "vitest";
import { anon, asUser, fixture, sql, type Fixture } from "./helpers";

let f: Fixture;
beforeAll(async () => {
  f = await fixture();
});

describe("RLS: public reads", () => {
  it("anon can read standings-related tables but not private player columns", async () => {
    const a = anon();
    expect((await a.from("matches").select("id").limit(1)).data?.length).toBe(1);
    expect((await a.from("teams").select("id").limit(1)).data?.length).toBe(1);
    expect((await a.from("player_profiles").select("display_name").limit(1)).data?.length).toBe(1);
    const direct = await a.from("players").select("email").limit(1);
    expect(direct.error ?? direct.data?.length).toBeTruthy(); // either an error (no grant) or nothing
    expect(direct.data?.length ?? 0).toBe(0);
  });
  it("anon cannot read chat, notifications, dues or join codes", async () => {
    const a = anon();
    expect((await a.from("messages").select("id").limit(1)).data?.length ?? 0).toBe(0);
    expect((await a.from("team_secrets").select("join_code").limit(1)).data?.length ?? 0).toBe(0);
    expect((await a.from("dues").select("id").limit(1)).data?.length ?? 0).toBe(0);
    expect((await a.from("notifications").select("id").limit(1)).data?.length ?? 0).toBe(0);
  });
  it("anon cannot call write RPCs", async () => {
    const a = anon();
    const { error } = await a.rpc("start_match", { p_match: f.matchAB });
    expect(error).toBeTruthy();
  });
});

describe("RLS: players", () => {
  it("a player can read their own email but not another player's", async () => {
    const me = await asUser(f.playerA);
    const { data: mine } = await me.from("players").select("id, email").not("email", "is", null);
    expect(mine?.length).toBe(1);
    expect(mine?.[0].email).toBe(f.playerA);
    const { data: others } = await me.from("players").select("email").neq("email", f.playerA);
    expect(others?.length ?? 0).toBe(0);
    // the public view never exposes email/phone columns at all
    const { data: prof } = await me.from("player_profiles").select("*").limit(1);
    expect(Object.keys(prof?.[0] ?? {})).not.toContain("email");
  });
  it("a player cannot grant themselves admin", async () => {
    const me = await asUser(f.playerA);
    const { data: p } = await me.from("players").select("id").eq("email", f.playerA).single();
    const { error } = await me.from("players").update({ is_admin: true }).eq("id", p!.id);
    expect(error).toBeTruthy();
    const [{ is_admin }] = await sql<{ is_admin: boolean }>(`select is_admin from players where email = $1`, [f.playerA]);
    expect(is_admin).toBe(false);
  });
  it("a member sees their own team's join code but not another team's", async () => {
    const me = await asUser(f.captainA);
    const { data } = await me.from("team_secrets").select("team_id");
    expect(data?.map((r) => r.team_id)).toContain(f.teamA);
    expect(data?.map((r) => r.team_id)).not.toContain(f.teamC);
  });
});

describe("RLS: scoring", () => {
  it("a captain of another team cannot score this match", async () => {
    const c = await asUser(f.captainC);
    const { error } = await c.rpc("start_match", { p_match: f.matchAB });
    expect(error?.message).toMatch(/captain|scorekeeper|admin/i);
  });
  it("a non-captain player cannot submit or score", async () => {
    const p = await asUser(f.playerA);
    const { error } = await p.rpc("submit_match_result", { p_match: f.matchAB, p_games: [{ home: 15, away: 3 }, { home: 15, away: 2 }] as never, p_entry_mode: "quick", p_idempotency_key: `t-${Date.now()}` });
    expect(error).toBeTruthy();
  });
  it("a captain can score, the DB rejects impossible scores, and the opposing captain confirms", async () => {
    const capA = await asUser(f.captainA);
    const bad = await capA.rpc("submit_match_result", { p_match: f.matchAB, p_games: [{ home: 16, away: 3 }, { home: 15, away: 2 }] as never, p_entry_mode: "quick", p_idempotency_key: `bad-${Date.now()}` });
    expect(bad.error?.message).toMatch(/exactly 15/);
    const key = `ok-${Date.now()}`;
    const ok = await capA.rpc("submit_match_result", { p_match: f.matchAB, p_games: [{ home: 15, away: 3 }, { home: 9, away: 15 }, { home: 15, away: 14 }] as never, p_entry_mode: "quick", p_idempotency_key: key });
    expect(ok.error).toBeNull();
    // idempotent retry does not error or duplicate
    const again = await capA.rpc("submit_match_result", { p_match: f.matchAB, p_games: [{ home: 15, away: 3 }] as never, p_entry_mode: "quick", p_idempotency_key: key });
    expect(again.error).toBeNull();
    const [{ n }] = await sql<{ n: string }>(`select count(*) n from score_submissions where match_id = $1`, [f.matchAB]);
    expect(Number(n)).toBe(1);
    // submitting captain cannot confirm their own submission
    const self = await capA.rpc("confirm_match", { p_match: f.matchAB });
    expect(self.error).toBeTruthy();
    // random player cannot confirm
    const other = await asUser(f.captainC);
    expect((await other.rpc("confirm_match", { p_match: f.matchAB })).error).toBeTruthy();
    // opposing captain confirms
    const capB = await asUser(f.captainB);
    const conf = await capB.rpc("confirm_match", { p_match: f.matchAB, p_note: "gg" });
    expect(conf.error).toBeNull();
    const [m] = await sql<{ status: string; home_games: number; away_games: number; version: number }>(`select status, home_games, away_games, version from matches where id = $1`, [f.matchAB]);
    expect(m.status).toBe("confirmed");
    expect(m.home_games).toBe(2);
    expect(m.away_games).toBe(1);
    // audit trail recorded the change
    const [{ n: audits }] = await sql<{ n: string }>(`select count(*) n from audit_log where entity_id = $1`, [f.matchAB]);
    expect(Number(audits)).toBeGreaterThan(0);
    // cleanup: admin reset so other tests/seed stay consistent
    await sql(`select public.admin_reset_match($1, 'rls test cleanup')`, [f.matchAB]).catch(() => {});
    await sql(`update matches set status='scheduled', home_games=0, away_games=0, home_points=0, away_points=0, winner_team_id=null, submitted_by=null, submitted_at=null, submitting_team_id=null, confirmed_by=null, confirmed_at=null, auto_confirm_at=null where id=$1`, [f.matchAB]);
    await sql(`delete from games where match_id=$1`, [f.matchAB]);
    await sql(`delete from confirmations where match_id=$1`, [f.matchAB]);
    await sql(`delete from score_submissions where match_id=$1`, [f.matchAB]);
    await sql(`delete from messages where channel_id = (select id from channels where match_id=$1) and is_bot`, [f.matchAB]);
  });
  it("live frames reject impossible values and are idempotent", async () => {
    const capA = await asUser(f.captainA);
    const fid = crypto.randomUUID();
    const bad = await capA.rpc("record_frame", { p_match: f.matchAB, p_game_number: 1, p_frame_id: fid, p_scoring_team: f.teamA, p_points: 40, p_hangers: 0 });
    expect(bad.error?.message).toMatch(/between 0 and 16/);
    const ok = await capA.rpc("record_frame", { p_match: f.matchAB, p_game_number: 1, p_frame_id: fid, p_scoring_team: f.teamA, p_points: 7, p_hangers: 1, p_weights: [3, 4] as never });
    expect(ok.error).toBeNull();
    const dup = await capA.rpc("record_frame", { p_match: f.matchAB, p_game_number: 1, p_frame_id: fid, p_scoring_team: f.teamA, p_points: 7, p_hangers: 1 });
    expect(dup.error).toBeNull();
    const [{ n }] = await sql<{ n: string }>(`select count(*) n from frames f join games g on g.id=f.game_id where g.match_id=$1`, [f.matchAB]);
    expect(Number(n)).toBe(1);
    const undo = await capA.rpc("undo_frame", { p_match: f.matchAB });
    expect(undo.error).toBeNull();
    await sql(`select public.admin_reset_match($1, 'rls test cleanup')`, [f.matchAB]).catch(() => {});
    await sql(`delete from games where match_id=$1`, [f.matchAB]);
    await sql(`update matches set status='scheduled', current_game=1, entry_mode=null where id=$1`, [f.matchAB]);
  });
});

describe("RLS: chat & moderation", () => {
  it("blocked words are rejected, rate limits apply, and players can only delete their own messages", async () => {
    const me = await asUser(f.playerA);
    const [{ id: ch }] = await sql<{ id: string }>(`select id from channels where kind='league' and season_id=$1`, [f.seasonId]);
    const slur = await me.rpc("post_message", { p_channel: ch, p_body: "you absolute f@ggot" });
    expect(slur.error?.message).toMatch(/blocked word/);
    const okMsg = await me.rpc("post_message", { p_channel: ch, p_body: "hell yeah, we sucked tonight" });
    expect(okMsg.error).toBeNull();
    const fast = await me.rpc("post_message", { p_channel: ch, p_body: "again" });
    expect(fast.error?.message).toMatch(/Slow down/);
    const id = (okMsg.data as { id: string }).id;
    const other = await asUser(f.captainC);
    expect((await other.rpc("delete_message", { p_message: id })).error).toBeTruthy();
    expect((await me.rpc("delete_message", { p_message: id })).error).toBeNull();
    await sql(`delete from messages where id=$1`, [id]);
  });
  it("only admins can insert announcements or edit rules", async () => {
    const me = await asUser(f.captainA);
    expect((await me.from("announcements").insert({ title: "x", body: "y" })).error).toBeTruthy();
    expect((await me.from("rules_pages").update({ body_md: "haha" }).eq("slug", "rules")).error ?? "no-op").toBeTruthy();
    const [{ body_md }] = await sql<{ body_md: string }>(`select body_md from rules_pages where slug='rules'`);
    expect(body_md).not.toBe("haha");
  });
  it("notifications are private to the recipient", async () => {
    const me = await asUser(f.playerA);
    const [{ id: pid }] = await sql<{ id: string }>(`select id from players where email=$1`, [f.playerA]);
    const { data } = await me.from("notifications").select("player_id");
    expect((data ?? []).every((n) => n.player_id === pid)).toBe(true);
  });
});
