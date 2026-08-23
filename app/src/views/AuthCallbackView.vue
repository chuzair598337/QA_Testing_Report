<script setup>
// Landing pad for every redirect-based auth flow: OAuth (Google),
// magic-link, signup-confirmation, and invite emails all come back here
// (see the `emailRedirectTo` / `redirectTo` values in ../stores/useAuth.js).
//
// Two distinct paths land here:
//  - Email-based links (signup confirm, magic link, invite) carry
//    `token_hash` + `type` query params. Per Supabase's PKCE-flow docs,
//    the code-exchange these links would otherwise rely on only works
//    "on the same browser and device where the flow was started" — so
//    for these we verify the token_hash directly via verifyOtp(), which
//    has no such same-device requirement.
//  - Google OAuth has no token_hash; supabase-js has already parsed the
//    `?code=...` query param (detectSessionInUrl + PKCE, set in
//    ../lib/supabaseClient.js) and exchanged it for a session by the time
//    this component mounts, so getSession() just waits for that in-flight
//    exchange to finish and reports the outcome. This fallback path is
//    unchanged.
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const router = useRouter()
const errorMessage = ref('')

function proceedAfterAuth() {
  // Newly-invited members land on /invite to finish setup (e.g. choose a
  // password) instead of going straight to the dashboard.
  const redirectTo = route.query.redirect_to
  if (typeof redirectTo === 'string' && redirectTo) {
    router.replace({ path: '/invite', query: { redirect_to: redirectTo } })
    return
  }

  router.replace({ name: 'dashboard' })
}

onMounted(async () => {
  const { token_hash: tokenHash, type } = route.query

  if (typeof tokenHash === 'string' && tokenHash && typeof type === 'string' && type) {
    // Email-based link (signup confirm / magic link / invite): verify the
    // token_hash directly. Works from any browser/device.
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

    if (error) {
      errorMessage.value = error.message
      return
    }

    proceedAfterAuth()
    return
  }

  // Google OAuth (PKCE) fallback — unchanged.
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    errorMessage.value = error.message
    return
  }

  if (!data.session) {
    errorMessage.value = 'We could not confirm your sign-in. Please try logging in again.'
    return
  }

  proceedAfterAuth()
})
</script>

<template>
  <div class="auth-status-page">
    <div v-if="errorMessage" class="auth-card">
      <p class="auth-error">{{ errorMessage }}</p>
      <div class="auth-links">
        <RouterLink to="/login">Back to log in</RouterLink>
      </div>
    </div>
    <p v-else>Signing you in…</p>
  </div>
</template>
