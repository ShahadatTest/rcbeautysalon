import { Printer } from "@phosphor-icons/react/dist/ssr"

interface PrinterIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function PrinterIcon({ size = 20, weight = "regular", className = "" }: PrinterIconProps) {
  return <Printer size={size} weight={weight} className={className} />
}
