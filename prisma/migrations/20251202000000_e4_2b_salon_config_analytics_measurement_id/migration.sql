-- EPIC #4 E4-2b: optional per-tenant analytics integration (GA4).
--
-- Additive and idempotent: one nullable column, no backfill, no data
-- loss, no behavior change for rows that do not set it. The column is
-- NULL for every existing tenant — per the E4-2 honesty rule the
-- analytics script is NEVER injected until the owner explicitly saves
-- their own measurement ID in settings.
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "analyticsMeasurementId" TEXT;
