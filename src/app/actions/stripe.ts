"use server"

import { stripe, isStripeConfigured } from "@/lib/stripe"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { addMinutes } from "date-fns"
import { after } from "next/server"
import { getServicesForBooking, getSalonConfig, getOrgTimezone } from "./appointments"
import { instantFromParts, formatSalonTime } from "@/lib/booking-time"
import { getPublicOrg, getSessionOrg, getOrgById } from "@/lib/tenant"
import { CreateCheckoutSessionData } from "@/lib/interfaces"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"

export async function createCheckoutSession(data: CreateCheckoutSessionData) {
  try {
    // Payments are an optional, salon-owned integration — degrade gracefully
    if (!isStripeConfigured()) {
      return {
        success: false,
        error:
          "Online payments are not configured yet. Please contact the salon to complete your booking.",
      }
    }

    // Get current session
    const session = await auth()

    // Resolve the tenant organization for this booking (employees act within
    // their session org, everyone else within the public tenant org)
    const org =
      session?.user && ["ADMIN", "STAFF"].includes(session.user.role)
        ? await getSessionOrg()
        : await getPublicOrg()
    if (!org) {
      return {
        success: false,
        error: "Online booking is currently unavailable. Please try again later.",
      }
    }

    // Validate required fields (date+time strings or a prebuilt ISO startTime)
    if (
      !data.staffId ||
      !data.serviceIds.length ||
      (!data.startTime && !(data.bookingDate && data.bookingTime))
    ) {
      return { success: false, error: "Manjkajo obvezni podatki" }
    }

    // Validate customer information
    if (!session?.user && (!data.guestName || !data.guestEmail)) {
      return { success: false, error: "Potrebni so kontakt podatki" }
    }

    // Build the exact start instant in the SALON timezone from date+time
    // strings (preferred contract) — avoids any client/server tz mismatch.
    const tz = await getOrgTimezone(org.id)
    const startInstant =
      data.bookingDate && data.bookingTime
        ? instantFromParts(data.bookingDate, data.bookingTime, tz)
        : data.startTime
          ? new Date(data.startTime)
          : null

    if (!startInstant || isNaN(startInstant.getTime())) {
      return { success: false, error: "Neveljaven datum ali ura termina" }
    }

    // Fetch services to get names and calculate totals
    const services = await getServicesForBooking(data.serviceIds)
    if (services.length === 0) {
      return { success: false, error: "Invalid service selection" }
    }

    // Get salon config for deposit amount
    const config = await getSalonConfig()

    // Create service names string
    const serviceNames = services.map((s) => s.name).join(", ")

    // Customer email for Stripe
    const customerEmail = session?.user?.email || data.guestEmail
    const customerName = session?.user?.name || data.guestName || "Customer"

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // SECURITY: employee discount is derived server-side from the session role,
    // never trusted from client arguments.
    const isEmployeeBooking =
      !!session?.user &&
      ["STAFF", "ADMIN"].includes(session.user.role)

    // Calculate deposit with employee discount (20% off)
    const employeeDiscountRate = 0.20
    const originalDeposit = config.bookingDeposit
    const depositAmount = isEmployeeBooking
      ? originalDeposit * (1 - employeeDiscountRate)
      : originalDeposit

    // Build product description
    const depositDescription = isEmployeeBooking
      ? `Non-refundable deposit for your appointment (20% employee discount applied)`
      : `Non-refundable deposit for your appointment`

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: (config.currency || "EUR").toLowerCase(),
            product_data: {
              name: `Appointment Deposit - ${serviceNames}`,
              description: depositDescription,
            },
            unit_amount: Math.round(depositAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        // Store booking data in metadata for webhook
        orgId: org.id,
        serviceIds: JSON.stringify(data.serviceIds),
        staffId: data.staffId,
        startTime: startInstant.toISOString(),
        guestName: data.guestName || "",
        guestEmail: data.guestEmail || "",
        guestPhone: data.guestPhone || "",
        notes: data.notes || "",
        userId: session?.user?.id || "",
        customerName,
        isEmployee: isEmployeeBooking ? "true" : "false",
      },
      success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/booking/cancel`,
    })

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
    }
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return {
      success: false,
      error: "Failed to create payment session. Please try again.",
    }
  }
}

// Verify and create appointment from checkout session (fallback for webhook)
export async function verifyAndCreateAppointment(sessionId: string) {
  try {
    if (!isStripeConfigured()) {
      return {
        success: false,
        error: "Payments are not configured.",
      }
    }

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    })

    // Verify payment was successful
    if (checkoutSession.payment_status !== "paid") {
      return {
        success: false,
        error: "Payment not completed",
      }
    }

    // payment_intent can be string or object depending on expand
    const paymentIntentId = typeof checkoutSession.payment_intent === 'string'
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id

    if (!paymentIntentId) {
      return {
        success: false,
        error: "No payment intent found",
      }
    }

    const metadata = checkoutSession.metadata

    if (!metadata) {
      return {
        success: false,
        error: "No booking data found",
      }
    }

    // Resolve the tenant organization: from checkout metadata, falling back
    // to the first ACTIVE organization (getPublicOrg behavior)
    const org = metadata.orgId
      ? await getOrgById(metadata.orgId)
      : await getPublicOrg()

    if (!org) {
      return {
        success: false,
        error: "No organization available",
      }
    }

    // Check if appointment already exists (webhook might have created it)
    const existingAppointment = await prisma.appointment.findFirst({
      where: { stripePaymentId: paymentIntentId },
    })

    if (existingAppointment) {
      // Appointment already created by webhook
      return {
        success: true,
        appointmentId: existingAppointment.id,
        alreadyExists: true,
        customerEmail: checkoutSession.customer_email,
      }
    }

    // Parse metadata
    const serviceIds = JSON.parse(metadata.serviceIds || "[]")
    const staffId = metadata.staffId
    const startTime = new Date(metadata.startTime)
    const guestName = metadata.guestName || null
    const guestEmail = metadata.guestEmail || null
    const guestPhone = metadata.guestPhone || null
    const notes = metadata.notes || null
    const userId = metadata.userId || null
    const customerName = metadata.customerName || "Customer"

    // Get services for duration calculation (scoped to this organization)
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, organizationId: org.id },
      select: { id: true, name: true, duration: true, price: true },
    })

    if (services.length !== new Set(serviceIds).size) {
      return {
        success: false,
        error: "Invalid booking data",
      }
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
    const totalPrice = services.reduce(
      (sum, s) => sum + s.price.toNumber(),
      0
    )
    const endTime = addMinutes(startTime, totalDuration)

    // SECURITY: re-check slot availability before creating the appointment.
    // Prevents double-booking when the webhook and this fallback race,
    // and blocks maliciously crafted checkout sessions for occupied slots.
    const overlapping = await prisma.appointment.count({
      where: {
        staffId,
        organizationId: org.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    })

    if (overlapping > 0) {
      return {
        success: false,
        error:
          "Ta termin ni več prost. Kontaktirajte salon za prestavitev rezervacije ali vračilo plačila.",
      }
    }

    // Get salon config for this organization
    const config = await prisma.salonConfig.findFirst({
      where: { organizationId: org.id },
    })
    const bookingDeposit = config?.bookingDeposit.toNumber() ?? 50

    // Handle customer creation/retrieval
    let customerId: string | null = null

    if (userId) {
      // Check if user has a customer profile
      const userWithCustomer = await prisma.user.findUnique({
        where: { id: userId },
        include: { customer: true },
      })

      if (userWithCustomer?.customer) {
        customerId = userWithCustomer.customer.id
      } else if (userWithCustomer) {
        // Create customer profile
        const customer = await prisma.customer.create({
          data: {
            name: customerName,
            email: userWithCustomer.email,
            phone: guestPhone,
            userId: userId,
            organizationId: org.id,
          },
        })
        customerId = customer.id
      }
    } else if (guestEmail) {
      // Guest booking - check if customer exists (within this organization)
      const existingCustomer = await prisma.customer.findFirst({
        where: { email: guestEmail, organizationId: org.id },
      })

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else if (guestName) {
        // Create new customer
        const customer = await prisma.customer.create({
          data: {
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
            organizationId: org.id,
          },
        })
        customerId = customer.id
      }
    }

    // Get staff info (must belong to this organization)
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: org.id },
      select: { name: true },
    })

    if (!staff) {
      return {
        success: false,
        error: "Invalid booking data",
      }
    }

    // Create the appointment
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: org.id,
        staffId,
        customerId,
        guestName: !customerId ? guestName : null,
        guestEmail: !customerId ? guestEmail : null,
        guestPhone: !customerId ? guestPhone : null,
        startTime,
        endTime,
        status: "CONFIRMED",
        notes,
        totalPrice,
        depositAmount: bookingDeposit,
        depositPaid: true,
        stripePaymentId: paymentIntentId,
        services: {
          create: serviceIds.map((serviceId: string) => ({
            serviceId,
          })),
        },
      },
    })

    // Send confirmation email in background (non-blocking)
    const customerEmail = guestEmail || checkoutSession.customer_email
    if (customerEmail) {
      const serviceNames = services.map((s) => s.name).join(", ")
      const salonTz = await getOrgTimezone(org.id)

      after(async () => {
        await sendAppointmentConfirmationEmail({
          email: customerEmail,
          customerName,
          serviceName: serviceNames,
          staffName: staff?.name || "Our Staff",
          appointmentDate: startTime,
          appointmentTime: formatSalonTime(startTime, salonTz),
          duration: totalDuration,
          totalPrice,
          depositAmount: bookingDeposit,
          appointmentId: appointment.id,
        })
      })
    }

    return {
      success: true,
      appointmentId: appointment.id,
      alreadyExists: false,
      customerEmail: customerEmail,
    }
  } catch (error) {
    console.error("Error creating appointment from checkout:", error)
    return {
      success: false,
      error: "Failed to create appointment",
    }
  }
}

// Create checkout session for existing unpaid appointment
export async function createDepositCheckoutForAppointment(appointmentId: string) {
  try {
    if (!isStripeConfigured()) {
      return {
        success: false,
        error:
          "Online payments are not configured yet. Please contact the salon.",
      }
    }

    const session = await auth()

    if (!session?.user) {
      return { success: false, error: "Unauthorized" }
    }

    // Fetch the appointment with services (scoped to the current organization)
    const org = await getPublicOrg()

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        services: { include: { service: true } },
        customer: true,
      },
    })

    // Validate appointment exists
    if (!appointment) {
      return { success: false, error: "Appointment not found" }
    }

    // Tenant check: the appointment must belong to the current organization
    // (legacy appointments without organizationId are still honored)
    if (org && appointment.organizationId && appointment.organizationId !== org.id) {
      return { success: false, error: "Appointment not found" }
    }

    // Validate appointment belongs to current user
    if (appointment.customer?.userId !== session.user.id) {
      return { success: false, error: "Unauthorized" }
    }

    // Validate deposit not already paid
    if (appointment.depositPaid) {
      return { success: false, error: "Deposit already paid" }
    }

    // Get service names for description
    const serviceNames = appointment.services.map((s) => s.service.name).join(", ")
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Salon currency for the deposit checkout
    const depositConfig = await prisma.salonConfig.findFirst({
      where: { organizationId: appointment.organizationId || org?.id || "" },
      select: { currency: true },
    })

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: session.user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: (depositConfig?.currency || "EUR").toLowerCase(),
            product_data: {
              name: `Appointment Deposit - ${serviceNames}`,
              description: "Non-refundable deposit for your appointment",
            },
            unit_amount: Math.round(appointment.depositAmount.toNumber() * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "existing_appointment",
        appointmentId: appointment.id,
        orgId: appointment.organizationId || org?.id || "",
      },
      success_url: `${baseUrl}/my-appointments?paid=${appointment.id}`,
      cancel_url: `${baseUrl}/my-appointments`,
    })

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
    }
  } catch (error) {
    console.error("Error creating checkout for existing appointment:", error)
    return {
      success: false,
      error: "Failed to create payment session",
    }
  }
}
