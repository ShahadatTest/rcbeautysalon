-- E2-4 (EPIC #2): secondary activity (G4) — optional second activity profile id.
-- Capability union (primary ∪ secondary); primary stays terminology/forms/workflows
-- and site content owner. Validated in src/lib/profiles/secondary.ts before writes.
-- Additive migration: no existing column is touched, NULL = no secondary activity.
ALTER TABLE "Organization" ADD COLUMN "secondaryVertical" TEXT;
