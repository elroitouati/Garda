import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'garda-auth' },
      })
    : null
