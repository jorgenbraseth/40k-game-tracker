import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env } from './env'

export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE (rather than the implicit flow) so the native build can complete sign-in itself via
    // `exchangeCodeForSession` -- see src/lib/nativeAuth.ts. Works the same as before on web,
    // where `detectSessionInUrl` still exchanges the `?code=` on /auth/callback automatically.
    flowType: 'pkce',
  },
})
