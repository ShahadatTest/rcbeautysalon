-- EPIC #4 E4-3: platform webhook failure log (§10).
--
-- Additive and idempotent: one new platform-level table, no changes to
-- existing tables, no backfill. Deliberately NOT org-scoped — many
-- failures (rejected signature, malformed body) carry no trusted org
-- context. PlatformBillingEvent stays the pure idempotency lock:
-- failures are recorded here so Stripe's replay of a failed delivery
-- can never be mistaken for an already-processed duplicate.
CREATE TABLE IF NOT EXISTS "PlatformWebhookFailure" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "type" TEXT,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "payloadSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformWebhookFailure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformWebhookFailure_createdAt_idx" ON "PlatformWebhookFailure"("createdAt");
CREATE INDEX IF NOT EXISTS "PlatformWebhookFailure_reason_createdAt_idx" ON "PlatformWebhookFailure"("reason", "createdAt");
