/**
 * Server-safe helper: prefix a path with the tenant slug.
 * orgPath("salon-luna", "/services") => "/s/salon-luna/services"
 * orgPath(null, "/services") => "/services" (default org)
 */
export function orgPath(slug: string | null | undefined, path: string): string {
  if (!slug || !path.startsWith("/")) return path
  // Idempotent guard: stored content may already embed this tenant's
  // prefix (e.g. owner-edited "/s/{slug}/booking") — never double-prefix.
  if (path === `/s/${slug}` || path.startsWith(`/s/${slug}/`)) return path
  const suffix = path === "/" ? "" : path
  return `/s/${slug}${suffix}`
}
