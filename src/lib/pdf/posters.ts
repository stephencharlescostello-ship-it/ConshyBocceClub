import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export type PosterTable = { name: string; url: string };

const GREEN = rgb(0.043, 0.122, 0.09);
const GOLD = rgb(0.83, 0.655, 0.227);
const CREAM = rgb(0.957, 0.937, 0.89);
const MUTED = rgb(0.725, 0.784, 0.75);

/** One US-Letter poster per table plus a general "Get the app" poster. */
export async function buildPostersPdf(tables: PosterTable[], appUrl: string, clubName = "Conshohocken Bocce Club"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const pages: { title: string; subtitle: string; url: string; steps: string[] }[] = [
    ...tables.map((t) => ({ title: t.name, subtitle: "Scan to keep score at this table", url: t.url, steps: ["Scan with your phone camera", "Tonight's match opens automatically", "Captains: tap Keep Score. Everyone else: watch live", "Add CBC Shuffle to your home screen for next time"] })),
    { title: "CBC Shuffle", subtitle: "Scores, standings, schedule & trash talk", url: appUrl, steps: ["Scan to open the league app", "Sign in with your email (no password)", "Enter your captain's join code", "Add it to your home screen — it works like an app"] },
  ];
  for (const p of pages) {
    const page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: GREEN });
    page.drawRectangle({ x: 36, y: 36, width: 540, height: 720, borderColor: GOLD, borderWidth: 3 });
    page.drawText(clubName.toUpperCase(), { x: 60, y: 710, size: 14, font: bold, color: GOLD });
    page.drawText("SHUFFLEBOARD LEAGUE", { x: 60, y: 692, size: 11, font: reg, color: MUTED });
    const titleSize = p.title.length > 14 ? 40 : 56;
    page.drawText(p.title, { x: 60, y: 630, size: titleSize, font: bold, color: CREAM });
    page.drawText(p.subtitle, { x: 60, y: 600, size: 16, font: reg, color: MUTED });
    const png = await QRCode.toBuffer(p.url, { type: "png", width: 900, margin: 1, color: { dark: "#0b1f17", light: "#f4efe3" } });
    const img = await pdf.embedPng(png);
    const size = 320;
    page.drawRectangle({ x: 306 - size / 2 - 12, y: 250 - 12, width: size + 24, height: size + 24, color: CREAM });
    page.drawImage(img, { x: 306 - size / 2, y: 250, width: size, height: size });
    let y = 215;
    p.steps.forEach((s, i) => {
      page.drawText(`${i + 1}.`, { x: 60, y, size: 14, font: bold, color: GOLD });
      page.drawText(s, { x: 84, y, size: 14, font: reg, color: CREAM });
      y -= 26;
    });
    page.drawText(p.url.replace(/^https?:\/\//, ""), { x: 60, y: 60, size: 11, font: reg, color: MUTED });
  }
  return pdf.save();
}
