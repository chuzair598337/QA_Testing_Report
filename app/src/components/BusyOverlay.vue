<script setup>
// Generic app-wide busy/loading overlay. Drop in as a plain extra child of
// any `position:relative` container (or use `fixed` for full-viewport) —
// it never wraps/slots the caller's content, so it has zero layout effect
// on flex/grid siblings. The actual interaction-blocking is the caller's
// job: bind `:inert` onto whatever content should be unreachable while
// `active` is true (see call sites in DashboardView.vue/ReportView.vue/
// ManageAccessModal.vue) — `.busy-overlay`'s own pointer-events only stop
// clicks that land on the scrim itself.
defineProps({
  active: { type: Boolean, required: true },
  label: { type: String, default: 'Loading…' },
  // Viewport-fixed instead of absolute-over-nearest-relative-ancestor.
  // Only PDF export uses this — every other call site overlays a specific
  // page/modal region, not the whole viewport.
  fixed: { type: Boolean, default: false },
})
</script>

<template>
  <div class="busy-overlay" :class="{ show: active, fixed }">
    <span class="busy-spinner" aria-hidden="true"></span>
    <!-- Always mounted (never v-if'd) so the aria-live region exists in the
         DOM before its text changes — required for screen readers to
         reliably announce it. -->
    <p class="busy-overlay-label" role="status" aria-live="polite">{{ active ? label : '' }}</p>
  </div>
</template>
