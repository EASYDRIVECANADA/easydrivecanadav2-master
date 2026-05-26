import type { Metadata } from 'next'
import InventoryClient from './InventoryClient'
import { buildInventoryCollectionJsonLd, buildBreadcrumbJsonLd, type CollectionItem } from '@/lib/seo/json-ld'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com').replace(/\/+$/, '')

export const metadata: Metadata = {
  title: 'Used Cars for Sale in Canada — Inventory',
  description:
    'Browse quality pre-owned vehicles for sale across Canada. Filter by make, model, year, price, and body style. Transparent pricing and CARFAX reports.',
  alternates: { canonical: '/inventory' },
  openGraph: {
    title: 'Used Cars for Sale in Canada — Inventory | EasyDrive Canada',
    description:
      'Browse quality pre-owned vehicles for sale across Canada. Filter by make, model, year, price, and body style.',
    url: `${SITE_URL}/inventory`,
    type: 'website',
    siteName: 'EasyDrive Canada',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Used Cars for Sale in Canada — Inventory | EasyDrive Canada',
    description:
      'Browse quality pre-owned vehicles for sale across Canada. Filter by make, model, year, price, and body style.',
  },
}

async function fetchInventoryPreview(): Promise<CollectionItem[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/edc_vehicles?select=id,year,make,model,series,price&status=not.in.(sold,closed)&order=created_at.desc&limit=50`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate: 600 },
      }
    )
    if (!res.ok) return []
    const rows = await res.json()
    if (!Array.isArray(rows)) return []
    return rows as CollectionItem[]
  } catch {
    return []
  }
}

export default async function InventoryPage() {
  const items = await fetchInventoryPreview()
  const collectionJsonLd = buildInventoryCollectionJsonLd(items)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: `${SITE_URL}/` },
    { name: 'Inventory', url: `${SITE_URL}/inventory` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <InventoryClient />
    </>
  )
}
