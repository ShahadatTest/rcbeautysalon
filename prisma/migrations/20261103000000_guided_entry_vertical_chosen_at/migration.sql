-- Guided entry ("vodeni vstop") — dashboard wizard that asks the owner
-- WHO they are (frizer / vulkanizer / kozmetika / …) before the
-- workspace opens, and re-scopes modules + terminology on change.
-- NULL = wizard still pending for this tenant (existing tenants see it
-- once; confirming the current vertical is non-destructive).
ALTER TABLE "Organization" ADD COLUMN "verticalChosenAt" TIMESTAMP(3);
