#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const SOURCE_COLUMNS = [
  'source_name',
  'source_url',
  'source_vehicle_id',
  'source_last_seen_at',
  'source_last_synced_at',
  'source_sync_status',
]

const REQUIRED_MARKETPLACE_COLUMNS = [
  'images',
  'marketplace_source',
  'marketplace_source_url',
  'marketplace_source_vehicle_id',
  'marketplace_last_seen_at',
  'marketplace_last_synced_at',
  'marketplace_sync_status',
  'marketplace_original_vin',
  'marketplace_original_stock_number',
]

function normalizeEnvValue(value) {
  const trimmed = String(value ?? '').trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const clean = normalizeEnvValue

function stripSourceColumns(row) {
  const copy = { ...row }
  const sourceUrl = clean(copy.source_url)
  const sourceVehicleId = clean(copy.source_vehicle_id)
  for (const key of SOURCE_COLUMNS) delete copy[key]
  copy.notes = [
    clean(copy.notes),
    sourceUrl ? `source_url=${sourceUrl}` : '',
    sourceVehicleId ? `source_vehicle_id=${sourceVehicleId}` : '',
  ].filter(Boolean).join('; ')
  return copy
}

function pickKnownColumns(row, knownColumns) {
  if (!knownColumns || knownColumns.size === 0) return row
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => knownColumns.has(key))
  )
}

function isDuplicateConstraintError(error) {
  return clean(error?.code) === '23505' || /duplicate key value violates unique constraint/i.test(clean(error?.message))
}

function requireMarketplaceColumns(vehicleColumns) {
  const missing = REQUIRED_MARKETPLACE_COLUMNS.filter((column) => !vehicleColumns.has(column))
  if (missing.length > 0) {
    throw new Error(`Apply supabase/marketplace_inventory_schema.sql before running DriveTown sync. Missing: ${missing.join(', ')}`)
  }
}

function buildRunStatus(counts, fatalError) {
  if (fatalError) return 'failed'
  if (Number(counts?.failed || 0) > 0 || Number(counts?.writeFailed || 0) > 0) return 'partial'
  return 'success'
}

function hydrateLegacySourceFields(row) {
  const notes = clean(row?.notes)
  const parsedNotesUrl = notes.match(/source_url=([^;]+)/)?.[1] ?? ''
  const parsedNotesVehicleId = notes.match(/source_vehicle_id=([^;]+)/)?.[1] ?? ''
  return {
    ...row,
    source_name: row?.marketplace_source || row?.source_name || (notes.includes('DriveTown Ottawa') ? 'DriveTown Ottawa' : ''),
    source_url: row?.marketplace_source_url || row?.source_url || parsedNotesUrl,
    source_vehicle_id: row?.marketplace_source_vehicle_id || row?.source_vehicle_id || parsedNotesVehicleId,
  }
}

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

  const vehicleColumns = await loadVehicleColumns(supabase)
  requireMarketplaceColumns(vehicleColumns)
  const sourceColumnsSupported = false
  const supportsDealerSelectType = dryRun ? true : await detectDealerSelectSupport(supabase, sync, userId, sourceColumnsSupported, vehicleColumns)
  const now = new Date().toISOString()
  const existingRows = await loadExistingDriveTownRows(supabase, userId, sourceColumnsSupported)

  const sourceId = dryRun ? '' : await ensureInventorySource(supabase, sync, userId)
  const runId = dryRun ? '' : await createSyncRun(supabase, {
    sourceId,
    userId,
    sourceName: sync.DRIVE_TOWN_SOURCE_NAME,
    dryRun,
    startedAt,
  })

  let fatalError = null
  let counts = {}
  let scrapeFailures = []
  const writeFailures = []
  let endedAt = null

  try {
    const scrape = await scraper.scrapeDriveTownInventory()
    if (!scrape.detailUrls.length) throw new Error('DriveTown listing discovery returned zero vehicle URLs')

    counts = {
      listingUrls: scrape.detailUrls.length,
      scraped: scrape.vehicles.length,
      failed: scrape.failures.length,
      inserted: 0,
      updated: 0,
      preserved: 0,
      markedSold: 0,
      writeFailed: 0,
    }
    scrapeFailures = scrape.failures.slice(0, 20)

    const scrapedVehicles = sync.prepareScrapedVehiclesForUniqueVin(scrape.vehicles)

    for (const vehicle of scrapedVehicles) {
      const existing = sync.chooseExistingVehicle(vehicle, existingRows, userId)
      const baseRow = sync.buildVehicleUpsertRow(vehicle, { userId, now, supportsDealerSelectType })
      const mergedRow = existing ? sync.mergePreservingEditableFields(baseRow, existing) : baseRow
      const row = pickKnownColumns(mergedRow, vehicleColumns)

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
            const fallbackRow = pickKnownColumns(fallback, vehicleColumns)
            const { error: fallbackError } = await supabase.from('edc_vehicles').insert(fallbackRow)
            if (fallbackError) {
              if (isDuplicateConstraintError(fallbackError)) {
                counts.writeFailed += 1
                writeFailures.push({ url: vehicle.sourceUrl, vin: vehicle.vin, stockNumber: vehicle.stockNumber, error: fallbackError.message })
                continue
              }
              throw fallbackError
            }
          } else if (isDuplicateConstraintError(error)) {
            counts.writeFailed += 1
            writeFailures.push({ url: vehicle.sourceUrl, vin: vehicle.vin, stockNumber: vehicle.stockNumber, error: error.message })
            continue
          } else {
            throw error
          }
        }
        counts.inserted += 1
      }
    }

    const missing = sync.computeMissingSyncedVehicles(existingRows, scrapedVehicles, {
      completeListing: scrape.detailUrls.length > 0 && scrape.failures.length <= Math.max(3, Math.floor(scrape.detailUrls.length * 0.05)),
    })

    counts.markedSold = missing.length
    if (!dryRun && missing.length) {
      for (const row of missing) {
        const soldRow = pickKnownColumns({
          status: 'Sold',
          marketplace_sync_status: 'missing',
          marketplace_last_synced_at: now,
          updated_at: now,
        }, vehicleColumns)
        const { error } = await supabase.from('edc_vehicles').update(soldRow).eq('id', row.id)
        if (error) throw error
      }
    }

    endedAt = new Date()
    console.log(JSON.stringify({
      source: sync.DRIVE_TOWN_SOURCE_NAME,
      dryRun,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      account,
      counts,
      failures: scrapeFailures,
      writeFailures: writeFailures.slice(0, 20),
      runId: runId || null,
    }, null, 2))
  } catch (error) {
    fatalError = error
    throw error
  } finally {
    if (!dryRun && runId) {
      const finishedAt = endedAt || new Date()
      const errors = [
        ...scrapeFailures.map((failure) => ({ type: 'scrape', ...failure })),
        ...writeFailures.slice(0, 20).map((failure) => ({ type: 'write', ...failure })),
        ...(fatalError ? [{ type: 'fatal', error: fatalError.message }] : []),
      ]
      await finishSyncRun(supabase, {
        runId,
        sourceId,
        status: buildRunStatus(counts, fatalError),
        counts,
        errors,
        finishedAt,
      })
    }
  }
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

