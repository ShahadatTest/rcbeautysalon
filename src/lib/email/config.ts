/**
 * Ali je e-poštni servis (Resend) dejansko konfiguriran? Brez API ključa
 * pošiljanje tiho odpove — klicatelj mora takrat pokazati alternativo
 * (npr. verifikacijsko povezavo direktno v UI), sicer uporabnik ostane
 * brez dostopa (E2E najdena luknja).
 *
 * Izvlečeno iz server action modula: v "use server" datoteki smejo biti
 * izvožene samo async funkcije, to pa je čisti sinhroni helper (testabilen).
 */
export function isEmailServiceConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const key = env.RESEND_API_KEY?.trim()
  return !!key && !key.startsWith("re_placeholder")
}
