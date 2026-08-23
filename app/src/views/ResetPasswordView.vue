<script setup>
// Serves both halves of the password-reset flow at one route, matching the
// single `redirectTo: '<origin>/reset-password'` used in
// resetPasswordForEmail:
//  - no session yet, no token_hash -> "request a reset link" form (enter email)
//  - landed here from the emailed link, carrying `token_hash` (+ `type`,
//    which Supabase sets to 'recovery') -> verify the token_hash directly
//    via verifyOtp() before showing the "set new password" form. This link
//    lands here directly (not via /auth/callback), and per Supabase's
//    PKCE-flow docs the old code-exchange approach only works "on the same
//    browser and device where the flow was started" — verifyOtp() has no
//    such restriction.
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/useAuth'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const router = useRouter()
const { resetPasswordForEmail, updateUser } = useAuth()

const mode = ref('checking') // 'checking' | 'request' | 'update'
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const loading = ref(false)

onMounted(async () => {
  const { token_hash: tokenHash, type } = route.query

  if (typeof tokenHash === 'string' && tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeof type === 'string' && type ? type : 'recovery',
    })

    if (error) {
      errorMessage.value = error.message
      mode.value = 'request'
      return
    }

    mode.value = 'update'
    return
  }

  const { data } = await supabase.auth.getSession()
  mode.value = data.session ? 'update' : 'request'
})

async function handleRequest() {
  errorMessage.value = ''
  infoMessage.value = ''

  if (!email.value) {
    errorMessage.value = 'Enter your email.'
    return
  }

  loading.value = true
  const { error } = await resetPasswordForEmail(email.value)
  loading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  infoMessage.value = `We sent a password reset link to ${email.value}.`
}

async function handleUpdate() {
  errorMessage.value = ''
  infoMessage.value = ''

  if (!password.value || password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  const { error } = await updateUser({ password: password.value })
  loading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  infoMessage.value = 'Your password has been updated.'
  router.push('/dashboard')
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <p class="auth-eyebrow">QA Testing Report</p>
      <h1 class="auth-title">{{ mode === 'update' ? 'Set a new password' : 'Reset your password' }}</h1>

      <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
      <p v-if="infoMessage" class="auth-success">{{ infoMessage }}</p>

      <form v-if="mode === 'request'" @submit.prevent="handleRequest" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="reset-email">Email</label>
          <input
            id="reset-email"
            v-model="email"
            type="email"
            class="auth-input"
            autocomplete="email"
            :disabled="loading"
            required
          />
        </div>
        <button type="submit" class="btn primary auth-submit" :disabled="loading">
          {{ loading ? 'Sending…' : 'Send reset link' }}
        </button>
      </form>

      <form v-else-if="mode === 'update'" @submit.prevent="handleUpdate" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="reset-password">New password</label>
          <input
            id="reset-password"
            v-model="password"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            :disabled="loading"
            required
          />
        </div>
        <div class="auth-field">
          <label class="auth-label" for="reset-confirm-password">Confirm new password</label>
          <input
            id="reset-confirm-password"
            v-model="confirmPassword"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            :disabled="loading"
            required
          />
        </div>
        <button type="submit" class="btn primary auth-submit" :disabled="loading">
          {{ loading ? 'Updating…' : 'Update password' }}
        </button>
      </form>

      <p v-else class="auth-links">Checking your session…</p>

      <div class="auth-links">
        <RouterLink to="/login">Back to log in</RouterLink>
      </div>
    </div>
  </div>
</template>
