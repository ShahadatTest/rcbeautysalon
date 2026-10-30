import { Suspense } from "react"
import type { Metadata } from "next"
import { RegisterForm } from "@/components/auth/register-form"
import { RegisterSkeleton } from "@/components/auth/register-skeleton"

export const metadata: Metadata = {
  title: "Registracija | RC Beauty Salon",
  description: "Ustvarite račun RC Beauty Salon za rezervacijo terminov, nakup izdelkov in upravljanje svoje lepote izkušnje.",
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterSkeleton />}>
      <RegisterForm />
    </Suspense>
  )
}
