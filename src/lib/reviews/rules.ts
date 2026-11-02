/**
 * Pure review-input rules shared by the public review actions.
 * Single decision point so `createReview` and `updateReview` can never
 * drift apart (the update path previously skipped the rating check).
 */

/** Rating must be an integer between 1 and 5 (inclusive). */
export function isValidRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

/** Comment length rule: trimmed, 10–1000 characters. */
export function isValidReviewComment(value: unknown): value is string {
  if (typeof value !== "string") return false
  const length = value.trim().length
  return length >= 10 && length <= 1000
}
