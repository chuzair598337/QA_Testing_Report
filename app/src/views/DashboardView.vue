<script setup>
// Authenticated placeholder — Phase 3 only proves the route guard and
// session wiring work end to end; the real dashboard (reports list, etc.)
// is a later phase's job.
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/useAuth'
import Icon from '../components/icons/Icon.vue'

const router = useRouter()
const { user, signOut } = useAuth()

async function handleSignOut() {
  await signOut()
  router.push('/login')
}
</script>

<template>
  <div class="head-chrome">
    <div class="head-inner">
      <div class="head-top">
        <div class="head-title-block">
          <div class="eyebrow">QA Testing Report</div>
          <h1>Dashboard</h1>
        </div>
        <div class="head-actions">
          <button class="btn" type="button" @click="handleSignOut">
            <Icon name="lock" />
            <span class="btn-label">Log out</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <main>
    <div class="empty-state">
      <div class="empty-icon">
        <Icon name="fileJson" cls="icon-lg" />
      </div>
      <h2 class="empty-title">You're signed in</h2>
      <p class="empty-hint">
        Logged in as <strong>{{ user?.email }}</strong>. Reports and modules
        land here in a later phase.
      </p>
    </div>
  </main>
</template>
