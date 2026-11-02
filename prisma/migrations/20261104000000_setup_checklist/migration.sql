-- Activation checklist ("vodena namestitev") — owner UI state only
-- (dismissed/reopened). Step completion is DERIVED from business data,
-- never stored here. See src/lib/profiles/setup-checklist.ts.
ALTER TABLE "Organization" ADD COLUMN "setupChecklist" JSONB;
