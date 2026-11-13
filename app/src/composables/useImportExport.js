// Export + Generate-report logic (Phase 5), ported from js/app.js (legacy
// static app):
//   downloadJson()                                      ~line 925
//   downloadPdf()  (html2pdf.js)                         ~line 948
//   reportSettings / testMatchesReportSettings           ~line 1088
//   collectReportCases()                                 ~line 1103
//   buildReportMarkdown() / buildReportPlainText() /
//   buildReportClipboardHtml()                            ~line 1148-1286
//
// Adapted to operate on the numbered tree from useReportRunner.js
// (module.num/name/subModules, subModule.num/name/tests,
// test.num/name/status/note) instead of the legacy in-memory `modules`
// array, and to return values/errors instead of touching the DOM or calling
// alert() directly — the caller (ReportView.vue) decides how to surface
// errors (its existing showToast), per the project's no-alert() rule.
import { reactive } from 'vue'

export function useImportExport() {
  // "All" and the three specific filters are one mutually-exclusive group —
  // same rule as the legacy report-settings panel (§ report settings cog):
  // checking "all" clears the other three; checking any specific one clears
  // "all"; unchecking the last-checked specific filter falls back to "all"
  // rather than leaving nothing selected.
  const reportSettings = reactive({
    all: true,
    passed: false,
    passedWithNote: false,
    failedOnly: false,
  })

  function setAllReportSetting() {
    reportSettings.all = true
    reportSettings.passed = false
    reportSettings.passedWithNote = false
    reportSettings.failedOnly = false
  }

  function toggleReportSetting(key, checked) {
    reportSettings.all = false
    reportSettings[key] = checked
    if (!reportSettings.passed && !reportSettings.passedWithNote && !reportSettings.failedOnly) {
      setAllReportSetting()
    }
  }

  function testMatchesReportSettings(t, settings) {
    const s = settings || reportSettings
    if (t.status !== 'pass' && t.status !== 'fail') return false // pending never included
    if (s.all) return true
    if (!s.passed && !s.passedWithNote && !s.failedOnly) return true // nothing checked — same as "all"

    const hasNote = !!(t.note && t.note.trim())
    if (s.passed && t.status === 'pass' && !hasNote) return true
    if (s.passedWithNote && t.status === 'pass' && hasNote) return true
    if (s.failedOnly && t.status === 'fail') return true
    return false
  }

  // Preserves tree order: module -> sub-module -> tests; filtered by the
  // Included Test Cases report setting (defaults to all pass/fail cases).
  function collectReportCases(tree, settings) {
    const sections = []
    let passed = 0
    let failed = 0

    tree.forEach((mod) => {
      const subSections = []
      mod.subModules.forEach((sm) => {
        const cases = sm.tests.filter((t) => testMatchesReportSettings(t, settings))
        if (!cases.length) return
        cases.forEach((t) => {
          if (t.status === 'pass') passed += 1
          else failed += 1
        })
        subSections.push({ num: sm.num, title: sm.name, cases })
      })
      if (subSections.length) {
        sections.push({ num: mod.num, title: mod.name, subModules: subSections })
      }
    })

    return { sections, passed, failed, total: passed + failed }
  }

  // Escapes Teams' typed-markdown emphasis/code markers inside dev/QA-
  // authored text so a stray "*", "_", "~", or "`" in a test case doesn't
  // accidentally toggle bold/italic/strikethrough/code once pasted into a
  // Teams chat.
  function escapeTeamsMarkdown(str) {
    return String(str).replace(/([*_~`\\])/g, '\\$1')
  }

  // Microsoft Teams' subset markdown (#/##/### headings, **bold**, >
  // blockquote) — this is what Download saves as a real .md file.
  function buildReportMarkdown(title, data) {
    const generatedAt = new Date().toLocaleString()
    const lines = []
    lines.push(`# ${escapeTeamsMarkdown(title)}`)
    lines.push('')
    lines.push(`**Generated:** ${generatedAt}`)
    lines.push(
      `**Summary:** ${data.passed} passed, ${data.failed} failed (${data.total} included; pending omitted)`,
    )
    lines.push('')

    if (!data.total) {
      lines.push('No passed or failed cases yet.')
      return lines.join('\n')
    }

    data.sections.forEach((mod) => {
      lines.push(`## ${mod.num}. ${escapeTeamsMarkdown(mod.title)}`)
      lines.push('')
      mod.subModules.forEach((sm) => {
        lines.push(`### ${sm.num}. ${escapeTeamsMarkdown(sm.title)}`)
        lines.push('')
        sm.cases.forEach((t) => {
          const status = t.status === 'pass' ? 'Passed' : 'Failed'
          lines.push(`${t.num} **[${status}]** — ${escapeTeamsMarkdown(t.name)}`)
          if (t.note && t.note.trim()) {
            t.note
              .trim()
              .split(/\n/)
              .forEach((noteLine, ni) => {
                const text = escapeTeamsMarkdown(noteLine)
                lines.push(ni === 0 ? `> Note: ${text}` : `> ${text}`)
              })
          }
        })
        lines.push('')
      })
    })

    return lines.join('\n').trim() + '\n'
  }

  // Clean plain text, no markdown syntax — the text/plain half of the rich
  // clipboard write, and the whole payload on the older-browser fallback
  // path (navigator.clipboard.writeText).
  function buildReportPlainText(title, data) {
    const generatedAt = new Date().toLocaleString()
    const lines = []
    lines.push(title)
    lines.push(`Generated: ${generatedAt}`)
    lines.push(
      `Summary: ${data.passed} passed, ${data.failed} failed (${data.total} included; pending omitted)`,
    )

    if (!data.total) {
      lines.push('')
      lines.push('No passed or failed cases yet.')
      return lines.join('\n')
    }

    data.sections.forEach((mod) => {
      lines.push('')
      lines.push(`${mod.num}. ${mod.title}`)
      mod.subModules.forEach((sm) => {
        lines.push(`${sm.num}. ${sm.title}`)
        sm.cases.forEach((t) => {
          const status = t.status === 'pass' ? 'Passed' : 'Failed'
          lines.push(`${t.num} [${status}] — ${t.name}`)
          if (t.note && t.note.trim()) {
            t.note
              .trim()
              .split(/\n/)
              .forEach((noteLine) => lines.push(`Note: ${noteLine}`))
          }
        })
      })
    })

    return lines.join('\n').trim() + '\n'
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // Plain semantic HTML fragment (h1/h2/h3/strong/em/p only) for the
  // text/html clipboard entry — renders as real formatted text when pasted
  // into Teams/Word/Outlook/Slack. See the legacy buildReportClipboardHtml()
  // comment (js/app.js ~1231) for why notes are plain <p><em> rather than
  // <blockquote> (Teams' paste handler keeps only the last blockquote in a
  // multi-quote paste).
  function buildReportClipboardHtml(title, data) {
    if (!data.total) {
      return `<p><strong>No passed or failed cases yet.</strong></p>`
    }

    const generatedAt = new Date().toLocaleString()
    let html = `<h1>${escapeHtml(title)}</h1>`
    html += `<p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>`
    html += `<p><strong>Summary:</strong> ${data.passed} passed, ${data.failed} failed (${data.total} included; pending omitted)</p>`

    data.sections.forEach((mod) => {
      html += `<h2>${escapeHtml(mod.num)}. ${escapeHtml(mod.title)}</h2>`
      mod.subModules.forEach((sm) => {
        html += `<h3>${escapeHtml(sm.num)}. ${escapeHtml(sm.title)}</h3>`
        sm.cases.forEach((t) => {
          const status = t.status === 'pass' ? 'Passed' : 'Failed'
          const note = (t.note || '').trim()
          html += `<p>${escapeHtml(t.num)} <strong>[${escapeHtml(status)}]</strong> — ${escapeHtml(t.name)}</p>`
          if (note) {
            const noteHtml = note
              .split(/\n/)
              .map((line) => escapeHtml(line))
              .join('<br>')
            html += `<p><em>Note: ${noteHtml}</em></p>`
          }
        })
      })
    })

    return html
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Same schema the create-report import pipeline expects (modules[].title/
  // subModules[].title/tests[].text|status|note — see useReports.js's
  // validateImportShape()), so a downloaded export can be re-imported
  // unchanged.
  function downloadJson(title, tree) {
    const payload = {
      docTitle: title,
      modules: tree.map((mod) => ({
        title: mod.name,
        subModules: mod.subModules.map((sm) => ({
          title: sm.name,
          tests: sm.tests.map((t) => ({ text: t.name, status: t.status, note: t.note || '' })),
        })),
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    triggerDownload(blob, `qa-test-results-${new Date().toISOString().slice(0, 10)}.json`)
  }

  function downloadReportMarkdown(markdown) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    triggerDownload(blob, `qa-test-report-${new Date().toISOString().slice(0, 10)}.md`)
  }

  // Dynamically imported so html2pdf.js (and its jsPDF/html2canvas
  // dependencies) only load into the bundle when Download PDF is actually
  // used, not on every ReportView visit. `element` is the DOM node to
  // capture — ReportView.vue passes document.body (same as the legacy app)
  // after toggling the `generating-pdf` body class the CSS already knows
  // how to expand/unhide everything for (ported unchanged in
  // src/styles/base.css).
  async function downloadPdf(element) {
    const { default: html2pdf } = await import('html2pdf.js')
    const opt = {
      margin: [10, 10, 12, 10],
      filename: `qa-test-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      // busy-overlay is position:fixed and full-viewport while pdfBusy is
      // true, which is exactly the moment this capture runs — exclude it
      // so it never gets baked into the exported PDF image.
      html2canvas: { scale: 2, useCORS: true, ignoreElements: (el) => el.classList.contains('busy-overlay') },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    }
    await html2pdf().set(opt).from(element).save()
  }

  // Preferred: write both text/html (rich) and text/plain (clean) so Teams/
  // Word/Outlook/Slack render it as formatted text on paste. Falls back to
  // plain writeText() when the async Clipboard API/ClipboardItem isn't
  // available.
  async function copyReportToClipboard(plainText, html) {
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      try {
        const item = new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
        return { error: null }
      } catch {
        // Fall through to the plain-text path below.
      }
    }
    try {
      await navigator.clipboard.writeText(plainText)
      return { error: null }
    } catch {
      return { error: 'Could not copy to clipboard.' }
    }
  }

  return {
    reportSettings,
    setAllReportSetting,
    toggleReportSetting,
    testMatchesReportSettings,
    collectReportCases,
    buildReportMarkdown,
    buildReportPlainText,
    buildReportClipboardHtml,
    downloadJson,
    downloadReportMarkdown,
    downloadPdf,
    copyReportToClipboard,
  }
}
