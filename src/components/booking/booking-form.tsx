"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  bookingSchema,
  authenticatedBookingSchema,
} from "@/lib/validations/booking"
import { createCheckoutSession } from "@/app/actions/stripe"
import { createAppointment } from "@/app/actions/appointments"
import { ServiceStep } from "./steps/service-step"
import { ServiceSelectionStep } from "./steps/service-selection-step"
import { StaffStep } from "./steps/staff-step"
import { StaffDisplayStep } from "./steps/staff-display-step"
import { DateTimeStep } from "./steps/date-time-step"
import { CustomerInfoStep } from "./steps/customer-info-step"
import { BookingSummaryCard } from "./booking-summary-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SparkleIcon } from "@/components/icons"
import { format, isSameDay } from "date-fns"

import { BookingFormProps, BookingFormValues } from "@/lib/interfaces"

export function BookingForm(props: BookingFormProps) {
  const {
    salonConfig,
    isAuthenticated,
    isEmployee,
    defaultValues = {},
  } = props

  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")

  // Determine mode
  const isStaffFirst = props.mode === "staff-first"

  // Get the selected service based on mode
  const getSelectedService = () => {
    if (isStaffFirst) {
      return props.staffServices.find((s) => s.id === selectedServiceId)
    }
    return props.service
  }

  const selectedService = getSelectedService()

  // Use appropriate schema based on authentication status
  const schema = isAuthenticated ? authenticatedBookingSchema : bookingSchema

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(schema) as never,
    mode: "onChange",
    defaultValues: {
      staffId: isStaffFirst ? props.preselectedStaff.id : "",
      date: undefined,
      time: "",
      firstName: defaultValues.firstName || "",
      lastName: defaultValues.lastName || "",
      email: defaultValues.email || "",
      phone: "",
      notes: "",
    },
  })

  // useWatch is more compatible with React Compiler than watch()
  const staffId = useWatch({ control, name: "staffId" })
  const selectedDate = useWatch({ control, name: "date" })
  const selectedTime = useWatch({ control, name: "time" })

  // Handle service selection in staff-first mode
  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId)
  }

  const onSubmit = async (data: BookingFormValues) => {
    // Validate service is selected in staff-first mode
    if (isStaffFirst && !selectedServiceId) {
      setError("Izberite storitev")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (!data.date) {
        setError("Izberite datum")
        setSubmitting(false)
        return
      }

      // Get the service ID based on mode
      const serviceId = isStaffFirst ? selectedServiceId : props.service.id

      // Send salon-local "yyyy-MM-dd" + "HH:mm" — the server builds the
      // exact instant in the salon's timezone (no client/server drift).
      const bookingDate = format(data.date, "yyyy-MM-dd")
      const bookingTime = data.time

      // Employee flow: Create appointment directly (no Stripe payment required)
      if (isEmployee) {
        const result = await createAppointment({
          serviceIds: [serviceId],
          staffId: data.staffId,
          startTime: new Date(),
          bookingDate,
          bookingTime,
          guestPhone: data.phone || undefined,
          notes: data.notes || undefined,
          isEmployee: true, // Apply 20% discount, no deposit
        })

        if (result.success && result.appointmentId) {
          // Redirect to my-appointments with success message
          router.push(`/my-appointments?new=${result.appointmentId}`)
        } else {
          setError(result.error || "Ustvarjanje termina ni uspelo")
          setSubmitting(false)
        }
        return
      }

      // Regular customer flow: Create Stripe Checkout session and redirect to payment
      const result = await createCheckoutSession({
        serviceIds: [serviceId],
        staffId: data.staffId,
        startTime: bookingDate, // legacy field — server prefers bookingDate/bookingTime
        bookingDate,
        bookingTime,
        guestName: !isAuthenticated
          ? `${data.firstName} ${data.lastName}`
          : undefined,
        guestEmail: !isAuthenticated ? data.email : undefined,
        guestPhone: data.phone || undefined,
        notes: data.notes || undefined,
      })

      if (result.success && result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.assign(result.checkoutUrl)
      } else {
        setError(result.error || "Ustvarjanje plačila ni uspelo")
        setSubmitting(false)
      }
    } catch (err) {
      console.error("Error creating booking:", err)
      setError("Prišlo je do nepričakovane napake. Poskusite znova.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Employee Banner */}
      {isEmployee && (
        <Alert className="mb-6 border-primary/30 bg-linear-to-r from-primary/5 via-primary/10 to-accent/5 dark:border-primary/40 dark:from-primary/10 dark:via-primary/15 dark:to-accent/10">
          <SparkleIcon size={18} className="text-primary dark:text-primary" />
          <AlertDescription className="text-foreground/80 dark:text-foreground/90">
            Rezervirate kot zaposleni. Upoštevan bo <strong className="text-primary">popust 20&nbsp;%</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Form Steps */}
        <div className="space-y-6 lg:col-span-2">
          {/* Staff-first mode: Show preselected staff, then service selection */}
          {isStaffFirst ? (
            <>
              {/* Step 0: Staff Display (Read-only) */}
              <StaffDisplayStep staff={props.preselectedStaff} />

              {/* Step 1: Service Selection */}
              <ServiceSelectionStep
                services={props.staffServices}
                selectedServiceId={selectedServiceId}
                onSelectService={handleServiceSelect}
                error={!selectedServiceId && error ? "Izberite storitev" : undefined}
              />
            </>
          ) : (
            <>
              {/* Service-first mode: Show service, then staff selection */}
              {/* Step 1: Service Display (Read-only) */}
              <ServiceStep service={props.service} />

              {/* Step 2: Staff Selection */}
              <StaffStep
                availableStaff={props.availableStaff}
                selectedStaffId={staffId}
                onSelectStaff={(id) =>
                  setValue("staffId", id, { shouldValidate: true })
                }
                error={errors.staffId?.message}
              />
            </>
          )}

          {/* Step 3: Date & Time Selection */}
          <DateTimeStep
            selectedStaffId={staffId}
            serviceDuration={selectedService?.duration || 60}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectDate={(date) => {
              // Clicking the selected day again toggles it off in
              // react-day-picker (date === undefined) — keep the last valid
              // selection instead of losing it.
              const nextDate = date ?? selectedDate
              setValue("date", nextDate, { shouldValidate: true })
              // BUGFIX: clear a stale time when the day changes — otherwise
              // the summary shows an old time and submit would send a slot
              // that does not exist on the newly picked day.
              if (selectedTime && nextDate && selectedDate && !isSameDay(nextDate, selectedDate)) {
                setValue("time", "")
              }
            }}
            onSelectTime={(time) =>
              setValue("time", time, { shouldValidate: true })
            }
            maxBookingAdvance={salonConfig.maxBookingAdvance}
            dateError={errors.date?.message}
            timeError={errors.time?.message}
          />

          {/* Step 4: Customer Information */}
          <CustomerInfoStep
            register={register}
            errors={errors}
            isAuthenticated={isAuthenticated}
          />
        </div>

        {/* Right Column - Summary & Submit */}
        <div className="lg:col-span-1">
          <BookingSummaryCard
            service={selectedService || null}
            selectedStaff={
              isStaffFirst
                ? props.preselectedStaff
                : props.availableStaff.find((s) => s.id === staffId)
            }
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            salonConfig={salonConfig}
            submitting={submitting}
            error={error}
            isEmployee={isEmployee}
            availableSlots={[]}
          />
        </div>
      </div>
    </form>
  )
}
