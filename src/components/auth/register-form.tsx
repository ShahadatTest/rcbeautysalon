"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
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
import { SpinnerIcon } from "@/components/icons"
import { toast } from "sonner"
import { Logo } from "@/components/ui/logo"
import { registerSchema, type RegisterInput } from "@/lib/validations/auth"
import { registerUser } from "@/app/actions/auth"
import { useI18n } from "@/lib/i18n/provider"

export function RegisterForm() {
  const router = useRouter()
  const { t } = useI18n()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    const result = await registerUser(data)

    if (!result.success) {
      const errorMessage =
        result.errors?.[0]?.message || t.auth.register.toast.failedDescription
      toast.error(t.auth.register.toast.failed, {
        description: errorMessage,
      })
      return
    }

    toast.success(t.auth.register.toast.created, {
      description: t.auth.register.toast.createdDescription,
      duration: 6000,
    })

    router.push("/login")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-6 flex justify-center">
            <Logo variant="auth" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t.auth.register.createAccountTitle}
          </CardTitle>
          <CardDescription className="text-center">
            {t.auth.register.getStarted}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.auth.register.fullName}</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                disabled={isSubmitting}
                autoComplete="name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.register.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                disabled={isSubmitting}
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.register.password}</Label>
              <Input
                id="password"
                type="password"
                disabled={isSubmitting}
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-destructive text-sm">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.auth.register.confirmPassword}</Label>
              <Input
                id="confirmPassword"
                type="password"
                disabled={isSubmitting}
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-sm">
                  {errors.confirmPassword.message}
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
              {t.auth.register.createAccountBtn}
            </Button>

            <Separator />

            <div className="text-muted-foreground text-center text-sm">
              {t.auth.register.haveAccount}{" "}
              <Link
                href="/login"
                className="text-primary font-medium hover:underline"
              >
                {t.auth.register.signIn}
              </Link>
            </div>

            <div className="text-center">
              <Link
                href="/"
                className="text-muted-foreground hover:text-primary text-sm"
              >
                {t.auth.register.backToHome}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
