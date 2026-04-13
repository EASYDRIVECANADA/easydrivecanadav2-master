import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: false, error: 'This test endpoint is disabled.' }, { status: 403 })
}
