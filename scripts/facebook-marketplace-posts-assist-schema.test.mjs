import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../supabase/edc_facebook_marketplace_posts_assist.sql', import.meta.url), 'utf8').toLowerCase()

test('facebook marketplace assist schema adds required columns and index', () => {
  for (const column of ['assist_status', 'assist_started_at', 'assist_completed_at', 'assist_error', 'assist_payload']) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`))
  }
  assert.match(sql, /edc_facebook_marketplace_posts_assist_status_idx/)
  assert.match(sql, /default 'not_started'/)
  assert.match(sql, /jsonb not null default '\{\}'::jsonb/)
})
