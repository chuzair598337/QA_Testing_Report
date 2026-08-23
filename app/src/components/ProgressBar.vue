<script setup>
// Overall pass-percent progress bar, ported from js/app.js's updateStats()
// progress-track/-fill/-label wiring (~line 749). `data-contrast` switches
// the label to high-contrast text once the fill covers most of the bar,
// same 42% threshold as the legacy app.
defineProps({
  percent: { type: Number, default: 0 },
  label: { type: String, default: '' },
})
</script>

<template>
  <div class="progress-wrap">
    <div
      class="progress-track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      aria-label="Testing progress"
      :data-contrast="percent >= 42 ? 'on-fill' : 'on-track'"
    >
      <div class="progress-fill" :style="{ width: percent + '%' }"></div>
      <span class="progress-label">{{ label || `${percent}% completed` }}</span>
    </div>
  </div>
</template>
