<script setup>
// One test-case row: status select + note toggle/textarea. Ported visually
// from js/app.js's renderTestRow() (~line 674). Status writes stay
// immediate (emitted straight through on change); note writes are debounced
// by the parent (ReportView.vue) — this component just emits raw input
// events and keeps its own open/closed + draft-text UI state.
import { ref, computed, watch } from 'vue'
import Icon from './icons/Icon.vue'

const props = defineProps({
  test: { type: Object, required: true }, // { id, num, name, status, note }
  locked: { type: Boolean, default: false }, // module/sub-module lock
  disabled: { type: Boolean, default: false }, // viewer role (RLS also enforces this server-side)
  busy: { type: Boolean, default: false }, // status write in flight
})
const emit = defineEmits(['status-change', 'note-input'])

const noteOpen = ref(false)
const draft = ref(props.test.note || '')

// Keep the local draft in sync with authoritative state (initial load,
// reload, or a failed-write rollback) without clobbering it mid-type —
// only resync while the note box is closed.
watch(
  () => props.test.note,
  (val) => {
    if (!noteOpen.value) draft.value = val || ''
  },
)

const editDisabled = computed(() => props.disabled || props.locked)

const STATUS_LABELS = { pending: 'Pending', pass: 'Pass', fail: 'Fail' }
const statusLabel = computed(() => STATUS_LABELS[props.test.status] || 'Pending')

function toggleNote() {
  noteOpen.value = !noteOpen.value
}

function onNoteInput() {
  emit('note-input', draft.value)
}
</script>

<template>
  <div class="test-row" :class="{ locked }" :data-status="test.status" :data-test-id="test.id">
    <div class="test-main">
      <span v-if="locked" class="row-lock-badge" title="Locked — status/note can't be edited">
        <Icon name="lock" cls="icon-sm" />
      </span>
      <span class="status-dot" :class="test.status"></span>
      <span class="test-id">{{ test.num }}.</span>
      <span class="test-text">{{ test.name }}</span>
      <div class="test-controls">
        <span class="status-select-wrap" :data-val="test.status">
          <!-- html2canvas (used for PDF export) renders native <select>
               option text unreliably — glyphs come out corrupted
               ("Pass" -> "Dace", "Fail" -> "Esil") since it can't
               faithfully rasterize native form-control internals. This
               plain span is the PDF-only stand-in; base.css swaps
               visibility between the two under body.generating-pdf. -->
          <span class="status-pill-print" :data-val="test.status">{{ statusLabel }}</span>
          <select
            class="status-select"
            :data-val="test.status"
            :disabled="editDisabled || busy"
            :value="test.status"
            @change="emit('status-change', $event.target.value)"
          >
            <option value="pending">Pending</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </span>
        <button
          type="button"
          class="note-toggle"
          :class="{ 'has-note': test.note && test.note.trim() }"
          :disabled="locked"
          @click="toggleNote"
        >
          <Icon name="notePlus" cls="icon-sm" />
          <span>{{ test.note ? 'Note' : 'Add note' }}</span>
        </button>
      </div>
    </div>
    <div class="note-box" :class="{ open: noteOpen }">
      <textarea
        v-model="draft"
        placeholder="Optional note — reproduction steps, screenshot ref, ticket link…"
        :disabled="editDisabled"
        @input="onNoteInput"
      ></textarea>
    </div>
  </div>
</template>
