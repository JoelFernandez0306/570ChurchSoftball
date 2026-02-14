import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const LEAGUE_TIMEZONE = "America/New_York";

export function normalizeAlias(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toLeagueDateString(date = new Date()): string {
  return formatInTimeZone(date, LEAGUE_TIMEZONE, "yyyy-MM-dd");
}

export function parseLeagueDate(month: number, day: number, year?: number): string {
  const yearToUse = year ?? Number(formatInTimeZone(new Date(), LEAGUE_TIMEZONE, "yyyy"));
  const utcDate = fromZonedTime(`${yearToUse}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} 12:00:00`, LEAGUE_TIMEZONE);
  return formatInTimeZone(utcDate, LEAGUE_TIMEZONE, "yyyy-MM-dd");
}

export function formatLeagueDateForDisplay(dateString: string): string {
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) {
    return dateString;
  }

  return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
}

export function formatLeagueTimeForDisplay(timeString: string | null): string {
  if (!timeString) {
    return "TBD";
  }

  const match = timeString.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return timeString;
  }

  const hour = Number(match[1]);
  const minute = match[2];

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return timeString;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.000";
  }

  return value.toFixed(3);
}

export function cleanPhone(phone: string): string {
  const raw = phone.trim();
  if (!raw) {
    return "";
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function safeInt(value: string | number | null | undefined, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const leagueTimezone = LEAGUE_TIMEZONE;
