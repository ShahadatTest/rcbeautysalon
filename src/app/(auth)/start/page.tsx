import type { Metadata } from "next"
import { StartWizard } from "@/components/onboarding/start-wizard"

export const metadata: Metadata = {
  title: "Ustvari svoj salon",
  description:
    "Registrirajte svoj frizerski, nail ali kozmetični salon in takoj dobite spletno stran z rezervacijami in trgovino.",
}

export default function StartPage() {
  return <StartWizard />
}
