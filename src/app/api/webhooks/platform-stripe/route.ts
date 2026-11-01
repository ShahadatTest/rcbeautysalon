// ============================================================
// PLATFORM BILLING WEBHOOK (EPIC #3 E3-4 — SERVER-ONLY)
// POST /api/webhooks/platform-stripe
//
// The ONLY writer of subscription/entitlement state. Acceptance
// rules (docs/EPIC-3/PLAN.md E3-4):
//   • signature validation against PLATFORM_STRIPE_WEBHOOK_SECRET
//     — without a configured secret the endpoint REFUSES to
//     process (honest, fail-closed)
//   • idempotency: PlatformBillingEvent.stripeEventId is UNIQUE —
//     a retried delivery can never be applied or recorded twice
//   • tenant scoping from provider metadata only (orgId set at
//     checkout) or a local subscription lookup — the route never
//     guesses an org
//   • entitlement changes ONLY via entitlementPlanFor() rules
// ============================================================

import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import {
  getPlatformStripeClient,
  platformWebhookSecret,
} from "@/lib/payments/stripe-platform"
import {
  entitlementPlanFor,
  isHandledPlatformEventType,
  planIdForPlatformPrice,
  snapshotFromStripeSubscription,
  subscriptionUpdateFromSnapshot,
  type SubscriptionSnapshot,
} from "@/lib/payments/subscription-state"
import { recordPlatformWebhookFailure } from "@/lib/platform/webhook-failure-recorder"

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get("stripe-signature")

  if (!signature) {
    // E4-3: every failure is recorded (§10) — never silently dropped.
    // Unverified bodies are stored only as a truncated diagnostic
    // snippet; no id/type is ever parsed out of them.
    await recordPlatformWebhookFailure({
      reason: "missing_signature",
      payload: body,
    })
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  // Fail-closed: without the configured platform secret nothing is
  // processed — we never validate against guessed/fallback secrets.
  const secret = platformWebhookSecret()
  const stripe = getPlatformStripeClient()
  if (!secret || !stripe) {
    console.error("[platform-billing] webhook received but platform billing is not configured")
    await recordPlatformWebhookFailure({
      reason: "not_configured",
      payload: body,
    })
    return NextResponse.json({ error: "Platform billing not configured" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    console.error(
      "[platform-billing] signature verification failed:",
      err instanceof Error ? err.message : err
    )
    await recordPlatformWebhookFailure({
      reason: "signature_invalid",
      detail: err instanceof Error ? err.message : String(err),
      payload: body,
    })
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 })
  }

  if (!isHandledPlatformEventType(event.type)) {
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event)
        break
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event)
        break
      case "invoice.paid":
      case "invoice.payment_failed":
        await handleInvoiceEvent(event)
        break
    }
  } catch (err) {
    // Duplicate replays short-circuit via the unique event id —
    // anything else is logged AND recorded (E4-3) for ops; the guarded
    // applies are replay-safe, so a manual resend from the dashboard
    // is safe.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error(`[platform-billing] error processing ${event.type}:`, err)
    await recordPlatformWebhookFailure({
      reason: "processing_error",
      stripeEventId: event.id,
      type: event.type,
      detail: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ------------------------------------------------------------
// Tenant scoping — provider metadata first, local lookup second,
// NEVER a guess.
// ------------------------------------------------------------

async function resolveOrgId(
  metadataOrgId: string | null | undefined,
  stripeSubscriptionId: string | null
): Promise<string | null> {
  if (metadataOrgId) {
    const org = await prisma.organization.findUnique({
      where: { id: metadataOrgId },
      select: { id: true },
    })
    if (org) return org.id
    console.error(`[platform-billing] metadata orgId ${metadataOrgId} does not exist`)
    return null
  }
  if (stripeSubscriptionId) {
    const sub = await prisma.platformSubscription.findUnique({
      where: { stripeSubscriptionId },
      select: { organizationId: true },
    })
    return sub?.organizationId ?? null
  }
  return null
}

// ------------------------------------------------------------
// checkout.session.completed — persist provider identifiers and
// clear the pending checkout intent. Status stays authoritative
// with the subscription events (arrives regardless of order).
// ------------------------------------------------------------
async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  if (session.mode !== "subscription") return

  const metadata = session.metadata
  const orgId = await resolveOrgId(metadata?.orgId, session.subscription as string | null)
  if (!orgId) {
    console.error(`[platform-billing] checkout session ${session.id}: no tenant scoping, skipping`)
    await recordPlatformWebhookFailure({
      reason: "no_tenant_scope",
      stripeEventId: event.id,
      type: event.type,
      detail: `checkout session ${session.id} has no resolvable tenant (metadata orgId: ${metadata?.orgId ?? "none"})`,
    })
    return
  }

  const planId = metadata?.planId || null

  await prisma.platformSubscription.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      status: "INCOMPLETE",
      plan: planId || "free",
      // pending intent is fulfilled by the provider's confirmation
      pendingCheckoutSessionId: null,
      pendingPlanId: null,
      pendingAt: null,
    },
    update: {
      ...(typeof session.subscription === "string" ? { stripeSubscriptionId: session.subscription } : {}),
      ...(typeof session.customer === "string" ? { stripeCustomerId: session.customer } : {}),
      ...(planId ? { plan: planId } : {}),
      pendingCheckoutSessionId: null,
      pendingPlanId: null,
      pendingAt: null,
    },
  })

  const local = await prisma.platformSubscription.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  })

  await recordEvent({
    stripeEventId: event.id,
    organizationId: orgId,
    subscriptionId: local?.id ?? null,
    type: event.type,
    amountCents: session.amount_total ?? null,
    currency: session.currency ?? null,
    plan: planId,
    periodStart: null,
    periodEnd: null,
  })

  console.log(`[platform-billing] checkout completed for org ${orgId} (plan ${planId})`)
}

