"use server"

// ============================================================
// BILLING ACTIONS (EPIC #3 E3-4)
// Platform subscription checkout + cancel requests and the read
// model for the Settings billing section.
//
// HONESTY RULES (docs/EPIC-3/PLAN.md §9 / E3-4 acceptance):
//   • Without a configured platform provider every money action
//     returns SETUP_REQUIRED — nothing is ever faked.
//   • The local plan/subscription state changes EXCLUSIVELY via
//     provider webhook events. These actions only open checkout /
//     request cancellation.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requireAdminOrg } from "@/lib/tenant"
import { isPlanId } from "@/lib/plans/registry"
import { siteConfig } from "@/lib/config"
import { getPlatformPaymentProvider } from "@/lib/payments/provider"
import { loadBillingOverview, type BillingOverview } from "@/lib/payments/billing-overview"
import { revalidatePath } from "next/cache"

/** Subscription state + billing history for the signed-in admin's tenant. */
export async function getBillingOverview(): Promise<BillingOverview | null> {
  const { org } = await requireAdminOrg()
  return loadBillingOverview(org.id)
}

export type StartCheckoutResult =
  | { success: true; checkoutUrl: string }
  | {
      success: false
      code: "SETUP_REQUIRED" | "PROVIDER_ERROR" | "INVALID_PLAN" | "ALREADY_SUBSCRIBED"
      error: string
      errorEn: string
    }

/**
 * Open the hosted checkout for subscribing to a paid plan. Only
 * creates the session and records the pending intent — the plan
 * change itself happens when the provider's webhook confirms.
 */
export async function startPlanCheckout(planId: string): Promise<StartCheckoutResult> {
  const { org, session } = await requireAdminOrg()

  if (!isPlanId(planId) || planId === "free") {
    return {
      success: false,
      code: "INVALID_PLAN",
      error: "Naročnina je mogoča samo na plačljive pakete.",
      errorEn: "Only paid plans can be subscribed to.",
    }
  }

  const existing = await prisma.platformSubscription.findUnique({
    where: { organizationId: org.id },
    select: { status: true, plan: true, stripeCustomerId: true },
  })
  if (existing && (existing.status === "ACTIVE" || existing.status === "TRIALING")) {
    return {
      success: false,
      code: "ALREADY_SUBSCRIBED",
      error:
        "Vaša naročnina je že aktivna. Za spremembo paketa najprej prekličite obstoječo naročnino (uveljavi se na koncu obračunskega obdobja).",
      errorEn:
        "Your subscription is already active. To change plans, cancel the existing one first (takes effect at the end of the billing period).",
    }
  }

  const provider = getPlatformPaymentProvider()

  const result = await provider.createSubscriptionCheckout({
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    planId,
    customerEmail: session.user.email ?? null,
    existingCustomerId: existing?.stripeCustomerId ?? null,
    successUrl: `${siteConfig.url}/dashboard/settings?billing=success`,
    cancelUrl: `${siteConfig.url}/dashboard/settings?billing=cancelled`,
  })

  if (!result.ok) {
    return { success: false, code: result.code, error: result.message, errorEn: result.messageEn }
  }

  // Pending intent only — visible as "obdelava" until the webhook confirms.
  await prisma.platformSubscription.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      status: "INCOMPLETE",
      stripeCustomerId: result.customerId,
      pendingCheckoutSessionId: result.sessionId,
      pendingPlanId: planId,
      pendingAt: new Date(),
    },
    update: {
      stripeCustomerId: result.customerId ?? undefined,
      pendingCheckoutSessionId: result.sessionId,
      pendingPlanId: planId,
      pendingAt: new Date(),
    },
  })

  revalidatePath("/dashboard/settings")

  return { success: true, checkoutUrl: result.checkoutUrl }
}

export type CancelSubscriptionResult =
  | { success: true }
  | {
      success: false
      code: "SETUP_REQUIRED" | "PROVIDER_ERROR" | "NO_SUBSCRIPTION"
      error: string
      errorEn: string
    }

/**
 * Request cancellation at the end of the current period. The
 * provider event (customer.subscription.updated with
 * cancel_at_period_end) updates the local state; the entitlement
 * moves to FREE only when the provider confirms the termination.
 */
export async function cancelSubscription(): Promise<CancelSubscriptionResult> {
  const { org } = await requireAdminOrg()

  const sub = await prisma.platformSubscription.findUnique({
    where: { organizationId: org.id },
    select: { status: true, stripeSubscriptionId: true, cancelAtPeriodEnd: true },
  })

  if (!sub || !sub.stripeSubscriptionId || !["ACTIVE", "TRIALING", "PAST_DUE"].includes(sub.status)) {
    return {
      success: false,
      code: "NO_SUBSCRIPTION",
      error: "Ni aktivne naročnine za preklic.",
      errorEn: "There is no active subscription to cancel.",
    }
  }
  if (sub.cancelAtPeriodEnd) {
    return { success: true } // already requested — idempotent
  }

  const provider = getPlatformPaymentProvider()
  const result = await provider.cancelSubscription({ stripeSubscriptionId: sub.stripeSubscriptionId })
  if (!result.ok) {
    return { success: false, code: result.code, error: result.message, errorEn: result.messageEn }
  }

  revalidatePath("/dashboard/settings")
  return { success: true }
}
