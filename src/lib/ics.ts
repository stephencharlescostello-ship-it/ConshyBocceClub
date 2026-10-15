import { publicEnv } from "@/lib/env";

type IcsEvent = { uid: string; start: Date; end: Date; summary: string; description?: string; location?: string; url?: string };

function fmt(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => "\\" + m);
}

export function buildIcs(name: string, events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CBC Shuffle//League//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:America/New_York",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@cbcshuffle`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(e.start)}`, `DTEND:${fmt(e.end)}`, `SUMMARY:${esc(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function matchToIcs(m: { id: string; scheduled_at: string; home?: { name: string } | null; away?: { name: string } | null; table?: { name: string } | null; week?: { number: number } | null; night?: { name: string } | null }, clubAddress: string): IcsEvent {
  const start = new Date(m.scheduled_at);
  return {
    uid: `match-${m.id}`,
    start,
    end: new Date(start.getTime() + 60 * 60 * 1000),
    summary: `Shuffleboard: ${m.home?.name ?? "Bye"} vs ${m.away?.name ?? "Bye"}`,
    description: `${m.night?.name ?? ""} night · Week ${m.week?.number ?? "?"} · ${m.table?.name ?? "Table TBD"}`,
    location: clubAddress,
    url: `${publicEnv.siteUrl}/matches/${m.id}`,
  };
}

/** Google Calendar "add" link for one event (works on any phone). */
export function googleCalendarUrl(e: { summary: string; start: Date; end: Date; description?: string; location?: string }) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.summary, dates: `${fmt(e.start)}/${fmt(e.end)}`, details: e.description ?? "", location: e.location ?? "" });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
