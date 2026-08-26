// Reports store — module-singleton composable (same pattern as
// ./useAuth.js): stateless action functions over Supabase, no local cache
// of report data (views own their own fetched state and re-fetch after
// mutations). This mirrors useAuth.js's shape rather than introducing a
// second state-management pattern into the project.
import { supabase } from '../lib/supabaseClient'

// ---------------------------------------------------------------------
// Legacy JSON import validation — ported unchanged from js/app.js's
// validateImportShape() (legacy static app, lines 1670-1690). Same rules,
// same order, same error strings — only the return path differs (no
// alert(), the caller decides how to show it).
// ---------------------------------------------------------------------
function validateImportShape(parsed) {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.modules)) {
    return 'Missing a "modules" array at the top level.'
  }
  for (const m of parsed.modules) {
    if (!m || typeof m.title !== 'string' || !Array.isArray(m.subModules)) {
      return 'Each module needs a "title" string and a "subModules" array.'
    }
    for (const sm of m.subModules) {
      if (!sm || typeof sm.title !== 'string' || !Array.isArray(sm.tests)) {
        return 'Each sub-module needs a "title" string and a "tests" array.'
      }
      for (const t of sm.tests) {
        if (!t || typeof t.text !== 'string') {
          return 'Each test needs a "text" string.'
        }
      }
    }
  }
  return null
}

const VALID_STATUSES = ['pass', 'fail', 'pending']
function normalizeStatus(value) {
  return VALID_STATUSES.includes(value) ? value : 'pending'
}

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

// Every report the current user can see (RLS: member or creator), newest
// first, with each report's own report_members rows (so the caller can
// resolve "my role") and its report_stats row (pass/fail/pending counts).
async function fetchMyReports() {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*, report_members(id, user_id, role)')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error }
  if (!reports.length) return { data: [], error: null }

  const ids = reports.map((r) => r.id)
  const { data: stats, error: statsError } = await supabase
    .from('report_stats')
    .select('*')
    .in('report_id', ids)
  if (statsError) return { data: null, error: statsError }

  const statsById = Object.fromEntries((stats || []).map((s) => [s.report_id, s]))
  return {
    data: reports.map((r) => ({ ...r, stats: statsById[r.id] || null })),
    error: null,
  }
}

// Everything needed to render one report: the report row, its members,
// its full module/sub-module/test tree (each ordered by order_index), and
// its stats row.
async function fetchReportDetail(reportId) {
  const [reportRes, membersRes, modulesRes, subModulesRes, testsRes, statsRes] = await Promise.all([
    supabase.from('reports').select('*').eq('id', reportId).single(),
    supabase.from('report_members').select('*').eq('report_id', reportId),
    supabase.from('modules').select('*').eq('report_id', reportId).order('order_index'),
    supabase.from('sub_modules').select('*').eq('report_id', reportId).order('order_index'),
    supabase.from('tests').select('*').eq('report_id', reportId).order('order_index'),
    supabase.from('report_stats').select('*').eq('report_id', reportId).maybeSingle(),
  ])

  const error =
    reportRes.error || membersRes.error || modulesRes.error || subModulesRes.error || testsRes.error
  if (error) return { data: null, error }

  return {
    data: {
      report: reportRes.data,
      members: membersRes.data,
      modules: modulesRes.data,
      subModules: subModulesRes.data,
      tests: testsRes.data,
      stats: statsRes.data,
    },
    error: null,
  }
}

function getMyRole(report, userId) {
  const row = (report.report_members || []).find((m) => m.user_id === userId)
  return row ? row.role : null
}

// ---------------------------------------------------------------------
// Create-report pipeline (title -> validated JSON -> reports row -> owner
// membership -> storage upload + tracking row -> modules/sub_modules/tests).
//
// Steps 1-2 (reports row, then the owner's own report_members bootstrap
// row) have nothing to roll back if either fails — the bootstrap INSERT
// policy needs the reports row to already exist, so a failure there simply
// stops the flow before any hierarchy exists to clean up.
//
// From step 3 onward (storage + report_uploads, then modules/sub_modules/
// tests), any failure deletes the reports row: the `on delete cascade` FKs
// already in the schema clean up report_members/modules/sub_modules/tests
// automatically, and we additionally best-effort remove the uploaded
// storage object ourselves since storage.objects isn't covered by those
// FK cascades.
// ---------------------------------------------------------------------
async function createReport(title, file, userId) {
  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return { data: null, error: 'That file is not valid JSON.' }
  }

  const shapeError = validateImportShape(parsed)
  if (shapeError) return { data: null, error: `Import failed: ${shapeError}` }

  // Step 1: reports row.
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .insert({ title, created_by: userId })
    .select()
    .single()
  if (reportError) return { data: null, error: reportError.message }

  // Step 2: owner's own report_members bootstrap row.
  const { error: memberError } = await supabase
    .from('report_members')
    .insert({ report_id: report.id, user_id: userId, role: 'owner' })
  if (memberError) {
    // Nothing to roll back yet at this point (see comment above).
    return { data: null, error: memberError.message }
  }

  const storagePath = `${report.id}/${file.name}`

  async function rollback() {
    await supabase
      .storage
      .from('report-uploads')
      .remove([storagePath])
      .catch(() => {})
    await supabase.from('reports').delete().eq('id', report.id)
  }

  // Step 3: raw file to Storage + its report_uploads tracking row, in
  // parallel — either failing rolls back.
  const [uploadResult, uploadRowResult] = await Promise.all([
    supabase.storage.from('report-uploads').upload(storagePath, file),
    supabase.from('report_uploads').insert({
      report_id: report.id,
      storage_path: storagePath,
      uploaded_by: userId,
    }),
  ])
  if (uploadResult.error || uploadRowResult.error) {
    await rollback()
    return {
      data: null,
      error: (uploadResult.error || uploadRowResult.error).message,
    }
  }

  // Step 4: modules/sub_modules/tests, batch-inserted with order_index
  // computed from array position.
  try {
    await insertHierarchy(report.id, parsed.modules)
  } catch (err) {
    await rollback()
    return { data: null, error: err.message || 'Failed to import test data.' }
  }

  return { data: report, error: null }
}

