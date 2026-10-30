import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** Serves images stored in the DB (Media model) — used when Cloudinary is not configured. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const media = await prisma.media.findUnique({ where: { id } })
    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const buffer = Buffer.from(media.data, "base64")
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Media serve error:", error)
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 })
  }
}
