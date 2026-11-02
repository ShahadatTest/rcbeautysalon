// Application configuration
//
// NOTE: only `siteConfig` remains here. The former `businessConfig`,
// `bookingConfig` and `stripeConfig` constants (with hardcoded US
// contact data like "123 Beauty Street" / "(555) 123-4567") were dead
// code — every salon's real contact info, deposit policy and payment
// settings live per-tenant in SalonConfig / Organization, and nothing
// imported these constants. Deleting them removes the trap of someone
// wiring the fake platform-wide data back into customer-facing UI.

export const siteConfig = {
  name: "Beauty Salon",
  description: "Your trusted destination for beauty and wellness",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
}
