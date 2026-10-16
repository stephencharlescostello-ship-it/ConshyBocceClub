// Builds docs/qr-posters.pdf (from the tables in the local DB) and docs/player-quickstart.pdf.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildPostersPdf } from "../src/lib/pdf/posters";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const docs = path.join(__dirname, "..", "docs");
fs.mkdirSync(docs, { recursive: true });

async function tables() {
  try {
    const c = new Client({ connectionString: DB });
    await c.connect();
    const r = await c.query("select name, qr_token from tables where active order by sort_order");
    await c.end();
    return r.rows as { name: string; qr_token: string }[];
  } catch {
    return [{ name: "Table 1", qr_token: "example-table-1" }, { name: "Table 2", qr_token: "example-table-2" }];
  }
}

async function quickstart() {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  const green = rgb(0.043, 0.122, 0.09), gold = rgb(0.83, 0.655, 0.227), cream = rgb(0.957, 0.937, 0.89), muted = rgb(0.725, 0.784, 0.75);
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: green });
  page.drawText("CBC SHUFFLE — PLAYER QUICKSTART", { x: 48, y: 730, size: 20, font: bold, color: gold });
  page.drawText("Conshohocken Bocce Club shuffleboard league", { x: 48, y: 708, size: 12, font: reg, color: muted });
  const steps: [string, string][] = [
    ["Install the app", `Open ${SITE.replace(/^https?:\/\//, "")} on your phone (or scan a table poster). iPhone: Share > Add to Home Screen. Android: tap Install.`],
    ["Sign in", "Enter the email you registered with and your name. No password, no code. You stay signed in all season."],
    ["Join your team", "Enter the 6-letter join code from your captain, or claim your name from the roster."],
    ["Match night", "Scan the QR poster on your table. Tonight's match opens. Captains (or a designated scorekeeper) tap Keep Score."],
    ["Keep score", "Each frame: tap the points for the side that scored (+1, +2, +3, Hanger = 4) then Next frame. Undo fixes mistakes. Games end at 15; first to 2 games wins. Everyone watching sees it live."],
    ["Quick Entry", "Kept score on the board? Enter the final score of each game instead."],
    ["Submit and confirm", "Submit when the match is over. The other captain confirms (or disputes) in the app. Results auto-confirm after 12 hours and standings update instantly."],
    ["Trash talk", "Every match has a thread and every night has a room. @mention someone to get their attention. Slurs get you muted."],
  ];
  let y = 660;
  steps.forEach(([t, d], i) => {
    page.drawCircle({ x: 62, y: y + 6, size: 12, color: gold });
    page.drawText(String(i + 1), { x: 58, y: y + 1, size: 12, font: bold, color: green });
    page.drawText(t, { x: 84, y, size: 14, font: bold, color: cream });
    // wrap description at ~90 chars
    const words = d.split(" "); let line = ""; let yy = y - 18;
    for (const w of words) { if ((line + " " + w).length > 92) { page.drawText(line, { x: 84, y: yy, size: 10.5, font: reg, color: muted }); yy -= 14; line = w; } else line = line ? line + " " + w : w; }
    page.drawText(line, { x: 84, y: yy, size: 10.5, font: reg, color: muted });
    y = yy - 30;
  });
  page.drawText("Questions? More > Rules, FAQ & contact in the app.", { x: 48, y: 48, size: 10, font: reg, color: muted });
  return pdf.save();
}

(async () => {
  const t = await tables();
  const posters = await buildPostersPdf(t.map((x) => ({ name: x.name, url: `${SITE}/t/${x.qr_token}` })), SITE);
  fs.writeFileSync(path.join(docs, "qr-posters.pdf"), posters);
  fs.writeFileSync(path.join(docs, "player-quickstart.pdf"), await quickstart());
  fs.mkdirSync(path.join(docs, "templates"), { recursive: true });
  for (const f of fs.readdirSync(path.join(__dirname, "..", "public", "templates"))) fs.copyFileSync(path.join(__dirname, "..", "public", "templates", f), path.join(docs, "templates", f));
  fs.mkdirSync(path.join(__dirname, "..", "public", "docs"), { recursive: true });
  fs.copyFileSync(path.join(docs, "player-quickstart.pdf"), path.join(__dirname, "..", "public", "docs", "player-quickstart.pdf"));
  console.log(`wrote docs/qr-posters.pdf (${t.length + 1} pages), docs/player-quickstart.pdf, docs/templates/*`);
})();
