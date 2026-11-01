"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DonutChart } from "@tremor/react"
import { EnquiriesByStatus } from "@/lib/interfaces"
import { EnvelopeIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"

interface EnquiriesStatusChartProps {
  data: EnquiriesByStatus[]
}

const statusConfig: Record<string, { color: string; dotColor: string }> = {
  NEW: { color: "teal", dotColor: "bg-teal-500" },
  IN_REVIEW: { color: "amber", dotColor: "bg-amber-500" },
  PROCESSED: { color: "emerald", dotColor: "bg-emerald-500" },
}

export function EnquiriesStatusChart({ data }: EnquiriesStatusChartProps) {
  const { t } = useI18n()
  const statusLabel = (status: string) =>
    t.analytics.enquiries[status as keyof typeof t.analytics.enquiries] || status
  const chartData = data.map((item) => ({
    name: statusLabel(item.status),
    value: item.count,
    status: item.status,
  }))

  const colors = data.map(
    (item) => statusConfig[item.status]?.color || "gray"
  ) as ("teal" | "amber" | "emerald" | "gray")[]

  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-100 p-2.5 dark:bg-teal-900/30">
            <EnvelopeIcon size={20} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <CardTitle className="text-base">
              {t.analytics.enquiries.title}{" "}
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                {t.analytics.enquiries.titleAccent}
              </span>
            </CardTitle>
            <CardDescription>{t.analytics.enquiries.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length > 0 ? (
          <div className="flex flex-col items-center">
            <DonutChart
              className="h-44"
              data={chartData}
              category="value"
              index="name"
              colors={colors}
              showAnimation
              showTooltip
              valueFormatter={(value) => `${value} (${total > 0 ? ((value / total) * 100).toFixed(0) : 0}%)`}
            />
            <div className="mt-6 grid w-full grid-cols-2 gap-2">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className={`h-2.5 w-2.5 rounded-full ${statusConfig[item.status]?.dotColor || "bg-gray-500"}`} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="ml-auto font-semibold tabular-nums text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">{t.analytics.enquiries.noData}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
