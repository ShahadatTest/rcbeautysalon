// ============================================================
// PLATFORM WEBHOOK FAILURE LOG — PURE CORE (EPIC #4 E4-3)
//
// §10: "Review billing integration/webhook health and failed
// events". Every webhook failure (rejected signature, unconfigured
// billing layer, unknown tenant, processing error) is recorded —
// ALWAYS, never silently dropped — while two honest constraints
// hold:
//
//  1. Recording must never break the webhook response (the writer
//     swallows its own errors), and
//  2. Unauthenticated traffic must not be able to drive unbounded
//     DB writes: the recorder is THROTTLED per reason (sliding
//     window). Stripe's own retries are bounded and legitimate
//     failure bursts stay far below the cap; anonymous spam gets
//     capped per instance.
//
// This file is deliberately free of server-only imports so every
// rule is unit-testable on fixed inputs (same principle as E4-1's
// computePlatformAnalytics). The prisma writer lives in
// webhook-failure-recorder.ts (server-only).
// ============================================================

/** Machine-readable failure reasons shown (and labeled) in /platform. */
export type WebhookFailureReason =
  | "missing_signature"
  | "not_configured"
  | "signature_invalid"
  | "no_tenant_scope"
  | "processing_error"

export const WEBHOOK_FAILURE_REASONS: readonly WebhookFailureReason[] = [
  "missing_signature",
  "not_configured",
  "signature_invalid",
  "no_tenant_scope",
  "processing_error",
] as const

export function isWebhookFailureReason(value: string): value is WebhookFailureReason {
  return (WEBHOOK_FAILURE_REASONS as readonly string[]).includes(value)
}

// --- Length caps (defense against oversized bodies / error strings) -----
export const MAX_PAYLOAD_SNIPPET_CHARS = 2000
export const MAX_DETAIL_CHARS = 500

/** Truncate a raw delivery body for diagnosis; null for empty input. */
export function sanitizeFailurePayload(
  raw: string | null | undefined
): string | null {
  if (!raw) return null
  const snippet = raw.slice(0, MAX_PAYLOAD_SNIPPET_CHARS)
  return snippet.length > 0 ? snippet : null
}

/** Truncate an error detail; null for empty input. */
export function sanitizeFailureDetail(
  raw: string | null | undefined
): string | null {
  if (!raw) return null
  const detail = raw.trim().slice(0, MAX_DETAIL_CHARS)
  return detail.length > 0 ? detail : null
}

// --- Throttle (sliding window per reason) -------------------------------
export interface FailureThrottleConfig {
  /** Maximum recorded failures per reason within the window. */
  maxPerWindow: number
  /** Sliding window length in milliseconds. */
  windowMs: number
}

/**
 * Throttle defaults: generous enough that real Stripe retry storms
 * (bounded, backoff-driven) are never dropped, tight enough that
 * anonymous spam cannot drive unbounded writes (per instance).
 */
export const DEFAULT_FAILURE_THROTTLE: FailureThrottleConfig = {
  maxPerWindow: 20,
  windowMs: 60_000,
}

export interface FailureThrottle {
  /** True when a failure of `reason` at time `now` may be recorded. */
  allow: (reason: string, now: Date) => boolean
}

/** Sliding-window throttle keyed by reason, with injectable clock. */
export function createFailureThrottle(
  config: FailureThrottleConfig = DEFAULT_FAILURE_THROTTLE
): FailureThrottle {
  const timestampsByReason = new Map<string, number[]>()

  return {
    allow(reason: string, now: Date): boolean {
      const nowMs = now.getTime()
      const windowStart = nowMs - config.windowMs

      const previous = (timestampsByReason.get(reason) ?? []).filter(
        (ts) => ts > windowStart
      )
      if (previous.length >= config.maxPerWindow) {
        // Denied attempts are NOT pushed — a spam flood cannot extend
        // its own window; the next legitimate event inside the window
        // still gets recorded.
        timestampsByReason.set(reason, previous)
        return false
      }
      timestampsByReason.set(reason, [...previous, nowMs])
      return true
    },
  }
}
