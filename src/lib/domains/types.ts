// ============================================================
// CUSTOM DOMAIN PROVIDER INTERFACE (EPIC #3 E3-6)
// The domains layer talks ONLY to this interface — the provider
// can be swapped without touching tenant flows (same adapter
// pattern as the payments layer, PLAN.md decision log).
//
// HONESTY RULE (issue #3 §7): the provider's confirmation is the
// ONLY source of a VERIFIED domain. No code path may mark a
// domain connected/verified/secure unless the provider explicitly
// reports it. A provider that is not configured must return a
// clear SETUP_REQUIRED result and must NEVER fake a success —
// without a configured provider the UI shows a "setup required"
// state.
//
// Client-safe: NO server-only imports.
// ============================================================

/**
 * Domain lifecycle states persisted on CustomDomain.status.
 * VERIFIED is written exclusively after the provider confirms the
 * domain (its `verified` flag); FAILED records an honest, checked
 * and not-yet-verified state.
 */
export const DOMAIN_STATUSES = ["PENDING", "VERIFIED", "FAILED"] as const
export type DomainStatus = (typeof DOMAIN_STATUSES)[number]

/**
 * One DNS instruction shown to the tenant (plainly serializable —
 * stored as Json on CustomDomain.dnsRecords and rendered in the
 * Settings DNS instructions UI).
 */
export interface DnsRecord {
  /** Record type, e.g. "A", "CNAME", "TXT". */
  type: string
  /** Record name/host, e.g. "@" (apex) or the full subdomain. */
  name: string
  /** Record value/target, e.g. an IP address or a CNAME target. */
  value: string
  /** Optional supplementary hint for the DNS instructions UI. */
  description?: string
}

/**
 * Serializable UI shape for a CustomDomain row (no Date/Json
 * leakage across the server/client boundary — timestamps are ISO
 * strings).
 */
export interface CustomDomainView {
  id: string
  domain: string
  status: DomainStatus
  isPrimary: boolean
  dnsRecords: DnsRecord[] | null
  /** Last verification/setup error, surfaced honestly in the UI. */
  lastError: string | null
  lastCheckedAt: string | null
  verifiedAt: string | null
}

export type AddDomainResult =
  | { ok: true; verified: boolean; dnsRecords: DnsRecord[] }
  | {
      ok: false
      code: "SETUP_REQUIRED" | "PROVIDER_ERROR" | "DOMAIN_CONFLICT" | "INVALID_DOMAIN"
      message: string
      messageEn: string
    }

export type VerifyDomainResult =
  | { ok: true; verified: boolean; dnsRecords: DnsRecord[] | null }
  | {
      ok: false
      code: "SETUP_REQUIRED" | "PROVIDER_ERROR" | "DOMAIN_NOT_FOUND"
      message: string
      messageEn: string
    }

export type RemoveDomainResult =
  | { ok: true }
  | { ok: false; code: "SETUP_REQUIRED" | "PROVIDER_ERROR"; message: string; messageEn: string }

/**
 * Provider-neutral custom-domain adapter. A provider's `verified`
 * response is the single source of truth for VERIFIED status —
 * local code only persists what the provider reported.
 */
export interface DomainProvider {
  readonly id: string
  /**
   * True when the domain provider is fully configured. False →
   * callers must show an honest "setup required" state, never a
   * fake verification.
   */
  isConfigured(): boolean
  /** Register the domain with the provider and collect DNS instructions. */
  addDomain(domain: string): Promise<AddDomainResult>
  /** Ask the provider whether the domain's DNS now verifies. */
  verifyDomain(domain: string): Promise<VerifyDomainResult>
  /** Detach the domain from the provider (idempotent where possible). */
  removeDomain(domain: string): Promise<RemoveDomainResult>
}
