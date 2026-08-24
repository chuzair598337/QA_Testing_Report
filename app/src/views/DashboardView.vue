<script setup>
// Real dashboard (Phase 4): the reports the current user is a member of,
// the create-report import pipeline, and quick per-report actions gated
// by role. Manage Access (member list + role edits + invites) is the
// shared, portable ManageAccessModal.vue — hosted directly here (opens in
// place, no navigation) and also on ReportView.vue.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/useAuth'
import { useReports } from '../stores/useReports'
import { useReportMembers } from '../composables/useReportMembers'
import { useTheme } from '../composables/useTheme'
import { useModalFocus } from '../composables/useModalFocus'
import Icon from '../components/icons/Icon.vue'
import ManageAccessModal from '../components/ManageAccessModal.vue'
import BusyOverlay from '../components/BusyOverlay.vue'

const router = useRouter()
const { user, signOut } = useAuth()
const { fetchMyReports, getMyRole, createReport, archiveReport, unarchiveReport } =
  useReports()
const { inviteMember } = useReportMembers()
const { theme, toggleTheme } = useTheme()

// Mobile hamburger nav (ported from setMobileNavOpen/toggleMobileNav in
// js/app.js ~line 893-904) — below the 900px breakpoint (responsive.css)
// .head-actions is display:none unless .is-open; this toggle is the
// only way to reach Theme/New report/Log out at that width.
const mobileNavOpen = ref(false)
function toggleMobileNav() {
  mobileNavOpen.value = !mobileNavOpen.value
}
function onDocumentClick(e) {
  if (!e.target.closest('.head-actions') && !e.target.closest('.nav-toggle')) {
    mobileNavOpen.value = false
  }
}
function onDocumentKeydown(e) {
  if (e.key === 'Escape') mobileNavOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})

const loading = ref(true)
const loadError = ref('')
const reports = ref([])
const showArchived = ref(false)

const activeReports = computed(() => reports.value.filter((r) => !r.archived_at))
const archivedReports = computed(() => reports.value.filter((r) => r.archived_at))

async function loadReports() {
  loading.value = true
  loadError.value = ''
  const { data, error } = await fetchMyReports()
  loading.value = false
  if (error) {
    loadError.value = error.message || 'Could not load your reports.'
    return
  }
  reports.value = data
}

onMounted(loadReports)

function myRole(report) {
  return getMyRole(report, user.value?.id)
}

function statsOf(report) {
  return (
    report.stats || {
      total_tests: 0,
      pass_count: 0,
      fail_count: 0,
      pending_count: 0,
      pass_percent: 0,
    }
  )
}

async function handleSignOut() {
  await signOut()
  router.push('/login')
}

function openReport(id) {
  router.push(`/reports/${id}`)
}

// ---------------------------------------------------------------------
// Manage Access modal — hosted here directly (not a navigate-then-open
// flow): ManageAccessModal.vue is fully self-contained and only needs a
// report id + the current user's id, so there's no reason to leave the
// Dashboard just to see the member list.
// ---------------------------------------------------------------------
const manageAccessOpen = ref(false)
// '' not null — ManageAccessModal's reportId prop is a required String;
// this is the closed-state placeholder before any card's button is clicked.
const manageAccessReportId = ref('')
function openManageAccess(reportId) {
  manageAccessReportId.value = reportId
  manageAccessOpen.value = true
}

// ---------------------------------------------------------------------
// Toast (inline, no alert())
// ---------------------------------------------------------------------
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer = null
function showToast(message) {
  toastMessage.value = message
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 3200)
}

// ---------------------------------------------------------------------
// Create-report modal: title -> JSON file -> (create pipeline) -> optional
// invite-teammates sub-step.
// ---------------------------------------------------------------------
const createOpen = ref(false)
const createStep = ref('form') // 'form' | 'invite'
const newTitle = ref('')
const newFile = ref(null)
const createBusy = ref(false)
const createError = ref('')
const createdReportId = ref(null)
const createdReportTitle = ref('')

