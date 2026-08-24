<script setup>
// One row in the Manage Access member list — either an active member or a
// pending invite (Task 7 of the 2026-08-24 design spec). `row` is exactly
// the shape useReportMembers.fetchMembers() produces.
import { computed } from 'vue'
import Icon from './icons/Icon.vue'

const props = defineProps({
  row: { type: Object, required: true },
  isSelf: { type: Boolean, default: false },
  roleChangeBusy: { type: Boolean, default: false },
})
const emit = defineEmits(['role-change', 'remove', 'resend', 'revoke'])

const ROLE_TOOLTIP =
  'Owner: full access, including managing members. Editor: can run tests and edit notes. Viewer: read-only.'

const displayName = computed(() => props.row.full_name || props.row.email || 'Unknown member')
const initials = computed(() => {
  const source = props.row.full_name || props.row.email || '?'
  return source
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
})

const selfLocked = computed(() => props.isSelf && props.row.role === 'owner')

function onRoleChange(event) {
  const newRole = event.target.value
  if (newRole === props.row.role) return
  emit('role-change', props.row.id, newRole)
}

function relativeInviteAge(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}
</script>

<template>
  <div class="member-card" :class="{ pending: row.status === 'pending' }">
    <div class="member-card-identity">
      <div class="member-avatar" aria-hidden="true">{{ initials }}</div>
      <div class="member-card-text">
        <div class="member-card-name">
          {{ displayName }}
          <span v-if="isSelf" class="member-you-tag">(you)</span>
        </div>
        <div class="member-card-email">{{ row.email }}</div>
        <div v-if="row.status === 'pending'" class="member-invite-meta">
          <template v-if="row.resent_at">
            Invited {{ relativeInviteAge(row.created_at) }} · Resent {{ relativeInviteAge(row.resent_at) }}
          </template>
          <template v-else> Invited {{ relativeInviteAge(row.created_at) }} </template>
        </div>
      </div>
    </div>

    <div class="member-card-actions">
      <template v-if="row.status === 'pending'">
        <span class="role-badge pending">Pending</span>
        <button type="button" class="btn" @click="emit('resend', row.id)">
          <Icon name="rotateCcw" cls="icon-sm" />
          <span>Resend</span>
        </button>
        <button type="button" class="btn danger" @click="emit('revoke', row.id)">
          <Icon name="x" cls="icon-sm" />
          <span>Revoke</span>
        </button>
      </template>
      <template v-else>
        <select
          class="role-select"
          :value="row.role"
          :disabled="selfLocked || roleChangeBusy"
          :title="selfLocked ? 'Transfer ownership to change your own role' : ROLE_TOOLTIP"
          @change="onRoleChange"
        >
          <option value="owner">Owner</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          type="button"
          class="icon-btn"
          :disabled="selfLocked"
          :aria-label="selfLocked ? 'Remove member (disabled — transfer ownership first)' : 'Remove member'"
          :title="selfLocked ? 'Transfer ownership before removing yourself' : 'Remove member'"
          @click="emit('remove', row.id)"
        >
          <Icon name="trash2" cls="icon-sm" />
        </button>
      </template>
    </div>
  </div>
</template>
