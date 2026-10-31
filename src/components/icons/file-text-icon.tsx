import { FileText } from "@phosphor-icons/react/dist/ssr"

interface FileTextIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function FileTextIcon({ size = 20, weight = "regular", className = "" }: FileTextIconProps) {
  return <FileText size={size} weight={weight} className={className} />
}
