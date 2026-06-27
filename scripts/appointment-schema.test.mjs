import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sqlPath = new URL('../supabase/edc_appointments.sql', import.meta.url)

test('appointment schema enforces one active booked appointment per dealership slot', async () => {
  const sql = await readFile(sqlPath, 'utf8')

  assert.match(sql, /edc_appointments_booked_starts_at_unique_idx/i)
  assert.match(sql, /unique\s+index/i)
  assert.match(sql, /on\s+public\.edc_appointments\s*\(\s*starts_at\s*\)/i)
  assert.match(sql, /where\s+status\s*=\s*'booked'/i)
})

test('appointment schema records notification sync placeholders for phase two delivery', async () => {
  const sql = await readFile(sqlPath, 'utf8')

  assert.match(sql, /customer_notification_status\s+text\s+not\s+null\s+default\s+'skipped'/i)
  assert.match(sql, /staff_notification_status\s+text\s+not\s+null\s+default\s+'skipped'/i)
})
