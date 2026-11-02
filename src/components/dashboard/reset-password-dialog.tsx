"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LockIcon, EyeIcon, EyeOffIcon, SparkleIcon } from "@/components/icons"
import { adminSetUserPassword } from "@/app/actions/users"
import {
  adminSetPasswordSchema,
  type AdminSetPasswordInput,
} from "@/lib/validations/auth"
import { generateStrongPassword } from "@/lib/auth/password-generator"
import { useI18n } from "@/lib/i18n/provider"
import { toast } from "sonner"

interface ResetPasswordDialogProps {
  userId: string
  userName: string
}

export function ResetPasswordDialog({ userId, userName }: ResetPasswordDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleGenerate() {
    const generated = generateStrongPassword()
    setPassword(generated)
    setConfirmPassword(generated)
    setShowPassword(true)
    setError(null)
  }

  async function handleSubmit() {
    setError(null)

    const input: AdminSetPasswordInput = { userId, password }
    const parsed = adminSetPasswordSchema.safeParse(input)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null)
      return
    }

    if (password !== confirmPassword) {
      setError(t.users.resetPassword.mismatch)
      return
    }

    setSubmitting(true)
    try {
      const result = await adminSetUserPassword(parsed.data)

      if (!result.success) {
        toast.error(t.users.resetPassword.toastFailed, {
          description: result.errors?.[0]?.message,
        })
        return
      }

      toast.success(t.users.resetPassword.toastSuccess)
      setOpen(false)
      setPassword("")
      setConfirmPassword("")
      setShowPassword(false)
    } catch {
      toast.error(t.users.resetPassword.toastFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setError(null)
          setPassword("")
          setConfirmPassword("")
          setShowPassword(false)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <LockIcon size={14} className="mr-2" />
          {t.users.resetPassword.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.users.resetPassword.title}</DialogTitle>
          <DialogDescription>
            {t.users.resetPassword.description(userName)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password-new">
              {t.users.resetPassword.newPassword}
            </Label>
            <div className="relative">
              <LockIcon
                size={18}
                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
              />
              <Input
                id="reset-password-new"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                autoComplete="new-password"
                className="pr-10 pl-10"
              />
              <button
                type="button"
                aria-label={showPassword ? "Skrij geslo" : "Prikaži geslo"}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">
              {t.users.resetPassword.confirmPassword}
            </Label>
            <div className="relative">
              <LockIcon
                size={18}
                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
              />
              <Input
                id="reset-password-confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting}
                autoComplete="new-password"
                className="pl-10"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={submitting}
          >
            <SparkleIcon size={14} className="mr-2" />
            {t.users.resetPassword.generate}
          </Button>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <p className="text-muted-foreground text-sm">
            {t.users.resetPassword.selfNote}
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || !password}>
            {submitting ? t.users.resetPassword.submitting : t.users.resetPassword.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
