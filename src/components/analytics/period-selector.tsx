"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PeriodType } from "@/lib/interfaces"
import { CalendarIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"

interface PeriodSelectorProps {
  value: PeriodType
}

const periods: { value: PeriodType }[] = [
  { value: "7d" },
  { value: "30d" },
  { value: "90d" },
  { value: "12m" },
]

export function PeriodSelector({ value }: PeriodSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  const handleChange = (newPeriod: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", newPeriod)
    router.push(`?${params.toString()}`)
  }

  const currentLabel =
    t.analytics.period[value] || t.analytics.period["30d"]

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-48">
        <CalendarIcon size={16} className="mr-2 text-muted-foreground" />
        <SelectValue placeholder={currentLabel} />
      </SelectTrigger>
      <SelectContent>
        {periods.map((period) => (
          <SelectItem key={period.value} value={period.value}>
            {t.analytics.period[period.value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
