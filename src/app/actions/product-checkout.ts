"use server"

import { stripe, isStripeConfigured } from "@/lib/stripe"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { validateCartStock } from "./cart"
import { getPublicOrg } from "@/lib/tenant"
import type { CartItem } from "@/store/cart-store"

const TAX_RATE = 0.08
const FREE_SHIPPING_THRESHOLD = 50
const SHIPPING_COST = 5.99

interface CheckoutResult {
  success: boolean
  checkoutUrl?: string
  error?: string
  stockErrors?: Array<{
    productId: string
    name: string
    available: number
    requested: number
  }>
}

export async function createProductCheckoutSession(
  items: CartItem[]
): Promise<CheckoutResult> {
  try {
    // Payments are an optional, salon-owned integration — degrade gracefully
    if (!isStripeConfigured()) {
      return {
        success: false,
        error:
          "Online payments are not configured yet. Please contact the salon to place your order.",
      }
    }

    // Get current session
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to checkout",
      }
    }

    // Resolve the tenant organization for this checkout
    const org = await getPublicOrg()
    if (!org) {
      return {
        success: false,
        error: "The shop is currently unavailable. Please try again later.",
      }
    }

    if (items.length === 0) {
      return {
        success: false,
        error: "Your cart is empty",
      }
    }

    // Validate stock (scoped to this organization)
    const stockValidation = await validateCartStock(items, org.id)
    if (!stockValidation.valid) {
      return {
        success: false,
        error: "Some items are out of stock",
        stockErrors: stockValidation.errors,
      }
    }

    // SECURITY: re-price everything from the database. Client-supplied prices
    // (from the Zustand cart) are never trusted for payment amounts.
    // Products MUST belong to the current organization — their price is only
    // used when organizationId matches.
    const productIds = items.map((item) => item.productId)
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        organizationId: org.id,
      },
      select: { id: true, name: true, images: true, price: true },
    })

    const productMap = new Map(dbProducts.map((p) => [p.id, p]))

    if (dbProducts.length !== new Set(productIds).size) {
      return {
        success: false,
        error: "Some items in your cart are no longer available",
      }
    }

    const pricedItems = items.map((item) => {
      const product = productMap.get(item.productId)! // existence guaranteed above
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price.toNumber(),
        name: product.name,
        image: product.images[0] || null,
      }
    })

    // Calculate totals from trusted prices
    const subtotal = pricedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
    const tax = subtotal * TAX_RATE
    const total = subtotal + shipping + tax

    // Get or create customer
    let customerId: string | null = null
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { customer: true },
    })

    if (user?.customer) {
      customerId = user.customer.id
    } else if (user) {
      const customer = await prisma.customer.create({
        data: {
          name: user.name || "Customer",
          email: user.email,
          userId: user.id,
          organizationId: org.id,
        },
      })
      customerId = customer.id
    }

    // Create order in database with PENDING status
    const order = await prisma.order.create({
      data: {
        organizationId: org.id,
        customerId,
        subtotal,
        tax,
        total,
        status: "PENDING",
        items: {
          create: pricedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    })

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Create Stripe line items from trusted prices
    const lineItems = pricedItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }))

    // Add shipping as line item if applicable
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Shipping",
            images: [],
          },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      })
    }

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: session.user.email || undefined,
      line_items: lineItems,
      automatic_tax: { enabled: false }, // We calculate tax ourselves
      metadata: {
        orderId: order.id,
        userId: session.user.id,
        type: "product_order",
        orgId: org.id,
      },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
    })

    return {
      success: true,
      checkoutUrl: checkoutSession.url || undefined,
    }
  } catch (error) {
    console.error("Error creating product checkout session:", error)
    return {
      success: false,
      error: "Failed to create payment session. Please try again.",
    }
  }
}

// Verify payment and update order status
export async function verifyProductOrder(sessionId: string) {
  try {
    // Only authenticated users can checkout, so require a session here too
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to verify your order",
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

    const orderId = checkoutSession.metadata?.orderId
    if (!orderId) {
      return {
        success: false,
        error: "Order not found",
      }
    }

    // Get payment intent ID
    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id

    // Check if order is already marked as paid
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })

    if (!existingOrder) {
      return {
        success: false,
        error: "Order not found",
      }
    }

    // Tenant check: the order must belong to the current organization
    // (legacy orders without organizationId are still honored)
    const org = await getPublicOrg()
    if (existingOrder.organizationId && org && existingOrder.organizationId !== org.id) {
      return {
        success: false,
        error: "Order not found",
      }
    }

    // SECURITY: the order must belong to the current user
    const userWithCustomer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { customer: { select: { id: true } } },
    })

    if (
      existingOrder.customerId &&
      existingOrder.customerId !== userWithCustomer?.customer?.id
    ) {
      return {
        success: false,
        error: "You do not have permission to view this order",
      }
    }

    if (existingOrder.status === "PAID") {
      return {
        success: true,
        orderId: existingOrder.id,
        alreadyProcessed: true,
      }
    }

    // Update order status and reduce stock
    await prisma.$transaction(async (tx) => {
      // Update order (backfill organizationId for legacy orders)
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          stripePaymentIntentId: paymentIntentId,
          ...(org && !existingOrder.organizationId
            ? { organizationId: org.id }
            : {}),
        },
      })

      // Reduce stock for each item
      for (const item of existingOrder.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        })
      }
    })

    return {
      success: true,
      orderId: orderId,
      alreadyProcessed: false,
    }
  } catch (error) {
    console.error("Error verifying product order:", error)
    return {
      success: false,
      error: "Failed to verify order",
    }
  }
}


