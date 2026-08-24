<script setup>
// Real single-report view (Phase 4 + Phase 5): modules/sub-modules/tests
// tree with status + note editing (role-gated), stats/progress, pin/lock,
// filters/jump-nav, export (PDF/JSON), Generate report, and the trigger
// button for the owner-only Manage Access panel — the panel's own state
// (member list, role changes, invites, removal) lives in
// ManageAccessModal.vue (Task 8/6 of the 2026-08-24 design), this file
// just renders the button and passes props/handles the open flag.
//
// Phase 4 built the data/role-gating layer (all reused unchanged here:
// fetchReportDetail/getMyRole/updateTestStatus/updateTestNote from
// useReports.js). Phase 5 adds
// the useReportRunner.js/useTreeUiState.js/useImportExport.js layers and
// splits the tree markup into ModuleCard/SubModuleCard/TestRow/StatTiles/
// ProgressBar, porting pin/lock/filter/jump-nav/scroll-collapse/export
// behavior from the legacy static app (js/app.js) — see each new file's own
// header comment for exactly which legacy function it ports.
import { ref, reactive, computed, provide, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/useAuth'
import { useReports } from '../stores/useReports'
import { useReportRunner } from '../stores/useReportRunner'
import { useTreeUiState } from '../composables/useTreeUiState'
import { useImportExport } from '../composables/useImportExport'
import { useModalFocus } from '../composables/useModalFocus'
import Icon from '../components/icons/Icon.vue'
import ModuleCard from '../components/ModuleCard.vue'
import StatTiles from '../components/StatTiles.vue'
import ProgressBar from '../components/ProgressBar.vue'
import ManageAccessModal from '../components/ManageAccessModal.vue'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const { getMyRole, archiveReport, updateTestStatus, updateTestNote } = useReports()

const reportId = route.params.id

const runner = useReportRunner()
const { loading, loadError, report, members, statsView, tree, findTest } = runner

const treeUi = useTreeUiState()

const myRole = computed(() => (report.value ? getMyRole({ report_members: members.value }, user.value?.id) : null))
const canEditTests = computed(() => myRole.value === 'owner' || myRole.value === 'editor')
const isOwner = computed(() => myRole.value === 'owner')

provide('treeUi', treeUi)
provide('canEdit', canEditTests)

async function load() {
  const { error } = await runner.load(reportId)
  // Legacy CSS (ported unchanged into base.css) gates the whole metrics
  // chrome — stat tiles, progress bar, jump-nav, filters, pinned bar,
  // all of it lives inside .head-metrics/.head-top — behind
  // `body:not(.suite-loaded)`. The legacy static app added this class to
  // <body> the moment a suite finished loading; that step was never
  // ported here, so all of that chrome was permanently invisible
  // regardless of whether the report itself loaded fine. Add it only on
  // a successful load (an access-denied/not-found report has no tree to
  // show metrics for), and clean it up on unmount so it doesn't leak
  // onto other routes sharing the same <body>.
  if (!error) {
    document.body.classList.add('suite-loaded')
  }
}

onMounted(load)
onUnmounted(() => {
  document.body.classList.remove('suite-loaded')
})

// ---------------------------------------------------------------------
// Filters (KPI-card status filter + live search) — combine to hide
// modules/sub-modules/tests with no match, matching applyFilter() in the
// legacy app (js/app.js ~line 790).
// ---------------------------------------------------------------------
const currentFilter = ref('all')
const searchQuery = ref('')
const filterActive = computed(() => currentFilter.value !== 'all' || !!searchQuery.value)
provide('filterActive', filterActive)

const FILTER_LABELS = { all: 'All', pending: 'Pending', pass: 'Passed', fail: 'Failed' }

const viewTree = computed(() => {
  const status = currentFilter.value
  const q = searchQuery.value.trim().toLowerCase()
  return tree.value.map((mod) => {
    const subModules = mod.subModules.map((sm) => {
      const tests = sm.tests.map((t) => {
        const statusMatch = status === 'all' || t.status === status
        const searchMatch = !q || t.name.toLowerCase().includes(q)
        return { ...t, visible: statusMatch && searchMatch }
      })
      const hasVisible = tests.some((t) => t.visible)
      return { ...sm, tests, hasVisible, hidden: filterActive.value && !hasVisible }
    })
    const hasVisibleSub = subModules.some((sm) => sm.hasVisible)
    return { ...mod, subModules, hasVisibleSub, hidden: filterActive.value && !hasVisibleSub }
  })
})

const anyModuleVisible = computed(() => viewTree.value.some((m) => !m.hidden))
const showFilterEmpty = computed(
  () => statsView.value.total_tests > 0 && filterActive.value && !anyModuleVisible.value,
)
const filterEmptyMessage = computed(() => {
  const statusLabel = FILTER_LABELS[currentFilter.value] || currentFilter.value
  const q = searchQuery.value.trim()
  if (q && currentFilter.value !== 'all') {
    return {
      title: `No ${statusLabel.toLowerCase()} cases match "${q}"`,
      hint: `Nothing matches both the ${statusLabel} filter and your search. Clear either one to see more cases.`,
    }
  }
  if (q) {
    return {
      title: `No cases match "${q}"`,
      hint: 'Nothing in the loaded suite matches your search. Clear it to see the full suite.',
    }
  }
  return {
    title: `No ${statusLabel.toLowerCase()} cases`,
    hint: `Nothing matches the ${statusLabel} filter right now. Clear the filter to see the full suite, or keep working — matching cases will appear here as statuses change.`,
  }
})

function handleFilterClick(filter) {
  currentFilter.value = filter
  jumpModuleValue.value = ''
  jumpSubValue.value = ''
}
function clearSearch() {
  searchQuery.value = ''
}
function clearFilterAndSearch() {
  currentFilter.value = 'all'
  clearSearch()
}

// ---------------------------------------------------------------------
// Jump navigation — dropdowns to jump straight to a module/sub-module,
// auto-expanding it and scrolling it into view. Ported from js/app.js's
// jumpTo()/jump-module/jump-submodule handlers (~line 110-190).
// ---------------------------------------------------------------------
const jumpModuleValue = ref('')
const jumpSubValue = ref('')

const jumpSubOptions = computed(() => {
  if (!jumpModuleValue.value) return []
  const mod = tree.value.find((m) => m.num === jumpModuleValue.value)
  return mod ? mod.subModules : []
})

function scrollToId(id) {
  nextTick(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}

function onJumpModuleChange() {
  jumpSubValue.value = ''
  if (!jumpModuleValue.value) return
  // Reset filter/search when jump nav is used — either could otherwise hide
  // the module being jumped to.
  clearFilterAndSearch()
  const mod = tree.value.find((m) => m.num === jumpModuleValue.value)
  if (mod) treeUi.expandModule(mod.id)
  scrollToId(`mod-${jumpModuleValue.value}`)
}

function onJumpSubChange() {
  if (!jumpSubValue.value) return
  clearFilterAndSearch()
  const mod = tree.value.find((m) => m.num === jumpModuleValue.value)
  const sm = mod && mod.subModules.find((s) => s.num === jumpSubValue.value)
  if (mod) treeUi.expandModule(mod.id)
  if (sm) treeUi.expandSub(sm.id)
  scrollToId(`sub-${jumpSubValue.value}`)
}

// ---------------------------------------------------------------------
// Pinned bar — ported from renderPinnedBar()/buildPinnedChip() (js/app.js
// ~line 352-400).
// ---------------------------------------------------------------------
const pinnedItems = computed(() => {
  const items = []
  for (const mod of tree.value) {
    if (treeUi.pinnedModules[mod.id]) {
      items.push({
        key: `mod-${mod.id}`,
        label: `${mod.num}. ${mod.name}`,
        targetId: `mod-${mod.num}`,
        unpin: () => treeUi.togglePinModule(mod.id),
      })
    }
    for (const sm of mod.subModules) {
      if (treeUi.pinnedSubModules[sm.id]) {
        items.push({
          key: `sub-${sm.id}`,
          label: `${sm.num} · ${sm.name}`,
          targetId: `sub-${sm.num}`,
          unpin: () => treeUi.togglePinSub(sm.id),
        })
      }
    }
  }
  return items
})

// ---------------------------------------------------------------------
// Test status + note editing. Status is immediate; notes are debounced
// (~500ms) autosave — replaces Phase 4's manual open-textarea -> click-Save
// flow. RLS (Phase 2) is the real enforcement boundary either way.
// ---------------------------------------------------------------------
const statusBusy = reactive({})
async function handleStatusChange(testVm, newStatus) {
  const test = findTest(testVm.id)
  if (!test) return
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

const noteDebounceTimers = {}
function handleNoteInput(testVm, value) {
  const test = findTest(testVm.id)
  if (!test) return
  clearTimeout(noteDebounceTimers[test.id])
  noteDebounceTimers[test.id] = setTimeout(async () => {
    const { error } = await updateTestNote(test.id, value)
    if (error) {
      showToast(error.message || 'Could not save note.')
      return
    }
    test.note = value || null
  }, 500)
}

// ---------------------------------------------------------------------
// Bulk mark ("Mark all Pass/Fail/Pending" from a module/sub-module's "more
// options" menu) — ported from bulkMarkTests() (js/app.js ~line 428).
// Confirms only when it would overwrite existing Pass/Fail results.
// ---------------------------------------------------------------------
const STATUS_LABELS = { pass: 'Pass', fail: 'Fail', pending: 'Pending' }
const confirmModal = reactive({ open: false, title: '', message: '', onConfirm: null })

function openConfirm(title, message, onConfirm) {
  confirmModal.title = title
  confirmModal.message = message
  confirmModal.onConfirm = onConfirm
  confirmModal.open = true
}
function closeConfirm() {
  confirmModal.open = false
  confirmModal.onConfirm = null
}
function confirmYes() {
  const cb = confirmModal.onConfirm
  closeConfirm()
  if (cb) cb()
}

// Focus management for the two modals this file still owns (confirm and
// generate-report — AA audit, see useModalFocus.js). Manage Access moved
// its own focus management into ManageAccessModal.vue (Task 8/6). ESC and
// backdrop-click are wired separately below/in the template.
const confirmModalBox = ref(null)
useModalFocus(
  () => confirmModal.open,
  confirmModalBox,
)

function handleBulkMark(testVms, targetStatus, scopeLabel) {
  const realTests = testVms.map((tv) => findTest(tv.id)).filter(Boolean)
  const overwriteCount = realTests.filter((t) => t.status !== 'pending' && t.status !== targetStatus).length

  const apply = async () => {
    for (const t of realTests) {
      if (t.status === targetStatus) continue
      const prev = t.status
      t.status = targetStatus
      const { error } = await updateTestStatus(t.id, targetStatus)
      if (error) {
        t.status = prev
        showToast(error.message || 'Could not update one or more tests.')
      }
    }
  }

  if (overwriteCount === 0) {
    apply()
    return
  }

  const statusLabel = STATUS_LABELS[targetStatus]
  openConfirm(
    `Mark all as ${statusLabel}?`,
    `This overwrites ${overwriteCount} already-marked test${overwriteCount === 1 ? '' : 's'} in "${scopeLabel}" to ${statusLabel}. This can't be undone.`,
    apply,
  )
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
// Manage Access panel (owner-only). Its own internal state (member list,
// invite form, role changes, removal) now lives inside
// ManageAccessModal.vue/useReportMembers.js (Task 8/6) — this file only
// keeps the open/close flag, since the trigger button and the PDF-capture
// snapshot logic in handleDownloadPdf both need it.
// ---------------------------------------------------------------------
const manageOpen = ref(false)

// After a successful ownership transfer inside ManageAccessModal, the
// current user's own role may have changed — re-load so isOwner/myRole
// (both derived from `members`) reflect it.
async function onMembershipChanged() {
  await load()
}

// ---------------------------------------------------------------------
// Export menu (Download PDF / Download JSON / Generate report) + Generate
// report modal. Ported from js/app.js's export dropdown (~line 855) and the
// Generate report modal (~line 1071-1487).
// ---------------------------------------------------------------------
const importExport = useImportExport()
const { reportSettings } = importExport

const exportMenuOpen = ref(false)
const reportModalOpen = ref(false)
const reportModalBox = ref(null)
useModalFocus(reportModalOpen, reportModalBox)
const reportSettingsOpen = ref(false)
const reportCopyLabel = ref('Copy to clipboard')
const pdfBusy = ref(false)

const reportTitle = computed(() => report.value?.title || 'QA Testing Report')
const reportData = computed(() => importExport.collectReportCases(tree.value, reportSettings))
const reportMarkdown = computed(() => importExport.buildReportMarkdown(reportTitle.value, reportData.value))
const reportPlainText = computed(() => importExport.buildReportPlainText(reportTitle.value, reportData.value))
const reportClipboardHtml = computed(() =>
  importExport.buildReportClipboardHtml(reportTitle.value, reportData.value),
)

function handleDownloadJson() {
  exportMenuOpen.value = false
  importExport.downloadJson(reportTitle.value, tree.value)
}

async function handleDownloadPdf() {
  exportMenuOpen.value = false
  pdfBusy.value = true
  // Snapshot + close any open modal so it isn't photographed into the
  // capture, then restore — same as the legacy downloadPdf()'s
  // openModals handling (js/app.js ~line 966).
  const wasManageOpen = manageOpen.value
  const wasReportModalOpen = reportModalOpen.value
  manageOpen.value = false
  reportModalOpen.value = false

  document.body.classList.add('generating-pdf')
  await nextTick()
  try {
    await importExport.downloadPdf(document.body)
  } catch {
    showToast('PDF generation failed. Please try again.')
  } finally {
    document.body.classList.remove('generating-pdf')
    manageOpen.value = wasManageOpen
    reportModalOpen.value = wasReportModalOpen
    pdfBusy.value = false
  }
}

function handleOpenReportModal() {
  exportMenuOpen.value = false
  const anyCases = importExport.collectReportCases(tree.value, {
    all: true,
    passed: false,
    passedWithNote: false,
    failedOnly: false,
  })
  if (anyCases.total === 0) {
    showToast('No passed or failed tests yet. Mark tests as Pass or Fail to generate a report.')
    return
  }
  reportCopyLabel.value = 'Copy to clipboard'
  reportModalOpen.value = true
}
function closeReportModal() {
  reportModalOpen.value = false
  reportSettingsOpen.value = false
}
function onReportSettingAll() {
  importExport.setAllReportSetting()
}
function onReportSettingToggle(key, checked) {
  importExport.toggleReportSetting(key, checked)
}
async function handleCopyReport() {
  const { error } = await importExport.copyReportToClipboard(reportPlainText.value, reportClipboardHtml.value)
  if (error) {
    showToast(error)
    return
  }
  reportCopyLabel.value = 'Copied!'
  setTimeout(() => {
    reportCopyLabel.value = 'Copy to clipboard'
  }, 1600)
}
function handleDownloadReport() {
  importExport.downloadReportMarkdown(reportMarkdown.value)
}

// ---------------------------------------------------------------------
// Close any open dropdown/menu on an outside click or Escape — mirrors
// closeAllMenus() (js/app.js ~line 254).
// ---------------------------------------------------------------------
// Mobile hamburger nav (ported from setMobileNavOpen/toggleMobileNav in
// js/app.js ~line 893-904) — at >900px .head-actions is a normal flex
// row and this button/state is invisible/inert (see responsive.css);
// below that, .head-actions is display:none unless .is-open, and this
// toggle is the only way to reach Export/Manage access/Delete at all.
const mobileNavOpen = ref(false)
function toggleMobileNav() {
  mobileNavOpen.value = !mobileNavOpen.value
  if (!mobileNavOpen.value) exportMenuOpen.value = false
}

function closeAllMenus() {
  treeUi.closeMenu()
  exportMenuOpen.value = false
  reportSettingsOpen.value = false
  mobileNavOpen.value = false
}
function onDocumentClick(e) {
  if (!e.target.closest('.menu-wrap') && !e.target.closest('.nav-toggle')) closeAllMenus()
}
function onDocumentKeydown(e) {
  if (e.key !== 'Escape') return
  if (confirmModal.open) {
    closeConfirm()
    return
  }
  if (reportModalOpen.value) {
    closeReportModal()
    return
  }
  closeAllMenus()
}

// ---------------------------------------------------------------------
// Scroll-collapse — hides the KPI/progress/jump-nav block while scrolling
// down through the test list, brings it back on scroll-up or near the top.
// Ported from js/app.js (~line 1743 onward).
// ---------------------------------------------------------------------
const SCROLL_COLLAPSE_THRESHOLD = 80
const SCROLL_COLLAPSE_THROTTLE_MS = 100
const SCROLL_COLLAPSE_COOLDOWN_MS = 400
let lastScrollY = 0
let scrollCollapseThrottled = false
let lastToggleAt = 0

function updateScrollCollapse() {
  const y = window.scrollY
  if (Date.now() - lastToggleAt < SCROLL_COLLAPSE_COOLDOWN_MS) {
    lastScrollY = y
    return
  }
  const delta = y - lastScrollY
  const isCollapsed = document.body.classList.contains('scroll-collapsed')
  const suiteLoaded = !!report.value
  if (suiteLoaded && delta > 0 && y > SCROLL_COLLAPSE_THRESHOLD && !isCollapsed) {
    document.body.classList.add('scroll-collapsed')
    lastToggleAt = Date.now()
  } else if ((!suiteLoaded || y <= SCROLL_COLLAPSE_THRESHOLD || delta < 0) && isCollapsed) {
    document.body.classList.remove('scroll-collapsed')
    lastToggleAt = Date.now()
  }
  lastScrollY = y
}
function onScroll() {
  if (scrollCollapseThrottled) return
  scrollCollapseThrottled = true
  setTimeout(() => {
    scrollCollapseThrottled = false
  }, SCROLL_COLLAPSE_THROTTLE_MS)
  updateScrollCollapse()
}

onMounted(() => {
  lastScrollY = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
  document.body.classList.remove('scroll-collapsed', 'generating-pdf')
})
</script>

<template>
  <div class="head-chrome" :class="{ 'nav-open': mobileNavOpen }">
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
          <div class="menu-wrap export-wrap">
            <button
              class="btn"
              type="button"
              :disabled="!statsView.total_tests || pdfBusy"
              :aria-expanded="exportMenuOpen"
              aria-haspopup="true"
              @click.stop="exportMenuOpen = !exportMenuOpen"
            >
              <Icon name="download" cls="icon-sm" />
              <span class="btn-label">{{ pdfBusy ? 'Generating…' : 'Export' }}</span>
            </button>
            <div class="dropdown-menu export-menu" :class="{ open: exportMenuOpen }" :inert="!exportMenuOpen">
              <button type="button" class="dropdown-item" @click="handleDownloadPdf">
                <Icon name="download" cls="icon-sm" />
                <span>Download PDF</span>
              </button>
              <button type="button" class="dropdown-item" @click="handleDownloadJson">
                <Icon name="download" cls="icon-sm" />
                <span>Download JSON</span>
              </button>
              <button type="button" class="dropdown-item" @click="handleOpenReportModal">
                <Icon name="fileJson" cls="icon-sm" />
                <span>Generate report</span>
              </button>
            </div>
          </div>
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

      <div v-if="report" class="head-metrics">
        <StatTiles :stats="statsView" :active-filter="currentFilter" @filter="handleFilterClick" />
        <ProgressBar :percent="statsView.pass_percent" :label="`${statsView.pass_percent}% passed`" />

        <div class="jump-group">
          <div class="search-wrap">
            <Icon name="search" cls="icon search-icon" />
            <input
              v-model="searchQuery"
              type="search"
              class="search-input"
              placeholder="Search test cases…"
              aria-label="Search test cases"
              autocomplete="off"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="search-clear-btn"
              aria-label="Clear search"
              @click="clearSearch"
            >
              <Icon name="x" cls="icon-sm" />
            </button>
          </div>
          <select v-model="jumpModuleValue" class="jump-select" @change="onJumpModuleChange">
            <option value="">Jump to module…</option>
            <option v-for="mod in tree" :key="mod.id" :value="mod.num">{{ mod.num }}. {{ mod.name }}</option>
          </select>
          <select
            v-if="jumpModuleValue && jumpSubOptions.length"
            v-model="jumpSubValue"
            class="jump-select"
            @change="onJumpSubChange"
          >
            <option value="">Jump to sub-module…</option>
            <option v-for="sm in jumpSubOptions" :key="sm.id" :value="sm.num">{{ sm.num }} · {{ sm.name }}</option>
          </select>
        </div>

        <div class="pinned-bar" :style="{ display: pinnedItems.length ? 'flex' : 'none' }">
          <span class="pinned-label">
            <Icon name="pin" cls="icon-sm" />
            Pinned
          </span>
          <div class="pinned-items">
            <div v-for="item in pinnedItems" :key="item.key" class="pinned-chip">
              <button type="button" class="pinned-chip-label" @click="scrollToId(item.targetId)">
                {{ item.label }}
              </button>
              <button type="button" class="pinned-unpin" title="Unpin" @click="item.unpin">
                <Icon name="x" cls="icon-sm" />
              </button>
            </div>
          </div>
        </div>
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

    <div v-else-if="tree.length === 0" class="empty-state">
      <h2 class="empty-title">No modules in this report</h2>
      <p class="empty-hint">This report's imported JSON had no modules.</p>
    </div>

    <template v-else>
      <ModuleCard
        v-for="mod in viewTree"
        v-show="!mod.hidden"
        :key="mod.id"
        :mod="mod"
        :status-busy="statusBusy"
        :on-status-change="handleStatusChange"
        :on-note-input="handleNoteInput"
        :on-bulk-mark="handleBulkMark"
      />

      <div v-if="showFilterEmpty" id="filter-empty" class="empty-state empty-state--filter">
        <div class="empty-icon" aria-hidden="true"><Icon name="search" cls="icon-lg" /></div>
        <h2 class="empty-title">{{ filterEmptyMessage.title }}</h2>
        <p class="empty-hint">{{ filterEmptyMessage.hint }}</p>
        <div class="empty-actions">
          <button class="btn primary" type="button" @click="clearFilterAndSearch">Show all cases</button>
        </div>
      </div>
    </template>
  </main>

  <!-- Manage Access modal (owner-only) -->
  <ManageAccessModal
    :open="manageOpen"
    :report-id="reportId"
    :current-user-id="user?.id"
    @close="manageOpen = false"
    @membership-changed="onMembershipChanged"
  />

  <!-- Bulk-mark confirm modal -->
  <div
    class="modal-overlay"
    :class="{ open: confirmModal.open }"
    :inert="!confirmModal.open"
    @click.self="closeConfirm"
  >
    <div ref="confirmModalBox" class="modal-box modal-box--closable" role="dialog" aria-modal="true">
      <button type="button" class="icon-btn modal-close-btn" aria-label="Cancel" @click="closeConfirm">
        <Icon name="x" />
      </button>
      <h2>{{ confirmModal.title }}</h2>
      <p>{{ confirmModal.message }}</p>
      <div class="modal-actions">
        <button class="btn" type="button" @click="closeConfirm">No</button>
        <button class="btn danger" type="button" @click="confirmYes">Yes</button>
      </div>
    </div>
  </div>

  <!-- Generate report modal -->
  <div
    class="modal-overlay"
    :class="{ open: reportModalOpen }"
    :inert="!reportModalOpen"
    @click.self="closeReportModal"
  >
    <div ref="reportModalBox" class="modal-box modal-box--report" role="dialog" aria-modal="true">
      <div class="report-modal-header">
        <div class="report-modal-heading"><h2>Test report</h2></div>
        <div class="report-modal-actions">
          <div class="menu-wrap report-settings-wrap">
            <button
              type="button"
              class="icon-btn report-modal-action-btn"
              aria-haspopup="true"
              :aria-expanded="reportSettingsOpen"
              aria-label="Report settings"
              title="Report settings"
              @click.stop="reportSettingsOpen = !reportSettingsOpen"
            >
              <Icon name="settings" />
            </button>
            <div class="dropdown-menu report-settings-panel" :class="{ open: reportSettingsOpen }" :inert="!reportSettingsOpen">
              <p class="report-settings-title">Included test cases</p>
              <label class="report-settings-check">
                <input type="checkbox" :checked="reportSettings.all" @change="onReportSettingAll" />
                <span>All</span>
              </label>
              <label class="report-settings-check">
                <input
                  type="checkbox"
                  :checked="reportSettings.passed"
                  @change="onReportSettingToggle('passed', $event.target.checked)"
                />
                <span>Passed</span>
              </label>
              <label class="report-settings-check">
                <input
                  type="checkbox"
                  :checked="reportSettings.passedWithNote"
                  @change="onReportSettingToggle('passedWithNote', $event.target.checked)"
                />
                <span>Passed with note</span>
              </label>
              <label class="report-settings-check">
                <input
                  type="checkbox"
                  :checked="reportSettings.failedOnly"
                  @change="onReportSettingToggle('failedOnly', $event.target.checked)"
                />
                <span>Failed only</span>
              </label>
            </div>
          </div>
          <button
            type="button"
            class="icon-btn report-modal-action-btn"
            aria-label="Close report"
            @click="closeReportModal"
          >
            <Icon name="x" />
          </button>
        </div>
      </div>

      <div class="report-modal-body">
        <div v-if="!reportData.total" class="report-empty">
          <strong>No passed or failed cases yet</strong>
          Mark cases as Pass or Fail to include them in this report. Pending cases are omitted.
        </div>
        <article v-else class="report-doc">
          <header class="report-doc-header">
            <p class="report-doc-kicker">QA Test Report</p>
            <h1 class="report-doc-title">{{ reportTitle }}</h1>
            <p class="report-doc-meta">
              Summary: {{ reportData.passed }} passed, {{ reportData.failed }} failed
              ({{ reportData.total }} included; pending omitted)
            </p>
          </header>
          <section v-for="mod in reportData.sections" :key="mod.num" class="report-module">
            <h2 class="report-module-title">{{ mod.num }}. {{ mod.title }}</h2>
            <div v-for="sm in mod.subModules" :key="sm.num" class="report-submodule">
              <h3 class="report-submodule-title">{{ sm.num }} {{ sm.title }}</h3>
              <ol class="report-case-list">
                <li v-for="t in sm.cases" :key="t.num" class="report-case-item">
                  <p class="report-case-line">
                    <span class="report-case-status-text">[{{ t.status === 'pass' ? 'Passed' : 'Failed' }}]</span>
                    {{ t.num }} — {{ t.name }}
                  </p>
                  <ul v-if="t.note && t.note.trim()" class="report-note-list">
                    <li><span class="report-note-label">Note:</span> {{ t.note }}</li>
                  </ul>
                </li>
              </ol>
            </div>
          </section>
        </article>
      </div>

      <div class="report-modal-footer">
        <button type="button" class="btn" :disabled="!reportData.total" @click="handleCopyReport">
          <Icon name="copy" cls="icon-sm" />
          <span>{{ reportCopyLabel }}</span>
        </button>
        <button type="button" class="btn primary" :disabled="!reportData.total" @click="handleDownloadReport">
          <Icon name="download" cls="icon-sm" />
          <span>Download</span>
        </button>
      </div>
    </div>
  </div>

  <div class="toast" :class="{ show: toastVisible }">
    <span class="toast-msg">{{ toastMessage }}</span>
  </div>
</template>
