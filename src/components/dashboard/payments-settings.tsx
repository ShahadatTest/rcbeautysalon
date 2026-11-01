"use client"

// Settings → Plačila: the salon owner connects their OWN Stripe account by
// pasting the secret key. The key is verified against the Stripe API before
// saving and is never returned to the browser — only a masked preview.

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EyeIcon, EyeOffIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import {
  clearStripeSettings,
  getPaymentsSettings,
  saveStripeSettings,
  type PaymentsSettings,
} from "@/app/actions/payments"

export function PaymentsSettings() {
  const { t } = useI18n()
  const tr = t.settings.payments
  const tc = t.common

  const [settings, setSettings] = useState<PaymentsSettings | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [secretKey, setSecretKey] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      const result = await getPaymentsSettings()
      if (result.success) {
        setSettings(result.settings)
      } else {
        setLoadError(true)
      }
    })
  }, [])

  const modeLabel = (mode: string) =>
    mode === "test"
      ? tr.modeTest
      : mode === "live"
        ? tr.modeLive
        : mode === "restricted"
          ? tr.modeRestricted
          : tr.modeUnknown

  const modeVariant = (mode: string) =>
    mode === "live" ? "default" : "secondary"

  const handleSave = () => {
    if (!secretKey.trim()) return

    startTransition(async () => {
      const result = await saveStripeSettings({
        secretKey,
        webhookSecret: webhookSecret || undefined,
      })

      if (result.success) {
        setSettings(result.settings)
        setSecretKey("")
        setWebhookSecret("")
        toast.success(tr.saved)
      } else {
        switch (result.errorKey) {
          case "secretKey":
            toast.error(
              result.error === "invalid_format"
                ? tr.errInvalidFormat
                : result.error === "invalid_key"
                  ? tr.errInvalidKey
                  : result.error === "verification_failed"
                    ? tr.errVerificationFailed
                    : tr.errSaveFailed
            )
            break
          case "webhookSecret":
            toast.error(tr.errInvalidWebhookFormat)
            break
          default:
            toast.error(
              result.error === "save_failed" ? tr.errSaveFailed : tr.errUnexpected
            )
        }
      }
    })
  }

  const handleRemove = () => {
    setIsRemoving(true)
    startTransition(async () => {
      const result = await clearStripeSettings()
      setIsRemoving(false)
      setRemoveOpen(false)
      if (result.success) {
        setSettings(result.settings)
        toast.success(tr.removed)
      } else {
        toast.error(tr.errUnexpected)
      }
    })
  }

  const copyWebhookUrl = async () => {
    if (!settings?.webhookUrl) return
    try {
      await navigator.clipboard.writeText(settings.webhookUrl)
      toast.success(tr.urlCopied)
    } catch {
      toast.error(tr.errUnexpected)
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tr.title}</CardTitle>
          <CardDescription>{tr.errLoadFailed}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>{tr.title}</CardTitle>
          <CardDescription>{tr.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={settings.active ? "default" : "destructive"}
                className="gap-1.5"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    settings.active ? "bg-primary-foreground" : "bg-white"
                  }`}
                  aria-hidden
                />
                {settings.active ? tr.statusEnabled : tr.statusDisabled}
              </Badge>
              {settings.active && (
                <Badge variant={modeVariant(settings.mode)}>
                  {modeLabel(settings.mode)}
                </Badge>
              )}
            </div>
          )}

          {settings?.active && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{tr.activeKey}</dt>
                <dd>
                  {tr.yourKey}:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {settings.maskedKey}
                  </code>
                </dd>
              </div>
              {settings.configuredAt && (
                <div>
                  <dt className="text-muted-foreground">{tr.configuredAt}</dt>
                  <dd>
                    {new Date(settings.configuredAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {settings && !settings.active && (
            <Alert>
              <AlertDescription>{tr.statusDisabledHint}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Key form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr.formSection}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stripe-secret-key">{tr.secretKey}</Label>
            <div className="relative">
              <Input
                id="stripe-secret-key"
                type={showKey ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={tr.secretKeyPlaceholder}
                autoComplete="off"
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? tr.hideKey : tr.showKey}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{tr.secretKeyHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripe-webhook-secret">{tr.webhookSecret}</Label>
            <Input
              id="stripe-webhook-secret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={tr.webhookSecretPlaceholder}
              autoComplete="off"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{tr.webhookSecretHint}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={isPending || !secretKey.trim()}
              className="min-h-11"
            >
              {isPending && <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? tr.saving : tr.save}
            </Button>
            {settings?.source === "settings" && (
              <Button
                variant="outline"
                onClick={() => setRemoveOpen(true)}
                disabled={isRemoving || isPending}
                className="min-h-11"
              >
                {tr.remove}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{tr.securityNote}</p>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr.webhookSection}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>{tr.webhookUrl}</Label>
            <div className="flex gap-2">
              <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">
                {settings?.webhookUrl || "…/api/webhooks/stripe"}
              </code>
              <Button variant="outline" onClick={copyWebhookUrl} className="min-h-11">
                {tr.copyUrl}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{tr.webhookUrlHint}</p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr.remove}</AlertDialogTitle>
            <AlertDialogDescription>{tr.removeConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>{tc.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRemove()
              }}
              disabled={isRemoving}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isRemoving && <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />}
              {tr.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
