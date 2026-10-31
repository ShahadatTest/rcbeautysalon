import type { CapabilityMatrix } from "@/lib/profiles/types"

/**
 * Publication lifecycle (EPIC #3, E3-1).
 *
 * A tenant site moves through DRAFT → PUBLISHED → (optionally) UNPUBLISHED.
 * This module holds the PURE publish requirements so the same rules can be
 * validated in tests, in the server action and shown in the UI — behavior can
 * never drift between surfaces.
 */

export type PublishState = "DRAFT" | "PUBLISHED" | "UNPUBLISHED"

export interface PublishRequirementsInput {
  /** Tenant display name (Organization.name). */
  orgName: string
  /** Contact details (SalonConfig) — at least one channel must exist. */
  contactEmail: string | null
  contactPhone: string | null
  /** Catalog counts per tenant. */
  serviceCount: number
  productCount: number
  /** Effective capability matrix (shared profile + owner overrides). */
  capabilities: Pick<CapabilityMatrix, "services" | "shop">
}

export interface PublishValidation {
  ok: boolean
  /** Human-readable (Slovenian, the public site language) reasons blocking publication. */
  errors: string[]
}

/**
 * Server-side publish gate. Publication is refused (state unchanged) while any
 * requirement is unmet — a failed publish can never silently replace a site.
 */
export function validatePublishRequirements(
  input: PublishRequirementsInput,
): PublishValidation {
  const errors: string[] = []

  if (!input.orgName || input.orgName.trim().length === 0) {
    errors.push("Ime podjetja ni nastavljeno (Nastavitve → Osnovni podatki).")
  }

  const hasContact =
    (input.contactEmail && input.contactEmail.trim().length > 0) ||
    (input.contactPhone && input.contactPhone.trim().length > 0)
  if (!hasContact) {
    errors.push(
      "Manjka kontaktni podatek — dodajte vsaj e-pošto ali telefonsko številko (Nastavitve → Kontakt).",
    )
  }

  // Catalog requirement follows the EFFECTIVE capabilities, but only REQUIRED
  // capabilities block publication: a profile's required capabilities are its
  // identity (a beauty salon without services is not a beauty salon), while
  // optional capabilities the owner chose not to use are hidden from the site
  // anyway and must not block going live.
  if (input.capabilities.services === "required" && input.serviceCount < 1) {
    errors.push("Katalog je prazen — dodajte vsaj eno storitev.")
  }
  if (input.capabilities.shop === "required" && input.productCount < 1) {
    errors.push("Trgovina je obvezna za to dejavnost — dodajte vsaj en izdelek.")
  }

  return { ok: errors.length === 0, errors }
}

export const PUBLISH_STATES: PublishState[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED"]

/** Tolerant parser for the DB string (unknown value never crashes rendering). */
export function parsePublishState(value: string | null | undefined): PublishState {
  return PUBLISH_STATES.includes((value ?? "") as PublishState)
    ? (value as PublishState)
    : "PUBLISHED"
}

// ------------------------------------------------------------
// Content versioning (EPIC #3 E3-2)
// ------------------------------------------------------------

/**
 * Does the tenant have site content changes that are NOT yet published?
 * `publishedContentVersion === null` means a pre-E3-2 tenant (no snapshot yet):
 * its live site renders the working content directly, so by definition nothing
 * is "unpublished" — the UI must not nag owners who never opted into the
 * draft/publish flow.
 */
export function hasUnpublishedChanges(
  contentVersion: number | null | undefined,
  publishedContentVersion: number | null | undefined
): boolean {
  if (contentVersion == null || publishedContentVersion == null) return false
  return contentVersion !== publishedContentVersion
}

export type ComputeRevertInput = {
  /** Current working content version (Organization.contentVersion). */
  contentVersion: number
  /** Snapshot fields from SalonConfig — null when the tenant never published. */
  publishedSiteContent: unknown
  publishedContentVersion: number | null
}

export type ComputeRevertResult =
  | {
      ok: true
      /** Working content restored to the published JSON. */
      siteContent: unknown
      /**
       * The working version AFTER the revert: re-aligned to the published
       * version, because the content now IS the published content — drift
       * detection must not report "unpublished changes" for identical JSON.
       */
      contentVersion: number
    }
  | { ok: false; reason: "no-published-version" }

/**
 * Pure revert semantics (EPIC #3 E3-2): restoring the working draft to the
 * last published content. A tenant that never published has nothing to revert
 * to — the working content IS the live content in that case.
 */
export function computeRevert(input: ComputeRevertInput): ComputeRevertResult {
  if (input.publishedSiteContent == null) {
    return { ok: false, reason: "no-published-version" }
  }
  return {
    ok: true,
    siteContent: input.publishedSiteContent,
    contentVersion: input.publishedContentVersion ?? input.contentVersion,
  }
}
