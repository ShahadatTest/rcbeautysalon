import { describe, it, expect } from "vitest"
import { HOW_IT_WORKS_STEPS } from "../../src/components/landing/how-it-works-section"
import { splitLastWord } from "../../src/components/landing/section-title"

// ============================================================
// "Kako deluje" trust section — the copy must stay truthful to
// the real booking semantics (guest booking = PENDING until the
// salon confirms) and renderable (4 steps, unique titles,
// non-empty copy, known icons).
// ============================================================

describe("HOW_IT_WORKS_STEPS", () => {
  it("has exactly four steps", () => {
    expect(HOW_IT_WORKS_STEPS).toHaveLength(4)
  })

  it("has unique, non-empty titles and descriptions", () => {
    const titles = HOW_IT_WORKS_STEPS.map((s) => s.title)
    expect(new Set(titles).size).toBe(titles.length)
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0)
      expect(step.description.trim().length).toBeGreaterThan(0)
    }
  })

  it("never promises an automatic e-mail/SMS confirmation (delivery depends on tenant config)", () => {
    const copy = HOW_IT_WORKS_STEPS.map((s) => `${s.title} ${s.description}`)
      .join(" ")
      .toLowerCase()
    expect(copy).not.toContain("e-pošto")
    expect(copy).not.toContain("email")
    expect(copy).not.toContain("sms")
  })

  it("tells the truth about who confirms the booking (the salon, not the system)", () => {
    const confirmStep = HOW_IT_WORKS_STEPS.find((s) => s.title.toLowerCase().includes("potrd"))
    expect(confirmStep).toBeDefined()
    expect(confirmStep!.title.toLowerCase()).toContain("salon")
  })

  it("every step icon is a renderable component (lucide forwardRef object)", () => {
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(step.icon).toBeTruthy()
    }
  })
})

describe("Kako deluje heading splitting", () => {
  it("splits the last word as accent, same as other landing headings", () => {
    const { lead, accent } = splitLastWord("Kako deluje")
    expect(lead).toBe("Kako")
    expect(accent).toBe("deluje")
  })
})
