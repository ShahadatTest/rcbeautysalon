-- Guided entry second-level answers (P2): the wizard asks "how many
-- people work here?" and "do you want 24/7 online bookings?" and the
-- answers VISIBLY change the product (solo → staff step removed from
-- the activation checklist; no-booking → publish step reworded).
ALTER TABLE "Organization" ADD COLUMN "onboardingAnswers" JSONB;
