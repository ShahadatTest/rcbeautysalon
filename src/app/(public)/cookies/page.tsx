import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Piškotki",
  description:
    "Katere piškotke uporablja platforma: prijava, košarica in temni način — brez sledilnih piškotkov tretjih oseb.",
}

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politika piškotkov"
      updated="2. november 2026"
      sections={[
        {
          heading: "Katere piškotke uporabljamo",
          body: [
            "Uporabljamo izključno nujno potrebne piškotke: za prijavo in varnost seje (avtentikacija), za vsebino košarice ter za vašo izbiro svetlega/temnega videza. Brez njih stran ne deluje pravilno, zato jih postavljamo brez soglasja.",
            "Ne uporabljamo oglaševalskih ali sledilnih piškotkov tretjih oseb.",
          ],
        },
        {
          heading: "Kako jih izbrišete",
          body: [
            "Piškotke lahko kadarkoli izbrišete v nastavitvah svojega brskalnika. Po brisanju piškotka za prijavo se boste morali znova prijaviti.",
          ],
        },
      ]}
    />
  )
}
