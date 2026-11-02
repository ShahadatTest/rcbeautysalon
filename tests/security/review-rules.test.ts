/**
 * E4-6b — shared review-input rules (`src/lib/reviews/rules.ts`).
 *
 * The update path previously skipped the rating check entirely, letting
 * a signed-in user write e.g. rating 999 on their own review and
 * corrupt the service's public aggregate rating. Both actions now go
 * through these pure rules — the tests lock the shared behaviour.
 */
import { describe, it, expect } from "vitest"
import { isValidRating, isValidReviewComment } from "@/lib/reviews/rules"

describe("isValidRating", () => {
  it("accepts integers 1-5", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(isValidRating(rating)).toBe(true)
    }
  })

  it("rejects out-of-range values (the corruption hole)", () => {
    expect(isValidRating(0)).toBe(false)
    expect(isValidRating(6)).toBe(false)
    expect(isValidRating(999)).toBe(false)
    expect(isValidRating(-1)).toBe(false)
  })

  it("rejects non-integers and non-numbers", () => {
    expect(isValidRating(4.5)).toBe(false)
    expect(isValidRating("5")).toBe(false)
    expect(isValidRating(null)).toBe(false)
    expect(isValidRating(undefined)).toBe(false)
    expect(isValidRating(NaN)).toBe(false)
  })
})

describe("isValidReviewComment", () => {
  it("accepts 10-1000 characters (trimmed)", () => {
    expect(isValidReviewComment("1234567890")).toBe(true)
    expect(isValidReviewComment("a".repeat(1000))).toBe(true)
  })

  it("is trimmed BEFORE the length check", () => {
    // "  12345678  " trims to 8 chars → must be rejected
    expect(isValidReviewComment("  12345678  ")).toBe(false)
    expect(isValidReviewComment("  1234567890  ")).toBe(true)
  })

  it("rejects too-short and too-long comments", () => {
    expect(isValidReviewComment("kratko")).toBe(false)
    expect(isValidReviewComment("a".repeat(1001))).toBe(false)
  })

  it("rejects non-strings", () => {
    expect(isValidReviewComment(null)).toBe(false)
    expect(isValidReviewComment(12345)).toBe(false)
  })
})
