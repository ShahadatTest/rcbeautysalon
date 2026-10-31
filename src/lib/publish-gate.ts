// Server-only module: uses the auth session and must never be imported by
// client components.
import { auth } from "@/lib/auth/auth"
import { parsePublishState } from "@/lib/publication"

export type PublishGate = "published" | "owner-preview" | "hidden"

/**
 * Single source of truth for who may see a tenant's site (EPIC #3 E3-1):
 * - PUBLISHED tenants are public.
 * - Non-published tenants are visible ONLY to their own signed-in owner/staff
 *   (as an explicit preview) — everyone else gets `hidden` (maintenance page,
 *   no footer, neutral metadata). No tenant data may leak through any surface.
 */
export async function resolvePublishGate(org: {
  id: string
  publishState: string | null
} | null | undefined): Promise<PublishGate> {
  if (!org) return "hidden"
  if (parsePublishState(org.publishState) === "PUBLISHED") return "published"
  try {
    const session = await auth()
    if (session?.user?.organizationId === org.id) return "owner-preview"
  } catch {
    // No session — treat as anonymous.
  }
  return "hidden"
}
