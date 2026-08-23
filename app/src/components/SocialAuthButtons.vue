<script setup>
// Shared OAuth buttons for LoginView / SignupView. Errors are surfaced via
// an emitted event rather than alert() — the parent view owns the inline
// error UI so both screens show it in the same place as their other
// form errors.
import { ref } from 'vue'
import { useAuth } from '../stores/useAuth'

const emit = defineEmits(['error'])
const { signInWithOAuth } = useAuth()

const loading = ref(false)

async function handleGoogle() {
  loading.value = true
  const { error } = await signInWithOAuth('google')
  // On success the browser is redirected away to Google, so `loading`
  // only ever needs resetting on the failure path.
  if (error) {
    loading.value = false
    emit('error', error.message)
  }
}
</script>

<template>
  <div class="social-auth">
    <button type="button" class="btn" :disabled="loading" @click="handleGoogle">
      <span>{{ loading ? 'Redirecting…' : 'Continue with Google' }}</span>
    </button>
  </div>
</template>
