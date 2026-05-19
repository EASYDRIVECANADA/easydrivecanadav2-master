import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getSupabaseServerConfigFromEnv } from './purchaseDocumentPackageServerConfig.mjs'

test('purchase document storage requires the Supabase service role key', () => {
  assert.throws(
    () => getSupabaseServerConfigFromEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    }),
    /SUPABASE_SERVICE_ROLE_KEY/
  )
})

test('purchase document storage returns normalized Supabase service config', () => {
  assert.deepEqual(
    getSupabaseServerConfigFromEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co///',
      SUPABASE_SERVICE_ROLE_KEY: ' service-key ',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    }),
    {
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'service-key',
    }
  )
})
