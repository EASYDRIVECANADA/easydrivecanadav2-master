import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com').replace(/\/+$/, '')
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const revalidate = 3600

type VehicleRow = { id: string; updated_at?: string | null; status?: string | null }

async function fetchVehicleRoutes(): Promise<MetadataRoute.Sitemap> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/edc_vehicles?select=id,updated_at,status&status=not.in.(sold,closed)&limit=5000`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return []
    const rows = (await res.json()) as VehicleRow[]
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r) => r?.id)
      .map((r) => ({
        url: `${SITE_URL}/inventory/${r.id}`,
        lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/inventory`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/dealers`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/financing`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/warranty`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/sell`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]

  const vehicleRoutes = await fetchVehicleRoutes()
  return [...staticRoutes, ...vehicleRoutes]
}
