// ============================================================
// DOMAIN NORMALIZATION + PURE DOMAIN RULES (EPIC #3 E3-6)
// Single source of truth for what counts as a usable custom
// domain. Pure and client-safe: the same functions run in server
// actions, UI and tests — validation can never drift between
// surfaces (same principle as the publish requirements).
//
// Client-safe: NO server-only imports.
// ============================================================

import { DOMAIN_STATUSES } from "./types"
import type { DomainStatus } from "./types"

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

/** Max total length of a hostname (RFC 1035, one byte per char). */
export const DOMAIN_MAX_LENGTH = 253
/** Max length of a single label between dots. */
export const DOMAIN_MAX_LABEL_LENGTH = 63

/** Hosts that can never be claimed as a tenant custom domain. */
const RESERVED_HOSTS: readonly string[] = ["localhost"]

// ------------------------------------------------------------
// Raw input normalization pieces (pure, individually testable)
// ------------------------------------------------------------

function stripProtocol(host: string): string {
  return host.replace(/^https:\/\//, "").replace(/^http:\/\//, "")
}

function stripPathQueryHash(host: string): string {
  const cut = host.search(/[/?#]/)
  return cut === -1 ? host : host.slice(0, cut)
}

function stripPort(host: string): string {
  // Bracketed IPv6 literals are kept intact — they fail charset
  // validation below anyway; unbracketed hosts cut at the first colon.
  if (host.startsWith("[")) {
    const end = host.indexOf("]")
    return end === -1 ? host : host.slice(0, end + 1)
  }
  const colon = host.indexOf(":")
  return colon === -1 ? host : host.slice(0, colon)
}

// ------------------------------------------------------------
// Structural host validation (expects a normalized, lowercase
// host — no protocol/path/port)
// ------------------------------------------------------------

export type HostValidationError =
  | "TOO_LONG"
  | "CHARSET"
  | "NO_DOT"
  | "EMPTY_LABEL"
  | "LABEL_TOO_LONG"
  | "LABEL_HYPHEN"
  | "TLD"

const HOST_CHARSET = /^[a-z0-9.-]+$/
const ALPHABETIC_TLD = /^[a-z]{2,}$/

/**
 * First structural problem with the host, or null when valid.
 * Also rejects IP addresses: their last label is all digits, which
 * the alphabetic-TLD rule refuses.
 */
export function firstHostValidationError(host: string): HostValidationError | null {
  if (host.length === 0) return "CHARSET"
  if (host.length > DOMAIN_MAX_LENGTH) return "TOO_LONG"
  if (!HOST_CHARSET.test(host)) return "CHARSET"
  const labels = host.split(".")
  if (labels.length < 2) return "NO_DOT"
  for (const label of labels) {
    if (label.length === 0) return "EMPTY_LABEL"
    if (label.length > DOMAIN_MAX_LABEL_LENGTH) return "LABEL_TOO_LONG"
    if (label.startsWith("-") || label.endsWith("-")) return "LABEL_HYPHEN"
  }
  // TLD must be alphabetic and at least 2 chars long.
  if (!ALPHABETIC_TLD.test(labels[labels.length - 1])) return "TLD"
  return null
}

export function isValidDomainHost(host: string): boolean {
  return firstHostValidationError(host) === null
}

/** Reserved list membership + tenant-specific blocked hosts. */
export function isBlockedHost(host: string, blockedHosts: readonly string[] = []): boolean {
  const normalized = host.trim().toLowerCase()
  if (RESERVED_HOSTS.includes(normalized)) return true
  return blockedHosts.some((entry) => entry.trim().toLowerCase() === normalized)
}

// ------------------------------------------------------------
// Localized refusal messages
// ------------------------------------------------------------

const EMPTY_MESSAGES = {
  message: 'Vnesite domeno (npr. "moj-salon.si").',
  messageEn: 'Enter a domain (e.g. "my-salon.com").',
} as const

const TOO_LONG_MESSAGES = {
  message: `Domena je predolga — največ ${DOMAIN_MAX_LENGTH} znakov.`,
  messageEn: `The domain is too long — max ${DOMAIN_MAX_LENGTH} characters.`,
} as const

const PLATFORM_HOST_MESSAGES = (host: string) => ({
  message: `Domeno "${host}" ni mogoče uporabiti — rezervirana je za platformo.`,
  messageEn: `The domain "${host}" cannot be used — it is reserved for the platform.`,
})

const INVALID_MESSAGES: Record<
  Exclude<HostValidationError, "TOO_LONG">,
  { message: string; messageEn: string }
> = {
  CHARSET: {
    message:
      "Domena vsebuje neveljavne znake — uporabite samo črke, številke, pike in pomišnjaje (brez presledkov, podčrtajev, nadomestnih znakov ali nadomestkov, kot je »*«).",
    messageEn:
      'The domain contains invalid characters — use only letters, numbers, dots and hyphens (no spaces, underscores, unicode or wildcards like "*").',
  },
  NO_DOT: {
    message: "Vnesite polno domeno s končnico (npr. moj-salon.si).",
    messageEn: "Enter the full domain with its extension (e.g. my-salon.com).",
  },
  EMPTY_LABEL: {
    message: "Domena vsebuje prazen del (zaporedje ali presežek pik).",
    messageEn: "The domain contains an empty label (consecutive or extra dots).",
  },
  LABEL_TOO_LONG: {
    message: `Posamezen del domene je predolg (največ ${DOMAIN_MAX_LABEL_LENGTH} znakov).`,
    messageEn: `Individual domain labels are limited to ${DOMAIN_MAX_LABEL_LENGTH} characters.`,
  },
  LABEL_HYPHEN: {
    message: "Del domene se ne sme začeti ali končati s pomišnjajem.",
    messageEn: "Domain labels must not start or end with a hyphen.",
  },
  TLD: {
    message:
      "Končnica domene ni veljavna — sestavljena mora biti iz črk (vsaj 2); IP-naslovi niso podprti.",
    messageEn:
      "The domain extension is not valid — it must be letters only (at least 2); IP addresses are not supported.",
  },
}

// ------------------------------------------------------------
// Public entry point
// ------------------------------------------------------------

export type NormalizeDomainResult =
  | { ok: true; domain: string }
  | {
      ok: false
      reason: "EMPTY" | "TOO_LONG" | "INVALID" | "PLATFORM_HOST"
      message: string
      messageEn: string
    }

/**
 * Normalize raw user input into a host string, or refuse it with a
 * precise, localized reason. Rules:
 * - trims + lowercases, strips protocol, path/query/hash, port and
 *   exactly ONE trailing dot;
 * - keeps "www."-prefixed hosts DISTINCT (www is never stripped —
 *   www.acme.com and acme.com are two different domains);
 * - rejects wildcards, reserved hosts ("localhost", `blockedHosts`),
 *   IP addresses and every hostname violation.
 */
export function normalizeDomainInput(raw: string, blockedHosts: string[] = []): NormalizeDomainResult {
  let host = raw.trim().toLowerCase()
  host = stripProtocol(host)
  host = stripPathQueryHash(host)
  host = stripPort(host)
  if (host.endsWith(".")) host = host.slice(0, -1)

  if (host.length === 0) {
    return { ok: false, reason: "EMPTY", ...EMPTY_MESSAGES }
  }
  if (isBlockedHost(host, blockedHosts)) {
    return { ok: false, reason: "PLATFORM_HOST", ...PLATFORM_HOST_MESSAGES(host) }
  }
  const problem = firstHostValidationError(host)
  if (problem === "TOO_LONG") {
    return { ok: false, reason: "TOO_LONG", ...TOO_LONG_MESSAGES }
  }
  if (problem !== null) {
    return { ok: false, reason: "INVALID", ...INVALID_MESSAGES[problem] }
  }
  return { ok: true, domain: host }
}

// ------------------------------------------------------------
// Status, plan and state-machine helpers (pure)
// ------------------------------------------------------------

/** Tolerant parser for the DB string (unknown value never crashes rendering). */
export function parseDomainStatus(value: string | null | undefined): DomainStatus {
  return DOMAIN_STATUSES.includes((value ?? "") as DomainStatus)
    ? (value as DomainStatus)
    : "PENDING"
}

/** Plan gate: `null` limit = unlimited, any positive number = allowed. */
export function canUseCustomDomains(planLimits: { customDomains: number | null }): boolean {
  return planLimits.customDomains === null || planLimits.customDomains > 0
}

/**
 * Pure status state machine — every CustomDomain.status write must
 * pass through this. Honesty rules encoded here:
 * - VERIFIED is reachable from PENDING or FAILED only, and once
 *   VERIFIED a domain stays VERIFIED until deleted (VERIFIED →
 *   PENDING/FAILED is refused): the provider confirmed it, so local
 *   code may never silently un-verify it;
 * - FAILED is reachable from PENDING only;
 * - same → same is allowed (idempotent re-verification writes).
 */
export function domainStatusTransition(
  current: DomainStatus,
  next: DomainStatus
): { ok: boolean; reason?: string } {
  if (current === next) return { ok: true }
  if (current === "VERIFIED") {
    return { ok: false, reason: "VERIFIED_LOCKED" }
  }
  if (next === "FAILED" && current !== "PENDING") {
    return { ok: false, reason: "FAILED_ONLY_FROM_PENDING" }
  }
  return { ok: true }
}

/**
 * Only VERIFIED domains may become primary — isPrimary on a
 * non-verified domain would fake a "connected" domain (issue #3 §7
 * honesty rule).
 */
export function assertPrimaryEligibility(
  status: DomainStatus
): { ok: true } | { ok: false; message: string; messageEn: string } {
  if (status === "VERIFIED") return { ok: true }
  return {
    ok: false,
    message: "Primarna domena je lahko samo preverjena domena (status VERIFIED).",
    messageEn: "Only a verified domain (status VERIFIED) can be set as primary.",
  }
}

// ------------------------------------------------------------
// Request-host helpers (pure) — used by tenant resolution (E3-6)
// ------------------------------------------------------------

/**
 * Normalize a `Host` request header to a bare hostname for lookups:
 * lowercase, port stripped, IPv6 brackets stripped. Returns null for
 * anything that is not a plausible hostname (the caller then falls
 * back to platform-root behavior — no crash, no exception).
 */
export function hostFromHostHeader(value: string | null | undefined): string | null {
  if (!value) return null
  let host = value.trim().toLowerCase()
  if (!host) return null
  // [::1]:3000 → ::1
  if (host.startsWith("[")) {
    const end = host.indexOf("]")
    if (end === -1) return null
    host = host.slice(1, end)
    return isValidDomainHost(host) ? host : null
  }
  // example.com:8443 → example.com
  const colon = host.indexOf(":")
  if (colon !== -1) host = host.slice(0, colon)
  if (!isValidDomainHost(host)) return null
  return host
}

/**
 * True when the request host is one of the PLATFORM's own hosts
 * (deployment/app hosts from env). Only non-platform hosts are
 * candidates for custom-domain tenant resolution.
 */
export function isPlatformHost(host: string, platformHosts: readonly string[]): boolean {
  return platformHosts.includes(host)
}