// ------------------------------------------------------------
// customer.subscription.* — the authoritative state carrier.
// Guarded apply + entitlement rule.
// ------------------------------------------------------------
async function handleSubscriptionEvent(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription
  const snapshot = snapshotFromStripeSubscription(sub)

  const orgId = await resolveOrgId(sub.metadata?.orgId, snapshot.stripeSubscriptionId)
  if (!orgId) {
    console.error(`[platform-billing] subscription ${sub.id}: no tenant scoping, skipping`)
    await recordPlatformWebhookFailure({
      reason: "no_tenant_scope",
      stripeEventId: event.id,
      type: event.type,
      detail: `subscription ${sub.id} has no resolvable tenant (metadata orgId: ${sub.metadata?.orgId ?? "none"})`,
    })
    return
  }

  const local = await upsertSubscriptionRow(orgId, snapshot, sub.id)

  // Guarded apply — a replayed event that would change nothing is a no-op.
  const update = local
    ? subscriptionUpdateFromSnapshot(
        {
          status: local.status,
          plan: local.plan,
          currentPeriodStart: local.currentPeriodStart,
          currentPeriodEnd: local.currentPeriodEnd,
          cancelAtPeriodEnd: local.cancelAtPeriodEnd,
        },
        snapshot
      )
    : null

  if (update) {
    await prisma.platformSubscription.update({
      where: { organizationId: orgId },
      data: update,
    })
  }

  // ENTITLEMENTS — Organization.plan moves ONLY through this rule.
  const entitlement = entitlementPlanFor(snapshot)
  if (entitlement) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    })
    if (org && org.plan !== entitlement) {
      await prisma.organization.update({ where: { id: orgId }, data: { plan: entitlement } })
      console.log(`[platform-billing] entitlement org ${orgId}: ${org.plan} → ${entitlement}`)
    }
  }

  await recordEvent({
    stripeEventId: event.id,
    organizationId: orgId,
    subscriptionId: local?.id ?? null,
    type: event.type,
    amountCents: null,
    currency: null,
    plan: snapshot.planId,
    periodStart: snapshot.currentPeriodStart,
    periodEnd: snapshot.currentPeriodEnd,
  })
}