async function ensureInventorySource(supabase, sync, userId) {
  const row = {
    user_id: userId,
    source_name: sync.DRIVE_TOWN_SOURCE_NAME,
    website_url: sync.DRIVE_TOWN_WEBSITE,
    inventory_url: 'https://drivetownottawa.com/vehicles/',
    source_type: 'dealer_site',
    enabled: true,
    schedule_cron: '0 */6 * * *',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('dealer_inventory_sources')
    .upsert(row, { onConflict: 'user_id,source_name' })
    .select('id')
    .single()
  if (error) throw error
  return String(data?.id || '')
}

async function createSyncRun(supabase, { sourceId, userId, sourceName, dryRun, startedAt }) {
  const { data, error } = await supabase
    .from('dealer_inventory_sync_runs')
    .insert({
      source_id: sourceId,
      user_id: userId,
      source_name: sourceName,
      dry_run: dryRun,
      started_at: startedAt.toISOString(),
      status: 'running',
    })
    .select('id')
    .single()
  if (error) throw error
  return String(data?.id || '')
}

async function finishSyncRun(supabase, { runId, sourceId, status, counts, errors, finishedAt }) {
  const { error: runError } = await supabase
    .from('dealer_inventory_sync_runs')
    .update({
      status,
      counts,
      errors,
      finished_at: finishedAt.toISOString(),
    })
    .eq('id', runId)
  if (runError) throw runError

  const { error: sourceError } = await supabase
    .from('dealer_inventory_sources')
    .update({
      last_run_at: finishedAt.toISOString(),
      last_run_status: status,
      last_run_counts: counts,
      last_error: errors?.[0]?.error || null,
      updated_at: finishedAt.toISOString(),
    })
    .eq('id', sourceId)
  if (sourceError) throw sourceError
}

async function loadVehicleColumns(supabase) {
  const { data, error } = await supabase
    .from('edc_vehicles')
    .select('*')
    .limit(1)

  if (error) throw error
  const first = Array.isArray(data) ? data[0] : null
  return new Set(Object.keys(first || {}))
}

async function detectDealerSelectSupport(supabase, sync, userId, sourceColumnsSupported, vehicleColumns) {
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

  const row = pickKnownColumns(sourceColumnsSupported ? probe : stripSourceColumns(probe), vehicleColumns)
  const { error } = await supabase.from('edc_vehicles').insert(row)
  if (!error) {
    await supabase.from('edc_vehicles').delete().eq('vin', probe.vin)
    return true
  }
  return !String(error.message || '').includes('DEALER_SELECT') && !String(error.message || '').includes('inventory_type')
}

async function loadExistingDriveTownRows(supabase, userId, sourceColumnsSupported) {
  let query = supabase
    .from('edc_vehicles')
    .select('*')
    .eq('user_id', userId)
    .limit(1000)

  if (sourceColumnsSupported) {
    query = query.or('notes.eq.Imported from DriveTown Ottawa feed,source_name.eq.DriveTown Ottawa,categories.eq.dealer_select')
  }

  const { data, error } = await query

  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  const filtered = sourceColumnsSupported
    ? rows
    : rows.filter((row) => {
      const notes = clean(row?.notes)
      return row?.categories === 'dealer_select' || notes.includes('Imported from DriveTown Ottawa feed')
    })
  return filtered.map(hydrateLegacySourceFields)
}

module.exports = {
  buildRunStatus,
  isDuplicateConstraintError,
  normalizeEnvValue,
  pickKnownColumns,
  requireMarketplaceColumns,
  stripSourceColumns,
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[sync-drivetown] failed:', error)
    process.exit(1)
  })
}
