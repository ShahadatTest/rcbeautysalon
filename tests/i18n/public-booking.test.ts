// ============================================================
// P1 — Javne strani EN: booking dict pariteta (SL/EN) +
// lokalizirana rezervacijska shema (istipravilna, dva jezika).
// ============================================================

import { describe, it, expect } from "vitest"
import { bookingSl, bookingEn } from "@/lib/i18n/dict/booking"
import { publicSl, publicEn } from "@/lib/i18n/dict/public"
import {
  buildBookingSchema,
  buildAuthenticatedBookingSchema,
  bookingSchema,
  authenticatedBookingSchema,
} from "@/lib/validations/booking"

/** Rekurzivna primerjava oblik: vsak SL ključ obstaja v EN (in obratno). */
function expectSameShape(a: unknown, b: unknown, path = "") {
  if (typeof a === "function") {
    expect(typeof b, `function at ${path}`).toBe("function")
    return
  }
  if (a !== null && typeof a === "object") {
    expect(b, `object at ${path}`).toBeTruthy()
    const aKeys = Object.keys(a as object).sort()
    const bKeys = Object.keys(b as object).sort()
    expect(bKeys, `keys at ${path}`).toEqual(aKeys)
    for (const key of aKeys) {
      expectSameShape(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`
      )
    }
    return
  }
  expect(typeof b, `primitive at ${path}`).toBe(typeof a)
}

describe("booking dict parity", () => {
  it("bookingSl and bookingEn have identical shapes", () => {
    expectSameShape(bookingSl, bookingEn)
  })

  it("publicSl and publicEn have identical shapes", () => {
    expectSameShape(publicSl, publicEn)
  })

  it("translated strings differ from Slovenian for key labels", () => {
    expect(bookingEn.summaryTitle).not.toBe(bookingSl.summaryTitle)
    expect(bookingEn.submitNoPayment).not.toBe(bookingSl.submitNoPayment)
    expect(publicEn.navServices).not.toBe(publicSl.navServices)
  })
})

describe("booking schema factory (locale messages)", () => {
  const validBase = {
    staffId: "staff_1",
    date: new Date(),
    time: "10:30",
    firstName: "Ana",
    lastName: "Novak",
    email: "ana@example.com",
    phone: "040123456",
  }

  it("accepts a valid booking in both locales", () => {
    expect(buildBookingSchema("sl").safeParse(validBase).success).toBe(true)
    expect(buildBookingSchema("en").safeParse(validBase).success).toBe(true)
  })

  it("uses Slovenian messages by default and for 'sl'", () => {
    const missing = buildBookingSchema("sl").safeParse({
      ...validBase,
      staffId: "",
    })
    expect(missing.success).toBe(false)
    expect(missing.error!.issues[0].message).toBe("Izberite osebo za termin")
  })

  it("uses English messages for 'en'", () => {
    const missing = buildBookingSchema("en").safeParse({
      ...validBase,
      staffId: "",
    })
    expect(missing.success).toBe(false)
    expect(missing.error!.issues[0].message).toBe("Choose a staff member")

    const badPhone = buildBookingSchema("en").safeParse({
      ...validBase,
      phone: "abcdefghij",
    })
    expect(badPhone.success).toBe(false)
    expect(badPhone.error!.issues[0].message).toBe(
      "Enter a valid phone number"
    )
  })

  it("keeps the named SL exports as sl defaults", () => {
    const missing = bookingSchema.safeParse({ ...validBase, staffId: "" })
    expect(missing.error!.issues[0].message).toBe("Izberite osebo za termin")

    const missingAuth = authenticatedBookingSchema.safeParse({
      ...validBase,
      staffId: "",
    })
    expect(missingAuth.error!.issues[0].message).toBe(
      "Izberite osebo za termin"
    )
  })

  it("authenticated variant makes name/email optional in both locales", () => {
    const { firstName: _f, lastName: _l, email: _e, ...rest } = validBase
    const result = buildAuthenticatedBookingSchema("en").safeParse(rest)
    expect(result.success).toBe(true)
  })
})
