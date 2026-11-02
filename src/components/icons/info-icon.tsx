import { Info } from "@phosphor-icons/react/dist/ssr"

interface InfoIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
  style?: React.CSSProperties
}

export function InfoIcon({ size = 20, weight = "regular", className = "", style }: InfoIconProps) {
  return <Info size={size} weight={weight} className={className} style={style} />
}
