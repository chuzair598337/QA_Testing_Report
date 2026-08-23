// Auth store — a module-singleton composable (same pattern as
// ../composables/useTheme.js): one shared `session`/`user` ref for the
// whole app, kept in sync via `supabase.auth.onAuthStateChange`, plus the
// action methods every auth view needs.
//
// This is deliberately not a Pinia store — the project has no Pinia
// dependency, and a single reactive singleton is enough for this phase's
// auth surface. `src/stores/` is still the right home for it because it
// holds cross-component app state, unlike `composables/`, which holds
// stateless/session-local UI helpers (see useTheme.js).
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'

const session = ref(null)
const user = ref(null)

// Seed initial state, then keep it live. onAuthStateChange also fires once
// immediately on subscribe with the current session, so this covers both
// the first paint and every subsequent sign-in/sign-out/token-refresh.
supabase.auth.onAuthStateChange((_event, newSession) => {
  session.value = newSession
  user.value = newSession?.user ?? null
})

// Every redirect-based flow (OAuth, magic link, invite, password reset)
// must be built from the *current* origin, never a hardcoded domain — this
// is what makes both Production and every Preview deployment work without
// per-deployment config.
function originUrl(path) {
  return `${window.location.origin}${path}`
}

async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

async function signUp(email, password) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: originUrl('/auth/callback') },
  })
}

async function signInWithOtp(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: originUrl('/auth/callback') },
  })
}

async function signInWithOAuth(provider = 'google') {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: originUrl('/auth/callback') },
  })
}

async function resetPasswordForEmail(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: originUrl('/reset-password'),
  })
}

async function updateUser(attrs) {
  return supabase.auth.updateUser(attrs)
}

async function signOut() {
  return supabase.auth.signOut()
}

export function useAuth() {
  return {
    session,
    user,
    signInWithPassword,
    signUp,
    signInWithOtp,
    signInWithOAuth,
    resetPasswordForEmail,
    updateUser,
    signOut,
  }
}
