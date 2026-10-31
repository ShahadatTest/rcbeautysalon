import { Image } from "@phosphor-icons/react/dist/ssr"

interface ImageIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function ImageIcon({
  size = 20,
  weight = "regular",
  className = "",
}: ImageIconProps) {
  return (
    // Phosphor icon component (inline SVG) — not an <img>; no alt attribute applies.
    // eslint-disable-next-line jsx-a11y/alt-text -- false positive: icon, not image
    <Image size={size} weight={weight} className={className} />
  )
}
