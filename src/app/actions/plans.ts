"use server"

// ============================================================
// PLAN ACTIONS (EPIC #3 E3-3 → E3-4)
// changePlan switches the tenant plan and the new entitlements
// apply immediately. Since E3-4 the action carries the payment
// gate:
//   • platform billing configured + paid target → CHECKOUT_REQUIRED
//     (the UI opens the hosted Stripe checkout; the plan change
//     happens EXCLUSIVELY via provider webhook events)
//   • otherwise the demonstrative free switch remains (no money
//     involved, the UI states it explicitly — no fake payment)
// Downgrades below current usage are allowed by design (EPIC #3:
// a downgrade must never delete tenant data): creation stays
// blocked until usage drops under the limit.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requireAdminOrg } from "@/lib/tenant"
import { getPlan, isPlanId } from "@/lib/plans/registry"
import { getSessionPlanContext, type PlanContext } from "@/lib/plans/resolve"
import { isPlatformBillingConfigured } from "@/lib/payments/provider"
import { revalidatePath } from "next/cache"

/** Fresh plan + usage context for the Settings card (client refresh). */
export async function getPlanContext(): Promise<PlanContext | null> {
  return getSessionPlanContext()
}

export type ChangePlanResult =
  | { success: true; planId: string }
  | {
      success: false
      error: string
      errorEn: string
      code: "INVALID_PLAN" | "CHECKOUT_REQUIRED" | "CANCEL_REQUIRED"
      targetPlanId?: string
    }

const CHECKOUT_REQUIRED_MESSAGE = {
  error:
    "Za plačljive pakete potekne naročnina prek Stripe. Plačilni sloj platforme je konfiguriran — uporabite gumb za naročnino.",
  errorEn:
    "Paid plans require a Stripe subscription. Platform billing is configured — use the subscribe button.",
}

const CANCEL_REQUIRED_MESSAGE = {
  error:
    "Vaša naročnina je aktivna. Za vrnitev na brezplačni paket prekličite naročnino — uveljavi se na koncu obračunskega obdobja prek Stripe dogodkov.",
  errorEn:
    "Your subscription is active. To return to the free plan, cancel the subscription — it takes effect at the end of the billing period via Stripe events.",
}

/**
 * Switch the tenant plan. With the platform payment layer configured,
 * paid targets are refused here and must go through the hosted
 * checkout (webhook-driven); with an active subscription, moving to
 * FREE requires cancelling the subscription first.
 */
export async function changePlan(planId: string): Promise<ChangePlanResult> {
  const { org } = await requireAdminOrg()

  if (!isPlanId(planId)) {
    return {
      success: false,
      error: "Neznan paket.",
      errorEn: "Unknown plan.",
      code: "INVALID_PLAN",
    }
  }

  if (isPlatformBillingConfigured()) {
    if (planId !== "free") {
      return {
        success: false,
        ...CHECKOUT_REQUIRED_MESSAGE,
        code: "CHECKOUT_REQUIRED",
        targetPlanId: planId,
      }
    }

    // Moving to FREE while a subscription is ACTIVE would leave the
    // provider charging — cancellation is requested from the provider
    // and the entitlement follows the webhook confirmation.
    const sub = await prisma.platformSubscription.findUnique({
      where: { organizationId: org.id },
      select: { status: true },
    })
    if (sub && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(sub.status)) {
      return {
        success: false,
        ...CANCEL_REQUIRED_MESSAGE,
        code: "CANCEL_REQUIRED",
        targetPlanId: planId,
      }
    }
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: planId },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")

  const plan = getPlan(planId)
  return { success: true, planId: plan.id }
}
