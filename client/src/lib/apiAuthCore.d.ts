export const ADMIN_USER_COLUMNS: string
export const ADMIN_USER_COLUMNS_WITH_SESSION_TOKEN: string
export function isMissingSessionTokenColumnError(error: unknown): boolean
export function shouldRejectAdminSessionToken(storedToken: unknown, requestToken: unknown): boolean
