"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { SpinnerIcon, EnvelopeIcon } from "@/components/icons"
import { Logo } from "@/components/ui/logo"
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth"
import { forgotPassword } from "@/app/actions/auth"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"

export function ForgotPasswordForm() {
  const { t } = useI18n()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordInput) {
    const result = await forgotPassword(data)

    if (!result.success) {
      toast.error(t.auth.forgot.toast.error, { description: result.errors?.[0]?.message })
      return
    }

    toast.success(t.auth.forgot.toast.checkEmail, {
      description: t.auth.forgot.toast.checkEmailDescription,
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-6 flex justify-center">
            <Logo variant="auth" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t.auth.forgot.title}
          </CardTitle>
          <CardDescription className="text-center">
            {t.auth.forgot.description}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.forgot.email}</Label>
              <div className="relative">
                <EnvelopeIcon
                  size={18}
                  className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  disabled={isSubmitting}
                  autoComplete="email"
                  className="pl-10"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <SpinnerIcon
                  size={16}
                  weight="bold"
                  className="mr-2 animate-spin"
                />
              )}
              {t.auth.forgot.sendResetLink}
            </Button>

            <Separator />

            <div className="text-muted-foreground text-center text-sm">
              <Link
                href="/login"
                className="text-primary font-medium hover:underline"
              >
                {t.auth.forgot.backToLogin}
              </Link>
            </div>

            <div className="text-center">
              <Link
                href="/"
                className="text-muted-foreground hover:text-primary text-sm"
              >
                {t.auth.forgot.backToHome}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
