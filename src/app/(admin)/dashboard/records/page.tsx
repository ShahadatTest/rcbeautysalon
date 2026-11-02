import { getExtensionEntities } from "@/app/actions/records"
import { getServerI18n } from "@/lib/i18n/server"
import { RecordsClient } from "@/components/admin/records/records-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requirePagePermission } from "@/lib/auth/guards"

// ============================================================
// EXTENSION RECORDS PAGE (EPIC #1 §13 — Phase 6)
// Universal registry UI for the entities declared by the
// tenant's enabled extensions (vehicles + tire sets for the
// workshop, harvest batches for beekeeping, …). The fields,
// labels and layout are fully data-driven from the extension
// registry — no industry-specific code exists on this page.
// Rendered only for extension-capable profiles (nav gate).
// ============================================================

export default async function RecordsPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("workorders.manage")
  const [{ t }, entities] = await Promise.all([
    getServerI18n(),
    getExtensionEntities(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t.common.nav.records}
        </h1>
        <p className="text-muted-foreground">
          {t.recordsPage.subtitle}
        </p>
      </div>

      {entities.length === 0 ? (
        <Alert>
          <AlertTitle>{t.recordsPage.emptyTitle}</AlertTitle>
          <AlertDescription>{t.recordsPage.emptyHint}</AlertDescription>
        </Alert>
      ) : (
        <RecordsClient entities={entities} />
      )}
    </div>
  )
}
