import { Suspense } from "react"
import type { Metadata } from "next"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { ForgotPasswordSkeleton } from "@/components/auth/forgot-password-skeleton"

export const metadata: Metadata = {
  title: "Pozabljeno geslo | Poslovna platforma",
  description: "Ponastavite geslo za svoj račun.",
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordSkeleton />}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
