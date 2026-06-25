import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sqlPath = new URL('../supabase/edc_facebook_marketplace_posts.sql', import.meta.url)

test('facebook marketplace posts schema declares required table, columns, and indexes', async () => {
  const sql = await readFile(sqlPath, 'utf8')

  assert.match(sql, /create table if not exists public\.edc_facebook_marketplace_posts/i)
  for (const column of [
    'vehicle_id',
    'user_id',
    'status',
    'facebook_listing_url',
    'posting_title',
    'posting_description',
    'posting_price',
    'posting_location',
    'posting_payload',
    'readiness',
    'notes',
    'posted_at',
    'last_prepared_at',
    'created_at',
    'updated_at',
  ]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, 'i'))
  }

  assert.match(sql, /edc_facebook_marketplace_posts_vehicle_id_idx/i)
  assert.match(sql, /edc_facebook_marketplace_posts_status_idx/i)
  assert.match(sql, /edc_facebook_marketplace_posts_user_status_idx/i)
  assert.match(sql, /edc_facebook_marketplace_posts_last_prepared_idx/i)
  assert.match(sql, /comment on table public\.edc_facebook_marketplace_posts/i)
})
