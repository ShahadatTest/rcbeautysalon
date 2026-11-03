import { describe, expect, it } from "vitest"
import { formatCurrency } from "@/lib/utils/format"
import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("service card price formatting (#14)", () => {
  it("formats EUR with Slovenian locale (decimals + symbol placement)", () => {
    const formatted = formatCurrency(75, "EUR")
    expect(formatted).toMatch(/75/)
    expect(formatted).toContain("€")
    // Must not be the hard-coded English-style "€75"
    expect(formatted).not.toBe("€75")
  })

  it("home service cards use the shared formatter instead of hard-coded €{price}", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/landing/home-content.tsx"),
      "utf8",
    )
    expect(src).toContain("useFormatPrice")
    expect(src).toContain("fmt(Number(service.price))")
    expect(src).not.toMatch(/€\{service\.price/)
  })
})
