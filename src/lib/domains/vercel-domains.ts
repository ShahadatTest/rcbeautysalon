import "server-only"

// ============================================================
// VERCEL DOMAINS PROVIDER (EPIC #3 E3-6 — SERVER-ONLY)
// Custom tenant domains via the Vercel Domains API, attached to
// the PLATFORM's own Vercel project (env DOMAINS_VERCEL_*).
//
// env:
//   DOMAINS_VERCEL_TOKEN       — API token for the platform team
//   DOMAINS_VERCEL_PROJECT_ID  — project the domains attach to
//   DOMAINS_VERCEL_TEAM_ID     — optional team scope
//
// HONESTY RULE (issue #3 §7): VERIFIED status comes ONLY from the
// provider's own `verified` flag in the API response. Without the
// required envs this provider reports SETUP_REQUIRED — it never
// fakes a verified/connected domain. The token is sent ONLY in
// the Authorization header and is never logged or included in
// error messages.
// ============================================================

import type {
  AddDomainResult,
  DnsRecord,
  DomainProvider,
  RemoveDomainResult,
  VerifyDomainResult,
} from "./types"

export const DOMAINS_VERCEL_TOKEN_ENV = "DOMAINS_VERCEL_TOKEN"
export const DOMAINS_VERCEL_PROJECT_ID_ENV = "DOMAINS_VERCEL_PROJECT_ID"
export const DOMAINS_VERCEL_TEAM_ID_ENV = "DOMAINS_VERCEL_TEAM_ID"

const DEFAULT_BASE_URL = "https://api.vercel.com"
/** Hard timeout for every provider call — no hanging requests. */
const REQUEST_TIMEOUT_MS = 10_000

/** Vercel's well-known apex routing IP (public documentation value). */
export const VERCEL_APEX_A_VALUE = "76.76.21.21"
/** Vercel's well-known subdomain CNAME target (public documentation value). */
export const VERCEL_CNAME_VALUE = "cname.vercel-dns.com"

export interface VercelDomainProviderConfig {
  /** API token — sent ONLY in the Authorization header, never logged. */
  token: string
  projectId: string
  teamId?: string | null
  /** Override for tests; defaults to https://api.vercel.com. */
  baseUrl?: string
  /** Injectable fetch for tests — the factory never captures globals. */
  fetchImpl?: typeof fetch
}

// ------------------------------------------------------------
// Pure request construction + response mapping (unit-testable
// without any network)
// ------------------------------------------------------------

function teamQuery(teamId: string | null): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
}

/** POST target — domain registration uses the v9 project endpoint. */
export function vercelAddDomainUrl(
  baseUrl: string,
  projectId: string,
  teamId: string | null
): string {
  return `${baseUrl}/v9/projects/${encodeURIComponent(projectId)}/domains${teamQuery(teamId)}`
}

/** GET target — the domain's verification status lives on v12. */
export function vercelGetDomainUrl(
  baseUrl: string,
  projectId: string,
  domain: string,
  teamId: string | null
): string {
  return `${baseUrl}/v12/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(teamId)}`
}

/** DELETE target — removal uses the v9 project endpoint (404 = already gone). */
export function vercelDeleteDomainUrl(
  baseUrl: string,
  projectId: string,
  domain: string,
  teamId: string | null
): string {
  return `${baseUrl}/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(teamId)}`
}

/**
 * Apex approximation (issue #3 §7): a host with exactly one dot is
 * treated as the registrable apex ("salon.si"); anything deeper is
 * a subdomain ("www.salon.si"). Good enough for DNS guidance.
 */
export function isApexHost(domain: string): boolean {
  return domain.split(".").length === 2
}

