export const GOOD_BUY_ALLOWED_EMAIL = 'info@easydrivecanada.com'

export function normalizeGoodBuyEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function isGoodBuyEmailAllowed(email) {
  return normalizeGoodBuyEmail(email) === GOOD_BUY_ALLOWED_EMAIL
}

export function getGoodBuyRequestEmail(request) {
  const url = new URL(request.url)
  return normalizeGoodBuyEmail(
    request.headers.get('x-admin-email') ||
    url.searchParams.get('email') ||
    ''
  )
}

export function goodBuyForbiddenResponse() {
  return {
    error: `Good Buy Analyzer is only available for ${GOOD_BUY_ALLOWED_EMAIL}.`,
  }
}
