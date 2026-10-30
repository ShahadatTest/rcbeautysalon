import { cn } from "@/lib/utils"

/**
 * Splits a section title so the last word can be rendered with the
 * brand gradient accent (matches the existing landing design).
 * Single-word titles are returned fully as the accent.
 */
export function splitLastWord(text: string): {
  lead: string
  accent: string | null
} {
  const trimmed = text.trim()
  const words = trimmed.split(" ")
  if (words.length <= 1) return { lead: "", accent: trimmed || null }
  const accent = words.pop() as string
  return { lead: words.join(" "), accent }
}

/** Splits on the first comma: "Vaša lepota, naša strast" → "Vaša lepota," + "naša strast". */
export function splitOnComma(text: string): {
  lead: string
  accent: string | null
} {
  const idx = text.indexOf(",")
  if (idx >= 0 && idx < text.length - 1) {
    return {
      lead: text.slice(0, idx + 1),
      accent: text.slice(idx + 1).trim() || null,
    }
  }
  return splitLastWord(text)
}

/** Gradient accent span used by section headings. */
export function AccentSpan({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "from-primary to-accent bg-linear-to-r bg-clip-text text-transparent",
        className
      )}
    >
      {children}
    </span>
  )
}
