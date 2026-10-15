import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/import/csv";
import { detectResultMapping, pairSubmissions, parseSubmissions, parseUsTimestamp } from "@/lib/import/results";
import { DEFAULT_FORMAT } from "@/lib/engine/format";

const csv = fs.readFileSync(path.join(__dirname, "../../data/s26/scores.csv"), "utf8");

describe("spreadsheet import", () => {
  it("detects the Google Form columns and pairs every match", () => {
    const { headers, rows } = parseCsv(csv);
    const map = detectResultMapping(headers);
    expect(map.team).toBe("Your Team");
    expect(map.altTeam).toBe("Your Team_1"); // second occurrence (Wednesday block), renamed by the CSV parser
    expect(map.g3o).toContain("Game 3");
    const subs = parseSubmissions(rows, map);
    expect(subs).toHaveLength(120);
    expect(subs.filter((s) => s.errors.length)).toHaveLength(0);
    const paired = pairSubmissions(subs, { ...DEFAULT_FORMAT, target_score: 11 });
    expect(paired).toHaveLength(60);
    expect(paired.filter((p) => p.sources.length === 2)).toHaveLength(60);
    expect(paired.filter((p) => p.errors.length)).toHaveLength(0);
    const ff = paired.filter((p) => p.forfeitTeam);
    expect(ff).toHaveLength(1);
    expect(ff[0].forfeitTeam).toBe("Keep It On The Board");
    expect(paired.filter((p) => p.night === "Monday")).toHaveLength(30);
  });
  it("flags disagreeing reports and impossible scores", () => {
    const rows: Record<string, string>[] = [
      { Night: "Monday", Week: "Week 1", "Your Team": "A", "Opposing Team": "B", "Game 1 [Your Score]": "15", "Game 1 [Opponent's Score]": "3", "Game 2 [Your Score]": "15", "Game 2 [Opponent's Score]": "9" },
      { Night: "Monday", Week: "Week 1", "Your Team": "B", "Opposing Team": "A", "Game 1 [Your Score]": "3", "Game 1 [Opponent's Score]": "15", "Game 2 [Your Score]": "10", "Game 2 [Opponent's Score]": "15" },
      { Night: "Tuesday", Week: "Week 1", "Your Team": "C", "Opposing Team": "D", "Game 1 [Your Score]": "16", "Game 1 [Opponent's Score]": "3", "Game 2 [Your Score]": "15", "Game 2 [Opponent's Score]": "9" },
      { Night: "Funday", Week: "", "Your Team": "", "Opposing Team": "D", "Game 1 [Your Score]": "x", "Game 1 [Opponent's Score]": "3" },
    ];
    const map = detectResultMapping(Object.keys(rows[0]));
    const subs = parseSubmissions(rows, map);
    expect(subs[3].errors.length).toBeGreaterThan(2);
    const paired = pairSubmissions(subs, DEFAULT_FORMAT);
    const ab = paired.find((p) => p.teamA === "A")!;
    const cd = paired.find((p) => p.teamA === "C")!;
    expect(ab.errors[0]).toMatch(/disagree/);
    expect(cd.errors[0]).toMatch(/exactly 15/);
    expect(cd.warnings[0]).toMatch(/Only one team/);
    expect(paired.find((p) => p.teamB === "D" && p.teamA === "")!.errors.length).toBeGreaterThan(2);
  });
  it("parses US timestamps", () => {
    expect(parseUsTimestamp("4/27/2026 18:50:15")).toEqual({ y: 2026, m: 4, d: 27, hh: 18, mm: 50 });
    expect(parseUsTimestamp("7/9/2026")).toEqual({ y: 2026, m: 7, d: 9, hh: 18, mm: 0 });
    expect(parseUsTimestamp("nope")).toBeNull();
  });
});
