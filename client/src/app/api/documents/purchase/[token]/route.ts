/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'

import { getPurchaseDocumentPackageByToken } from '@/lib/purchaseDocumentPackageServer'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const token = String(params.token || '').trim()
    const pkg = await getPurchaseDocumentPackageByToken(token)
    if (!pkg) return NextResponse.json({ error: 'Document package not found' }, { status: 404 })
    return NextResponse.json({ package: pkg })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load document package' },
      { status: 500 }
    )
  }
}
