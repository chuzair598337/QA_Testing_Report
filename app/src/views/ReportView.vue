<script setup>
// Real single-report view (Phase 4): modules/sub-modules/tests tree with
// status + note editing (role-gated), stats/progress, and the owner-only
// Manage Access panel (member list, role changes, invites, removal).
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/useAuth'
import { useReports } from '../stores/useReports'
import Icon from '../components/icons/Icon.vue'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const {
  fetchReportDetail,
  getMyRole,
  archiveReport,
  inviteMember,
  updateMemberRole,
  removeMember,
  updateTestStatus,
  updateTestNote,
} = useReports()

const reportId = route.params.id

const loading = ref(true)
const loadError = ref('')
const report = ref(null)
const members = ref([])
const modules = ref([])
const subModules = ref([])
const tests = ref([])
const stats = ref(null)

const myRole = computed(() => (report.value ? getMyRole({ report_members: members.value }, user.value?.id) : null))
const canEditTests = computed(() => myRole.value === 'owner' || myRole.value === 'editor')
const isOwner = computed(() => myRole.value === 'owner')

async function load() {
  loading.value = true
  loadError.value = ''
  const { data, error } = await fetchReportDetail(reportId)
  loading.value = false
  if (error) {
    loadError.value = error.message || 'Could not load this report.'
    return
  }
  report.value = data.report
  members.value = data.members
  modules.value = data.modules
  subModules.value = data.subModules
  tests.value = data.tests
  stats.value = data.stats
}

onMounted(load)

const statsView = computed(
  () =>
    stats.value || {
      total_tests: 0,
      pass_count: 0,
      fail_count: 0,
      pending_count: 0,
      pass_percent: 0,
    },
)

// ---------------------------------------------------------------------
// Tree grouping + per-module/sub-module pass/fail counts for mini-bars.
// ---------------------------------------------------------------------
const sortedModules = computed(() => [...modules.value].sort((a, b) => a.order_index - b.order_index))

const subModulesByModule = computed(() => {
  const map = {}
  for (const sm of subModules.value) {
    ;(map[sm.module_id] ||= []).push(sm)
  }
  for (const arr of Object.values(map)) arr.sort((a, b) => a.order_index - b.order_index)
  return map
})

const testsBySubModule = computed(() => {
  const map = {}
  for (const t of tests.value) {
    ;(map[t.sub_module_id] ||= []).push(t)
  }
  for (const arr of Object.values(map)) arr.sort((a, b) => a.order_index - b.order_index)
  return map
})

function subModuleStats(subModuleId) {
  const ts = testsBySubModule.value[subModuleId] || []
  const pass = ts.filter((t) => t.status === 'pass').length
  const fail = ts.filter((t) => t.status === 'fail').length
  return { total: ts.length, pass, fail }
}

function moduleStats(moduleId) {
  const subs = subModulesByModule.value[moduleId] || []
  let total = 0
  let pass = 0
  let fail = 0
  for (const sm of subs) {
    const s = subModuleStats(sm.id)
    total += s.total
    pass += s.pass
    fail += s.fail
  }
  return { total, pass, fail }
}

function pct(count, total) {
  return total > 0 ? (count / total) * 100 : 0
}

// ---------------------------------------------------------------------
// Test status + note editing.
// ---------------------------------------------------------------------
const statusBusy = reactive({})
async function handleStatusChange(test, newStatus) {
  const prev = test.status
  test.status = newStatus
  statusBusy[test.id] = true
  const { error } = await updateTestStatus(test.id, newStatus)
  statusBusy[test.id] = false
  if (error) {
    test.status = prev
    showToast(error.message || 'Could not update status.')
  }
}

const openNotes = reactive({})
const noteDrafts = reactive({})
function toggleNote(test) {
  openNotes[test.id] = !openNotes[test.id]
  if (openNotes[test.id] && noteDrafts[test.id] === undefined) {
    noteDrafts[test.id] = test.note || ''
  }
}
async function saveNote(test) {
  const { error } = await updateTestNote(test.id, noteDrafts[test.id])
  if (error) {
    showToast(error.message || 'Could not save note.')
    return
  }
  test.note = noteDrafts[test.id] || null
  openNotes[test.id] = false
  showToast('Note saved.')
}
function cancelNote(test) {
  noteDrafts[test.id] = test.note || ''
  openNotes[test.id] = false
}

// ---------------------------------------------------------------------
// Toast
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
// Delete (archive) report.
// ---------------------------------------------------------------------
async function handleDeleteReport() {
  const { error } = await archiveReport(reportId)
  if (error) {
    showToast(error.message || 'Could not delete report.')
    return
  }
  router.push('/dashboard')
}

