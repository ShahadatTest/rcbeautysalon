import "server-only"

// ============================================================
// PLATFORM WEBHOOK FAILURE RECORDER (EPIC #4 E4-3, server-only)
//
// The single writer of PlatformWebhookFailure rows. Contract:
//  - a failure is ALWAYS recorded when the throttle allows it;
//  - recording must NEVER break the webhook response — any error
//    here is logged and swallowed (the webhook's own status code
//    is decided by the route, not by the recorder);
//  - payload/detail are length-capped by the pure core before
//    they reach the DB.
// ============================================================

import { prisma } from "@/lib/prisma"
import {
  createFailureThrottle,
  sanitizeFailureDetail,
  sanitizeFailurePayload,
  type WebhookFailureReason,
} from "@/lib/platform/webhook-failure-core"

const throttle = createFailureThrottle()

/**
 * Record one webhook failure (throttled per reason, fire-safe).
 * Awaited by the route so serverless does not freeze mid-write.
 */
export async function recordPlatformWebhookFailure(input: {
  reason: WebhookFailureReason
  stripeEventId?: string | null
  type?: string | null
  detail?: string | null
  payload?: string | null
}): Promise<void> {
  try {
    if (!throttle.allow(input.reason, new Date())) {
      // Throttled — the flood is visible in platform logs, the console
      // shows the last recorded failures of each reason. Never throws.
      console.warn(
        `[platform-billing] failure recording throttled for reason=${input.reason}`
      )
      return
    }

    await prisma.platformWebhookFailure.create({
      data: {
        reason: input.reason,
        stripeEventId: input.stripeEventId ?? null,
        type: input.type ?? null,
        detail: sanitizeFailureDetail(input.detail),
        payloadSnippet: sanitizeFailurePayload(input.payload),
      },
    })
  } catch (err) {
    // Never let diagnostics break the webhook response.
    console.error("[platform-billing] failed to record webhook failure:", err)
  }
}
