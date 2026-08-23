# Graph Report - QA_Testing_Report  (2026-08-23)

## Corpus Check
- 8 files · ~12,897 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 126 nodes · 206 edges · 8 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1e4e0ad8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- Features
- render
- refreshReportModal
- applyImport
- buildMenuWrap
- updateActionButtons

## God Nodes (most connected - your core abstractions)
1. `render()` - 23 edges
2. `applyImport()` - 9 edges
3. `Features` - 9 edges
4. `icon()` - 8 edges
5. `refreshReportModal()` - 8 edges
6. `allTests()` - 7 edges
7. `escapeHtml()` - 6 edges
8. `updateActionButtons()` - 6 edges
9. `updateFilterEmptyState()` - 6 edges
10. `QA Testing Report` - 6 edges

## Surprising Connections (you probably didn't know these)
- `wireEmptyImportActions()` --indirect_call--> `loadSample()`  [INFERRED]
  js/app.js → js/app.js  _Bridges community 2 → community 4_
- `buildMenuWrap()` --calls--> `icon()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 2 → community 5_
- `render()` --calls--> `escapeHtml()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 3 → community 2_
- `updateFilterEmptyState()` --calls--> `escapeHtml()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 3 → community 4_
- `updateActionButtons()` --calls--> `allTests()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 4 → community 6_

## Import Cycles
- None detected.

## Communities (8 total, 0 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.04
Nodes (44): confirmActionsDefault, confirmActionsImport, confirmExportBtn, confirmExportMenu, confirmMessageEl, confirmModal, confirmTitleEl, docTitleEl (+36 more)

### Community 1 - "Features"
Cohesion: 0.11
Nodes (16): Coming Soon Features, Core workflow, Features, Filtering, Not Required, Organization & navigation, Reporting (Export → Generate report), Safety (+8 more)

### Community 2 - "render"
Cohesion: 0.18
Nodes (18): buildEmptyState(), buildJumpNav(), buildPinnedChip(), icon(), jumpTo(), render(), renderEmptySuite(), renderIdleEmpty() (+10 more)

### Community 3 - "refreshReportModal"
Cohesion: 0.18
Nodes (13): buildReportClipboardHtml(), buildReportHtml(), buildReportMarkdown(), buildReportPlainText(), collectReportCases(), escapeHtml(), escapeTeamsMarkdown(), onSpecificReportSettingChange() (+5 more)

### Community 4 - "applyImport"
Cohesion: 0.22
Nodes (10): allTests(), applyFilter(), applyImport(), buildModules(), clearSearch(), importFile(), loadSample(), undoReset() (+2 more)

### Community 5 - "buildMenuWrap"
Cohesion: 0.29
Nodes (7): buildMenuWrap(), bulkMarkTests(), closeAllMenus(), closeConfirmExportMenu(), confirmModalClose(), confirmModalOpen(), openExportMenu()

### Community 6 - "updateActionButtons"
Cohesion: 0.33
Nodes (7): closeExportMenu(), closeMobileNav(), downloadPdf(), setMobileNavOpen(), toggleMobileNav(), updateActionButtons(), updateSuiteChrome()

## Knowledge Gaps
- **57 isolated node(s):** `ICON_PATHS`, `root`, `jumpModuleSel`, `jumpSubmoduleSel`, `searchInput` (+52 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `render()` connect `render` to `app.js`, `refreshReportModal`, `applyImport`, `buildMenuWrap`, `updateActionButtons`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `ICON_PATHS`, `root`, `jumpModuleSel` to the rest of the system?**
  _57 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._
- **Should `Features` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._