// ---------------------------------------------------------------------
// Manage Access panel (owner-only).
// ---------------------------------------------------------------------
const manageOpen = ref(false)
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
  const { data, error } = await inviteMember(reportId, inviteValue.value, inviteRole.value)
  inviteBusy.value = false
  if (error) {
    inviteError.value = error
    return
  }
  // The Edge Function returns a status/message, not the member row itself
  // (an 'invited' result has no row yet — it's pending the invitee's
  // signup) — refetch instead of guessing what to push into the list.
  if (data?.status === 'added') {
    await load()
  }
  inviteSuccess.value = data?.message || 'Invite sent.'
  inviteValue.value = ''
}

const roleChangeBusy = reactive({})
async function handleRoleChange(member, newRole) {
  const prev = member.role
  member.role = newRole
  const ownerCount = members.value.filter((m) => m.role === 'owner').length
  if (prev === 'owner' && newRole !== 'owner' && ownerCount <= 1) {
    member.role = prev
    showToast("Can't demote the only owner — promote someone else first.")
    return
  }

  roleChangeBusy[member.id] = true
  const { error } = await updateMemberRole(member.id, newRole)
  roleChangeBusy[member.id] = false
  if (error) {
    member.role = prev
    showToast(error.message || 'Could not update role.')
  }
}

async function handleRemoveMember(member) {
  const ownerCount = members.value.filter((m) => m.role === 'owner').length
  if (member.role === 'owner' && ownerCount <= 1) {
    showToast("Can't remove the only owner — promote someone else first.")
    return
  }

  const { error } = await removeMember(member.id)
  if (error) {
    showToast(error.message || 'Could not remove member.')
    return
  }
  members.value = members.value.filter((m) => m.id !== member.id)
}
</script>