// Bulk-inserts modules, then sub_modules, then tests, mapping JSON
// field names to DB column names (module.title -> name, subModule.title ->
// name, test.text -> name; test.status/test.note map directly) and
// computing order_index from each array's position within its parent.
//
// Correlates parent -> child rows by (parent id, order_index) rather than
// assuming the DB returns inserted rows in the same order they were sent —
// order_index is unique within its parent (module index within the
// report, sub-module index within its module), so it's a safe join key
// regardless of insert/return ordering.
async function insertHierarchy(reportId, modulesJson) {
  const modulesPayload = modulesJson.map((m, i) => ({
    report_id: reportId,
    name: m.title,
    order_index: i,
  }))
  const { data: moduleRows, error: moduleError } = await supabase
    .from('modules')
    .insert(modulesPayload)
    .select('id, order_index')
  if (moduleError) throw moduleError

  const moduleIdByIndex = {}
  moduleRows.forEach((row) => {
    moduleIdByIndex[row.order_index] = row.id
  })

  const subModulesPayload = []
  modulesJson.forEach((m, i) => {
    m.subModules.forEach((sm, j) => {
      subModulesPayload.push({
        report_id: reportId,
        module_id: moduleIdByIndex[i],
        name: sm.title,
        order_index: j,
      })
    })
  })

  const subModuleIdByKey = {}
  if (subModulesPayload.length) {
    const { data: subModuleRows, error: subModuleError } = await supabase
      .from('sub_modules')
      .insert(subModulesPayload)
      .select('id, module_id, order_index')
    if (subModuleError) throw subModuleError

    subModuleRows.forEach((row) => {
      subModuleIdByKey[`${row.module_id}:${row.order_index}`] = row.id
    })
  }

  const testsPayload = []
  modulesJson.forEach((m, i) => {
    const moduleId = moduleIdByIndex[i]
    m.subModules.forEach((sm, j) => {
      const subModuleId = subModuleIdByKey[`${moduleId}:${j}`]
      sm.tests.forEach((t, k) => {
        testsPayload.push({
          report_id: reportId,
          sub_module_id: subModuleId,
          name: t.text,
          status: normalizeStatus(t.status),
          note: typeof t.note === 'string' && t.note ? t.note : null,
          order_index: k,
        })
      })
    })
  })

  if (testsPayload.length) {
    const { error: testsError } = await supabase.from('tests').insert(testsPayload)
    if (testsError) throw testsError
  }
}

// ---------------------------------------------------------------------
// Report-level actions
// ---------------------------------------------------------------------

// Soft delete only — the schema has no *unscoped* delete policy for
// `reports` (see Phase 2 migration; Phase 11 added a narrow archived+owner
// -only one — see deleteReportPermanently below), so "Delete" in the UI
// sets archived_at rather than removing the row.
//
// All three functions below share the same shape: PostgREST returns
// error:null whether an update/delete touched one row or zero (e.g. RLS
// silently denied it), so each asks for the touched row back via
// .select('id') and treats an empty result as a denial, not a success.
async function archiveReport(reportId) {
  const { data, error } = await supabase
    .from('reports')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', reportId)
    .select('id')
  if (error) return { data: null, error: error.message }
  if (!data?.length) return { data: null, error: 'Could not delete this report — you may not have permission.' }
  return { data, error: null }
}

async function unarchiveReport(reportId) {
  const { data, error } = await supabase
    .from('reports')
    .update({ archived_at: null })
    .eq('id', reportId)
    .select('id')
  if (error) return { data: null, error: error.message }
  if (!data?.length) return { data: null, error: 'Could not restore this report — you may not have permission.' }
  return { data, error: null }
}

// Hard delete — Bin-only, irreversible. Requires archived_at already set
// (enforced both by the UI flow and server-side by the
// reports_delete_archived_owner RLS policy from Task 3/Phase 11).
async function deleteReportPermanently(reportId) {
  const { data, error } = await supabase.from('reports').delete().eq('id', reportId).select('id')
  if (error) return { data: null, error: error.message }
  if (!data?.length) {
    return { data: null, error: 'Could not permanently delete this report — you may not have permission.' }
  }
  return { data, error: null }
}

// ---------------------------------------------------------------------
// Test actions (status/note edits — the only columns editors may touch;
// enforced server-side by the tests_update_scope trigger, not just here)
// ---------------------------------------------------------------------

async function updateTestStatus(testId, status) {
  return supabase.from('tests').update({ status }).eq('id', testId).select().single()
}

async function updateTestNote(testId, note) {
  return supabase.from('tests').update({ note: note || null }).eq('id', testId).select().single()
}

export function useReports() {
  return {
    fetchMyReports,
    fetchReportDetail,
    getMyRole,
    createReport,
    archiveReport,
    unarchiveReport,
    deleteReportPermanently,
    updateTestStatus,
    updateTestNote,
  }
}
