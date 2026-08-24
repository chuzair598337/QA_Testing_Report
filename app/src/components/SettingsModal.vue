<script setup>
// Settings modal — Profile/Theme/Logout (Task 5) + Bin recover/permanent
// delete (Task 6) of the 2026-08-24 design spec. Not wired into any view
// yet — Task 7 does that.
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../stores/useAuth'
import { useTheme } from '../composables/useTheme'
import { useModalFocus } from '../composables/useModalFocus'
import { useReports } from '../stores/useReports'
import Icon from './icons/Icon.vue'
import BusyOverlay from './BusyOverlay.vue'

const props = defineProps({
  open: { type: Boolean, required: true },
})
const emit = defineEmits(['close', 'reports-changed'])

const router = useRouter()
const { user, signOut } = useAuth()
const { theme, setTheme } = useTheme()
const { fetchMyReports, unarchiveReport, deleteReportPermanently } = useReports()

const modalBox = ref(null)
useModalFocus(
  () => props.open,
  modalBox,
)

const activeSection = ref('profile') // 'profile' | 'bin' | 'theme'

// ---------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------
const profile = ref(null)
const profileLoading = ref(false)

async function loadProfile() {
  if (!user.value) return
  profileLoading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name,email,avatar_url')
    .eq('id', user.value.id)
    .single()
  profileLoading.value = false
  if (error) return
  profile.value = data
}

const displayName = computed(
  () => profile.value?.full_name || profile.value?.email || user.value?.email || '',
)
// Ported verbatim from MemberCard.vue's initials computed (L22-30).
const initials = computed(() => {
  const source = profile.value?.full_name || profile.value?.email || user.value?.email || '?'
  return source
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
})

// ---------------------------------------------------------------------
// Bin — list archived reports, recover, or permanently delete.
// ---------------------------------------------------------------------
const archivedReports = ref([])
const binLoading = ref(false)
const binError = ref('')
const recoverBusy = ref({}) // keyed by report id
const deleteBusy = ref({}) // keyed by report id
const pendingHardDelete = ref(null) // { id, title } | null
const binViewStep = ref('list') // 'list' | 'confirm-delete'

// The confirm-delete step unmounts the bin list (v-if="binViewStep ===
// 'list'"), same reasoning as ManageAccessModal.vue's transfer-confirm
// step (L227-236): a second, independent useModalFocus watch keeps focus
// inside modalBox — and ESC working — while this sub-state is active.
useModalFocus(
  () => binViewStep.value === 'confirm-delete',
  modalBox,
)

async function loadBin() {
  binLoading.value = true
  const { data, error } = await fetchMyReports()
  binLoading.value = false
  if (error) {
    binError.value = error.message || 'Could not load the bin.'
    return
  }
  archivedReports.value = data.filter((r) => r.archived_at)
}

async function onRecover(report) {
  recoverBusy.value = { ...recoverBusy.value, [report.id]: true }
  const { error } = await unarchiveReport(report.id)
  recoverBusy.value = { ...recoverBusy.value, [report.id]: false }
  if (error) {
    binError.value = error.message || 'Could not restore report.'
    return
  }
  await loadBin()
  emit('reports-changed')
}

function requestHardDelete(report) {
  pendingHardDelete.value = { id: report.id, title: report.title }
  binViewStep.value = 'confirm-delete'
}

function cancelHardDelete() {
  pendingHardDelete.value = null
  binViewStep.value = 'list'
}

async function confirmHardDelete() {
  const { id } = pendingHardDelete.value
  deleteBusy.value = { ...deleteBusy.value, [id]: true }
  const { error } = await deleteReportPermanently(id)
  deleteBusy.value = { ...deleteBusy.value, [id]: false }
  binViewStep.value = 'list'
  pendingHardDelete.value = null
  if (error) {
    binError.value = error.message || 'Could not permanently delete report.'
    return
  }
  await loadBin()
  emit('reports-changed')
}

const anyBusy = computed(
  () =>
    profileLoading.value ||
    binLoading.value ||
    Object.values(recoverBusy.value).some(Boolean) ||
    Object.values(deleteBusy.value).some(Boolean),
)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    activeSection.value = 'profile'
    binViewStep.value = 'list'
    pendingHardDelete.value = null
    binError.value = ''
    loadProfile()
    loadBin()
  },
)

function close() {
  emit('close')
}
function onModalKeydown(e) {
  if (e.key === 'Escape') close()
}

