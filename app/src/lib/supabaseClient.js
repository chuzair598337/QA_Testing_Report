// Supabase client — single shared instance for the whole app.
//
// Reads its connection details from Vite env vars, populated locally via
// `.env.local` (gitignored, see `.env.example` for the shape) and in
// deployed environments via Vercel's Environment Variables.
//
// `flowType: 'pkce'` is explicit (not left to the library default) because
// it's what keeps every auth redirect (OAuth, magic link, invite, password
// reset) landing as a clean `?code=...` query string instead of a `#`
// fragment — required by the "no `#` in the URL" contract for
// `/auth/callback` and `/reset-password` (see router and useAuth).
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
