import { getSalonSettings } from "@/app/actions/settings"
import { getPublicationStatus } from "@/app/actions/publication"
import { SettingsForm } from "@/components/dashboard/settings-form"
import { BrandingEditor } from "@/components/dashboard/branding-editor"
import { PaymentsSettings } from "@/components/dashboard/payments-settings"
import { ProfileOverview } from "@/components/dashboard/profile-overview"
import { ModulesConfigurator } from "@/components/dashboard/modules-configurator"
import { PublicationCard } from "@/components/dashboard/publication-card"
import { PlanUsageCard } from "@/components/dashboard/plan-usage-card"
import { SettingsTabs } from "@/components/dashboard/settings-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerI18n } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"
import { getSessionPlanContext } from "@/lib/plans/resolve"
import { loadBillingOverview } from "@/lib/payments/billing-overview"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>
}) {
  const [{ t }, params, settings, publication, org, planContext] = await Promise.all([
    getServerI18n(),
    searchParams,
    getSalonSettings(),
    getPublicationStatus(),
    getSessionOrg(),
    getSessionPlanContext(),
  ])

  // Billing read model depends on the resolved tenant — one extra
  // sequential read after the parallel block above.
  const billing = org ? await loadBillingOverview(org.id) : null

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.title}</CardTitle>
          <CardDescription>{t.settings.loadError}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  return (
    <SettingsTabs
      basic={
        <div className="space-y-6">
          <PlanUsageCard
            initial={
              planContext
                ? {
                    planId: planContext.planId,
                    usage: { ...planContext.usage },
                  }
                : null
            }
            billing={
              billing
                ? {
                    paymentsConfigured: billing.paymentsConfigured,
                    subscription: billing.subscription,
                    history: billing.history.map((e) => ({
                      id: e.id,
                      type: e.type,
                      amountCents: e.amountCents,
                      currency: e.currency,
                      createdAt: e.createdAt,
                    })),
                  }
                : null
            }
            billingFlag={params.billing ?? null}
          />
          <PublicationCard
            initial={publication}
            siteHref={org ? `/s/${org.slug}` : null}
          />
          <ProfileOverview />
          <SettingsForm initialSettings={settings} />
        </div>
      }
      modules={<ModulesConfigurator />}
      branding={<BrandingEditor />}
      payments={<PaymentsSettings />}
    />
  )
}
