import Papa from "papaparse";

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; errors: string[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = res.meta.fields ?? [];
  return { headers, rows: res.data, errors: res.errors.map((e) => `Row ${e.row ?? "?"}: ${e.message}`) };
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  return Papa.unparse({ fields: cols, data: rows.map((r) => cols.map((c) => formatCell(r[c]))) });
}

function formatCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
