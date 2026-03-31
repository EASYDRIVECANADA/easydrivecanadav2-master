import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SITE_URL = 'https://easydrivecanada.com'

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('missing env')

    // 1. Fetch vehicle row
    const vehRes = await fetch(
      `${SUPABASE_URL}/rest/v1/edc_vehicles?id=eq.${encodeURIComponent(id)}&select=make,model,series,year,price,mileage,odometer,transmission,exterior_color,ad_description,vehicleId`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    )
    if (!vehRes.ok) throw new Error('vehicle fetch failed')
    const rows = await vehRes.json()
    const v = Array.isArray(rows) && rows[0] ? rows[0] : null
    if (!v) throw new Error('not found')

    // 2. Build title & description
    const year = String(v.year || '')
    const make = String(v.make || '')
    const model = String(v.model || '')
    const series = String(v.series || '')
    const price = v.price ? `$${Number(v.price).toLocaleString('en-CA')}` : ''
    const km = Number(v.odometer ?? v.mileage ?? 0)
    const transmission = String(v.transmission || '')
    const color = String(v.exterior_color || '')
    const adDesc = String(v.ad_description || '')

    const nameParts = [year, make, model, series].filter(Boolean).join(' ')
    const title = nameParts + (price ? ` — ${price}` : '')
    const fullTitle = `${title} | EasyDrive Canada`

    const descParts: string[] = []
    if (price) descParts.push(`Price: ${price}`)
    if (km) descParts.push(`${km.toLocaleString('en-CA')} km`)
    if (transmission) descParts.push(transmission)
    if (color) descParts.push(color)
    const autoDesc = descParts.join(' · ')
    const description = adDesc
      ? adDesc.slice(0, 200).replace(/\s+/g, ' ').trim()
      : autoDesc + '. Available at EasyDrive Canada.'

    // 3. Fetch first photo from storage bucket
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
            body: JSON.stringify({
              prefix: `${prefix}/`,
              limit: 1,
              sortBy: { column: 'name', order: 'asc' },
            }),
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
    const t = esc(fullTitle)
    const d = esc(description)
    const img = esc(imageUrl)
    const u = esc(pageUrl)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${t}</title>

  <!-- ✅ Open Graph — used by Facebook, WhatsApp, iMessage, LinkedIn, Discord, Telegram -->
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="EasyDrive Canada" />
  <meta property="og:url"         content="${u}" />
  <meta property="og:title"       content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image"       content="${img}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type"   content="image/jpeg" />

  <!-- ✅ Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image"       content="${img}" />

  <link rel="canonical" href="${u}" />
</head>
<body>
  <a href="${u}">${t}</a>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    })
  } catch {
    // Fallback — redirect bot to the real page
    return NextResponse.redirect(`${SITE_URL}/inventory/${id}`, { status: 302 })
  }
}
