import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // heic-convert uses libheif-js (WebAssembly) — no native deps required
    // @ts-ignore — no types shipped with heic-convert
    const heicConvert = (await import('heic-convert')).default as any
    const outputArrayBuffer: ArrayBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.92,
    })

    return new Response(outputArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `inline; filename="${file.name.replace(/\.(heic|heif)$/i, '.jpg')}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Conversion failed' }, { status: 500 })
  }
}