function openCreateModal() {
  createOpen.value = true
  createStep.value = 'form'
  newTitle.value = ''
  newFile.value = null
  createError.value = ''
  createdReportId.value = null
}

function closeCreateModal() {
  createOpen.value = false
}

// Escape-to-close + focus management (WCAG escape-routes / modal-escape —
// AA audit: this modal previously had no ESC handler, no backdrop-click
// dismiss, and left focus on the trigger button instead of moving into
// the dialog). Backdrop click is bound directly on the template via
// @click.self on .modal-overlay.
const createModalBox = ref(null)
useModalFocus(createOpen, createModalBox)
function onCreateModalKeydown(e) {
  if (e.key === 'Escape') closeCreateModal()
}

function handleFileChange(event) {
  newFile.value = event.target.files?.[0] || null
}

async function submitCreate() {
  createError.value = ''
  if (!newTitle.value.trim()) {
    createError.value = 'Give this report a title.'
    return
  }
  if (!newFile.value) {
    createError.value = 'Choose a JSON file to import.'
    return
  }

  createBusy.value = true
  const { data, error } = await createReport(newTitle.value.trim(), newFile.value, user.value.id)
  createBusy.value = false

  if (error) {
    createError.value = error
    return
  }

  createdReportId.value = data.id
  createdReportTitle.value = data.title
  createStep.value = 'invite'
  await loadReports()
}

function finishCreate() {
  closeCreateModal()
  showToast('Report created.')
}

// Invite sub-step, right after a successful create.
const inviteValue = ref('')
const inviteRole = ref('viewer')
const inviteBusy = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

async function submitInvite() {
  inviteError.value = ''
  inviteSuccess.value = ''
  if (!inviteValue.value.trim()) {
    inviteError.value = 'Enter an email address.'
    return
  }
  inviteBusy.value = true
  const { data, error } = await inviteMember(createdReportId.value, inviteValue.value, inviteRole.value)
  inviteBusy.value = false
  if (error) {
    inviteError.value = error
    return
  }
  inviteSuccess.value = data?.message || 'Member added.'
  inviteValue.value = ''
}

// ---------------------------------------------------------------------
// Archive ("Delete") / restore — soft delete only, see useReports.js.
// ---------------------------------------------------------------------
async function handleArchive(report) {
  const { error } = await archiveReport(report.id)
  if (error) {
    showToast(error.message || 'Could not delete report.')
    return
  }
  await loadReports()
  showToast('Report deleted.')
}

async function handleUnarchive(report) {
  const { error } = await unarchiveReport(report.id)
  if (error) {
    showToast(error.message || 'Could not restore report.')
    return
  }
  await loadReports()
  showToast('Report restored.')
}
</script>

