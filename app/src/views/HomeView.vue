<script setup>
// Placeholder view — validates the build pipeline end-to-end before real
// views exist (Phase 1). Reuses the ported design tokens and Icon.vue.
import { useTheme } from '../composables/useTheme'
import Icon from '../components/icons/Icon.vue'

const { theme, toggleTheme } = useTheme()
</script>

<template>
  <div class="head-chrome">
    <div class="head-inner">
      <div class="head-top">
        <div class="head-title-block">
          <div class="eyebrow">QA Testing Report</div>
          <h1>Vue 3 + Vite Foundations</h1>
        </div>
        <div class="head-actions">
          <button class="btn" type="button" @click="toggleTheme">
            <Icon :name="theme === 'dark' ? 'sun' : 'moon'" />
            <span class="btn-label">{{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}</span>
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
      <h2 class="empty-title">Hello from Vue 3 + Vite</h2>
      <p class="empty-hint">
        This is the Phase 1 placeholder page — it proves the
        <strong>Vite build pipeline</strong> and ported design tokens work
        end to end, ahead of any real views or Supabase-backed data.
      </p>
    </div>
  </main>
</template>
