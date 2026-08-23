<script setup>
// Authenticated placeholder for a single report (/reports/:id) — proves
// the route param + guard work; real report content is a later phase.
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <main>
    <div class="empty-state">
      <h2 class="empty-title">Report {{ route.params.id }}</h2>
      <p class="empty-hint">Report content lands here in a later phase.</p>
    </div>
  </main>
</template>
