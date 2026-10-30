"use client"

// Client wrapper so the settings page can render both forms inside
// shadcn Tabs. Contents are force-mounted so unsaved state survives
// switching between the two tabs.

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SettingsTabsProps {
  basic: ReactNode
  branding: ReactNode
}

export function SettingsTabs({ basic, branding }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="basic">
      <TabsList>
        <TabsTrigger value="basic">Osnovne nastavitve</TabsTrigger>
        <TabsTrigger value="branding">Izgled in vsebina</TabsTrigger>
      </TabsList>
      <TabsContent value="basic" forceMount className="mt-6 data-[state=inactive]:hidden">
        {basic}
      </TabsContent>
      <TabsContent value="branding" forceMount className="mt-6 data-[state=inactive]:hidden">
        {branding}
      </TabsContent>
    </Tabs>
  )
}
