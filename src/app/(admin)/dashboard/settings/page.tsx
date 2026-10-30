import { getSalonSettings } from "@/app/actions/settings"
import { SettingsForm } from "@/components/dashboard/settings-form"
import { BrandingEditor } from "@/components/dashboard/branding-editor"
import { PaymentsSettings } from "@/components/dashboard/payments-settings"
import { SettingsTabs } from "@/components/dashboard/settings-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerI18n } from "@/lib/i18n/server"

export default async function SettingsPage() {
  const [{ t }, settings] = await Promise.all([getServerI18n(), getSalonSettings()])

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
      basic={<SettingsForm initialSettings={settings} />}
      branding={<BrandingEditor />}
      payments={<PaymentsSettings />}
    />
  )
}
