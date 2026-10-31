// ============================================================
// BILLING OVERVIEW LOADER (EPIC #3 E3-4 — SERVER-ONLY)
// Read model for the Settings billing section: subscription
// state + recent billing history. Pure reads — the state in
// PlatformSubscription is written ONLY by the webhook route.
// ============================================================

import { prisma } from "@/lib/prisma"
import { isPlatformBillingConfigured } from "./provider"

export interface BillingHistoryEntry {
  id: string
  type: string
  amountCents: number | null
  currency: string | null
  plan: string | null
  createdAt: string // ISO
}

export interface BillingSubscription {
  status: string
  plan: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
}

export interface BillingOverview {
  paymentsConfigured: boolean
  subscription: BillingSubscription | null
  history: BillingHistoryEntry[]
}

const HISTORY_LIMIT = 12

/** Subscription + billing history for one tenant (no session logic). */
export async function loadBillingOverview(orgId: string): Promise<BillingOverview> {
  const [sub, paymentsConfigured] = await Promise.all([
    prisma.platformSubscription.findUnique({
      where: { organizationId: orgId },
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: HISTORY_LIMIT,
          select: {
            id: true,
            type: true,
            amountCents: true,
            currency: true,
            plan: true,
            createdAt: true,
          },
        },
      },
    }),
    Promise.resolve(isPlatformBillingConfigured()),
  ])

  return {
    paymentsConfigured,
    subscription: sub
      ? {
          status: sub.status,
          plan: sub.plan,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt?.toISOString() ?? null,
        }
      : null,
    history: sub
      ? sub.events.map((e) => ({
          id: e.id,
          type: e.type,
          amountCents: e.amountCents,
          currency: e.currency,
          plan: e.plan,
          createdAt: e.createdAt.toISOString(),
        }))
      : [],
  }
}
