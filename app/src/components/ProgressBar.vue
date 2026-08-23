<script setup>
// Overall pass-percent progress bar, ported from js/app.js's updateStats()
// progress-track/-fill/-label wiring (~line 749). The label renders twice,
// each clipped to the half of the bar it stays legible on — see the
// `.progress-label--on-fill`/`--on-track` comment in base.css.
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
      :style="{ '--pct': percent + '%' }"
    >
      <div class="progress-fill" :style="{ width: percent + '%' }"></div>
      <span class="progress-label progress-label--on-fill" aria-hidden="true">{{ label || `${percent}% completed` }}</span>
      <span class="progress-label progress-label--on-track">{{ label || `${percent}% completed` }}</span>
    </div>
  </div>
</template>
