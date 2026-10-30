"use client"

/**
 * Client-side image prep: downscales to max dimension and re-encodes
 * as JPEG/WebP to keep uploads small (DB storage has no CDN transforms).
 */
export async function prepareImageForUpload(
  file: File,
  maxDimension = 1400,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1 && file.size < 1.2 * 1024 * 1024) return file

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    )
    if (!blob) return file
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg" })
  } catch {
    return file
  }
}

/** Upload helper used by all dashboard forms. Returns the served URL. */
export async function uploadImage(file: File, type: string): Promise<string> {
  const prepared = await prepareImageForUpload(file)
  const formData = new FormData()
  formData.append("file", prepared)
  formData.append("type", type)
  const res = await fetch("/api/upload", { method: "POST", body: formData })
  const json = await res.json()
  if (!res.ok || !json?.url) {
    throw new Error(json?.error || "Upload ni uspel")
  }
  return json.url as string
}
