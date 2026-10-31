// ============================================================
// E2-3 — bilingual error text for project action error codes.
// Client-safe: takes the already-loaded projects dictionary and
// maps the server error code to its message (no server imports).
// ============================================================

import type { ProjectErrorCode } from "@/app/actions/projects"
import type { ProjectsDict } from "@/lib/i18n/dict/projects"

export function projectErrorText(
  d: ProjectsDict,
  code: ProjectErrorCode | undefined
): string {
  switch (code) {
    case "VALIDATION":
      return d.errValidation
    case "NOT_FOUND":
      return d.errNotFound
    case "EXTENSION_OFF":
      return d.errExtensionOff
    case "LINK_MISMATCH":
      return d.errLinkMismatch
    case "INVALID_TRANSITION":
      return d.errTransition
    case "TASKS_OPEN":
      return d.errTasksOpen
    default:
      return d.errGeneric
  }
}
