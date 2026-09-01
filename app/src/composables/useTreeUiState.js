// Client-only UI state for the module/sub-module tree: collapse/expand,
// pin/unpin, lock/unlock, and which "more options" dropdown is open.
// Ported behaviorally from js/app.js (legacy static app):
//   toggleCollapseModule/toggleCollapseSub   ~line 205
//   togglePinModule/togglePinSub             ~line 219
//   toggleLockModule/toggleLockSub           ~line 233
//   closeAllMenus/openMenuKey                ~line 254
//
// None of this is written to Supabase — it's pure front-end presentation
// state (a plain `reactive` map per concern, keyed by the module/sub-module's
// real DB id), reset on reload exactly like the legacy in-memory app. Each
// module/sub-module defaults to collapsed, unpinned, unlocked until touched
// (same defaults buildModules() gave every node in the legacy app).
import { reactive, ref, onMounted, onUnmounted } from 'vue'

export function useTreeUiState() {
  const collapsedModules = reactive({})
  const collapsedSubModules = reactive({})
  const pinnedModules = reactive({})
  const pinnedSubModules = reactive({})
  const lockedModules = reactive({})
  const lockedSubModules = reactive({})

  // Single source of truth for which one "more options" dropdown is open at
  // a time (module/sub-module menus, plus the report-settings/export menus
  // reuse the same key namespace from ReportView.vue) — mirrors legacy's
  // module-level `openMenuKey` + closeAllMenus().
  const openMenuKey = ref(null)
  function toggleMenu(key) {
    openMenuKey.value = openMenuKey.value === key ? null : key
  }
  function closeMenu() {
    openMenuKey.value = null
  }
  // Module/sub-module "more options" menus are teleported to <body> (see
  // ModuleCard.vue/SubModuleCard.vue) so .module's overflow:hidden — there
  // for the card's rounded corners — can't clip them. Teleported +
  // position:fixed means they don't move with the page on scroll, so close
  // on scroll rather than tracking/repositioning — same UX other floating
  // menus (native <select>, etc.) already use.
  onMounted(() => window.addEventListener('scroll', closeMenu, { passive: true }))
  onUnmounted(() => window.removeEventListener('scroll', closeMenu))

  function isModuleCollapsed(id) {
    return id in collapsedModules ? collapsedModules[id] : true
  }
  function isSubCollapsed(id) {
    return id in collapsedSubModules ? collapsedSubModules[id] : true
  }

  function toggleCollapseModule(id) {
    if (lockedModules[id]) return
    collapsedModules[id] = !isModuleCollapsed(id)
  }
  function toggleCollapseSub(id) {
    if (lockedSubModules[id]) return
    collapsedSubModules[id] = !isSubCollapsed(id)
  }
  // Used by jump-nav: expand a target module/sub-module explicitly (locked
  // ones stay collapsed, same as jumpTo() in the legacy app).
  function expandModule(id) {
    if (!lockedModules[id]) collapsedModules[id] = false
  }
  function expandSub(id) {
    if (!lockedSubModules[id]) collapsedSubModules[id] = false
  }

  function togglePinModule(id) {
    pinnedModules[id] = !pinnedModules[id]
  }
  function togglePinSub(id) {
    pinnedSubModules[id] = !pinnedSubModules[id]
  }

  function toggleLockModule(id) {
    lockedModules[id] = !lockedModules[id]
    if (lockedModules[id]) collapsedModules[id] = true
  }
  function toggleLockSub(id) {
    lockedSubModules[id] = !lockedSubModules[id]
    if (lockedSubModules[id]) collapsedSubModules[id] = true
  }

  return {
    collapsedModules,
    collapsedSubModules,
    pinnedModules,
    pinnedSubModules,
    lockedModules,
    lockedSubModules,
    openMenuKey,
    toggleMenu,
    closeMenu,
    isModuleCollapsed,
    isSubCollapsed,
    toggleCollapseModule,
    toggleCollapseSub,
    expandModule,
    expandSub,
    togglePinModule,
    togglePinSub,
    toggleLockModule,
    toggleLockSub,
  }
}
