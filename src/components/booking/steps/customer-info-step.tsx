import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
            4
          </div>
          <CardTitle>Vaši podatki</CardTitle>
        </div>
        <CardDescription>
          {isAuthenticated
            ? "Potrdite svoje kontaktne podatke"
            : "Vnesite svoje kontaktne podatke"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              Ime <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              placeholder="Janez"
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
              Priimek <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              name="lastName"
              placeholder="Novak"
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
            E-pošta <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="janez@primer.si"
            disabled={isAuthenticated}
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            Telefon <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="040 123 456"
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Posebne želje (neobvezno)</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Kakšne posebne želje ali preference?"
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
