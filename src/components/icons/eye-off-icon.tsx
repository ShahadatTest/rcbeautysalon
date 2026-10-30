import { EyeSlash } from "@phosphor-icons/react/dist/ssr"

interface EyeOffIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function EyeOffIcon({
  size = 20,
  weight = "regular",
  className = "",
}: EyeOffIconProps) {
  return <EyeSlash size={size} weight={weight} className={className} />
}
