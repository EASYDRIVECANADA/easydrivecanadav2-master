export function resolveAccountScopeUserId({ sessionUserId, rowUserId, rowId } = {}) {
  const fromUserRow = String(rowUserId ?? '').trim()
  if (fromUserRow) return fromUserRow

  const fromSession = String(sessionUserId ?? '').trim()
  if (fromSession) return fromSession

  return String(rowId ?? '').trim()
}

export function resolveShowroomVehicleScope({
  sessionUserId,
  rowUserId,
  rowId,
  canViewAllShowroomVehicles,
} = {}) {
  const fromUserRow = String(rowUserId ?? '').trim()
  if (fromUserRow) return { userId: fromUserRow, shouldFilterByUserId: true }

  const fromSession = String(sessionUserId ?? '').trim()
  const fromRow = String(rowId ?? '').trim()
  if (canViewAllShowroomVehicles && fromRow && fromSession === fromRow) {
    return { userId: '', shouldFilterByUserId: false }
  }

  const userId = fromSession || fromRow
  return { userId, shouldFilterByUserId: Boolean(userId) }
}
