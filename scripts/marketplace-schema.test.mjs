import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sqlPath = new URL('../supabase/marketplace_inventory_schema.sql', import.meta.url)

test('marketplace schema migration declares required vehicle columns and tables', async () => {
  const sql = await readFile(sqlPath, 'utf8')

  for (const column of [
    'images',
    'marketplace_source',
    'marketplace_source_url',
    'marketplace_source_vehicle_id',
    'marketplace_last_seen_at',
    'marketplace_last_synced_at',
    'marketplace_sync_status',
    'marketplace_original_vin',
    'marketplace_original_stock_number',
    'retail_price',
    'finance_price',
    'source_price_payload',
  ]) {
    assert.match(sql, new RegExp(`add column if not exists ${column}\\b`, 'i'))
  }

  assert.match(sql, /create table if not exists public\.dealer_inventory_sources/i)
  assert.match(sql, /create table if not exists public\.dealer_inventory_sync_runs/i)
  assert.match(sql, /edc_vehicles_marketplace_source_url_idx/i)
  assert.match(sql, /dealer_inventory_sources_user_source_name_idx/i)
  assert.match(sql, /dealer_inventory_sync_runs_source_started_idx/i)
})
