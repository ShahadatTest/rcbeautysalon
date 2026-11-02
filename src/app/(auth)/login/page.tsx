import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { LoginSkeleton } from "@/components/auth/login-skeleton"

export const metadata: Metadata = {
  title: "Prijava | Poslovna platforma",
  description:
    "Prijavite se v svoj račun za upravljanje terminov, ogled storitev in dostop do posebnih funkcij.",
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