<template>
  <div class="head-chrome" :class="{ 'nav-open': mobileNavOpen }">
    <div class="head-inner">
      <div class="head-top">
        <div class="head-title-block">
          <div class="eyebrow">QA Testing Report</div>
          <h1>Dashboard</h1>
        </div>
        <button
          type="button"
          class="nav-toggle"
          id="nav-toggle"
          :aria-label="mobileNavOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="mobileNavOpen"
          aria-controls="head-actions"
          @click.stop="toggleMobileNav"
        >
          <Icon :name="mobileNavOpen ? 'x' : 'menu'" cls="icon-md nav-toggle-icon" />
        </button>
        <div id="head-actions" class="head-actions" :class="{ 'is-open': mobileNavOpen }">
          <button class="btn" type="button" @click="toggleTheme">
            <Icon :name="theme === 'dark' ? 'sun' : 'moon'" />
            <span class="btn-label">{{ theme === 'dark' ? 'Light' : 'Dark' }}</span>
          </button>
          <button class="btn primary" type="button" @click="openCreateModal">
            <Icon name="plus" />
            <span class="btn-label">New report</span>
          </button>
          <button class="btn" type="button" @click="handleSignOut">
            <Icon name="logOut" />
            <span class="btn-label">Log out</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <main>
    <div v-if="loading" class="loading-frame">
      <BusyOverlay :active="loading" label="Loading your reports…" />
    </div>

    <div v-else-if="loadError" class="empty-state">
      <p class="auth-error">{{ loadError }}</p>
      <div class="empty-actions">
        <button class="btn" type="button" @click="loadReports">Try again</button>
      </div>
    </div>

    <div v-else-if="activeReports.length === 0" class="empty-state empty-state--empty-suite">
      <div class="empty-icon">
        <Icon name="fileJson" cls="icon-lg" />
      </div>
      <h2 class="empty-title">No reports yet</h2>
      <p class="empty-hint">
        Create your first report by importing a QA test-suite JSON file (see
        <code>sample.json</code> in the repo for the expected shape).
      </p>
      <div class="empty-actions">
        <button class="btn primary" type="button" @click="openCreateModal">
          <Icon name="plus" />
          <span class="btn-label">New report</span>
        </button>
      </div>
    </div>

    <div v-else class="report-grid">
      <div v-for="report in activeReports" :key="report.id" class="report-card">
        <div class="report-card-head">
          <div>
            <h2 class="report-card-title">{{ report.title }}</h2>
            <p class="report-card-meta">{{ new Date(report.created_at).toLocaleDateString() }}</p>
          </div>
          <span class="role-badge" :class="myRole(report)">{{ myRole(report) }}</span>
        </div>

        <div v-if="statsOf(report).total_tests === 0" class="report-card-empty">
          No tests in this report yet.
        </div>
        <template v-else>
          <div class="stat-grid report-card-stats">
            <div class="stat-tile total">
              <div class="stat-label">Total</div>
              <div class="stat-value">{{ statsOf(report).total_tests }}</div>
            </div>
            <div class="stat-tile passed">
              <div class="stat-label">Pass</div>
              <div class="stat-value">{{ statsOf(report).pass_count }}</div>
            </div>
            <div class="stat-tile failed">
              <div class="stat-label">Fail</div>
              <div class="stat-value">{{ statsOf(report).fail_count }}</div>
            </div>
            <div class="stat-tile percent">
              <div class="stat-label">Pass %</div>
              <div class="stat-value">{{ statsOf(report).pass_percent }}%</div>
            </div>
          </div>
          <div
            class="progress-track mini"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="statsOf(report).pass_percent"
            :aria-label="`${report.title} testing progress`"
            :style="{ '--pct': statsOf(report).pass_percent + '%' }"
          >
            <div
              class="progress-fill"
              :style="{ width: statsOf(report).pass_percent + '%' }"
            ></div>
            <div class="progress-label progress-label--on-fill" aria-hidden="true">{{ statsOf(report).pass_percent }}% passed</div>
            <div class="progress-label progress-label--on-track">{{ statsOf(report).pass_percent }}% passed</div>
          </div>
        </template>

        <div class="report-card-actions">
          <button class="btn" type="button" @click="openReport(report.id)">Open</button>
          <button
            v-if="myRole(report) === 'owner'"
            class="btn"
            type="button"
            @click="openManageAccess(report.id)"
          >
            <Icon name="users" cls="icon-sm" />
            <span class="btn-label">Manage access</span>
          </button>
          <button
            v-if="myRole(report) === 'owner'"
            class="btn danger"
            type="button"
            @click="handleArchive(report)"
          >
            <Icon name="trash2" cls="icon-sm" />
            <span class="btn-label">Delete</span>
          </button>
        </div>
      </div>
    </div>

    <template v-if="archivedReports.length > 0">
      <button class="section-toggle" type="button" @click="showArchived = !showArchived">
        {{ showArchived ? 'Hide' : 'Show' }} deleted reports ({{ archivedReports.length }})
      </button>
      <div v-if="showArchived" class="report-grid">
        <div v-for="report in archivedReports" :key="report.id" class="report-card">
          <div class="report-card-head">
            <div>
              <h2 class="report-card-title">{{ report.title }}</h2>
              <p class="report-card-meta">Deleted {{ new Date(report.archived_at).toLocaleDateString() }}</p>
            </div>
            <span class="archived-badge">Deleted</span>
          </div>
          <div class="report-card-actions">
            <button
              v-if="myRole(report) === 'owner'"
              class="btn"
              type="button"
              @click="handleUnarchive(report)"
            >
              <Icon name="rotateCcw" cls="icon-sm" />
              <span class="btn-label">Restore</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </main>

  <!-- Create-report modal -->
  <div
    class="modal-overlay"
    :class="{ open: createOpen }"
    :inert="!createOpen"
    @click.self="closeCreateModal"
    @keydown="onCreateModalKeydown"
  >
    <div ref="createModalBox" class="modal-box modal-box--form" role="dialog" aria-modal="true">
      <BusyOverlay
        :active="createBusy || inviteBusy"
        :label="createStep === 'form' ? 'Creating report…' : 'Adding member…'"
      />
      <template v-if="createStep === 'form'">
        <div :inert="createBusy">
          <h2>New report</h2>
          <p v-if="createError" class="auth-error">{{ createError }}</p>

          <div class="auth-field">
            <label class="auth-label" for="new-report-title">Title</label>
            <input
              id="new-report-title"
              v-model="newTitle"
              type="text"
              class="auth-input"
              placeholder="e.g. Onboarding — Q3 regression"
            />
          </div>

          <div class="auth-field">
            <label class="auth-label" for="new-report-file">Test-suite JSON file</label>
            <input
              id="new-report-file"
              type="file"
              accept=".json,application/json"
              class="auth-input"
              @change="handleFileChange"
            />
            <p class="field-hint">
              Must match the legacy export shape — see <code>sample.json</code> in the repo root.
            </p>
          </div>

          <div class="modal-actions">
            <button class="btn" type="button" @click="closeCreateModal">
              Cancel
            </button>
            <button class="btn primary" type="button" @click="submitCreate">
              {{ createBusy ? 'Creating…' : 'Create report' }}
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div :inert="inviteBusy">
          <h2>{{ createdReportTitle }} created</h2>
          <p class="empty-hint" style="margin: 0 0 14px; text-align: left">
            Invite a teammate now, or do it later from the report's Manage Access panel.
          </p>

          <p v-if="inviteError" class="auth-error">{{ inviteError }}</p>
          <p v-if="inviteSuccess" class="auth-success">{{ inviteSuccess }}</p>

          <div class="auth-field">
            <label class="auth-label" for="invite-id">Teammate's email</label>
            <input
              id="invite-id"
              v-model="inviteValue"
              type="email"
              class="auth-input"
              placeholder="teammate@example.com"
            />
            <p class="field-hint">
              If they already have an account they're added immediately; otherwise we send them an
              invite email to create one.
            </p>
          </div>

          <div class="auth-field">
            <label class="auth-label" for="invite-role">Role</label>
            <select id="invite-role" v-model="inviteRole" class="auth-input">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>

          <div class="modal-actions">
            <button class="btn" type="button" @click="finishCreate">Done</button>
            <button class="btn primary" type="button" @click="submitInvite">
              {{ inviteBusy ? 'Adding…' : 'Add member' }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <ManageAccessModal
    :open="manageAccessOpen"
    :report-id="manageAccessReportId"
    :current-user-id="user?.id"
    @close="manageAccessOpen = false"
    @membership-changed="loadReports"
  />

  <div class="toast" :class="{ show: toastVisible }">
    <span class="toast-msg">{{ toastMessage }}</span>
  </div>
</template>
