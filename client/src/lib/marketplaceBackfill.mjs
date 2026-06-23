export const DRIVE_TOWN_SOURCE_NAME = 'DriveTown Ottawa'
export const DRIVE_TOWN_WEBSITE_URL = 'https://drivetownottawa.com/'
export const DRIVE_TOWN_INVENTORY_URL = 'https://drivetownottawa.com/vehicles/'
export const DRIVE_TOWN_SYNC_CRON = '0 3 */2 * *'

const clean = (value) => String(value ?? '').trim()

export function parseLegacySourceNotes(notes) {
  const raw = clean(notes)
  return {
    sourceUrl: raw.match(/source_url=([^;]+)/)?.[1]?.trim() || '',
    sourceVehicleId: raw.match(/source_vehicle_id=([^;]+)/)?.[1]?.trim() || '',
  }
}

export function buildMarketplaceBackfillUpdate(row) {
  const parsed = parseLegacySourceNotes(row?.notes)
  return {
    marketplace_source: DRIVE_TOWN_SOURCE_NAME,
    marketplace_source_url: parsed.sourceUrl || null,
    marketplace_source_vehicle_id: parsed.sourceVehicleId || null,
    marketplace_last_seen_at: row?.updated_at || null,
    marketplace_last_synced_at: row?.updated_at || null,
    marketplace_sync_status: 'active',
    marketplace_original_vin: clean(row?.vin) || null,
    marketplace_original_stock_number: clean(row?.stock_number) || null,
  }
}

export function buildDriveTownSourceRow(userId) {
  return {
    user_id: userId,
    source_name: DRIVE_TOWN_SOURCE_NAME,
    website_url: DRIVE_TOWN_WEBSITE_URL,
    inventory_url: DRIVE_TOWN_INVENTORY_URL,
    source_type: 'dealer_site',
    enabled: true,
    schedule_cron: DRIVE_TOWN_SYNC_CRON,
  }
}
