import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { ResetPasswordSkeleton } from "@/components/auth/reset-password-skeleton"

export const metadata: Metadata = {
  title: "Ponastavitev gesla | RC Beauty Salon",
  description: "Ustvarite novo geslo za svoj račun RC Beauty Salon.",
}

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams

  if (!token) {
    redirect("/forgot-password")
  }

  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordForm token={token} />
    </Suspense>
  )
}
