import { Stack } from "@phosphor-icons/react/dist/ssr"

interface StackIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function StackIcon({ size = 20, weight = "regular", className = "" }: StackIconProps) {
  return <Stack size={size} weight={weight} className={className} />
}
