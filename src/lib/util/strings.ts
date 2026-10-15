export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}
export function pct(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}
export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}
export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
export function teamSlugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
