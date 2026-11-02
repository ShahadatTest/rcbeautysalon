import { describe, expect, it } from "vitest"
import { iconForProfile, PROFILE_ICONS } from "@/lib/profiles/profile-icons"
import { listProfileOptions } from "@/lib/profiles/registry"

// The guided-entry wizard and the dashboard's activity card share this
// icon map — every registered activity MUST resolve (fallback is allowed
// but the map should cover all known ids so no card ever looks generic).
describe("profile icons", () => {
  it("every registered profile has an explicit icon", () => {
    for (const option of listProfileOptions()) {
      expect(PROFILE_ICONS[option.id], `missing icon for ${option.id}`).toBeTruthy()
    }
  })

  it("iconForProfile returns a truthy component for every profile", () => {
    for (const option of listProfileOptions()) {
      expect(iconForProfile(option.id)).toBeTruthy()
    }
  })

  it("unknown ids fall back to the neutral grid icon", () => {
    expect(iconForProfile("does-not-exist")).toBe(PROFILE_ICONS.generic)
  })
})
