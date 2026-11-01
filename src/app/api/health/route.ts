// ============================================================
// PUBLIC HEALTH ENDPOINT (EPIC #4 E4-5 — §13)
// GET /api/health
//
// Deliberately MINIMAL: status + version (+ commit when Vercel
// provides it). No DB, no session, no subsystem touch — it can
// only answer or not answer (an absent/timeout response is the
// failure signal for external uptime monitors). No sensitive
// data by construction; answers well under the 200 ms budget.
// ============================================================

import { NextResponse } from "next/server"
import { publicHealthPayload } from "@/lib/health/health-report"

export const dynamic = "force-dynamic"

export function GET() {
  const payload = publicHealthPayload(
    process.env.npm_package_version ?? "unknown",
    process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    new Date()
  )
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  })
}
