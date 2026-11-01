import { z } from "zod"

// ============================================================
// F1 (E3-8 follow-up): React 19 `action={}` form migration
// ------------------------------------------------------------
// Forms migrated off the RHF `handleSubmit` event pathway submit
// through `<form action={formAction}>` — the action receives
// FormData. These pure helpers parse FormData into typed values
// and map zod issues to per-field error maps, so the migration
// keeps server-side schemas as the single validation authority
// while the client parses input defensively.
// ============================================================

/** Raw string value of a field (empty string when absent). */
export function fdStr(fd: FormData, key: string): string {
  const value = fd.get(key)
  return typeof value === "string" ? value : ""
}

/** Optional string: absent/empty → undefined (server schemas use .optional()). */
export function fdOptStr(fd: FormData, key: string): string | undefined {
  const value = fdStr(fd, key).trim()
  return value.length > 0 ? value : undefined
}

/** Required number: absent/empty/NaN → undefined (zod "required" message wins). */
export function fdNum(fd: FormData, key: string): number | undefined {
  const raw = fdStr(fd, key).trim()
  if (raw.length === 0) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Boolean from hidden inputs that mirror Switch state ("true"/"on" → true). */
export function fdBool(fd: FormData, key: string): boolean {
  const value = fd.get(key)
  if (typeof value !== "string") return false
  return value === "true" || value === "on" || value === "1"
}

/** All string values under one key (checkbox groups: staffIds, images…). */
export function fdStrList(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
}

/** Whether the FormData carries the field at all. */
export function hasField(fd: FormData, key: string): boolean {
  return fd.has(key)
}

/**
 * Map zod issues to a per-field error map (first message per path).
 * Nested array paths (e.g. `staffIds.0`) collapse to the field key.
 */
export function zodIssuesToFieldErrors(
  error: z.ZodError
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form")
    if (!out[key]) out[key] = issue.message
  }
  return out
}
