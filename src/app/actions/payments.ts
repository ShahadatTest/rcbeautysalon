"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { UnauthorizedError } from "@/lib/auth/guards"
import { requireAdminOrg } from "@/lib/tenant"
import {
  maskSecretKey,
  stripeKeyMode,
  verifyStripeSecretKey,
} from "@/lib/stripe"

export interface PaymentsSettings {
  /** True when payments are runnable right now (the salon's own key). */
  active: boolean
  /** Where the key comes from: admin settings only — the platform never
   *  holds a key, so there is deliberately no "env" source (E4-3b). */
  source: "settings" | "none"
  /** "test" | "live" | "restricted" | "unknown" — of the salon's key. */
  mode: string
  /** Masked org key for display, e.g. "sk_live_••••ab12" (never the full key). */
  maskedKey: string | null
  configuredAt: string | null
  webhookConfigured: boolean
  /** Webhook endpoint URL to register in the Stripe Dashboard. */
  webhookUrl: string
}

const SECRET_KEY_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/

function buildPaymentsSettings(org: {
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
  stripeConfiguredAt: Date | null
}): PaymentsSettings {
  // Org key ONLY — no env fallback: the platform never holds the key (E4-3b).
  const activeKey = org.stripeSecretKey
  return {
    active: Boolean(activeKey),
    source: org.stripeSecretKey ? "settings" : "none",
    mode: activeKey ? stripeKeyMode(activeKey) : "unknown",
    maskedKey: org.stripeSecretKey ? maskSecretKey(org.stripeSecretKey) : null,
    configuredAt: org.stripeConfiguredAt?.toISOString() ?? null,
    webhookConfigured: Boolean(org.stripeWebhookSecret),
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/stripe`,
  }
}

/** Load payment settings for the admin's organization (masked, never raw). */
export async function getPaymentsSettings(): Promise<
  { success: true; settings: PaymentsSettings } | { success: false; error: string }
> {
  try {
    const { org } = await requireAdminOrg()
    return {
      success: true,
      settings: buildPaymentsSettings({
        stripeSecretKey: org.stripeSecretKey,
        stripeWebhookSecret: org.stripeWebhookSecret,
        stripeConfiguredAt: org.stripeConfiguredAt,
      }),
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error loading payment settings:", error)
    return { success: false, error: "Failed to load payment settings." }
  }
}

/**
 * Save the salon's own Stripe keys (admin only). The secret key is verified
 * against the Stripe API before storing; only a masked preview is ever
 * returned to the client.
 */
export async function saveStripeSettings(input: {
  secretKey: string
  webhookSecret?: string
}): Promise<
  | { success: true; settings: PaymentsSettings }
  | { success: false; error: string; errorKey?: "secretKey" | "webhookSecret" }
> {
  try {
    const { org } = await requireAdminOrg()

    const secretKey = input.secretKey.trim()
    const webhookSecret = input.webhookSecret?.trim() || null

    if (!SECRET_KEY_PATTERN.test(secretKey)) {
      return {
        success: false,
        errorKey: "secretKey",
        error: "invalid_format",
      }
    }

    if (webhookSecret && !WEBHOOK_SECRET_PATTERN.test(webhookSecret)) {
      return {
        success: false,
        errorKey: "webhookSecret",
        error: "invalid_webhook_format",
      }
    }

    // Verify the key actually works before persisting it.
    const verification = await verifyStripeSecretKey(secretKey)
    if (!verification.valid) {
      return {
        success: false,
        errorKey: "secretKey",
        error: verification.error === "invalid" ? "invalid_key" : "verification_failed",
      }
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        stripeSecretKey: secretKey,
        stripeWebhookSecret: webhookSecret,
        stripeConfiguredAt: new Date(),
      },
    })

    revalidatePath("/dashboard/settings")

    return {
      success: true,
      settings: buildPaymentsSettings(updated),
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error saving Stripe settings:", error)
    return { success: false, error: "save_failed" }
  }
}

/** Remove the salon's stored Stripe keys — online payments stop until the
 *  owner enters a key again (there is no platform fallback). */
export async function clearStripeSettings(): Promise<
  | { success: true; settings: PaymentsSettings }
  | { success: false; error: string }
> {
  try {
    const { org } = await requireAdminOrg()

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        stripeSecretKey: null,
        stripeWebhookSecret: null,
        stripeConfiguredAt: null,
      },
    })

    revalidatePath("/dashboard/settings")

    return {
      success: true,
      settings: buildPaymentsSettings(updated),
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error clearing Stripe settings:", error)
    return { success: false, error: "clear_failed" }
  }
}
