import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sqlPath = new URL('../supabase/edc_fleet_quote_profiles.sql', import.meta.url)

test('fleet quote profiles schema supports secure customer quote sessions', async () => {
  const sql = await readFile(sqlPath, 'utf8')

  assert.match(sql, /create table if not exists public\.edc_fleet_quote_profiles/i)
  assert.match(sql, /public_token uuid not null default gen_random_uuid\(\)/i)
  assert.match(sql, /passcode_hash text not null/i)
  assert.match(sql, /customer_name text not null/i)
  assert.match(sql, /customer_phone_last4 text not null/i)
  assert.match(sql, /province text not null default 'ON'/i)
  assert.match(sql, /apr numeric not null default 0\.0799/i)
  assert.match(sql, /term_months integer not null default 96/i)
  assert.match(sql, /warranty_tier text not null default '3yr'/i)
  assert.match(sql, /suggested_vehicle_ids text\[\] not null default '\{\}'::text\[\]/i)
  assert.match(sql, /selected_vehicle_ids text\[\] not null default '\{\}'::text\[\]/i)
  assert.match(sql, /view_expires_at timestamptz/i)
  assert.match(sql, /submitted_at timestamptz/i)
  assert.match(sql, /edc_fleet_quote_profiles_public_token_idx/i)
})
