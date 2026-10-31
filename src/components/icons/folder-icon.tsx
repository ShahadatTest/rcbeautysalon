import { Folder } from "@phosphor-icons/react/dist/ssr"

interface FolderIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function FolderIcon({ size = 20, weight = "regular", className = "" }: FolderIconProps) {
  return <Folder size={size} weight={weight} className={className} />
}
