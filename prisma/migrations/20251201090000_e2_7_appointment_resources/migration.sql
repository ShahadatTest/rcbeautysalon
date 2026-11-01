-- E2-7 (EPIC #2, G7): optional workspace resource on appointments.
-- An ExtensionRecord ("workspace-resources" / "workspace") as an optional
-- room/chair/station differentiator for a booking. Server-side conflict
-- check: one booking per resource at a time. SetNull on delete —
-- removing a resource never deletes appointments. Additive only.
ALTER TABLE "Appointment" ADD COLUMN "resourceRecordId" TEXT;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resourceRecordId_fkey" FOREIGN KEY ("resourceRecordId") REFERENCES "ExtensionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Appointment_resourceRecordId_idx" ON "Appointment"("resourceRecordId");
