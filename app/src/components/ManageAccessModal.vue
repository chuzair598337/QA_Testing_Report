<script setup>
// Manage Access — full CRUD module (2026-08-24 design spec, Task 8).
// Self-contained: owns its own fetch/mutate lifecycle. Only tells its
// parent something changed via `membership-changed`, since an ownership
// transfer can change the CURRENT user's own role — something only the
// parent (which computed myRole/isOwner from its own report load) can
// refresh.
import { ref, computed, watch } from 'vue'
import { useReportMembers } from '../composables/useReportMembers'
import { useModalFocus } from '../composables/useModalFocus'
import Icon from './icons/Icon.vue'
import MemberCard from './MemberCard.vue'

const props = defineProps({
  open: { type: Boolean, required: true },
  reportId: { type: String, required: true },
  currentUserId: { type: String, required: true },
})
const emit = defineEmits(['close', 'membership-changed'])

const {
  fetchMembers,
  inviteMember,
  resendInvite,
  revokeInvite,
  updateMemberRole,
  removeMember,
  transferOwnership,
} = useReportMembers()

const modalBox = ref(null)
useModalFocus(
  () => props.open,
  modalBox,
)

const loading = ref(true)
const loadError = ref('')
const rows = ref([])

async function load() {
  loading.value = true
  loadError.value = ''
  const { data, error } = await fetchMembers(props.reportId)
  loading.value = false
  if (error) {
    loadError.value = error
    return
  }
  rows.value = data
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    viewStep.value = 'list'
    addOpen.value = false
    load()
  },
)

function close() {
  emit('close')
}
function onModalKeydown(e) {
  if (e.key === 'Escape') close()
}

// ---------------------------------------------------------------------
// Search / sort / filter
// ---------------------------------------------------------------------
const search = ref('')
const sort = ref('name')
const filter = ref('all')

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'pending', label: 'Pending' },
]

const visibleRows = computed(() => {
  let list = rows.value

  if (filter.value === 'pending') {
    list = list.filter((r) => r.status === 'pending')
  } else if (filter.value !== 'all') {
    list = list.filter((r) => r.status === 'active' && r.role === filter.value)
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (r) => (r.full_name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q),
    )
  }

  const sorted = [...list]
  if (sort.value === 'name') {
    sorted.sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''))
  } else if (sort.value === 'role') {
    const order = { owner: 0, editor: 1, viewer: 2 }
    sorted.sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3))
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }
  return sorted
})

// ---------------------------------------------------------------------
// Add member (inline expand/collapse under +Add, not a nested modal)
// ---------------------------------------------------------------------
const addOpen = ref(false)
const newEmail = ref('')
const newRole = ref('viewer')
const addBusy = ref(false)
const addError = ref('')

function toggleAdd() {
  addOpen.value = !addOpen.value
  addError.value = ''
}

async function submitAdd() {
  addError.value = ''
  addBusy.value = true
  const { error } = await inviteMember(props.reportId, newEmail.value, newRole.value)
  addBusy.value = false
  if (error) {
    addError.value = error
    return
  }
  newEmail.value = ''
  addOpen.value = false
  await load()
}

// ---------------------------------------------------------------------
// Per-row actions
// ---------------------------------------------------------------------
const roleChangeBusy = ref({})

const viewStep = ref('list') // 'list' | 'transfer-confirm'
const pendingTransfer = ref(null) // { memberId, name }

function onRoleChange(memberId, newRoleValue) {
  if (newRoleValue === 'owner') {
    const row = rows.value.find((r) => r.id === memberId)
    pendingTransfer.value = { memberId, name: row?.full_name || row?.email || 'this member' }
    viewStep.value = 'transfer-confirm'
    return
  }
  applyRoleChange(memberId, newRoleValue)
}

async function applyRoleChange(memberId, newRoleValue) {
  roleChangeBusy.value = { ...roleChangeBusy.value, [memberId]: true }
  const { error } = await updateMemberRole(memberId, newRoleValue)
  roleChangeBusy.value = { ...roleChangeBusy.value, [memberId]: false }
  if (error) {
    loadError.value = error
    return
  }
  await load()
}

