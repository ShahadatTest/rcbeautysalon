// ============================================================
// EPIC #3 E3-6 — DOMAIN PROVIDER (honesty tests)
// The null provider must ALWAYS answer SETUP_REQUIRED (never a
// fake success) and the Vercel adapter must derive VERIFIED
// EXCLUSIVELY from the provider's own `verified` flag, map
// provider errors to honest results, never leak the token and
// never hang (timeout path).
// ============================================================

import { describe, it, expect, vi } from "vitest"
import { createVercelDomainProvider, vercelAddDomainUrl } from "../../src/lib/domains/vercel-domains"
import { getDomainProvider, getPlatformHosts } from "../../src/lib/domains/provider"
import type { DomainProvider } from "../../src/lib/domains/types"

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Fetch stub returning a queued sequence of responses. */
function fetchSequence(...outcomes: Array<{ status: number; body: unknown } | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl = async (url: any, init: any = {}) => {
    calls.push({ url: String(url), init })
    const next = outcomes[calls.length - 1]
    if (!next) throw new Error("no queued outcome")
    if (next instanceof Error) throw next
    return jsonResponse(next.status, next.body)
  }
  return { impl: impl as unknown as typeof fetch, calls }
}

// ------------------------------------------------------------
// null provider honesty
// ------------------------------------------------------------

describe("getDomainProvider — honest null provider", () => {
  it("returns a provider that reports SETUP_REQUIRED for every operation", async () => {
    const provider: DomainProvider = getDomainProvider()
    // In the test env DOMAINS_VERCEL_* are unset → the null provider.
    expect(provider.isConfigured()).toBe(false)

    const add = await provider.addDomain("moj-salon.si")
    expect(add.ok).toBe(false)
    if (!add.ok) expect(add.code).toBe("SETUP_REQUIRED")

    const verify = await provider.verifyDomain("moj-salon.si")
    expect(verify.ok).toBe(false)
    if (!verify.ok) expect(verify.code).toBe("SETUP_REQUIRED")

    const remove = await provider.removeDomain("moj-salon.si")
    expect(remove.ok).toBe(false)
    if (!remove.ok) expect(remove.code).toBe("SETUP_REQUIRED")
  })

  it("every failure carries both sl and en messages", async () => {
    const provider = getDomainProvider()
    const add = await provider.addDomain("moj-salon.si")
    expect(add.ok).toBe(false)
    if (!add.ok) {
      expect(add.message.length).toBeGreaterThan(0)
      expect(add.messageEn.length).toBeGreaterThan(0)
    }
  })
})

// ------------------------------------------------------------
// Vercel adapter — request construction
// ------------------------------------------------------------

describe("createVercelDomainProvider — requests", () => {
  it("sends the token ONLY in the Authorization header (never in the URL)", async () => {
    const { impl, calls } = fetchSequence({ status: 200, body: { verified: false } })
    const provider = createVercelDomainProvider({
      token: "sekret-token",
      projectId: "proj_1",
      teamId: "team_1",
      baseUrl: "https://api.test",
      fetchImpl: impl,
    })
    await provider.addDomain("moj-salon.si")
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(
      vercelAddDomainUrl("https://api.test", "proj_1", "team_1")
    )
    expect(calls[0].url).not.toContain("sekret-token")
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get("Authorization")).toBe("Bearer sekret-token")
  })

  it("isConfigured is false when token or project are blank", () => {
    expect(
      createVercelDomainProvider({ token: "t", projectId: "" }).isConfigured()
    ).toBe(false)
    expect(
      createVercelDomainProvider({ token: "", projectId: "p" }).isConfigured()
    ).toBe(false)
    expect(
      createVercelDomainProvider({ token: "t", projectId: "p" }).isConfigured()
    ).toBe(true)
  })
})

// ------------------------------------------------------------
// Vercel adapter — addDomain response mapping (honesty)
// ------------------------------------------------------------

