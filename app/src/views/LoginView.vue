<script setup>
// Password + magic-link + Google sign-in, all landing on the same screen.
// All errors are inline state — no alert() anywhere in this app.
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/useAuth'
import SocialAuthButtons from '../components/SocialAuthButtons.vue'

const route = useRoute()
const router = useRouter()
const { signInWithPassword, signInWithOtp } = useAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const loading = ref(false)
const magicLinkLoading = ref(false)

function redirectTarget() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/dashboard'
}

async function handleSubmit() {
  errorMessage.value = ''
  infoMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Enter both your email and password.'
    return
  }

  loading.value = true
  const { error } = await signInWithPassword(email.value, password.value)
  loading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  router.push(redirectTarget())
}

async function handleMagicLink() {
  errorMessage.value = ''
  infoMessage.value = ''

  if (!email.value) {
    errorMessage.value = 'Enter your email above first.'
    return
  }

  magicLinkLoading.value = true
  const { error } = await signInWithOtp(email.value)
  magicLinkLoading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  infoMessage.value = `We sent a sign-in link to ${email.value}. Check your inbox.`
}

function handleSocialError(message) {
  errorMessage.value = message
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <p class="auth-eyebrow">QA Testing Report</p>
      <h1 class="auth-title">Log in</h1>

      <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
      <p v-if="infoMessage" class="auth-success">{{ infoMessage }}</p>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="login-email">Email</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            class="auth-input"
            autocomplete="email"
            :disabled="loading"
            required
          />
        </div>
        <div class="auth-field">
          <label class="auth-label" for="login-password">Password</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="auth-input"
            autocomplete="current-password"
            :disabled="loading"
            required
          />
        </div>
        <button type="submit" class="btn primary auth-submit" :disabled="loading">
          {{ loading ? 'Logging in…' : 'Log in' }}
        </button>
      </form>

      <div class="auth-links">
        <button
          type="button"
          class="auth-secondary-action"
          :disabled="magicLinkLoading"
          @click="handleMagicLink"
        >
          {{ magicLinkLoading ? 'Sending link…' : 'Email me a magic link instead' }}
        </button>
      </div>

      <div class="auth-divider">or</div>

      <SocialAuthButtons @error="handleSocialError" />

      <div class="auth-links">
        <RouterLink to="/reset-password">Forgot your password?</RouterLink>
        <span>No account? <RouterLink to="/signup">Sign up</RouterLink></span>
      </div>
    </div>
  </div>
</template>
