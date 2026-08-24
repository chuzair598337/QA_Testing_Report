<script setup>
// Manage Access — full CRUD module (2026-08-24 design spec, Task 8).
// Self-contained: owns its own fetch/mutate lifecycle. Only tells its
// parent something changed via `membership-changed`, since an ownership
// transfer can change the CURRENT user's own role — something only the
// parent (which computed myRole/isOwner from its own report load) can
// refresh.
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useReportMembers } from '../composables/useReportMembers'
import { useModalFocus } from '../composables/useModalFocus'
import Icon from './icons/Icon.vue'
import MemberCard from './MemberCard.vue'
import BusyOverlay from './BusyOverlay.vue'

const props = defineProps({
  open: { type: Boolean, required: true },
  reportId: { type: String, required: true },
  // Not required: on a hard page refresh, ReportView.vue's `user?.id` can
  // briefly be undefined while the auth store is still loading, before
  // this modal is ever opened — default avoids a dev-mode prop-validation
  // warning for a state that's never actually visible to a user.
  currentUserId: { type: String, default: '' },
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
// Whether the current viewer is a report owner — gates the role select/
// trash/resend/revoke controls in MemberCard for every row that isn't
// their own (their own row never shows those regardless, see MemberCard).
const isOwnerViewer = computed(() =>
  rows.value.some((r) => r.user_id === props.currentUserId && r.role === 'owner'),
)
// Local status line for Resend/Revoke/Remove feedback — this modal has no
// toast/message channel today, so reuse the existing auth-error/
// auth-success class pattern (see DashboardView.vue's invite feedback).
const actionMessage = ref('')
const actionMessageKind = ref('success') // 'success' | 'error'

function setActionMessage(text, kind) {
  actionMessage.value = text
  actionMessageKind.value = kind
}

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
    actionMessage.value = ''
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

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'role', label: 'Role' },
  { value: 'recent', label: 'Recently added' },
]
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'pending', label: 'Pending' },
]

