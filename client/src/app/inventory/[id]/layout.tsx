import type { Metadata } from 'next'

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
      `${SUPABASE_URL}/rest/v1/edc_vehicles?id=eq.${encodeURIComponent(id)}&select=make,model,series,year,price,mileage,odometer,transmission,exterior_color,body_style,images,vehicle_id`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    )
    if (!res.ok) throw new Error('fetch failed')
    const rows = await res.json()
    const v = Array.isArray(rows) && rows[0] ? rows[0] : null
    if (!v) throw new Error('not found')

    const year = v.year || ''
    const make = v.make || ''
    const model = v.model || ''
    const series = v.series || ''
    const price = v.price ? `$${Number(v.price).toLocaleString('en-CA')}` : ''
    const km = Number(v.odometer ?? v.mileage ?? 0)
    const transmission = v.transmission || ''
    const color = v.exterior_color || ''

    const title = [year, make, model, series].filter(Boolean).join(' ') + (price ? ` — ${price}` : '') + ' | EasyDrive Canada'
    const descParts = [
      price && `Price: ${price}`,
      km && `${km.toLocaleString('en-CA')} km`,
      transmission,
      color,
    ].filter(Boolean)
    const description = descParts.join(' · ') + '. Quality pre-owned vehicle at EasyDrive Canada.'

    // Resolve first image URL
    let imageUrl = `${SITE_URL}/og-default.jpg`
    const rawImages = v.images
    let imageList: string[] = []
    if (Array.isArray(rawImages)) {
      imageList = rawImages.map(String).filter(Boolean)
    } else if (typeof rawImages === 'string') {
      try { imageList = JSON.parse(rawImages) } catch { imageList = rawImages.split(',').map((s: string) => s.trim()).filter(Boolean) }
    }

    // If images are storage paths (not full URLs), convert to public URLs
    if (imageList.length > 0) {
      const first = imageList[0]
      if (first.startsWith('http://') || first.startsWith('https://')) {
        imageUrl = first
      } else if (SUPABASE_URL) {
        // Try bucket public URL: vehicle-photos/{vehicleId}/{filename}
        const vehicleId = v.vehicle_id || id
        const bucketRes = await fetch(
          `${SUPABASE_URL}/rest/v1/storage/v1/object/list/vehicle-photos`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prefix: `${vehicleId}/`, limit: 1, sortBy: { column: 'name', order: 'asc' } }),
            cache: 'no-store',
          }
        )
        if (bucketRes.ok) {
          const files = await bucketRes.json()
          if (Array.isArray(files) && files[0]?.name) {
            imageUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${vehicleId}/${files[0].name}`
          }
        }
      }
    }

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

export default function VehicleDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
