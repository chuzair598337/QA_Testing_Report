<script setup>
// Landing pad for every redirect-based auth flow: OAuth (Google),
// magic-link, and invite emails all come back here (see the
// `emailRedirectTo` / `redirectTo` values in ../stores/useAuth.js).
//
// By the time this component mounts, supabase-js has already parsed the
// `?code=...` query param from the URL (detectSessionInUrl + PKCE, set in
// ../lib/supabaseClient.js) and exchanged it for a session — so there is
// no `#` fragment ever visible here, and no explicit exchange call is
// needed from this component. Calling getSession() below just waits for
// that in-flight exchange to finish and reports the outcome.
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const router = useRouter()
const errorMessage = ref('')

onMounted(async () => {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    errorMessage.value = error.message
    return
  }

  if (!data.session) {
    errorMessage.value = 'We could not confirm your sign-in. Please try logging in again.'
    return
  }

  // Newly-invited members land on /invite to finish setup (e.g. choose a
  // password) instead of going straight to the dashboard.
  const redirectTo = route.query.redirect_to
  if (typeof redirectTo === 'string' && redirectTo) {
    router.replace({ path: '/invite', query: { redirect_to: redirectTo } })
    return
  }

  router.replace({ name: 'dashboard' })
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
