import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const res = await fetch('https://primary-production-6722.up.railway.app/webhook/creditApp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const text = await res.text()
    return new NextResponse(text, { status: res.status })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Proxy error', { status: 500 })
  }
}
