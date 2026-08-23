// Report-runner composable (Phase 5) — loads one report's full
// modules -> sub_modules -> tests tree by report_id and derives everything
// ReportView.vue and its child components need to render it: per-module/
// per-sub-module pass/fail rollups, and the display numbers ("1", "1.1",
// "1.1.1") the legacy static app computed from array position in
// buildModules() (js/app.js line ~85). Those numbers are NEVER persisted —
// they're recomputed from order_index-sorted array position on every load,
// same as the "Decisions carried forward" section of the migration plan
// requires.
//
// Wraps fetchReportDetail() from ./useReports.js (Phase 4, unchanged) rather
// than duplicating the four-table fetch — this module only adds the
// derived/computed layer on top (numbering + stats), which useReports.js
// deliberately doesn't own (it's a thin, stateless data-access layer, see
// its own header comment).
import { ref, computed } from 'vue'
import { useReports } from './useReports'

export function useReportRunner() {
  const { fetchReportDetail } = useReports()

  const loading = ref(true)
  const loadError = ref('')
  const report = ref(null)
  const members = ref([])
  const modules = ref([])
  const subModules = ref([])
  const tests = ref([])
  const stats = ref(null)

  // Any error from fetchReportDetail's zero-row `.single()` on `reports` —
  // whether the row genuinely doesn't exist or RLS just withholds it from
  // this user — collapses to the same friendly message. Distinguishing the
  // two cases isn't possible (and isn't useful) from an anon/authenticated
  // client without leaking existence, so both look identical on purpose.
  async function load(reportId) {
    loading.value = true
    loadError.value = ''
    const { data, error } = await fetchReportDetail(reportId)
    loading.value = false
    if (error) {
      loadError.value = "This report doesn't exist, or you don't have access to it."
      return { error }
    }
    report.value = data.report
    members.value = data.members
    modules.value = data.modules
    subModules.value = data.subModules
    tests.value = data.tests
    stats.value = data.stats
    return { error: null }
  }

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

  // The numbered tree every component renders from. Each level keeps the
  // original DB row's fields (spread first) plus its derived `num` and
  // (for modules/sub-modules) its child array + stats rollup — `id` stays
  // the real DB id throughout, so callers can always map a tree node back
  // to its source row in `tests.value`/`modules.value`/`subModules.value`.
  const tree = computed(() =>
    sortedModules.value.map((mod, mi) => {
      const modNum = String(mi + 1)
      const subs = (subModulesByModule.value[mod.id] || []).map((sm, si) => {
        const subNum = `${modNum}.${si + 1}`
        const smTests = (testsBySubModule.value[sm.id] || []).map((t, ti) => ({
          ...t,
          num: `${subNum}.${ti + 1}`,
        }))
        return { ...sm, num: subNum, tests: smTests, stats: subModuleStats(sm.id) }
      })
      return { ...mod, num: modNum, subModules: subs, stats: moduleStats(mod.id) }
    }),
  )

  function findTest(testId) {
    return tests.value.find((t) => t.id === testId)
  }

  return {
    loading,
    loadError,
    report,
    members,
    modules,
    subModules,
    tests,
    stats,
    load,
    statsView,
    sortedModules,
    subModulesByModule,
    testsBySubModule,
    subModuleStats,
    moduleStats,
    tree,
    findTest,
  }
}
