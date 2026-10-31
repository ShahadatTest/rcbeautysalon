-- EPIC #3 E3-5: platform operator console.
-- Additive only — one new audit table, two nullable Organization
-- columns. No existing column or row is touched; the 7 production
-- tenants keep working verbatim (suspendedAt/suspendedReason stay
-- NULL for ACTIVE tenants).

-- ------------------------------------------------------------
-- PlatformAuditLog — append-only operator audit trail.
-- Every operator action (suspend/reactivate tenant) writes one
-- row: who (actorEmail), what (action), why (reason). Rows are
-- never updated or deleted.
-- ------------------------------------------------------------
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- Suspension context on the tenant root (display purpose; the
-- authoritative trail is PlatformAuditLog).
ALTER TABLE "Organization" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "suspendedReason" TEXT;

-- Lookup indexes
CREATE INDEX "PlatformAuditLog_organizationId_createdAt_idx" ON "PlatformAuditLog"("organizationId", "createdAt" DESC);
CREATE INDEX "PlatformAuditLog_action_createdAt_idx" ON "PlatformAuditLog"("action", "createdAt" DESC);

-- Foreign key
ALTER TABLE "PlatformAuditLog"
  ADD CONSTRAINT "PlatformAuditLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
