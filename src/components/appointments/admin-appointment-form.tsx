"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, SpinnerGapIcon } from "@/components/icons"
import { format, setHours, setMinutes } from "date-fns"
import { sl } from "date-fns/locale"
import { cn } from "@/lib/utils"
import {
  adminAppointmentSchema,
  AdminAppointmentInput,
} from "@/lib/validations/admin-appointment"
import {
  getAvailableStaff,
  getAvailableTimeSlots,
  createAppointment,
} from "@/app/actions/appointments"
import { TimeSlot, AvailableStaffMember } from "@/lib/interfaces"
import { AdminAppointmentFormProps } from "@/lib/interfaces"

export default function AdminAppointmentForm({
  services,
  customers,
}: AdminAppointmentFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [availableStaff, setAvailableStaff] = useState<AvailableStaffMember[]>(
    []
  )
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminAppointmentInput>({
    resolver: zodResolver(adminAppointmentSchema),
    defaultValues: {
      serviceId: "",
      staffId: "",
      time: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      notes: "",
    },
  })

  const selectedServiceId = watch("serviceId")
  const selectedStaffId = watch("staffId")
  const selectedDate = watch("date")

  // Get selected service duration
  const selectedService = services.find((s) => s.id === selectedServiceId)
  const serviceDuration = selectedService?.duration || 60

  // Load available staff when service changes
  useEffect(() => {
    if (!selectedServiceId) {
      setAvailableStaff([])
      setValue("staffId", "")
      return
    }

    const loadStaff = async () => {
      setLoadingStaff(true)
      try {
        const staff = await getAvailableStaff(selectedServiceId)
        setAvailableStaff(staff)
        setValue("staffId", "")
        setValue("time", "")
        setAvailableSlots([])
      } catch (error) {
        console.error("Error loading staff:", error)
      } finally {
        setLoadingStaff(false)
      }
    }

    loadStaff()
  }, [selectedServiceId, setValue])

  // Load available time slots when staff, date, or service changes
  useEffect(() => {
    if (!selectedStaffId || !selectedDate || !selectedServiceId) {
      setAvailableSlots([])
      setValue("time", "")
      return
    }

    const loadSlots = async () => {
      setLoadingSlots(true)
      try {
        // "yyyy-MM-dd" — the server resolves it in the salon timezone
        const slots = await getAvailableTimeSlots(
          selectedStaffId,
          format(selectedDate, "yyyy-MM-dd"),
          serviceDuration
        )
        setAvailableSlots(slots)
        setValue("time", "")
      } catch (error) {
        console.error("Error loading time slots:", error)
      } finally {
        setLoadingSlots(false)
      }
    }

    loadSlots()
  }, [
    selectedStaffId,
    selectedDate,
    selectedServiceId,
    serviceDuration,
    setValue,
  ])

  // Auto-fill customer info when selecting from existing customers
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers?.find((c) => c.id === customerId)
    if (customer) {
      setValue("customerName", customer.name)
      setValue("customerEmail", customer.email || "")
      setValue("customerPhone", customer.phone || "")
    }
  }

  const onSubmit = async (data: AdminAppointmentInput) => {
    setIsLoading(true)

    try {
      // Combine date and time into startTime
      const [hours, minutes] = data.time.split(":").map(Number)
      const startTime = setMinutes(setHours(data.date, hours), minutes)

      const result = await createAppointment({
        serviceIds: [data.serviceId],
        staffId: data.staffId,
        startTime,
        // Preferred contract: the server builds the exact instant in the
        // salon's timezone from these salon-local strings.
        bookingDate: format(data.date, "yyyy-MM-dd"),
        bookingTime: data.time,
        guestName: data.customerName,
        guestEmail: data.customerEmail || undefined,
        guestPhone: data.customerPhone,
        notes: data.notes,
      })

      if (result.success) {
        router.push("/dashboard/appointments")
      } else {
        alert(result.error || "Ustvarjanje termina ni uspelo")
      }
    } catch (error) {
      console.error("Error creating appointment:", error)
      alert("Ustvarjanje termina ni uspelo. Poskusite znova.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Existing Customer Selection (optional) */}
      {customers && customers.length > 0 && (
        <div className="space-y-2">
          <Label>Izberi obstoječo stranko (neobvezno)</Label>
          <Select onValueChange={handleCustomerSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Išči med obstoječimi strankami …" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Izberite stranko za samodejno izpolnitev podatkov, ali jih vnesite
            ročno spodaj
          </p>
        </div>
      )}

      {/* Customer Info Section */}
      <div className="space-y-4">
        <h3 className="font-medium">Podatki stranke</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Ime *</Label>
            <Input
              id="customerName"
              placeholder="Ime stranke"
              {...register("customerName")}
            />
            {errors.customerName && (
              <p className="text-destructive text-sm">
                {errors.customerName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Telefon *</Label>
            <Input
              id="customerPhone"
              type="tel"
              placeholder="040 123 456"
              {...register("customerPhone")}
            />
            {errors.customerPhone && (
              <p className="text-destructive text-sm">
                {errors.customerPhone.message}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerEmail">E-pošta</Label>
          <Input
            id="customerEmail"
            type="email"
            placeholder="stranka@email.si"
            {...register("customerEmail")}
          />
          {errors.customerEmail && (
            <p className="text-destructive text-sm">
              {errors.customerEmail.message}
            </p>
          )}
        </div>
      </div>

      {/* Service Selection */}
      <div className="space-y-2">
        <Label>Storitev *</Label>
        <Select
          value={selectedServiceId}
          onValueChange={(value) => setValue("serviceId", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Izberite storitev" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} – €{service.price} ({service.duration} min)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.serviceId && (
          <p className="text-destructive text-sm">{errors.serviceId.message}</p>
        )}
      </div>

      {/* Staff Selection */}
      <div className="space-y-2">
        <Label>Staff Member *</Label>
        <Select
          value={selectedStaffId}
          onValueChange={(value) => setValue("staffId", value)}
          disabled={!selectedServiceId || loadingStaff}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                loadingStaff
                  ? "Loading staff..."
                  : !selectedServiceId
                    ? "Select a service first"
                    : "Select staff member"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableStaff.length === 0 && !loadingStaff ? (
              <SelectItem value="no-staff" disabled>
                No staff available for this service
              </SelectItem>
            ) : (
              availableStaff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors.staffId && (
          <p className="text-destructive text-sm">{errors.staffId.message}</p>
        )}
      </div>

      {/* Date Selection */}
      <div className="space-y-2">
        <Label>Date *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
              disabled={!selectedStaffId}
            >
              <CalendarIcon size={16} className="mr-2" />
              {selectedDate
                ? format(selectedDate, "d. MMMM yyyy", { locale: sl })
                : "Izberite datum"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setValue("date", date)}
              disabled={(date) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return date < today
              }}
            />
          </PopoverContent>
        </Popover>
        {errors.date && (
          <p className="text-destructive text-sm">{errors.date.message}</p>
        )}
      </div>

      {/* Time Selection */}
      <div className="space-y-2">
        <Label>Time *</Label>
        <Select
          value={watch("time")}
          onValueChange={(value) => setValue("time", value)}
          disabled={!selectedStaffId || !selectedDate || loadingSlots}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                loadingSlots
                  ? "Loading available times..."
                  : !selectedStaffId || !selectedDate
                    ? "Select staff and date first"
                    : "Select a time slot"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableSlots.length === 0 && !loadingSlots ? (
              <SelectItem value="no-slots" disabled>
                No available time slots
              </SelectItem>
            ) : (
              availableSlots
                .filter((slot) => slot.available)
                .map((slot) => (
                  <SelectItem key={slot.time} value={slot.time}>
                    {slot.formattedTime}
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
        {errors.time && (
          <p className="text-destructive text-sm">{errors.time.message}</p>
        )}
        <p className="text-muted-foreground text-xs">
          {availableSlots.filter((s) => s.available).length > 0
            ? `${availableSlots.filter((s) => s.available).length} time slots available`
            : "Available times will appear after selecting staff and date"}
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any special requests or notes..."
          rows={3}
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-destructive text-sm">{errors.notes.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading && (
            <SpinnerGapIcon size={18} className="mr-2 animate-spin" />
          )}
          Create Appointment
        </Button>
      </div>
    </form>
  )
}
