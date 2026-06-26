const clean = (value) => String(value ?? '').trim()

export const ADMIN_USER_COLUMNS = 'id, email, administrator, status'
export const ADMIN_USER_COLUMNS_WITH_SESSION_TOKEN = `${ADMIN_USER_COLUMNS}, session_token`

export function isMissingSessionTokenColumnError(error) {
  const message = clean(error?.message || error)
  return /session_token/i.test(message) && /does not exist/i.test(message)
}

export function shouldRejectAdminSessionToken(storedToken, requestToken) {
  const stored = clean(storedToken)
  if (!stored) return false
  return stored !== clean(requestToken)
}
