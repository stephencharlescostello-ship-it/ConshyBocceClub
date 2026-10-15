/**
 * League Bot copy. Template based with deliberate variety; no external AI calls.
 * `rng` lets tests be deterministic.
 */
export type BotContext = {
  winner: string;
  loser: string;
  winnerGames: number;
  loserGames: number;
  winnerPoints: number;
  loserPoints: number;
  night: string;
  week: number;
  upset?: boolean; // loser was ranked higher
  streak?: number; // winner's current match win streak
  sweep?: boolean;
  shutoutGame?: boolean;
  hangers?: number;
  forfeit?: boolean;
};

const FINAL = [
  "{winner} take down {loser} {wg}–{lg} on {night}. {pts}",
  "Final from {night}: {winner} {wg}, {loser} {lg}. {pts}",
  "{winner} get it done against {loser}, {wg}–{lg}. {pts}",
  "Books closed: {winner} over {loser} {wg}–{lg} in Week {week}. {pts}",
  "{loser} ran into {winner} tonight and it ended {wg}–{lg}. {pts}",
  "Chalk it up — {winner} beat {loser} {wg}–{lg}. {pts}",
];
const PTS = ["Points {wp}–{lp}.", "{wp} to {lp} on the night.", "Total points: {wp}–{lp}.", "Score it {wp}–{lp} overall."];
const SWEEP = ["Straight games. Brutal.", "A clean sweep — nobody saw game three.", "Two and done. Efficient.", "Sweep! Someone owes someone a round."];
const SHUTOUT = ["There was a shutout game in there. Oof.", "Includes a goose egg. We're not naming names.", "A zero was posted. Moment of silence."];
const UPSET = ["UPSET ALERT 🚨 {winner} knocked off a higher seed.", "Bracket busters: {winner} just flipped {night}.", "Hold on — {loser} were supposed to win that one."];
const STREAK = ["{winner} have now won {streak} straight. Who's stopping them?", "Make it {streak} in a row for {winner}.", "{streak}-match win streak for {winner}. Heater."];
const HANGERS = ["{hangers} hangers tonight. The board was slippery.", "Hanger count: {hangers}. Show-offs.", "{hangers} hangers in one match. Save some for the rest of us."];
const FORFEIT = ["{loser} couldn't field a team — {winner} take the forfeit win.", "Forfeit on {night}: {winner} win by walkover over {loser}.", "No-show on {night}. {winner} collect the W."];
const MILESTONE = ["Milestone: {winner} notched win number {n} this season.", "{winner} hit {n} wins. Somebody print a banner."];

export function pick<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
}

function fill(t: string, c: BotContext, extra: Record<string, string | number> = {}) {
  const vars: Record<string, string | number> = {
    winner: c.winner, loser: c.loser, wg: c.winnerGames, lg: c.loserGames, wp: c.winnerPoints, lp: c.loserPoints,
    night: c.night, week: c.week, streak: c.streak ?? 0, hangers: c.hangers ?? 0, ...extra,
  };
  return t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function finalScoreLine(c: BotContext, rng: () => number = Math.random): string {
  if (c.forfeit) return fill(pick(FORFEIT, rng), c);
  const pts = fill(pick(PTS, rng), c);
  let line = fill(pick(FINAL, rng), c, { pts });
  const tags: string[] = [];
  if (c.sweep) tags.push(pick(SWEEP, rng));
  if (c.shutoutGame) tags.push(pick(SHUTOUT, rng));
  if (c.upset) tags.push(fill(pick(UPSET, rng), c));
  if ((c.streak ?? 0) >= 3) tags.push(fill(pick(STREAK, rng), c));
  if ((c.hangers ?? 0) >= 3) tags.push(fill(pick(HANGERS, rng), c));
  if (tags.length) line += " " + tags.join(" ");
  return line;
}

export function milestoneLine(team: string, wins: number, rng: () => number = Math.random): string {
  return fill(pick(MILESTONE, rng), { winner: team } as BotContext, { n: wins });
}

export const BOT_NAME = "League Bot";
