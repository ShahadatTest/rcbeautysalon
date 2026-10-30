import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { LoginSkeleton } from "@/components/auth/login-skeleton"

export const metadata: Metadata = {
  title: "Prijava | RC Beauty Salon",
  description:
    "Prijavite se v svoj račun RC Beauty Salon za upravljanje terminov, ogled storitev in dostop do posebnih funkcij.",
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
