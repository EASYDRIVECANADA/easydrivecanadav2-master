import type { Metadata } from 'next'
import VehicleDetail from './VehicleDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com').replace(/\/+$/, '')

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  try {
    const { id } = params
    if (!id || !SUPABASE_URL || !SUPABASE_KEY) throw new Error('missing config')

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/edc_vehicles?id=eq.${encodeURIComponent(id)}&select=make,model,series,year,price,mileage,odometer,transmission,exterior_color,vehicleId`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    )
    if (!res.ok) throw new Error('fetch failed')
    const rows = await res.json()
    const v = Array.isArray(rows) && rows[0] ? rows[0] : null
    if (!v) throw new Error('not found')

    const year = String(v.year || '')
    const make = String(v.make || '')
    const model = String(v.model || '')
    const series = String(v.series || '')
    const price = v.price ? `$${Number(v.price).toLocaleString('en-CA')}` : ''
    const km = Number(v.odometer ?? v.mileage ?? 0)
    const transmission = String(v.transmission || '')
    const color = String(v.exterior_color || '')

    const nameParts = [year, make, model, series].filter(Boolean).join(' ')
    const title = nameParts + (price ? ` — ${price}` : '') + ' | EasyDrive Canada'

    const descParts: string[] = []
    if (price) descParts.push(`Price: ${price}`)
    if (km) descParts.push(`${km.toLocaleString('en-CA')} km`)
    if (transmission) descParts.push(transmission)
    if (color) descParts.push(color)
    const description = descParts.join(' · ') + '. Quality pre-owned vehicle at EasyDrive Canada.'

    // Fetch first photo from storage bucket
    // Images are uploaded under the DB primary key (id from URL), not vehicle_id
    let imageUrl = `${SITE_URL}/og-default.jpg`

    const tryBucketPrefix = async (prefix: string): Promise<string | null> => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/list/vehicle-photos`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prefix: `${prefix}/`, limit: 1, sortBy: { column: 'name', order: 'asc' } }),
            cache: 'no-store',
          }
        )
        if (!res.ok) return null
        const files = await res.json()
        const firstName: string | undefined =
          Array.isArray(files) && files[0]?.name && !String(files[0].name).endsWith('/')
            ? String(files[0].name)
            : undefined
        if (firstName) {
          return `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${prefix}/${encodeURIComponent(firstName)}`
        }
      } catch { /* ignore */ }
      return null
    }

    // Try DB id first (how images are uploaded), then vehicle_id as fallback
    const found = await tryBucketPrefix(id) || (v.vehicleId ? await tryBucketPrefix(String(v.vehicleId)) : null)
    if (found) imageUrl = found

    const pageUrl = `${SITE_URL}/inventory/${id}`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: pageUrl,
        type: 'website',
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
        siteName: 'EasyDrive Canada',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    }
  } catch {
    return {
      title: 'Vehicle Details | EasyDrive Canada',
      description: 'Browse quality pre-owned vehicles at EasyDrive Canada.',
    }
  }
}

export default function Page() {
  return <VehicleDetail />
}
