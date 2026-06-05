#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const clean = (value) => String(value ?? '').trim()

async function main() {
  const startedAt = new Date()
  const dryRun = ['1', 'true', 'yes'].includes(clean(process.env.DRIVETOWN_SYNC_DRY_RUN).toLowerCase())
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
  const supabaseKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const configuredUserId = clean(process.env.DRIVETOWN_DEALER_USER_ID)

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const scraper = await import('../client/src/lib/drivetownScraper.mjs')
  const sync = await import('../client/src/lib/dealerSelectSync.mjs')

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const account = await ensureDriveTownAccount(supabase, sync, configuredUserId, dryRun)
  const userId = account.userId
  if (!userId) throw new Error('DriveTown account user_id could not be resolved')

  const scrape = await scraper.scrapeDriveTownInventory()
  if (!scrape.detailUrls.length) throw new Error('DriveTown listing discovery returned zero vehicle URLs')

  const supportsDealerSelectType = dryRun ? true : await detectDealerSelectSupport(supabase, sync, userId)
  const now = new Date().toISOString()
  const existingRows = await loadExistingDriveTownRows(supabase, userId)

  const counts = {
    listingUrls: scrape.detailUrls.length,
    scraped: scrape.vehicles.length,
    failed: scrape.failures.length,
    inserted: 0,
    updated: 0,
    preserved: 0,
    markedSold: 0,
  }

  for (const vehicle of scrape.vehicles) {
    const existing = sync.chooseExistingVehicle(vehicle, existingRows, userId)
    const baseRow = sync.buildVehicleUpsertRow(vehicle, { userId, now, supportsDealerSelectType })
    const row = existing ? sync.mergePreservingEditableFields(baseRow, existing) : baseRow

    if (existing && sync.shouldPreserveEditableFields(existing)) counts.preserved += 1

    if (dryRun) {
      if (existing) counts.updated += 1
      else counts.inserted += 1
      continue
    }

    if (existing?.id) {
      const { error } = await supabase.from('edc_vehicles').update({
        ...row,
        created_at: existing.created_at || row.created_at,
        vehicleId: existing.vehicleId || row.vehicleId,
      }).eq('id', existing.id)
      if (error) throw error
      counts.updated += 1
    } else {
      const { error } = await supabase.from('edc_vehicles').insert(row)
      if (error) {
        if (String(error.message || '').includes('DEALER_SELECT')) {
          const fallback = sync.buildVehicleUpsertRow(vehicle, { userId, now, supportsDealerSelectType: false })
          const { error: fallbackError } = await supabase.from('edc_vehicles').insert(fallback)
          if (fallbackError) throw fallbackError
        } else {
          throw error
        }
      }
      counts.inserted += 1
    }
  }

  const missing = sync.computeMissingSyncedVehicles(existingRows, scrape.vehicles, {
    completeListing: scrape.detailUrls.length > 0 && scrape.failures.length <= Math.max(3, Math.floor(scrape.detailUrls.length * 0.05)),
  })

  counts.markedSold = missing.length
  if (!dryRun && missing.length) {
    for (const row of missing) {
      const { error } = await supabase.from('edc_vehicles').update({
        status: 'Sold',
        source_sync_status: 'missing',
        source_last_synced_at: now,
        updated_at: now,
      }).eq('id', row.id)
      if (error) throw error
    }
  }

  const endedAt = new Date()
  console.log(JSON.stringify({
    source: sync.DRIVE_TOWN_SOURCE_NAME,
    dryRun,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    account,
    counts,
    failures: scrape.failures.slice(0, 20),
  }, null, 2))
}

async function ensureDriveTownAccount(supabase, sync, configuredUserId, dryRun) {
  if (configuredUserId) {
    return { userId: configuredUserId, configured: true }
  }

  const ownerRow = sync.buildDriveTownOwnerRow(globalThis.crypto?.randomUUID?.() || `${Date.now()}`)
  const { data: existingOwner, error: ownerLookupError } = await supabase
    .from('users')
    .select('id,user_id')
    .ilike('email', ownerRow.email)
    .limit(1)
    .maybeSingle()

  if (ownerLookupError) throw ownerLookupError

  let userId = clean(existingOwner?.user_id || ownerRow.user_id)
  if (dryRun) return { userId, configured: false, dryRunCreated: !existingOwner }

  if (existingOwner?.id) {
    const { error } = await supabase.from('users').update(sync.buildDriveTownOwnerRow(userId)).eq('id', existingOwner.id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('users').insert({
      ...sync.buildDriveTownOwnerRow(userId),
      created_at: new Date().toISOString(),
    }).select('id,user_id').single()
    if (error) throw error
    userId = clean(data?.user_id || userId)
  }

  const profileRow = sync.buildDriveTownDealershipRow(userId)
  const { data: existingDealer, error: dealerLookupError } = await supabase
    .from('dealership')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (dealerLookupError) throw dealerLookupError
  if (existingDealer?.id) {
    const { error } = await supabase.from('dealership').update(profileRow).eq('id', existingDealer.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('dealership').insert(profileRow)
    if (error) throw error
  }

  return { userId, configured: false }
}

async function detectDealerSelectSupport(supabase, sync, userId) {
  const probe = sync.buildVehicleUpsertRow({
    sourceUrl: 'probe',
    sourceVehicleId: 'probe',
    title: '2020 Test Probe',
    year: 2020,
    make: 'Test',
    model: 'Probe',
    vin: `PROBE${Date.now()}`,
    stockNumber: `PROBE${Date.now()}`,
    price: 1,
    mileage: 1,
  }, { userId, now: new Date().toISOString(), supportsDealerSelectType: true })

  const { error } = await supabase.from('edc_vehicles').insert(probe)
  if (!error) {
    await supabase.from('edc_vehicles').delete().eq('vin', probe.vin)
    return true
  }
  return !String(error.message || '').includes('DEALER_SELECT') && !String(error.message || '').includes('inventory_type')
}

async function loadExistingDriveTownRows(supabase, userId) {
  const { data, error } = await supabase
    .from('edc_vehicles')
    .select('*')
    .eq('user_id', userId)
    .or('notes.eq.Imported from DriveTown Ottawa feed,source_name.eq.DriveTown Ottawa,categories.eq.dealer_select')
    .limit(1000)

  if (error) throw error
  return Array.isArray(data) ? data : []
}

main().catch((error) => {
  console.error('[sync-drivetown] failed:', error)
  process.exit(1)
})
