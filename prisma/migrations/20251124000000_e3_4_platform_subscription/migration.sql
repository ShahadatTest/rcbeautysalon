-- EPIC #3 E3-4: platform subscriptions + billing history.
-- Additive only — two new tables and FKs; no existing column or
-- row is touched (the 7 production tenants keep working verbatim;
-- they simply have no PlatformSubscription row until they subscribe).

-- ------------------------------------------------------------
-- PlatformSubscription — one row per tenant (unique org).
-- State is driven EXCLUSIVELY by provider webhook events.
-- ------------------------------------------------------------
CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "pendingCheckoutSessionId" TEXT,
    "pendingPlanId" TEXT,
    "pendingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- PlatformBillingEvent — immutable billing history; the unique
-- stripeEventId is the webhook idempotency key.
-- ------------------------------------------------------------
CREATE TABLE "PlatformBillingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER,
    "currency" TEXT,
    "plan" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformBillingEvent_pkey" PRIMARY KEY ("id")
);

-- Unique + lookup indexes
CREATE UNIQUE INDEX "PlatformSubscription_organizationId_key" ON "PlatformSubscription"("organizationId");
CREATE UNIQUE INDEX "PlatformSubscription_stripeSubscriptionId_key" ON "PlatformSubscription"("stripeSubscriptionId");
CREATE INDEX "PlatformSubscription_status_idx" ON "PlatformSubscription"("status");

CREATE UNIQUE INDEX "PlatformBillingEvent_stripeEventId_key" ON "PlatformBillingEvent"("stripeEventId");
CREATE INDEX "PlatformBillingEvent_organizationId_createdAt_idx" ON "PlatformBillingEvent"("organizationId", "createdAt" DESC);

-- Foreign keys
ALTER TABLE "PlatformSubscription"
  ADD CONSTRAINT "PlatformSubscription_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformBillingEvent"
  ADD CONSTRAINT "PlatformBillingEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformBillingEvent"
  ADD CONSTRAINT "PlatformBillingEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "PlatformSubscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
