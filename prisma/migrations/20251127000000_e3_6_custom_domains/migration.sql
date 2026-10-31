-- EPIC #3 E3-6: custom domains (issue #3 §7).
-- Additive only — one new table. No existing column or row is
-- touched; the 7 production tenants are unaffected (they simply
-- have zero CustomDomain rows and keep serving on path URLs).

-- ------------------------------------------------------------
-- CustomDomain — a tenant-owned hostname pointed at the platform.
-- status is driven EXCLUSIVELY by provider confirmation (Vercel
-- Domains API); the app never marks a domain VERIFIED on its own.
-- `domain` is UNIQUE across the whole platform — one host can
-- belong to at most one tenant (conflict prevention, §7).
-- ------------------------------------------------------------
CREATE TABLE "CustomDomain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "dnsRecords" JSONB,
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- Lookup indexes
CREATE UNIQUE INDEX "CustomDomain_domain_key" ON "CustomDomain"("domain");
CREATE INDEX "CustomDomain_organizationId_idx" ON "CustomDomain"("organizationId");
CREATE INDEX "CustomDomain_organizationId_status_idx" ON "CustomDomain"("organizationId", "status");

-- Foreign key
ALTER TABLE "CustomDomain"
  ADD CONSTRAINT "CustomDomain_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