// Sort/filter as icon-button dropdowns (same .menu-wrap/.dropdown-menu/
// .dropdown-item pattern as ReportView's Export menu — a plain local ref,
// not the shared treeUi store, since this modal is self-contained).
const sortMenuOpen = ref(false)
const filterMenuOpen = ref(false)
function toggleSortMenu() {
  sortMenuOpen.value = !sortMenuOpen.value
  filterMenuOpen.value = false
}
function toggleFilterMenu() {
  filterMenuOpen.value = !filterMenuOpen.value
  sortMenuOpen.value = false
}
function pickSort(value) {
  sort.value = value
  sortMenuOpen.value = false
}
function pickFilter(value) {
  filter.value = value
  filterMenuOpen.value = false
}
function onDocumentClick(e) {
  if (!e.target.closest('.menu-wrap')) {
    sortMenuOpen.value = false
    filterMenuOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

const hasActiveFilters = computed(() => search.value.trim() !== '' || filter.value !== 'all')
function clearFilters() {
  search.value = ''
  filter.value = 'all'
}

// Card/list view toggle (Task 11) — persisted the same way as Dashboard's
// view-mode toggle, but under its own localStorage key since this is a
// different list.
const MEMBER_VIEW_MODE_KEY = 'qa-report:manage-access-view-mode'
const memberViewMode = ref(localStorage.getItem(MEMBER_VIEW_MODE_KEY) === 'list' ? 'list' : 'card')
function setMemberViewMode(mode) {
  memberViewMode.value = mode
  localStorage.setItem(MEMBER_VIEW_MODE_KEY, mode)
}

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
// Remove/resend/revoke/transfer previously had zero busy-state protection
// at all — fully clickable mid-request. One combined overlay covers the
// whole modal for all five actions (deliberately excludes roleChangeBusy,
// which stays the lightweight per-row disable it's always been — a role
// change isn't a modal-submit-shaped action).
const removeBusy = ref(false)
const resendBusy = ref(false)
const revokeBusy = ref(false)
const transferBusy = ref(false)
const actionBusy = computed(
  () => addBusy.value || removeBusy.value || resendBusy.value || revokeBusy.value || transferBusy.value,
)

function toggleAdd() {
  addOpen.value = !addOpen.value
  addError.value = ''
}

async function submitAdd() {
  addError.value = ''
  addBusy.value = true
  try {
    const { error } = await inviteMember(props.reportId, newEmail.value, newRole.value)
    if (error) {
      addError.value = error
      return
    }
    newEmail.value = ''
    addOpen.value = false
    await load()
  } finally {
    addBusy.value = false
  }
}

// ---------------------------------------------------------------------
// Per-row actions
// ---------------------------------------------------------------------
const roleChangeBusy = ref({})

const viewStep = ref('list') // 'list' | 'transfer-confirm'
const pendingTransfer = ref(null) // { memberId, name }

// The transfer-confirm step unmounts the member list (v-if="viewStep ===
// 'list'"), which unmounts whatever <select> had focus and drops it to
// <body> — silently breaking both Tab order and ESC (the overlay's
// @keydown only fires for events bubbling from inside it). A second,
// independent useModalFocus watch fixes both by moving focus back into
// modalBox whenever this step becomes active. (Declared here, after
// viewStep, rather than immediately next to the first useModalFocus call
// above, since referencing viewStep.value any earlier would hit its
// temporal dead zone — watch() evaluates its getter synchronously on
// setup.)
useModalFocus(
  () => viewStep.value === 'transfer-confirm',
  modalBox,
)

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
  transferBusy.value = true
  try {
    const { error } = await transferOwnership(props.reportId, memberId)
    viewStep.value = 'list'
    pendingTransfer.value = null
    if (error) {
      loadError.value = error
      return
    }
    await load()
    emit('membership-changed')
  } finally {
    transferBusy.value = false
  }
}

function cancelTransfer() {
  viewStep.value = 'list'
  pendingTransfer.value = null
}

async function onRemove(memberId) {
  removeBusy.value = true
  try {
    const { error } = await removeMember(memberId)
    if (error) {
      setActionMessage(error, 'error')
      return
    }
    // removeMember() only returns { data: true } on success — no message
    // from the server to surface, so use a fixed confirmation line.
    setActionMessage('Member removed.', 'success')
    await load()
  } finally {
    removeBusy.value = false
  }
}

async function onResend(inviteId) {
  resendBusy.value = true
  try {
    const { data, error } = await resendInvite(props.reportId, inviteId)
    if (error) {
      setActionMessage(error, 'error')
      return
    }
    // Covers the 'resent' case and the 'noop' case (spec: "Already up to
    // date") the same way — both carry a human-readable data.message and
    // neither is a failure, so both use the success styling.
    setActionMessage(data?.message || 'Invite resent.', 'success')
    await load()
  } finally {
    resendBusy.value = false
  }
}

async function onRevoke(inviteId) {
  revokeBusy.value = true
  try {
    const { data, error } = await revokeInvite(props.reportId, inviteId)
    if (error) {
      setActionMessage(error, 'error')
      return
    }
    setActionMessage(data?.message || 'Invite revoked.', 'success')
    await load()
  } finally {
    revokeBusy.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" :class="{ open }" :inert="!open" @click.self="close" @keydown="onModalKeydown">
    <div ref="modalBox" class="modal-box modal-box--members" role="dialog" aria-modal="true">
      <!-- Sibling of both viewStep templates below, never a descendant of
           an :inert element — see the inert/BusyOverlay note near <main>
           in ReportView.vue for why that ordering matters for the
           role="status" label to actually get announced. -->
      <BusyOverlay :active="actionBusy" label="Working…" />
      <template v-if="viewStep === 'list'">
        <div class="manage-access-header" :inert="actionBusy">
          <h2>Manage access</h2>
          <button type="button" class="btn primary" @click="toggleAdd">
            <Icon name="plus" cls="icon-sm" />
            <span>Add</span>
          </button>
        </div>

        <div v-if="addOpen" class="manage-access-add-panel" :inert="actionBusy">
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

        <div class="manage-access-toolbar" :inert="actionBusy">
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
          <div class="menu-wrap">
            <button
              type="button"
              class="icon-btn"
              aria-haspopup="true"
              :aria-expanded="sortMenuOpen"
              title="Sort"
              @click.stop="toggleSortMenu"
            >
              <Icon name="arrowUpDown" cls="icon-sm" />
            </button>
            <div class="dropdown-menu" :class="{ open: sortMenuOpen }" :inert="!sortMenuOpen">
              <button
                v-for="s in SORTS"
                :key="s.value"
                type="button"
                class="dropdown-item"
                :class="{ active: sort === s.value }"
                @click.stop="pickSort(s.value)"
              >
                <span>{{ s.label }}</span>
                <Icon v-if="sort === s.value" name="check" cls="icon-sm dropdown-item-check" />
              </button>
            </div>
          </div>
          <div class="menu-wrap">
            <button
              type="button"
              class="icon-btn"
              :class="{ 'active-state': filter !== 'all' }"
              aria-haspopup="true"
              :aria-expanded="filterMenuOpen"
              title="Filter"
              @click.stop="toggleFilterMenu"
            >
              <Icon name="filter" cls="icon-sm" />
            </button>
            <div class="dropdown-menu" :class="{ open: filterMenuOpen }" :inert="!filterMenuOpen">
              <button
                v-for="f in FILTERS"
                :key="f.value"
                type="button"
                class="dropdown-item"
                :class="{ active: filter === f.value }"
                @click.stop="pickFilter(f.value)"
              >
                <span>{{ f.label }}</span>
                <Icon v-if="filter === f.value" name="check" cls="icon-sm dropdown-item-check" />
              </button>
            </div>
          </div>
          <div class="menu-wrap">
            <button
              type="button"
              class="icon-btn"
              :class="{ 'active-state': memberViewMode === 'list' }"
              :aria-pressed="memberViewMode === 'list'"
              title="Toggle list view"
              @click.stop="setMemberViewMode(memberViewMode === 'card' ? 'list' : 'card')"
            >
              <Icon :name="memberViewMode === 'list' ? 'grid' : 'list'" cls="icon-sm" />
            </button>
          </div>
          <button v-if="hasActiveFilters" type="button" class="btn manage-access-clear" @click="clearFilters">
            Clear
          </button>
        </div>

        <p v-if="loadError" class="auth-error">{{ loadError }}</p>
        <div
          v-if="actionMessage"
          :class="actionMessageKind === 'error' ? 'auth-error' : 'auth-success'"
          style="display: flex; align-items: center; justify-content: space-between; gap: 8px"
        >
          <span>{{ actionMessage }}</span>
          <button type="button" class="icon-btn" aria-label="Dismiss message" @click="actionMessage = ''">
            <Icon name="x" cls="icon-sm" />
          </button>
        </div>

        <div class="manage-access-list" :inert="actionBusy">
          <BusyOverlay :active="loading" label="Loading members…" />
          <template v-if="!loading">
            <div v-if="visibleRows.length === 0" class="empty-state empty-state--filter">
              <div class="empty-icon" aria-hidden="true"><Icon name="users" cls="icon-lg" /></div>
              <h2 class="empty-title">No members match</h2>
              <p class="empty-hint">Try a different search or filter.</p>
              <div v-if="hasActiveFilters" class="empty-actions">
                <button class="btn primary" type="button" @click="clearFilters">Clear search &amp; filter</button>
              </div>
            </div>
            <MemberCard
              v-for="row in visibleRows"
              :key="`${row.kind}-${row.id}`"
              :row="row"
              :is-self="row.user_id === currentUserId"
              :can-manage="isOwnerViewer"
              :role-change-busy="!!roleChangeBusy[row.id]"
              :compact="memberViewMode === 'list'"
              @role-change="onRoleChange"
              @remove="onRemove"
              @resend="onResend"
              @revoke="onRevoke"
            />
          </template>
        </div>

        <div class="modal-actions" :inert="actionBusy">
          <button type="button" class="btn" @click="close">Close</button>
        </div>
      </template>

      <template v-else>
        <div :inert="transferBusy">
          <h2>Transfer ownership?</h2>
          <p>
            {{ pendingTransfer?.name }} becomes the owner. You'll be moved to Editor. This can't be undone from
            here — the new owner would need to transfer it back.
          </p>
          <div class="modal-actions">
            <button type="button" class="btn" @click="cancelTransfer">Cancel</button>
            <button type="button" class="btn danger" @click="confirmTransfer">Transfer ownership</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