/** DNS record the tenant must create so Vercel can route the domain. */
export function dnsGuidanceRecord(domain: string): DnsRecord {
  if (isApexHost(domain)) {
    return {
      type: "A",
      name: "@",
      value: VERCEL_APEX_A_VALUE,
      description: "Points the apex domain to Vercel (A record).",
    }
  }
  return {
    type: "CNAME",
    name: domain,
    value: VERCEL_CNAME_VALUE,
    description: "Points the subdomain to Vercel (CNAME record).",
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Map the provider's `verification` entries ({ type, domain, value })
 * to serializable DnsRecords. Malformed entries are skipped — never
 * guessed into existence.
 */
export function mapVerificationRecords(domain: string, verification: unknown): DnsRecord[] {
  if (!Array.isArray(verification)) return []
  const records: DnsRecord[] = []
  for (const entry of verification) {
    const record = asRecord(entry)
    if (!record) continue
    const type = typeof record["type"] === "string" ? record["type"] : ""
    const name = typeof record["domain"] === "string" ? record["domain"] : domain
    const value = typeof record["value"] === "string" ? record["value"] : ""
    if (!type || !value) continue
    records.push({ type, name, value })
  }
  return records
}

// ------------------------------------------------------------
// Localized failure messages (sl/en pairs, never leak the token)
// ------------------------------------------------------------

const SETUP_REQUIRED_MESSAGES = {
  message: `Povezovanje lastnih domen ni konfigurirano (manjka ${DOMAINS_VERCEL_TOKEN_ENV} ali ${DOMAINS_VERCEL_PROJECT_ID_ENV}).`,
  messageEn: `Custom domains are not configured (missing ${DOMAINS_VERCEL_TOKEN_ENV} or ${DOMAINS_VERCEL_PROJECT_ID_ENV}).`,
} as const

const NETWORK_ERROR_MESSAGES = {
  message: "Povezava z Vercel ni uspela (mrežna napaka ali časovna omejitev 10 s).",
  messageEn: "Could not reach Vercel (network error or 10 s timeout).",
} as const

const AUTH_ERROR_MESSAGES = {
  message:
    "Vercel je zavrnil overjanje — preverite DOMAINS_VERCEL_TOKEN (pravice žetona ali potek).",
  messageEn:
    "Vercel rejected authentication — check DOMAINS_VERCEL_TOKEN (token permissions or expiry).",
} as const

function conflictMessages(domain: string) {
  return {
    message: `Domena ${domain} je že povezana z drugim Vercel projektom ali računom.`,
    messageEn: `The domain ${domain} is already connected to another Vercel project or account.`,
  }
}

function invalidDomainMessages(domain: string) {
  return {
    message: `Vercel je domeno ${domain} zavrnil kot neveljavno.`,
    messageEn: `Vercel rejected ${domain} as an invalid domain.`,
  }
}

function notFoundMessages(domain: string) {
  return {
    message: `Domena ${domain} ni bila najdena v Vercel projektu — dodajte jo najprej.`,
    messageEn: `The domain ${domain} was not found in the Vercel project — add it first.`,
  }
}

function httpErrorMessages(status: number, upstreamMessage: string) {
  const detail = upstreamMessage ? `: ${upstreamMessage}` : ""
  return {
    message: `Vercel napaka (HTTP ${status}${detail}).`,
    messageEn: `Vercel error (HTTP ${status}${detail}).`,
  }
}

// ------------------------------------------------------------
// HTTP plumbing
// ------------------------------------------------------------

function authHeaders(token: string, jsonBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (jsonBody) headers["Content-Type"] = "application/json"
  return headers
}

type FetchOutcome =
  | { kind: "response"; status: number; body: unknown }
  | { kind: "network"; detail: string }

/**
 * Single fetch funnel: 10 s AbortController timeout, JSON body
 * parsing (empty bodies → null) and network failures collapsed
 * into a discriminated outcome. Only the injected fetchImpl is
 * called — tests replace it entirely.
 */
async function performRequest(
  fetchImpl: typeof fetch,
  url: string,
  init: Pick<RequestInit, "method" | "headers" | "body">
): Promise<FetchOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { kind: "response", status: response.status, body }
  } catch (err) {
    return {
      kind: "network",
      detail: err instanceof Error ? err.message : "unknown network error",
    }
  } finally {
    clearTimeout(timer)
  }
}

function vercelErrorCode(body: unknown): string {
  const error = asRecord(asRecord(body)?.["error"])
  return error && typeof error["code"] === "string" ? error["code"] : ""
}

function vercelErrorMessage(body: unknown): string {
  const error = asRecord(asRecord(body)?.["error"])
  return error && typeof error["message"] === "string" ? error["message"] : ""
}

// ------------------------------------------------------------
// Factory + env-backed instance
// ------------------------------------------------------------

/**
 * Build a Vercel-backed DomainProvider from explicit config. Tests
 * inject `fetchImpl` and `baseUrl`; production uses `fetch` and the
 * real API. The provider is honest by construction: every method
 * refuses with SETUP_REQUIRED when the token/project are blank.
 */
