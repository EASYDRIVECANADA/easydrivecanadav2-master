#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const clean = (value) => {
  const trimmed = String(value ?? '').trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) return trimmed.slice(1, -1).trim()
  return trimmed
}

async function main() {
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
  const supabaseKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const userId = clean(process.env.DRIVETOWN_DEALER_USER_ID)

  if (!supabaseUrl || !supabaseKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

  const backfill = await import('../client/src/lib/marketplaceBackfill.mjs')
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const resolvedUserId = userId || await resolveDriveTownUserId(supabase)
  if (!resolvedUserId) throw new Error('DriveTown user_id could not be resolved')

  const sourceRow = backfill.buildDriveTownSourceRow(resolvedUserId)
  const { error: sourceError } = await supabase
    .from('dealer_inventory_sources')
    .upsert(sourceRow, { onConflict: 'user_id,source_name' })
  if (sourceError) throw sourceError

  const { data: rows, error: rowsError } = await supabase
    .from('edc_vehicles')
    .select('id,user_id,vin,stock_number,notes,updated_at')
    .eq('user_id', resolvedUserId)
    .eq('categories', 'dealer_select')
    .ilike('notes', '%Imported from DriveTown Ottawa feed%')
    .limit(1000)
  if (rowsError) throw rowsError

  let updated = 0
  for (const row of rows || []) {
    const update = backfill.buildMarketplaceBackfillUpdate(row)
    const { error } = await supabase.from('edc_vehicles').update(update).eq('id', row.id)
    if (error) throw error
    updated += 1
  }

  console.log(JSON.stringify({ userId: resolvedUserId, source: sourceRow.source_name, updated }, null, 2))
}

async function resolveDriveTownUserId(supabase) {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('email', 'inventory@drivetownottawa.com')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return String(data?.user_id || '').trim()
}

main().catch((error) => {
  console.error('[backfill-drivetown-marketplace] failed:', error)
  process.exit(1)
})
