import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Skupni okvir pravnih strani (Zasebnost / Pogoji / Piškotki).
 * Besedilo je splošno in pošteno — opisuje dejansko obnašanje platforme
 * (katere podatke se shranjujejo in zakaj), ne pravne vodovodne palice.
 */
export function LegalPage({
  title,
  updated,
  sections,
  backLabel = "← Nazaj na domačo stran",
}: {
  title: string
  updated: string
  sections: { heading: string; body: string[] }[]
  backLabel?: string
}) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{title}</CardTitle>
          <CardDescription>Zadnja posodobitev: {updated}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-2 text-lg font-semibold">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-muted-foreground mb-2 text-sm leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href="/">{backLabel}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
