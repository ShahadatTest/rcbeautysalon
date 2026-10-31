// ============================================================
// INVENTORY STOCK RULES (EPIC #2 E2-2) — pure, client-safe.
// The product/variant `stockQuantity` column is the STATE; the
// StockMovement table is the LEDGER. This module holds the
// universal rules both the manual movement flow and tests use:
//   • quantity must be a positive integer;
//   • IN adds to stock;
//   • OUT subtracts — below zero is REJECTED (§11: product
//     businesses must not sell what isn't there);
//   • exactly-at-zero is allowed (the NEXT issue is blocked).
// Server actions call computeStockDelta before writing, so the
// ledger and the state can never disagree about a rejected move.
// ============================================================

export type StockDirectionValue = "IN" | "OUT"

export type StockComputationResult =
  | { ok: true; nextStock: number }
  | { ok: false; reason: "INVALID_QUANTITY" | "NEGATIVE_STOCK" }

/**
 * Compute the resulting stock for one movement.
 * Pure — no IO, deterministic, unit-tested.
 */
export function computeStockDelta(
  currentStock: number,
  direction: StockDirectionValue,
  quantity: number
): StockComputationResult {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, reason: "INVALID_QUANTITY" }
  }
  if (!Number.isInteger(currentStock) || currentStock < 0) {
    return { ok: false, reason: "INVALID_QUANTITY" }
  }

  const nextStock =
    direction === "IN" ? currentStock + quantity : currentStock - quantity

  if (nextStock < 0) {
    return { ok: false, reason: "NEGATIVE_STOCK" }
  }
  return { ok: true, nextStock }
}