describe("createVercelDomainProvider — addDomain", () => {
  it("verified:true (provider confirmation) is the ONLY verified path", async () => {
    const { impl } = fetchSequence({ status: 200, body: { name: "moj-salon.si", verified: true } })
    const provider = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl })
    const result = await provider.addDomain("moj-salon.si")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.verified).toBe(true)
      expect(result.dnsRecords).toEqual([])
    }
  })

  it("unverified add returns DNS guidance (apex → A, sub → CNAME)", async () => {
    const { impl } = fetchSequence({
      status: 201,
      body: { name: "moj-salon.si", verified: false, verification: [] },
    })
    const provider = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl })
    const apex = await provider.addDomain("moj-salon.si")
    expect(apex.ok && apex.verified).toBe(false)
    if (apex.ok) {
      const a = apex.dnsRecords.find((r) => r.type === "A")
      expect(a?.value).toBe("76.76.21.21")
    }

    const { impl: impl2 } = fetchSequence({
      status: 201,
      body: { name: "www.moj-salon.si", verified: false },
    })
    const provider2 = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl2 })
    const sub = await provider2.addDomain("www.moj-salon.si")
    if (sub.ok) {
      const cname = sub.dnsRecords.find((r) => r.type === "CNAME")
      expect(cname?.value).toBe("cname.vercel-dns.com")
    }
  })

  it("maps verification challenge entries into DNS records", async () => {
    const { impl } = fetchSequence({
      status: 201,
      body: {
        name: "moj-salon.si",
        verified: false,
        verification: [{ type: "TXT", domain: "_vercel.moj-salon.si", value: "vc-abc123" }],
      },
    })
    const provider = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl })
    const result = await provider.addDomain("moj-salon.si")
    if (result.ok) {
      const txt = result.dnsRecords.find((r) => r.type === "TXT")
      expect(txt?.name).toBe("_vercel.moj-salon.si")
      expect(txt?.value).toBe("vc-abc123")
    }
  })

  it("refuses taken domains with DOMAIN_CONFLICT (409 / provider code)", async () => {
    const { impl } = fetchSequence({
      status: 409,
      body: { error: { code: "domain_taken", message: "taken" } },
    })
    const provider = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl })
    const result = await provider.addDomain("vzeta.si")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("DOMAIN_CONFLICT")
  })

  it("maps auth failures to PROVIDER_ERROR without leaking the token", async () => {
    const { impl } = fetchSequence({ status: 403, body: { error: { code: "forbidden" } } })
    const provider = createVercelDomainProvider({ token: "sekret-token", projectId: "p", fetchImpl: impl })
    const result = await provider.addDomain("moj-salon.si")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("PROVIDER_ERROR")
      expect(result.message).not.toContain("sekret-token")
      expect(result.messageEn).not.toContain("sekret-token")
    }
  })

  it("network failure → PROVIDER_ERROR (never a fake success)", async () => {
    const { impl } = fetchSequence(new Error("ECONNREFUSED"))
    const provider = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl })
    const result = await provider.addDomain("moj-salon.si")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("PROVIDER_ERROR")
  })
})

// ------------------------------------------------------------
// Vercel adapter — verifyDomain (VERIFIED only from provider)
// ------------------------------------------------------------

describe("createVercelDomainProvider — verifyDomain", () => {
  it("returns verified ONLY when the provider says so", async () => {
    const { impl } = fetchSequence({
      status: 200,
      body: { name: "moj-salon.si", verified: true, verification: [] },
    })
    const provider = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl })
    const result = await provider.verifyDomain("moj-salon.si")
    expect(result.ok && result.verified).toBe(true)

    const { impl: impl2 } = fetchSequence({
      status: 200,
      body: {
        name: "moj-salon.si",
        verified: false,
        verification: [{ type: "TXT", domain: "_vercel.moj-salon.si", value: "vc-x" }],
      },
    })
    const provider2 = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl2 })
    const pending = await provider2.verifyDomain("moj-salon.si")
    expect(pending.ok && pending.verified).toBe(false)
    if (pending.ok) expect(pending.dnsRecords?.[0].type).toBe("TXT")
  })

  it("404 → DOMAIN_NOT_FOUND (the FAILED transition source)", async () => {
    const { impl } = fetchSequence({ status: 404, body: { error: { code: "not_found" } } })
    const provider = createVercelDomainProvider({ token: "t", projectId: "p", fetchImpl: impl })
    const result = await provider.verifyDomain("izgubljena.si")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("DOMAIN_NOT_FOUND")
  })
})

// ------------------------------------------------------------
// Vercel adapter — removeDomain (idempotent removal)
// ------------------------------------------------------------

describe("createVercelDomainProvider — removeDomain", () => {
  it("200 and 404 both count as removed (idempotent)", async () => {
    const ok = createVercelDomainProvider({
      token: "t",
      projectId: "p",
      fetchImpl: fetchSequence({ status: 200, body: {} }).impl,
    })
    expect((await ok.removeDomain("moj-salon.si")).ok).toBe(true)

    const gone = createVercelDomainProvider({
      token: "t",
      projectId: "p",
      fetchImpl: fetchSequence({ status: 404, body: { error: { code: "not_found" } } }).impl,
    })
    expect((await gone.removeDomain("moj-salon.si")).ok).toBe(true)
  })
})

// ------------------------------------------------------------
// platform hosts from env (server helper)
// ------------------------------------------------------------

describe("getPlatformHosts", () => {
  it("derives bare hostnames from URL-ish env values and never throws", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.rcbeauty.si:443")
    vi.stubEnv("VERCEL_URL", "rcbeautysalon-phi.vercel.app")
    try {
      const hosts = getPlatformHosts()
      expect(hosts).toContain("app.rcbeauty.si")
      expect(hosts).toContain("rcbeautysalon-phi.vercel.app")
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
