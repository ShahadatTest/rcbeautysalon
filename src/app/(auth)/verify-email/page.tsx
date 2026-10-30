import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { verifyEmail } from "@/app/actions/auth"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VerifyEmailSkeleton } from "@/components/auth/verify-email-skeleton"
import { getServerI18n } from "@/lib/i18n/server"
import { CheckCircleIcon } from "@/components/icons/check-circle-icon"
import { XCircleIcon } from "@/components/icons/x-circle-icon"

export const metadata: Metadata = {
  title: "Verify Email | RC Beauty Salon",
  description: "Verify your RC Beauty Salon account email address.",
}

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>
}

async function VerifyEmailContent({ token }: { token: string }) {
  const [{ t }, result] = await Promise.all([getServerI18n(), verifyEmail(token)])

  if (result?.success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-6 flex justify-center">
            <Logo variant="auth" />
          </div>
          <div className="flex justify-center">
            <CheckCircleIcon size={64} weight="fill" className="text-green-500" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t.auth.verifyEmail.successTitle}
          </CardTitle>
          <CardDescription className="text-center">
            {t.auth.verifyEmail.successDescription}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full" size="lg">
            <Link href="/login">{t.auth.verifyEmail.signIn}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="mb-6 flex justify-center">
          <Logo variant="auth" />
        </div>
        <div className="flex justify-center">
          <XCircleIcon size={64} weight="fill" className="text-destructive" />
        </div>
        <CardTitle className="text-center text-2xl">
          {t.auth.verifyEmail.errorTitle}
        </CardTitle>
        <CardDescription className="text-center">
          {result?.errors?.[0]?.message ||
            t.auth.verifyEmail.errorDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-center text-sm">
          {t.auth.verifyEmail.errorDescription}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <Button asChild className="w-full" size="lg">
          <Link href="/register">{t.auth.register.createAccountBtn}</Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/">{t.auth.verifyEmail.backToHome}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { token } = await searchParams

  if (!token) {
    redirect("/register")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<VerifyEmailSkeleton />}>
        <VerifyEmailContent token={token} />
      </Suspense>
    </div>
  )
}
