// ============================================================
// P1 — Admin password reset (dashboard/users/[id])
// Pure pieces only: shared password schema + strong-password
// generator with injected RNG (deterministic tests).
// ============================================================

import { describe, it, expect } from "vitest"
import {
  adminSetPasswordSchema,
  passwordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth"
import {
  generateStrongPassword,
  type RandomBytesFn,
} from "@/lib/auth/password-generator"

describe("adminSetPasswordSchema", () => {
  it("accepts a valid userId + strong password", () => {
    const result = adminSetPasswordSchema.safeParse({
      userId: "user_123",
      password: "Geslo1234",
    })
    expect(result.success).toBe(true)
  })

  it("rejects an empty userId", () => {
    const result = adminSetPasswordSchema.safeParse({
      userId: "",
      password: "Geslo1234",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a password shorter than 8 characters", () => {
    const result = adminSetPasswordSchema.safeParse({
      userId: "user_123",
      password: "Gslo123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a password without an uppercase letter", () => {
    const result = adminSetPasswordSchema.safeParse({
      userId: "user_123",
      password: "geslo1234",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a password without a lowercase letter", () => {
    const result = adminSetPasswordSchema.safeParse({
      userId: "user_123",
      password: "GESLO1234",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a password without a digit", () => {
    const result = adminSetPasswordSchema.safeParse({
      userId: "user_123",
      password: "GesloGeslo",
    })
    expect(result.success).toBe(false)
  })
})

describe("passwordSchema (shared with self-service reset)", () => {
  it("keeps the same policy for resetPasswordSchema", () => {
    const weak = resetPasswordSchema.safeParse({
      token: "t",
      password: "samo male",
      confirmPassword: "samo male",
    })
    expect(weak.success).toBe(false)

    const strong = resetPasswordSchema.safeParse({
      token: "t",
      password: "Geslo1234",
      confirmPassword: "Geslo1234",
    })
    expect(strong.success).toBe(true)
  })

  it("exposes identical rules via passwordSchema", () => {
    expect(passwordSchema.safeParse("Geslo1234").success).toBe(true)
    expect(passwordSchema.safeParse("geslo1234").success).toBe(false)
  })
})

describe("generateStrongPassword", () => {
  // Deterministic RNG: cycles through fixed byte values.
  function fakeRandomBytes(values: number[]): RandomBytesFn {
    let i = 0
    return (n: number) => {
      const out = new Uint8Array(n)
      for (let k = 0; k < n; k++) {
        out[k] = values[i % values.length]
        i++
      }
      return out
    }
  }

  it("generates the default length of 12", () => {
    const pw = generateStrongPassword()
    expect(pw).toHaveLength(12)
  })

  it("respects a custom length", () => {
    expect(generateStrongPassword(8)).toHaveLength(8)
    expect(generateStrongPassword(20)).toHaveLength(20)
  })

  it("throws below the minimum length of 8", () => {
    expect(() => generateStrongPassword(7)).toThrow()
    expect(() => generateStrongPassword(0)).toThrow()
  })

  it("is deterministic with an injected RNG", () => {
    const a = generateStrongPassword(12, fakeRandomBytes([1, 5, 9, 13, 21, 34]))
    const b = generateStrongPassword(12, fakeRandomBytes([1, 5, 9, 13, 21, 34]))
    expect(a).toBe(b)
  })

  it("always contains a lowercase, uppercase and digit", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateStrongPassword()
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[0-9]/)
      // No ambiguous characters (l, I, O, 0, 1) for hand transcription
      expect(pw).not.toMatch(/[lIO01]/)
    }
  })

  it("produces different passwords across calls with real crypto", () => {
    const a = generateStrongPassword()
    const b = generateStrongPassword()
    expect(a).not.toBe(b)
  })
})
