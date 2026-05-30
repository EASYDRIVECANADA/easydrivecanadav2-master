const clean = (value) => String(value || '').trim()

const uniqueIds = (rows) => {
  const ids = []
  const seen = new Set()
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = clean(row?.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export async function scopePurchaseSubmissionQueryForUser(supabase, query, userId) {
  const scopedUserId = clean(userId)
  if (!scopedUserId) return { query, empty: false }

  const { data, error } = await supabase
    .from('edc_vehicles')
    .select('id')
    .eq('user_id', scopedUserId)

  if (error) throw new Error(error.message || 'Failed to load scoped vehicles')

  const vehicleIds = uniqueIds(data)
  if (vehicleIds.length === 0) return { query, empty: true }

  return {
    query: query.in('vehicle_id', vehicleIds),
    empty: false,
  }
}
