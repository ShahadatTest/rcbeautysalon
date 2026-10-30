import "server-only"
import { TZDate, tz } from "@date-fns/tz"
import { format } from "date-fns"

/**
 * Salon timezone helpers.
 *
 * The server (e.g. Vercel) may run in UTC while the salon operates in its own
 * timezone (SalonConfig.timezone). Interpreting client dates with the SERVER
 * clock produced off-by-one-day availability and UTC-shifted times. All
 * calendar math now goes through explicit timezone-aware instants.
 */

export const DEFAULT_SALON_TIMEZONE = "Europe/Ljubljana"

/** Validate an IANA timezone string, fall back to the salon default. */
export function safeTimezone(timezone?: string | null): string {
  if (!timezone) return DEFAULT_SALON_TIMEZONE
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone })
    return timezone
  } catch {
    return DEFAULT_SALON_TIMEZONE
  }
}

/**
 * Normalize any date argument (client Date, ISO string or "yyyy-MM-dd")
 * to a canonical calendar key "yyyy-MM-dd" as seen in the salon timezone.
 */
export function toDateKey(date: Date | string, timezone: string): string | null {
  const tzName = safeTimezone(timezone)

  if (typeof date === "string") {
    // "yyyy-MM-dd" (preferred contract) or a full ISO string
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return null
    return format(parsed, "yyyy-MM-dd", { in: tz(tzName) })
  }

  if (date instanceof Date && !isNaN(date.getTime())) {
    return format(date, "yyyy-MM-dd", { in: tz(tzName) })
  }

  return null
}

/**
 * Build the exact UTC instant for a salon-local wall-clock time.
 * dateKey: "yyyy-MM-dd", time: "HH:mm" (24h).
 */
export function instantFromParts(
  dateKey: string,
  time: string,
  timezone: string
): Date | null {
  const dateMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!dateMatch || !timeMatch) return null

  const [, y, m, d] = dateMatch.map(Number)
  const [, h, min] = timeMatch.map(Number)
  if (h > 23 || min > 59) return null

  const tz = safeTimezone(timezone)
  const instant = new TZDate(y, m - 1, d, h, min, 0, 0, tz)
  return isNaN(instant.getTime()) ? null : instant
}

/** Day of week (0 = Sunday … 6 = Saturday) for a "yyyy-MM-dd" key in the salon timezone. */
export function dayOfWeekFor(dateKey: string, timezone: string): number | null {
  const dateMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) return null
  const [, y, m, d] = dateMatch.map(Number)
  // Noon avoids DST edge cases around midnight
  return new TZDate(y, m - 1, d, 12, 0, 0, 0, safeTimezone(timezone)).getDay()
}

/** Start/end UTC instants of a salon-local calendar day. */
export function dayBounds(
  dateKey: string,
  timezone: string
): { start: Date; end: Date } | null {
  const dateMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) return null
  const [, y, m, d] = dateMatch.map(Number)
  const tz = safeTimezone(timezone)
  return {
    start: new TZDate(y, m - 1, d, 0, 0, 0, 0, tz),
    end: new TZDate(y, m - 1, d, 23, 59, 59, 999, tz),
  }
}

/** Format an instant as a 24h "HH:mm" wall-clock time in the salon timezone. */
export function formatSalonTime(date: Date, timezone: string): string {
  return format(date, "HH:mm", { in: tz(safeTimezone(timezone)) })
}

/** Pad a number to 2 digits. */
function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

/** Convert minutes-from-midnight to "HH:mm". */
export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}
