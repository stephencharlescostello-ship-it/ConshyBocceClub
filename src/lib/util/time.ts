import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict, isSameDay, differenceInCalendarDays } from "date-fns";

export const TZ = "America/New_York";

export function inTz(iso: string | Date): TZDate {
  return new TZDate(typeof iso === "string" ? new Date(iso) : iso, TZ);
}

export function fmtTime(iso: string | Date) {
  return format(inTz(iso), "h:mm a");
}
export function fmtDate(iso: string | Date) {
  return format(inTz(iso), "EEE, MMM d");
}
export function fmtDateTime(iso: string | Date) {
  return format(inTz(iso), "EEE, MMM d · h:mm a");
}
export function fmtLongDate(iso: string | Date) {
  return format(inTz(iso), "EEEE, MMMM d, yyyy");
}
export function fmtWeekday(iso: string | Date) {
  return format(inTz(iso), "EEEE");
}
export function relative(iso: string | Date) {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}
export function isToday(iso: string | Date, now = new Date()) {
  return isSameDay(inTz(iso), inTz(now));
}
/** ISO weekday 1..7 (Mon..Sun) in the league time zone. */
export function isoWeekday(d: Date = new Date()): number {
  const day = inTz(d).getDay();
  return day === 0 ? 7 : day;
}
export function daysUntil(iso: string | Date, now = new Date()) {
  return differenceInCalendarDays(inTz(iso), inTz(now));
}
export const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