<template>
  <div class="head-chrome">
    <div class="head-inner">
      <div class="head-top">
        <div class="head-title-block">
          <RouterLink to="/dashboard" class="report-detail-back">
            <Icon name="arrowLeft" cls="icon-sm" />
            Dashboard
          </RouterLink>
          <div class="report-detail-head">
            <div>
              <div class="eyebrow">QA Testing Report</div>
              <h1>{{ report?.title || 'Report' }}</h1>
            </div>
            <span v-if="myRole" class="role-badge" :class="myRole">{{ myRole }}</span>
          </div>
        </div>
        <div class="head-actions">
          <button v-if="isOwner" class="btn" type="button" @click="manageOpen = true">
            <Icon name="users" cls="icon-sm" />
            <span class="btn-label">Manage access</span>
          </button>
          <button v-if="isOwner" class="btn danger" type="button" @click="handleDeleteReport">
            <Icon name="trash2" cls="icon-sm" />
            <span class="btn-label">Delete</span>
          </button>
        </div>
      </div>

      <div v-if="report && statsView.total_tests > 0" class="stat-grid">
        <div class="stat-tile total">
          <div class="stat-label">Total</div>
          <div class="stat-value">{{ statsView.total_tests }}</div>
        </div>
        <div class="stat-tile passed">
          <div class="stat-label">Pass</div>
          <div class="stat-value">{{ statsView.pass_count }}</div>
        </div>
        <div class="stat-tile failed">
          <div class="stat-label">Fail</div>
          <div class="stat-value">{{ statsView.fail_count }}</div>
        </div>
        <div class="stat-tile percent">
          <div class="stat-label">Pass %</div>
          <div class="stat-value">{{ statsView.pass_percent }}%</div>
        </div>
      </div>
      <div v-if="report && statsView.total_tests > 0" class="progress-track" data-contrast="on-fill">
        <div class="progress-fill" :style="{ width: statsView.pass_percent + '%' }"></div>
        <div class="progress-label">{{ statsView.pass_percent }}% passed</div>
      </div>
    </div>
  </div>

  <main>
    <div v-if="loading" class="empty-state">
      <p class="empty-hint">Loading report…</p>
    </div>

    <div v-else-if="loadError" class="empty-state">
      <p class="auth-error">{{ loadError }}</p>
      <div class="empty-actions">
        <button class="btn" type="button" @click="load">Try again</button>
        <RouterLink class="btn" to="/dashboard">Back to dashboard</RouterLink>
      </div>
    </div>

    <div v-else-if="sortedModules.length === 0" class="empty-state">
      <h2 class="empty-title">No modules in this report</h2>
      <p class="empty-hint">This report's imported JSON had no modules.</p>
    </div>

    <template v-else>
      <div v-for="(mod, mIdx) in sortedModules" :key="mod.id" class="module">
        <div class="module-head">
          <div class="module-head-left">
            <span class="module-num">{{ mIdx + 1 }}</span>
            <span class="module-title">{{ mod.name }}</span>
          </div>
          <div class="module-head-progress">
            <span class="module-count">
              {{ moduleStats(mod.id).pass }}/{{ moduleStats(mod.id).total }} pass
            </span>
            <div class="mini-bar">
              <div
                class="progress-seg pass"
                :style="{ width: pct(moduleStats(mod.id).pass, moduleStats(mod.id).total) + '%' }"
              ></div>
              <div
                class="progress-seg fail"
                :style="{ width: pct(moduleStats(mod.id).fail, moduleStats(mod.id).total) + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <div class="module-body">
          <div
            v-for="sm in subModulesByModule[mod.id] || []"
            :key="sm.id"
            class="submodule"
          >
            <div class="submodule-title">
              <div class="submodule-head-left">
                <span class="sub-title-text">{{ sm.name }}</span>
              </div>
              <div class="submodule-head-progress">
                <span class="sub-count">
                  {{ subModuleStats(sm.id).pass }}/{{ subModuleStats(sm.id).total }}
                </span>
                <div class="mini-bar">
                  <div
                    class="progress-seg pass"
                    :style="{ width: pct(subModuleStats(sm.id).pass, subModuleStats(sm.id).total) + '%' }"
                  ></div>
                  <div
                    class="progress-seg fail"
                    :style="{ width: pct(subModuleStats(sm.id).fail, subModuleStats(sm.id).total) + '%' }"
                  ></div>
                </div>
              </div>
            </div>

            <div class="submodule-body">
              <div
                v-for="test in testsBySubModule[sm.id] || []"
                :key="test.id"
                class="test-row"
                :data-status="test.status"
              >
                <div class="test-main">
                  <span class="status-dot" :class="test.status"></span>
                  <span class="test-text">{{ test.name }}</span>
                  <div class="test-controls">
                    <div class="status-select-wrap" :data-val="test.status">
                      <select
                        class="status-select"
                        :data-val="test.status"
                        :disabled="!canEditTests || statusBusy[test.id]"
                        :value="test.status"
                        @change="handleStatusChange(test, $event.target.value)"
                      >
                        <option value="pending">Pending</option>
                        <option value="pass">Pass</option>
                        <option value="fail">Fail</option>
                      </select>
                    </div>
                    <button
                      class="note-toggle"
                      :class="{ 'has-note': test.note }"
                      type="button"
                      @click="toggleNote(test)"
                    >
                      <Icon name="notePlus" cls="icon-sm" />
                      {{ test.note ? 'Note' : 'Add note' }}
                    </button>
                  </div>
                </div>
                <div class="note-box" :class="{ open: openNotes[test.id] }">
                  <textarea
                    v-model="noteDrafts[test.id]"
                    :disabled="!canEditTests"
                    placeholder="Add context, repro steps, or a reason for this status…"
                  ></textarea>
                  <div class="modal-actions" style="margin-top: 8px">
                    <button class="btn" type="button" @click="cancelNote(test)">Cancel</button>
                    <button
                      v-if="canEditTests"
                      class="btn primary"
                      type="button"
                      @click="saveNote(test)"
                    >
                      Save note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </main>

  <!-- Manage Access modal (owner-only) -->
  <div class="modal-overlay" :class="{ open: manageOpen }">
    <div class="modal-box modal-box--form">
      <h2>Manage access</h2>

      <div>
        <div v-for="member in members" :key="member.id" class="member-row">
          <div class="member-row-id">
            <span class="mono-id" :title="member.user_id">
              {{ member.user_id }}{{ member.user_id === user?.id ? ' (you)' : '' }}
            </span>
          </div>
          <div class="member-row-actions">
            <select
              class="role-select"
              :value="member.role"
              :disabled="roleChangeBusy[member.id]"
              @change="handleRoleChange(member, $event.target.value)"
            >
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              class="icon-btn"
              type="button"
              aria-label="Remove member"
              @click="handleRemoveMember(member)"
            >
              <Icon name="trash2" cls="icon-sm" />
            </button>
          </div>
        </div>
      </div>

      <div class="auth-field" style="margin-top: 16px">
        <label class="auth-label" for="report-invite-id">Invite by email</label>
        <input
          id="report-invite-id"
          v-model="inviteValue"
          type="email"
          class="auth-input"
          :disabled="inviteBusy"
          placeholder="teammate@example.com"
        />
        <p class="field-hint">
          If they already have an account they're added immediately; otherwise we send them an
          invite email to create one.
        </p>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="report-invite-role">Role</label>
        <select id="report-invite-role" v-model="inviteRole" class="auth-input" :disabled="inviteBusy">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="owner">Owner</option>
        </select>
      </div>

      <p v-if="inviteError" class="auth-error">{{ inviteError }}</p>
      <p v-if="inviteSuccess" class="auth-success">{{ inviteSuccess }}</p>

      <div class="modal-actions">
        <button class="btn" type="button" @click="manageOpen = false">Close</button>
        <button class="btn primary" type="button" :disabled="inviteBusy" @click="submitInvite">
          {{ inviteBusy ? 'Adding…' : 'Add member' }}
        </button>
      </div>
    </div>
  </div>

  <div class="toast" :class="{ show: toastVisible }">
    <span class="toast-msg">{{ toastMessage }}</span>
  </div>
</template>
