<script setup>
// KPI stat tiles — Total/Passed/Failed/Pending — clickable as status
// filters (Total clears the filter). Ported from the `.stat-tile` markup in
// index.html/js/app.js's KPI-click handler (~line 838); the active tile is
// highlighted via the existing `.stat-tile.active` CSS rule.
defineProps({
  stats: { type: Object, required: true },
  activeFilter: { type: String, default: 'all' },
})
const emit = defineEmits(['filter'])
</script>

<template>
  <div class="stat-grid">
    <button
      type="button"
      class="stat-tile total"
      :class="{ active: activeFilter === 'all' }"
      data-filter="all"
      @click="emit('filter', 'all')"
    >
      <div class="stat-label">Total cases</div>
      <div class="stat-value">{{ stats.total_tests }}</div>
    </button>
    <button
      type="button"
      class="stat-tile passed"
      :class="{ active: activeFilter === 'pass' }"
      data-filter="pass"
      @click="emit('filter', 'pass')"
    >
      <div class="stat-label">Passed</div>
      <div class="stat-value">{{ stats.pass_count }}</div>
    </button>
    <button
      type="button"
      class="stat-tile failed"
      :class="{ active: activeFilter === 'fail' }"
      data-filter="fail"
      @click="emit('filter', 'fail')"
    >
      <div class="stat-label">Failed</div>
      <div class="stat-value">{{ stats.fail_count }}</div>
    </button>
    <button
      type="button"
      class="stat-tile percent"
      :class="{ active: activeFilter === 'pending' }"
      data-filter="pending"
      @click="emit('filter', 'pending')"
    >
      <div class="stat-label">Pending</div>
      <div class="stat-value">{{ stats.pending_count }}</div>
    </button>
  </div>
</template>
