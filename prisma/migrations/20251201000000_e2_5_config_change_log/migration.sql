-- E2-5 (EPIC #2): configuration history + rollback (G5).
-- Append-only log of config edits (overrides / forms / workflows) with
-- previous/next JSON snapshots and per-org+entity monotonic version.
-- Reverts append NEW entries — history is never rewritten or deleted.
CREATE TABLE "ConfigChangeLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "previous" JSONB,
    "next" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConfigChangeLog_organizationId_createdAt_idx" ON "ConfigChangeLog"("organizationId", "createdAt");
CREATE INDEX "ConfigChangeLog_organizationId_entityKey_idx" ON "ConfigChangeLog"("organizationId", "entityKey");
CREATE UNIQUE INDEX "ConfigChangeLog_organizationId_entityKey_version_key" ON "ConfigChangeLog"("organizationId", "entityKey", "version");

ALTER TABLE "ConfigChangeLog" ADD CONSTRAINT "ConfigChangeLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
