import { getSalonSettings } from "@/app/actions/settings"
import { getPublicationStatus } from "@/app/actions/publication"
import { SettingsForm } from "@/components/dashboard/settings-form"
import { BrandingEditor } from "@/components/dashboard/branding-editor"
import { PaymentsSettings } from "@/components/dashboard/payments-settings"
import { ProfileOverview } from "@/components/dashboard/profile-overview"
import { ModulesConfigurator } from "@/components/dashboard/modules-configurator"
import { PublicationCard } from "@/components/dashboard/publication-card"
import { SettingsTabs } from "@/components/dashboard/settings-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerI18n } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"

export default async function SettingsPage() {
  const [{ t }, settings, publication, org] = await Promise.all([
    getServerI18n(),
    getSalonSettings(),
    getPublicationStatus(),
    getSessionOrg(),
  ])

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
