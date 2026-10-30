"use client"

import { Button } from "@/components/ui/button"
import { UsersIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"

interface User {
  id: string
  name: string | null
  email: string | null
  role: string
  createdAt: Date
  customer: {
    _count: {
      appointments: number
      orders: number
    }
  } | null
}

interface ExportUsersButtonProps {
  users: User[]
}

export function ExportUsersButton({ users }: ExportUsersButtonProps) {
  const { t, locale } = useI18n()

  const handleExport = () => {
    const headers = [
      t.users.csvHeaders.name,
      t.users.csvHeaders.email,
      t.users.csvHeaders.role,
      t.users.csvHeaders.appointments,
      t.users.csvHeaders.orders,
      t.users.csvHeaders.joined,
    ]

    const rows = users.map((user) => [
      user.name || t.users.noName,
      user.email || "-",
      t.users.roleLabel(user.role),
      (user.customer?._count.appointments || 0).toString(),
      (user.customer?._count.orders || 0).toString(),
      new Date(user.createdAt).toLocaleDateString(locale === "sl" ? "sl-SI" : "en-US"),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", `users-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      <UsersIcon size={16} className="mr-2" />
      {t.users.exportList}
    </Button>
  )
}
