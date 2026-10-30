import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { v2 as cloudinary } from "cloudinary"
import { getSessionOrg } from "@/lib/tenant"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const cloudinaryConfigured =
  !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET

// Upload type configurations
type UploadType =
  | "avatar"
  | "service"
  | "product"
  | "staff"
  | "logo"
  | "hero"
  | "about"
  | "cta"

const uploadConfigs: Record<UploadType, { folder: string }> = {
  avatar: { folder: "avatars" },
  service: { folder: "services" },
  product: { folder: "products" },
  staff: { folder: "staff" },
  logo: { folder: "branding" },
  hero: { folder: "branding" },
  about: { folder: "branding" },
  cta: { folder: "branding" },
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const type = (formData.get("type") as UploadType) || "avatar"
    const customId = formData.get("customId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate upload type
    if (!(type in uploadConfigs)) {
      return NextResponse.json({ error: "Invalid upload type" }, { status: 400 })
    }

    // SECURITY: only ADMIN/STAFF may upload site content; regular users are
    // limited to their own avatar uploads.
    if (type !== "avatar" && !["ADMIN", "STAFF"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to upload this content type" },
        { status: 403 }
      )
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    const config = uploadConfigs[type]

    // Org context: admins/staff upload into THEIR salon's namespace
    const org =
      session.user.role === "CLIENTE"
        ? null
        : await getSessionOrg()

    // --- Path A: Cloudinary (if the salon configured it) ---
    if (cloudinaryConfigured) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`

      // SECURITY: public_id is always server-generated. Client-supplied ids
      // would let an attacker overwrite existing site imagery, so they are ignored.
      const safePrefix = type.replace(/[^a-z_]/g, "")
      const publicId = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      void customId

      const result = await cloudinary.uploader.upload(base64, {
        folder: org ? `${org.slug}/${config.folder}` : `Beauty Salon/${config.folder}`,
        public_id: publicId,
        overwrite: false,
      })

      return NextResponse.json({
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
      })
    }

    // --- Path B: DB-backed media storage (zero third-party keys needed) ---
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    const media = await prisma.media.create({
      data: {
        organizationId: org?.id ?? null,
        filename: file.name.slice(0, 200) || "upload",
        mimeType: file.type,
        size: file.size,
        data: base64,
      },
    })

    return NextResponse.json({
      success: true,
      url: `/api/media/${media.id}`,
      publicId: media.id,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
