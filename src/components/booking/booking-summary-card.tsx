import { useFormatPrice } from "@/lib/currency"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  WarningCircleIcon,
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  SpinnerGapIcon,
} from "@/components/icons"
import { format } from "date-fns"
import { sl } from "date-fns/locale"
import { AvailableStaffMember, TimeSlot } from "@/lib/interfaces"

interface BookingSummaryCardProps {
  service: {
    name: string
    price: number
    duration: number
  } | null
  selectedStaff?: AvailableStaffMember
  selectedDate?: Date
  selectedTime?: string
  salonConfig: {
    bookingDeposit: number
    depositRefundable: boolean
  }
  submitting: boolean
  error: string | null
  availableSlots: TimeSlot[]
  isEmployee?: boolean
}

export function BookingSummaryCard({
  service,
  selectedStaff,
  selectedDate,
  selectedTime,
  salonConfig,
  submitting,
  error,
  availableSlots,
  isEmployee = false,
}: BookingSummaryCardProps) {
  const fmt = useFormatPrice()
  const selectedSlot = availableSlots.find((s) => s.time === selectedTime)

  // Calculate employee discount (20%)
  const employeeDiscountRate = 0.20
  const originalPrice = service?.price || 0
  const discountAmount = isEmployee ? originalPrice * employeeDiscountRate : 0
  const finalPrice = originalPrice - discountAmount

  return (
    <div className="space-y-4">
      <Card className="sticky top-4 border-border/50 shadow-xl">
        <CardHeader className="rounded-t-lg bg-linear-to-br from-primary/10 via-primary/5 to-accent/10 dark:from-primary/20 dark:via-primary/10 dark:to-accent/15">
          <CardTitle className="text-foreground">Povzetek rezervacije</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-muted-foreground">Storitev</p>
              <p className="text-base font-medium text-foreground">{service?.name || "Ni izbrano"}</p>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <p className="font-semibold text-muted-foreground">Osebje</p>
              <p className="text-base font-medium text-foreground">
                {selectedStaff ? selectedStaff.name : "Ni izbrano"}
              </p>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <p className="font-semibold text-muted-foreground">Datum in ura</p>
              <p className="text-base font-medium text-foreground">
                {selectedDate && selectedTime ? (
                  <>
                    <CalendarIcon
                      size={14}
                      className="mr-1 inline text-primary"
                      weight="regular"
                    />
                    {format(selectedDate, "d. MMMM yyyy", { locale: sl })} ob{" "}
                    {selectedSlot?.formattedTime || selectedTime}
                  </>
                ) : (
                  "Ni izbrano"
                )}
              </p>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <p className="font-semibold text-muted-foreground">Trajanje</p>
              <p className="text-base font-medium text-foreground">
                <ClockIcon size={14} className="mr-1 inline text-primary" weight="regular" />
                {service?.duration || 0} minut
              </p>
            </div>
          </div>

          <Separator className="my-4 bg-border/50" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cena storitve</span>
              <span className="font-medium text-foreground">{fmt(originalPrice)}</span>
            </div>
            {isEmployee && (
              <div className="flex justify-between text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <span>Popust za zaposlene (20&nbsp;%)</span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}
            {isEmployee && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-foreground">Končna cena</span>
                <span className="text-primary">{fmt(finalPrice)}</span>
              </div>
            )}
            <Separator className="my-2 bg-border/50" />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-foreground">Obvezni polog</span>
              {isEmployee ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Ni potreben
                </span>
              ) : (
                <span className="text-primary">
                  {fmt(salonConfig.bookingDeposit)}
                </span>
              )}
            </div>
          </div>

          {/* Non-refundable warning - only show for non-employees */}
          {!isEmployee ? (
            <div className="rounded-xl border-2 border-amber-400 bg-white p-4 dark:border-amber-600 dark:bg-amber-950/40!">
              <div className="flex gap-3">
                <WarningCircleIcon
                  size={32}
                  weight="fill"
                  className="shrink-0 text-amber-700 dark:text-amber-400"
                />
                <div className="space-y-1">
                  <p className="text-base font-bold text-amber-950 dark:text-amber-300">
                    Nepovratni polog
                  </p>
                  <p className="text-sm text-amber-900 dark:text-amber-400">
                    Polog {fmt(salonConfig.bookingDeposit)} je potreben za
                    potrditev termina in je{" "}
                    <strong className="font-bold">nepovraten</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-emerald-400 bg-emerald-100 p-4 dark:border-emerald-600 dark:bg-emerald-950/50">
              <div className="flex gap-3">
                <div className="shrink-0 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  ✓
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                    Rezervacija zaposlenega
                  </p>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Polog ni potreben. Plačilo bo obračunano po opravljeni
                    storitvi.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3 pt-6">
          {error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive w-full rounded-lg border-2 p-3 text-sm">
              <WarningCircleIcon
                size={16}
                className="mr-1 inline"
                weight="regular"
              />
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="w-full text-base shadow-lg transition-all hover:scale-105"
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <SpinnerGapIcon
                size={20}
                className="animate-spin"
                weight="regular"
              />
            ) : isEmployee ? (
              <>
                <CurrencyDollarIcon size={20} className="mr-2" weight="regular" />
                Potrdi rezervacijo zaposlenega
              </>
            ) : (
              <>
                <CurrencyDollarIcon size={20} className="mr-2" weight="regular" />
                Plačaj {fmt(salonConfig.bookingDeposit)} in potrdi rezervacijo
              </>
            )}
          </Button>

          {/* Test Mode Indicator */}
          {process.env.NODE_ENV === "development" && (
            <div className="w-full rounded-lg border border-border bg-muted/50 p-3 text-xs">
              <p className="mb-1 font-bold text-muted-foreground">
                Testni način – brez pravih obremenitev
              </p>
              <p className="text-muted-foreground">
                Kartica: <code className="rounded bg-background px-1.5 py-0.5 font-mono font-bold text-foreground">4242 4242 4242 4242</code>
              </p>
              <p className="text-muted-foreground">
                Veljavnost: katerikoli prihodnji datum • CVV: katerikoli 3-mestni
              </p>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
