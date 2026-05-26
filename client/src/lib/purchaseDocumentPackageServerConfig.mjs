export function getSupabaseServerConfigFromEnv(env = process.env) {
  const supabaseUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (!supabaseUrl) {
    throw new Error('Supabase server not configured: missing NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!supabaseKey) {
    throw new Error(
      'Supabase server not configured: missing SUPABASE_SERVICE_ROLE_KEY. Purchase document packages must use the service role key so private BOS PDFs can be stored in Supabase Storage.'
    )
  }

  return { supabaseUrl, supabaseKey }
}