export function createVercelDomainProvider(config: VercelDomainProviderConfig): DomainProvider {
  const baseUrl = (config.baseUrl ?? "").trim().replace(/\/+$/, "") || DEFAULT_BASE_URL
  const teamId = (config.teamId ?? "").trim() || null
  const fetchImpl = config.fetchImpl ?? fetch

  const isConfigured = (): boolean =>
    config.token.trim().length > 0 && config.projectId.trim().length > 0

  return {
    id: "vercel",
    isConfigured,

    async addDomain(domain: string): Promise<AddDomainResult> {
      if (!isConfigured()) {
        return { ok: false, code: "SETUP_REQUIRED", ...SETUP_REQUIRED_MESSAGES }
      }
      const outcome = await performRequest(
        fetchImpl,
        vercelAddDomainUrl(baseUrl, config.projectId.trim(), teamId),
        {
          method: "POST",
          headers: authHeaders(config.token.trim(), true),
          body: JSON.stringify({ name: domain }),
        }
      )
      if (outcome.kind === "network") {
        console.error("[domains] vercel addDomain request failed:", outcome.detail)
        return { ok: false, code: "PROVIDER_ERROR", ...NETWORK_ERROR_MESSAGES }
      }
      const errorCode = vercelErrorCode(outcome.body)
      if (
        outcome.status === 409 ||
        errorCode === "domain_taken" ||
        errorCode === "domain_already_exists"
      ) {
        return { ok: false, code: "DOMAIN_CONFLICT", ...conflictMessages(domain) }
      }
      if (outcome.status === 400 || outcome.status === 422) {
        return { ok: false, code: "INVALID_DOMAIN", ...invalidDomainMessages(domain) }
      }
      if (outcome.status === 401 || outcome.status === 403) {
        return { ok: false, code: "PROVIDER_ERROR", ...AUTH_ERROR_MESSAGES }
      }
      if (outcome.status !== 200 && outcome.status !== 201) {
        return {
          ok: false,
          code: "PROVIDER_ERROR",
          ...httpErrorMessages(outcome.status, vercelErrorMessage(outcome.body)),
        }
      }
      const data = asRecord(outcome.body)
      if (data && data["verified"] === true) {
        // Provider confirmed — the ONLY moment a domain may count as verified.
        return { ok: true, verified: true, dnsRecords: [] }
      }
      return {
        ok: true,
        verified: false,
        dnsRecords: data
          ? [...mapVerificationRecords(domain, data["verification"]), dnsGuidanceRecord(domain)]
          : [dnsGuidanceRecord(domain)],
      }
    },

    async verifyDomain(domain: string): Promise<VerifyDomainResult> {
      if (!isConfigured()) {
        return { ok: false, code: "SETUP_REQUIRED", ...SETUP_REQUIRED_MESSAGES }
      }
      const outcome = await performRequest(
        fetchImpl,
        vercelGetDomainUrl(baseUrl, config.projectId.trim(), domain, teamId),
        {
          method: "GET",
          headers: authHeaders(config.token.trim(), false),
        }
      )
      if (outcome.kind === "network") {
        console.error("[domains] vercel verifyDomain request failed:", outcome.detail)
        return { ok: false, code: "PROVIDER_ERROR", ...NETWORK_ERROR_MESSAGES }
      }
      if (outcome.status === 404) {
        return { ok: false, code: "DOMAIN_NOT_FOUND", ...notFoundMessages(domain) }
      }
      if (outcome.status !== 200) {
        return {
          ok: false,
          code: "PROVIDER_ERROR",
          ...httpErrorMessages(outcome.status, vercelErrorMessage(outcome.body)),
        }
      }
      const data = asRecord(outcome.body)
      const records = data ? mapVerificationRecords(domain, data["verification"]) : []
      return {
        ok: true,
        verified: data?.["verified"] === true,
        dnsRecords: records.length > 0 ? records : null,
      }
    },

    async removeDomain(domain: string): Promise<RemoveDomainResult> {
      if (!isConfigured()) {
        return { ok: false, code: "SETUP_REQUIRED", ...SETUP_REQUIRED_MESSAGES }
      }
      const outcome = await performRequest(
        fetchImpl,
        vercelDeleteDomainUrl(baseUrl, config.projectId.trim(), domain, teamId),
        {
          method: "DELETE",
          headers: authHeaders(config.token.trim(), false),
        }
      )
      if (outcome.kind === "network") {
        console.error("[domains] vercel removeDomain request failed:", outcome.detail)
        return { ok: false, code: "PROVIDER_ERROR", ...NETWORK_ERROR_MESSAGES }
      }
      // 404 = already gone — removal stays idempotent, never a fake error.
      if (outcome.status === 200 || outcome.status === 404) {
        return { ok: true }
      }
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        ...httpErrorMessages(outcome.status, vercelErrorMessage(outcome.body)),
      }
    },
  }
}

/**
 * The env-configured provider instance. Env is read lazily (getters)
 * so isConfigured()/calls always reflect current configuration —
 * same discipline as the platform Stripe client.
 */
export const vercelDomainProvider: DomainProvider = createVercelDomainProvider({
  get token() {
    return process.env[DOMAINS_VERCEL_TOKEN_ENV] ?? ""
  },
  get projectId() {
    return process.env[DOMAINS_VERCEL_PROJECT_ID_ENV] ?? ""
  },
  get teamId() {
    return process.env[DOMAINS_VERCEL_TEAM_ID_ENV] || null
  },
})
