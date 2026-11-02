import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/lib/i18n/provider"

// F1 (E3-8 follow-up): the booking form submits through the React 19
// `action={}` pathway, which resets UNCONTROLLED inputs after every
// action submission — so all customer fields are controlled here and
// immune to that reset (React re-renders the state value back).

interface CustomerInfoStepProps {
  values: {
    firstName: string
    lastName: string
    email: string
    phone: string
    notes: string
  }
  onChange: (field: keyof CustomerInfoStepProps["values"], value: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any
  isAuthenticated: boolean
}

export function CustomerInfoStep({ values, onChange, errors, isAuthenticated }: CustomerInfoStepProps) {
  const { t } = useI18n()
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
            4
          </div>
          <CardTitle>{t.booking.yourDetails}</CardTitle>
        </div>
        <CardDescription>
          {isAuthenticated
            ? t.booking.confirmDetailsDesc
            : t.booking.enterDetailsDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              {t.booking.firstName} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              placeholder={t.booking.firstNamePlaceholder}
              disabled={isAuthenticated}
              value={values.firstName}
              onChange={(e) => onChange("firstName", e.target.value)}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">
              {t.booking.lastName} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              name="lastName"
              placeholder={t.booking.lastNamePlaceholder}
              disabled={isAuthenticated}
              value={values.lastName}
              onChange={(e) => onChange("lastName", e.target.value)}
            />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            {t.booking.email} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t.booking.emailPlaceholder}
            disabled={isAuthenticated}
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            {t.booking.phone} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={t.booking.phonePlaceholder}
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">{t.booking.specialRequests}</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder={t.booking.notesPlaceholder}
            rows={3}
            value={values.notes}
            onChange={(e) => onChange("notes", e.target.value)}
          />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
