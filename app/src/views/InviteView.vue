<script setup>
// Accept-invite landing for a newly registered member, reached via
// /auth/callback -> /invite?redirect_to=... . The invite link already
// established a session (handled in AuthCallbackView); this screen's job
// is just to get the member to set their own password before they
// continue into the app.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/useAuth'

const router = useRouter()
const { updateUser } = useAuth()

const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = ''

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

  router.replace('/dashboard')
}

function skipForNow() {
  router.replace('/dashboard')
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <p class="auth-eyebrow">QA Testing Report</p>
      <h1 class="auth-title">Welcome — finish setting up</h1>

      <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="invite-password">Choose a password</label>
          <input
            id="invite-password"
            v-model="password"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            :disabled="loading"
            required
          />
        </div>
        <div class="auth-field">
          <label class="auth-label" for="invite-confirm-password">Confirm password</label>
          <input
            id="invite-confirm-password"
            v-model="confirmPassword"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            :disabled="loading"
            required
          />
        </div>
        <button type="submit" class="btn primary auth-submit" :disabled="loading">
          {{ loading ? 'Saving…' : 'Set password and continue' }}
        </button>
      </form>

      <div class="auth-links">
        <button type="button" class="auth-secondary-action" :disabled="loading" @click="skipForNow">
          Skip for now
        </button>
      </div>
    </div>
  </div>
</template>
