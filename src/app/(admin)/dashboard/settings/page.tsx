import { getSalonSettings } from "@/app/actions/settings"
import { SettingsForm } from "@/components/dashboard/settings-form"
import { BrandingEditor } from "@/components/dashboard/branding-editor"
import { SettingsTabs } from "@/components/dashboard/settings-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SettingsPage() {
  const settings = await getSalonSettings()

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nastavitve</CardTitle>
          <CardDescription>
            Nastavitev ni bilo mogoče naložiti. Poskusite osvežiti stran.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  return (
    <SettingsTabs
      basic={<SettingsForm initialSettings={settings} />}
      branding={<BrandingEditor />}
    />
  )
}
