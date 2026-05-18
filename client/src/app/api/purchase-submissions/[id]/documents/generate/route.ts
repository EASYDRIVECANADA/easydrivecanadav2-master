/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'

import { generatePurchaseDocumentPackage } from '@/lib/purchaseDocumentPackageServer'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const submissionId = String(params.id || '').trim()
    if (!submissionId) return NextResponse.json({ error: 'Missing submission id' }, { status: 400 })

    const result = await generatePurchaseDocumentPackage(submissionId)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to generate document package' },
      { status: 500 }
    )
  }
}