// ------------------------------------------------------------
// invoice.* — billing history only; the subscription state rides
// on customer.subscription.* events (single source of truth).
// ------------------------------------------------------------
async function handleInvoiceEvent(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice

  // This API version carries the subscription under
  // invoice.parent.subscription_details (may be null for legacy invoices).
  const parentSub =
    invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details?.subscription
      : null
  const subscriptionId = typeof parentSub === "string" ? parentSub : null

  // Invoice metadata is an immutable snapshot of the subscription
  // metadata at finalization time — usable for direct org scoping.
  const metadataOrgId =
    (invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details?.metadata?.orgId
      : null) ?? invoice.metadata?.orgId ?? null

  const orgId = await resolveOrgId(metadataOrgId, subscriptionId)
  if (!orgId) {
    console.error(`[platform-billing] invoice ${invoice.id}: no tenant scoping, skipping`)
    await recordPlatformWebhookFailure({
      reason: "no_tenant_scope",
      stripeEventId: event.id,
      type: event.type,
      detail: `invoice ${invoice.id} has no resolvable tenant (metadata orgId: ${metadataOrgId ?? "none"})`,
    })
    return
  }

  const local = await prisma.platformSubscription.findUnique({
    where: { organizationId: orgId },
    select: { id: true, plan: true },
  })

  // Plan attribution: price-id mapping → local row (never a guess beyond that).
  const priceId = invoicePriceId(invoice)
  const planFromPrice = priceId ? planIdForPlatformPrice(priceId) : null
  const plan =
    planFromPrice ||
    (local?.plan && local.plan !== "free" ? local.plan : null) ||
    undefined

  await recordEvent({
    stripeEventId: event.id,
    organizationId: orgId,
    subscriptionId: local?.id ?? null,
    type: event.type,
    amountCents: invoice.amount_paid ?? null,
    currency: invoice.currency ?? null,
    plan: plan ?? null,
    periodStart: tsToDate(invoice.period_start),
    periodEnd: tsToDate(invoice.period_end),
  })

  console.log(`[platform-billing] ${event.type} recorded for org ${orgId}`)
}

function tsToDate(ts: number | null | undefined): Date | null {
  return typeof ts === "number" && Number.isFinite(ts) ? new Date(ts * 1000) : null
}

/** Price id of the invoice's first line (this API version nests it under pricing.price_details). */
function invoicePriceId(invoice: Stripe.Invoice): string | null {
  const line = invoice.lines?.data?.[0]
  const pricing = line?.pricing
  return pricing?.type === "price_details" ? (pricing.price_details?.price ?? null) : null
}

// ------------------------------------------------------------
// Upsert the local subscription row for a provider snapshot.
// ------------------------------------------------------------
async function upsertSubscriptionRow(
  orgId: string,
  snapshot: SubscriptionSnapshot,
  stripeSubscriptionId: string | null
) {
  const existing = await prisma.platformSubscription.findUnique({
    where: { organizationId: orgId },
  })

  if (existing) return existing

  return prisma.platformSubscription.create({
    data: {
      organizationId: orgId,
      status: snapshot.status,
      plan: snapshot.planId,
      stripeSubscriptionId: snapshot.stripeSubscriptionId ?? stripeSubscriptionId,
      stripeCustomerId: snapshot.stripeCustomerId,
      stripePriceId: snapshot.stripePriceId,
      currentPeriodStart: snapshot.currentPeriodStart,
      currentPeriodEnd: snapshot.currentPeriodEnd,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      canceledAt: snapshot.canceledAt,
    },
  })
}

// ------------------------------------------------------------
// Billing history. The unique stripeEventId makes this the
// idempotency lock: a duplicate insert means the event was
// already processed, which callers treat as success.
// ------------------------------------------------------------
async function recordEvent(data: {
  stripeEventId: string
  organizationId: string
  subscriptionId: string | null
  type: string
  amountCents: number | null
  currency: string | null
  plan: string | null
  periodStart: Date | null
  periodEnd: Date | null
}) {
  try {
    await prisma.platformBillingEvent.create({ data })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Already recorded (replay) — safe, guarded applies are no-ops.
      console.log(`[platform-billing] event ${data.stripeEventId} already recorded (replay)`)
      return
    }
    throw err
  }
}