async function confirmTransfer() {
  if (!pendingTransfer.value) return
  const { memberId } = pendingTransfer.value
  const { error } = await transferOwnership(props.reportId, memberId)
  viewStep.value = 'list'
  pendingTransfer.value = null
  if (error) {
    loadError.value = error
    return
  }
  await load()
  emit('membership-changed')
}

function cancelTransfer() {
  viewStep.value = 'list'
  pendingTransfer.value = null
}

async function onRemove(memberId) {
  const { error } = await removeMember(memberId)
  if (error) {
    loadError.value = error
    return
  }
  await load()
}

async function onResend(inviteId) {
  const { error } = await resendInvite(props.reportId, inviteId)
  if (error) {
    loadError.value = error
    return
  }
  await load()
}

async function onRevoke(inviteId) {
  const { error } = await revokeInvite(props.reportId, inviteId)
  if (error) {
    loadError.value = error
    return
  }
  await load()
}
</script>

<template>
  <div class="modal-overlay" :class="{ open }" :inert="!open" @click.self="close" @keydown="onModalKeydown">
    <div ref="modalBox" class="modal-box modal-box--members" role="dialog" aria-modal="true">
      <template v-if="viewStep === 'list'">
        <div class="manage-access-header">
          <h2>Manage access</h2>
          <button type="button" class="btn primary" @click="toggleAdd">
            <Icon name="plus" cls="icon-sm" />
            <span>Add</span>
          </button>
        </div>

        <div v-if="addOpen" class="manage-access-add-panel">
          <div class="auth-field">
            <label class="auth-label" for="manage-access-email">Invite by email</label>
            <input
              id="manage-access-email"
              v-model="newEmail"
              type="email"
              class="auth-input"
              :disabled="addBusy"
              placeholder="teammate@example.com"
            />
          </div>
          <div class="auth-field">
            <label class="auth-label" for="manage-access-role">Role</label>
            <select id="manage-access-role" v-model="newRole" class="auth-input" :disabled="addBusy">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          <p v-if="addError" class="auth-error">{{ addError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn" :disabled="addBusy" @click="addOpen = false">Cancel</button>
            <button type="button" class="btn primary" :disabled="addBusy" @click="submitAdd">
              {{ addBusy ? 'Sending…' : 'Send invite' }}
            </button>
          </div>
        </div>

        <div class="manage-access-toolbar">
          <div class="search-wrap">
            <Icon name="search" cls="icon search-icon" />
            <input
              v-model="search"
              type="search"
              class="search-input"
              placeholder="Search members…"
              aria-label="Search members"
              autocomplete="off"
            />
          </div>
          <select v-model="sort" class="auth-input manage-access-sort" aria-label="Sort members">
            <option value="name">Sort: Name</option>
            <option value="role">Sort: Role</option>
            <option value="recent">Sort: Recently added</option>
          </select>
        </div>
        <div class="manage-access-filters">
          <button
            v-for="f in FILTERS"
            :key="f.value"
            type="button"
            class="filter-chip"
            :class="{ active: filter === f.value }"
            @click="filter = f.value"
          >
            {{ f.label }}
          </button>
        </div>

        <p v-if="loadError" class="auth-error">{{ loadError }}</p>

        <div class="manage-access-list">
          <p v-if="loading" class="empty-hint">Loading members…</p>
          <p v-else-if="visibleRows.length === 0" class="empty-hint">No members match.</p>
          <MemberCard
            v-for="row in visibleRows"
            :key="`${row.kind}-${row.id}`"
            :row="row"
            :is-self="row.user_id === currentUserId"
            :role-change-busy="!!roleChangeBusy[row.id]"
            @role-change="onRoleChange"
            @remove="onRemove"
            @resend="onResend"
            @revoke="onRevoke"
          />
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" @click="close">Close</button>
        </div>
      </template>

      <template v-else>
        <h2>Transfer ownership?</h2>
        <p>
          {{ pendingTransfer?.name }} becomes the owner. You'll be moved to Editor. This can't be undone from
          here — the new owner would need to transfer it back.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn" @click="cancelTransfer">Cancel</button>
          <button type="button" class="btn danger" @click="confirmTransfer">Transfer ownership</button>
        </div>
      </template>
    </div>
  </div>
</template>