// Ported verbatim from DashboardView.vue's handleSignOut (L88-91), plus
// closing this modal before navigating away.
async function handleLogout() {
  await signOut()
  emit('close')
  router.push('/login')
}
</script>

<template>
  <div class="modal-overlay" :class="{ open }" :inert="!open" @click.self="close" @keydown="onModalKeydown">
    <div ref="modalBox" class="modal-box modal-box--settings" role="dialog" aria-modal="true">
      <!-- Sibling of the flex-column modal box's direct children below,
           never a wrapper around them — see the per-child :inert note in
           ManageAccessModal.vue for why a wrapping div would break the
           flex layout here. -->
      <BusyOverlay :active="anyBusy" label="Loading…" />

      <div class="settings-header" :inert="anyBusy">
        <h2>Settings</h2>
        <button type="button" class="icon-btn" aria-label="Close" @click="close">
          <Icon name="x" cls="icon-sm" />
        </button>
      </div>

      <div class="settings-layout" :inert="anyBusy">
        <nav class="settings-nav">
          <button
            type="button"
            class="settings-nav-item"
            :class="{ active: activeSection === 'profile' }"
            @click="activeSection = 'profile'"
          >
            <Icon name="users" cls="icon-sm" />
            <span>Profile</span>
          </button>
          <button
            type="button"
            class="settings-nav-item"
            :class="{ active: activeSection === 'bin' }"
            @click="activeSection = 'bin'"
          >
            <Icon name="trash2" cls="icon-sm" />
            <span>Bin</span>
          </button>
          <button
            type="button"
            class="settings-nav-item"
            :class="{ active: activeSection === 'theme' }"
            @click="activeSection = 'theme'"
          >
            <Icon name="moon" cls="icon-sm" />
            <span>Theme</span>
          </button>
        </nav>

        <div class="settings-panel">
          <template v-if="activeSection === 'profile'">
            <div class="settings-profile">
              <div class="settings-profile-avatar" aria-hidden="true">{{ initials }}</div>
              <div>
                <div class="settings-profile-name">{{ displayName }}</div>
                <div class="settings-profile-email">{{ profile?.email || user?.email }}</div>
              </div>
            </div>
          </template>

          <template v-else-if="activeSection === 'bin'">
            <template v-if="binViewStep === 'list'">
              <p v-if="binError" class="auth-error">{{ binError }}</p>
              <p v-if="!archivedReports.length" class="settings-profile-email">Nothing in the bin.</p>
              <div v-else class="bin-list">
                <div v-for="report in archivedReports" :key="report.id" class="bin-item">
                  <div>
                    <div class="settings-profile-name">{{ report.title }}</div>
                    <div class="settings-profile-email">
                      Deleted {{ new Date(report.archived_at).toLocaleDateString() }}
                    </div>
                  </div>
                  <div class="bin-item-actions">
                    <button
                      type="button"
                      class="btn"
                      :disabled="!!recoverBusy[report.id] || !!deleteBusy[report.id]"
                      @click="onRecover(report)"
                    >
                      <Icon name="rotateCcw" cls="icon-sm" />
                      <span>Recover</span>
                    </button>
                    <button
                      type="button"
                      class="btn danger"
                      :disabled="!!recoverBusy[report.id] || !!deleteBusy[report.id]"
                      @click="requestHardDelete(report)"
                    >
                      <Icon name="trash2" cls="icon-sm" />
                      <span>Delete permanently</span>
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <h2>Permanently delete this report?</h2>
              <p>
                "{{ pendingHardDelete?.title }}" will be deleted permanently. This can't be undone.
              </p>
              <div class="modal-actions">
                <button type="button" class="btn" @click="cancelHardDelete">Cancel</button>
                <button type="button" class="btn danger" @click="confirmHardDelete">Delete permanently</button>
              </div>
            </template>
          </template>

          <template v-else-if="activeSection === 'theme'">
            <div style="display: flex; gap: 8px">
              <button type="button" class="btn" :class="{ primary: theme === 'light' }" @click="setTheme('light')">
                Light
              </button>
              <button type="button" class="btn" :class="{ primary: theme === 'dark' }" @click="setTheme('dark')">
                Dark
              </button>
            </div>
          </template>
        </div>
      </div>

      <div class="settings-footer" :inert="anyBusy">
        <button type="button" class="btn danger" @click="handleLogout">
          <Icon name="logOut" cls="icon-sm" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  </div>
</template>
