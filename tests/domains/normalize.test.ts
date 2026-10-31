// ============================================================
// EPIC #3 E3-6 — CUSTOM DOMAIN PURE RULES
// Normalization (the single validation gate), the honest status
// state machine (VERIFIED only via provider confirmation), the
// plan entitlement gate and primary-domain eligibility.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  normalizeDomainInput,
  parseDomainStatus,
  canUseCustomDomains,
  domainStatusTransition,
  assertPrimaryEligibility,
  hostFromHostHeader,
  isPlatformHost,
  isValidDomainHost,
} from "../../src/lib/domains/normalize"

describe("normalizeDomainInput — normalization", () => {
  it("trims, lowercases and keeps a plain domain", () => {
    expect(normalizeDomainInput("  Moj-Salon.SI  ")).toEqual({ ok: true, domain: "moj-salon.si" })
  })

  it("strips protocol, path, query, hash and port", () => {
    const r = normalizeDomainInput("https://moj-salon.si/rezervaciji?x=1")
    expect(r.ok && r.domain).toBe("moj-salon.si")
    const r2 = normalizeDomainInput("http://sub.domena.si:8443/path")
    expect(r2.ok && r2.domain).toBe("sub.domena.si")
  })

  it("strips exactly ONE trailing dot (FQDN form)", () => {
    const one = normalizeDomainInput("moj-salon.si.")
    expect(one.ok && one.domain).toBe("moj-salon.si")
    const two = normalizeDomainInput("moj-salon.si..")
    expect(two.ok).toBe(false)
  })

  it("keeps www-prefixed hosts DISTINCT (never strips www)", () => {
    const r = normalizeDomainInput("WWW.Moj-Salon.SI")
    expect(r.ok && r.domain).toBe("www.moj-salon.si")
  })
})

describe("normalizeDomainInput — refusals", () => {
  it("refuses empty input", () => {
    const refused = normalizeDomainInput("")
    expect(refused.ok).toBe(false)
    expect(!refused.ok && refused.reason).toBe("EMPTY")
    expect(normalizeDomainInput("   ").ok).toBe(false)
  })

  it("refuses wildcards, spaces, underscores and unicode", () => {
    expect(normalizeDomainInput("*.moj-salon.si").ok).toBe(false)
    expect(normalizeDomainInput("moj_salon.si").ok).toBe(false)
    expect(normalizeDomainInput("moj salon.si").ok).toBe(false)
    expect(normalizeDomainInput("moj-salon.si/rezervaciji#frag").ok).toBe(true) // path stripped
    expect(normalizeDomainInput("šalon.si").ok).toBe(false)
  })

  it("refuses hosts without a TLD and IP addresses", () => {
    expect(normalizeDomainInput("moj-salon").ok).toBe(false)
    expect(normalizeDomainInput("192.168.1.10").ok).toBe(false) // numeric TLD
    expect(normalizeDomainInput("localhost").ok).toBe(false)
  })

  it("refuses structural violations", () => {
    expect(normalizeDomainInput(".moj-salon.si").ok).toBe(false) // empty label
    expect(normalizeDomainInput("moj-salon..si").ok).toBe(false)
    expect(normalizeDomainInput("-moj-salon.si").ok).toBe(false)
    expect(normalizeDomainInput("moj-salon-.si").ok).toBe(false)
    const longLabel = `${"a".repeat(64)}.si`
    expect(normalizeDomainInput(longLabel).ok).toBe(false)
    expect(isValidDomainHost("ok.salon.si")).toBe(true)
  })

  it("refuses reserved and explicitly blocked platform hosts", () => {
    const blocked = normalizeDomainInput("rcbeautysalon-phi.vercel.app", [
      "rcbeautysalon-phi.vercel.app",
    ])
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toBe("PLATFORM_HOST")
    expect(normalizeDomainInput("LOCALHOST", []).ok).toBe(false)
  })
})

describe("parseDomainStatus — tolerant DB read", () => {
  it("accepts known statuses and falls back to PENDING", () => {
    expect(parseDomainStatus("PENDING")).toBe("PENDING")
    expect(parseDomainStatus("VERIFIED")).toBe("VERIFIED")
    expect(parseDomainStatus("FAILED")).toBe("FAILED")
    expect(parseDomainStatus("nonsense")).toBe("PENDING")
    expect(parseDomainStatus(null)).toBe("PENDING")
    expect(parseDomainStatus(undefined)).toBe("PENDING")
  })
})

describe("canUseCustomDomains — plan entitlement gate (§8)", () => {
  it("FREE (limit 0) is refused, PRO (limit 1) and SCALE (null) allowed", () => {
    expect(canUseCustomDomains({ customDomains: 0 })).toBe(false)
    expect(canUseCustomDomains({ customDomains: 1 })).toBe(true)
    expect(canUseCustomDomains({ customDomains: null })).toBe(true)
  })
})

describe("domainStatusTransition — honesty state machine", () => {
  it("PENDING → VERIFIED only (provider confirmation path)", () => {
    expect(domainStatusTransition("PENDING", "VERIFIED").ok).toBe(true)
    expect(domainStatusTransition("FAILED", "VERIFIED").ok).toBe(true)
  })

  it("VERIFIED is locked — local code can never un-verify", () => {
    expect(domainStatusTransition("VERIFIED", "PENDING").ok).toBe(false)
    expect(domainStatusTransition("VERIFIED", "FAILED").ok).toBe(false)
  })

  it("FAILED only from PENDING", () => {
    expect(domainStatusTransition("PENDING", "FAILED").ok).toBe(true)
    expect(domainStatusTransition("FAILED", "FAILED").ok).toBe(true) // idempotent
    expect(domainStatusTransition("VERIFIED", "FAILED").ok).toBe(false)
  })

  it("same → same is idempotent", () => {
    expect(domainStatusTransition("PENDING", "PENDING").ok).toBe(true)
    expect(domainStatusTransition("VERIFIED", "VERIFIED").ok).toBe(true)
  })
})

describe("assertPrimaryEligibility — only VERIFIED can be primary", () => {
  it("accepts VERIFIED, refuses PENDING and FAILED", () => {
    expect(assertPrimaryEligibility("VERIFIED").ok).toBe(true)
    expect(assertPrimaryEligibility("PENDING").ok).toBe(false)
    expect(assertPrimaryEligibility("FAILED").ok).toBe(false)
  })
})

describe("hostFromHostHeader — request host resolution", () => {
  it("lowercases and strips the port", () => {
    expect(hostFromHostHeader("Moj-Salon.si:3000")).toBe("moj-salon.si")
    expect(hostFromHostHeader("moj-salon.si")).toBe("moj-salon.si")
  })

  it("handles bracketed IPv6 and returns null for junk", () => {
    expect(hostFromHostHeader("[::1]:3000")).toBeNull() // IP never a valid host
    expect(hostFromHostHeader("not a host")).toBeNull()
    expect(hostFromHostHeader("")).toBeNull()
    expect(hostFromHostHeader(null)).toBeNull()
    expect(hostFromHostHeader(undefined)).toBeNull()
  })
})

describe("isPlatformHost — platform hosts skip custom-domain lookup", () => {
  it("matches exactly", () => {
    expect(isPlatformHost("app.platform.si", ["app.platform.si", "localhost"])).toBe(true)
    expect(isPlatformHost("other.platform.si", ["app.platform.si"])).toBe(false)
    expect(isPlatformHost("tenant-domain.si", [])).toBe(false)
  })
})
