import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface CustomerInfoStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any
  isAuthenticated: boolean
}

export function CustomerInfoStep({ register, errors, isAuthenticated }: CustomerInfoStepProps) {
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
              placeholder="Janez"
              disabled={isAuthenticated}
              {...register("firstName")}
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
              placeholder="Novak"
              disabled={isAuthenticated}
              {...register("lastName")}
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
            type="email"
            placeholder="janez@primer.si"
            disabled={isAuthenticated}
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            Telefon <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="040 123 456"
            {...register("phone")}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Posebne želje (neobvezno)</Label>
          <Textarea
            id="notes"
            placeholder="Kakšne posebne želje ali preference?"
            rows={3}
            {...register("notes")}
          />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
