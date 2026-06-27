const clean = (value) => String(value ?? '').trim()

const defaultBaseUrl = () => clean(process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com')

export function buildBookingLink({ baseUrl = defaultBaseUrl(), vehicleId = '', source = 'messenger' } = {}) {
  const base = clean(baseUrl).replace(/\/+$/, '') || 'https://easydrivecanada.com'
  const params = new URLSearchParams()
  const id = clean(vehicleId)
  if (id) params.set('vehicleId', id)
  params.set('source', clean(source) || 'messenger')
  return `${base}/book/test-drive?${params.toString()}`
}

export function buildBookingMessage({ baseUrl, vehicleId = '', vehicleTitle = '', source = 'messenger' } = {}) {
  const title = clean(vehicleTitle)
  const link = buildBookingLink({ baseUrl, vehicleId, source })
  const intro = title
    ? `Thanks for your interest in the ${title}. You can book a test drive here:`
    : 'Thanks for your interest. You can book a test drive here:'
  return `${intro}\n${link}`
}
