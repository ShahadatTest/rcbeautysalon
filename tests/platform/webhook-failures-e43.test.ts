// ============================================================
// EPIC #4 E4-3 — PLATFORM WEBHOOK FAILURE LOG (§10)
// Pure-rule tests: every failure is always recorded (never
// silently dropped), unauthenticated spam cannot drive unbounded
// DB writes (per-reason sliding-window throttle), unverified
// bodies are only ever stored as truncated diagnostic snippets,
// and the console summary keeps unknown reasons as their own
// bucket (nothing folded away silently).
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  sanitizeFailurePayload,
  sanitizeFailureDetail,
  createFailureThrottle,
  DEFAULT_FAILURE_THROTTLE,
  WEBHOOK_FAILURE_REASONS,
  isWebhookFailureReason,
  MAX_PAYLOAD_SNIPPET_CHARS,
  MAX_DETAIL_CHARS,
} from "../../src/lib/platform/webhook-failure-core"
import { computePlatformAnalytics } from "../../src/lib/platform/analytics"

describe("sanitizeFailurePayload / sanitizeFailureDetail (E4-3 caps)", () => {
  it("truncates oversized bodies to the diagnostic cap", () => {
    const huge = "x".repeat(MAX_PAYLOAD_SNIPPET_CHARS + 5000)
    const snippet = sanitizeFailurePayload(huge)
    expect(snippet).toHaveLength(MAX_PAYLOAD_SNIPPET_CHARS)
  })

  it("maps empty and absent input to null (no fabricated content)", () => {
    expect(sanitizeFailurePayload("")).toBeNull()
    expect(sanitizeFailurePayload(null)).toBeNull()
    expect(sanitizeFailurePayload(undefined)).toBeNull()
    expect(sanitizeFailureDetail("   ")).toBeNull()
  })

  it("truncates error details to the detail cap", () => {
    const detail = sanitizeFailureDetail("e".repeat(MAX_DETAIL_CHARS + 100))
    expect(detail).toHaveLength(MAX_DETAIL_CHARS)
  })
})

describe("createFailureThrottle (E4-3 abuse bound)", () => {
  const cfg = { maxPerWindow: 3, windowMs: 60_000 }
  const t0 = new Date("2025-12-03T12:00:00Z")

  it("allows failures up to the cap, then denies within the window", () => {
    const throttle = createFailureThrottle(cfg)
    expect(throttle.allow("signature_invalid", t0)).toBe(true)
    expect(throttle.allow("signature_invalid", new Date(t0.getTime() + 1000))).toBe(true)
    expect(throttle.allow("signature_invalid", new Date(t0.getTime() + 2000))).toBe(true)
    expect(throttle.allow("signature_invalid", new Date(t0.getTime() + 3000))).toBe(false)
  })

  it("is independent per reason", () => {
    const throttle = createFailureThrottle(cfg)
    for (let i = 0; i < cfg.maxPerWindow; i++) {
      expect(throttle.allow("missing_signature", new Date(t0.getTime() + i))).toBe(true)
    }
    // a different reason still gets its own full budget
    expect(throttle.allow("processing_error", new Date(t0.getTime() + 10))).toBe(true)
  })

  it("slides: denied events do not extend the window", () => {
    const throttle = createFailureThrottle(cfg)
    for (let i = 0; i < cfg.maxPerWindow; i++) {
      throttle.allow("missing_signature", new Date(t0.getTime() + i * 1000))
    }
    expect(throttle.allow("missing_signature", new Date(t0.getTime() + 5000))).toBe(false)
    // after the window passes, recording works again
    expect(throttle.allow("missing_signature", new Date(t0.getTime() + 61_000))).toBe(true)
  })

  it("ships with a generous default (real Stripe retry storms are never dropped)", () => {
    expect(DEFAULT_FAILURE_THROTTLE.maxPerWindow).toBeGreaterThanOrEqual(20)
    expect(DEFAULT_FAILURE_THROTTLE.windowMs).toBeLessThanOrEqual(60_000)
  })
})

