<script setup>
// Email/password signup + Google. On success, Supabase sends a
// verification email; we show that inline rather than redirecting, since
// there's no session yet until the link is clicked (see AuthCallbackView).
import { ref } from 'vue'
import { useAuth } from '../stores/useAuth'
import SocialAuthButtons from '../components/SocialAuthButtons.vue'

const { signUp } = useAuth()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  infoMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Enter both an email and a password.'
    return
  }
  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  const { error } = await signUp(email.value, password.value)
  loading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  infoMessage.value = `We sent a verification link to ${email.value}. Click it to finish signing up.`
  email.value = ''
  password.value = ''
  confirmPassword.value = ''
}

function handleSocialError(message) {
  errorMessage.value = message
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <p class="auth-eyebrow">QA Testing Report</p>
      <h1 class="auth-title">Create an account</h1>

      <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
      <p v-if="infoMessage" class="auth-success">{{ infoMessage }}</p>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="signup-email">Email</label>
          <input
            id="signup-email"
            v-model="email"
            type="email"
            class="auth-input"
            autocomplete="email"
            :disabled="loading"
            required
          />
        </div>
        <div class="auth-field">
          <label class="auth-label" for="signup-password">Password</label>
          <input
            id="signup-password"
            v-model="password"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            :disabled="loading"
            required
          />
        </div>
        <div class="auth-field">
          <label class="auth-label" for="signup-confirm-password">Confirm password</label>
          <input
            id="signup-confirm-password"
            v-model="confirmPassword"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            :disabled="loading"
            required
          />
        </div>
        <button type="submit" class="btn primary auth-submit" :disabled="loading">
          {{ loading ? 'Signing up…' : 'Sign up' }}
        </button>
      </form>

      <div class="auth-divider">or</div>

      <SocialAuthButtons @error="handleSocialError" />

      <div class="auth-links">
        <span>Already have an account? <RouterLink to="/login">Log in</RouterLink></span>
      </div>
    </div>
  </div>
</template>