describe("failure reason registry (E4-3)", () => {
  it("exposes exactly the five documented reasons", () => {
    expect(WEBHOOK_FAILURE_REASONS).toEqual([
      "missing_signature",
      "not_configured",
      "signature_invalid",
      "no_tenant_scope",
      "processing_error",
    ])
    expect(isWebhookFailureReason("signature_invalid")).toBe(true)
    expect(isWebhookFailureReason("something_else")).toBe(false)
  })
})

describe("computePlatformAnalytics webhookFailures summary (E4-3)", () => {
  const baseInput = {
    tenants: [{ plan: "scale", subscriptionStatus: "ACTIVE" }],
    billingEvents: [],
    now: new Date("2025-12-03T12:00:00Z"),
  }

  it("stays backward compatible: no failure input → honest empty summary", () => {
    const result = computePlatformAnalytics(baseInput)
    expect(result.webhookFailures).toEqual({
      failuresLast7d: 0,
      distinctRecentReasons: 0,
      lastFailureAt: null,
      recent: [],
    })
  })

  it("passes the exact loader count through and derives recency + distinct reasons", () => {
    const t = baseInput.now
    const result = computePlatformAnalytics({
      ...baseInput,
      webhookFailures: {
        failuresLast7dCount: 42, // loader's exact 7-day count (list may be truncated)
        recent: [
          {
            reason: "signature_invalid",
            type: null,
            stripeEventId: null,
            detail: "No signatures found matching the expected signature",
            createdAt: new Date(t.getTime() - 1000),
          },
          {
            reason: "no_tenant_scope",
            type: "invoice.paid",
            stripeEventId: "evt_123",
            detail: null,
            createdAt: new Date(t.getTime() - 2000),
          },
          {
            reason: "signature_invalid",
            type: null,
            stripeEventId: null,
            detail: null,
            createdAt: new Date(t.getTime() - 3000),
          },
        ],
      },
    })

    expect(result.webhookFailures.failuresLast7d).toBe(42)
    expect(result.webhookFailures.distinctRecentReasons).toBe(2)
    expect(result.webhookFailures.lastFailureAt).toEqual(new Date(t.getTime() - 1000))
    expect(result.webhookFailures.recent).toHaveLength(3)
  })

  it("keeps unknown reasons as their own bucket (nothing silently folded)", () => {
    const t = baseInput.now
    const result = computePlatformAnalytics({
      ...baseInput,
      webhookFailures: {
        failuresLast7dCount: 1,
        recent: [
          {
            reason: "some_future_reason",
            type: null,
            stripeEventId: null,
            detail: null,
            createdAt: t,
          },
        ],
      },
    })
    expect(result.webhookFailures.distinctRecentReasons).toBe(1)
    expect(result.webhookFailures.recent[0].reason).toBe("some_future_reason")
  })
})

describe("PlatformWebhookFailure schema contract (E4-3)", () => {
  const schemaPath = resolve(process.cwd(), "prisma/schema.prisma")
  const schema = readFileSync(schemaPath, "utf8")
  const block = (schema.match(/model\s+PlatformWebhookFailure\s*\{[^}]*\}/g) ?? [])[0]

  it("exists in the schema", () => {
    expect(block).toBeTruthy()
  })

  it("is deliberately platform-level (NO organizationId — failures often have no trusted org context)", () => {
    expect(block).not.toContain("organizationId")
  })

  it("keeps the idempotency lock separate from failures (no unique stripeEventId here)", () => {
    expect(block).not.toMatch(/stripeEventId\s+String\s+@unique/)
    expect(block).toMatch(/stripeEventId\s+String\?/)
  })

  it("indexes the queries the console runs (recent list, per-reason trail)", () => {
    expect(block).toMatch(/@@index\(\[createdAt\]\)/)
    expect(block).toMatch(/@@index\(\[reason,\s*createdAt\]\)/)
  })
})
