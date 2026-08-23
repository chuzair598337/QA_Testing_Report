/* ======================================================================
   This page carries no built-in test cases. Test cases arrive at runtime
   via the Import button (a JSON file matching the schema documented in
   README.md) or, if config.json enables it, via the "Load sample data"
   option shown on the empty state.

   Everything below this point — icons, module/sub-module/test-row
   rendering, filters, jump nav, pinned bar, pin/lock, PDF export, dark
   mode, stats — is the same runtime the QA report template uses; only the
   data-loading layer (Import/Export/config/sample, the empty state, and
   the generalized confirm modal) is new.
   ====================================================================== */

/* Lucide icon paths, inlined (no external icon dependency). */
const ICON_PATHS = {
  ellipsisVertical: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  pinOff: '<path d="M12 17v5"/><path d="M15 9.34V6a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8.32"/><path d="M2 2l20 20"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/><path d="M17 17v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 13 13.86"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  lockOpen: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  notePlus: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4"/><path d="M10 9h4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  fileJson: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
};
function icon(name, cls){
  return `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

/* Escapes user/dev-authored text (module/sub-module titles, test text) before
   it goes into an innerHTML template — imported JSON is not guaranteed to be
   HTML-safe (e.g. test text like "Age < 18 blocks signup" would otherwise be
   parsed as a tag and silently dropped, or worse). */
function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const root = document.getElementById('report-root');
const jumpModuleSel = document.getElementById('jump-module');
const jumpSubmoduleSel = document.getElementById('jump-submodule');
const pinnedBar = document.getElementById('pinned-bar');
const pinnedItems = document.getElementById('pinned-items');
const docTitleEl = document.getElementById('doc-title');
let currentFilter = 'all';
let openMenuKey = null;
let showSample = false;
let suiteLoaded = false;
let docTitle = docTitleEl.textContent;

/* Builds the numbered module/sub-module/test-row structure from a plain
   { title, subModules: [{ title, tests: [{ text, status?, note? }] }] }
   array — the shape carried by an imported JSON file's "modules" key.
   status/note are optional per test (default "pending"/""); every
   module/sub-module starts collapsed, unpinned, unlocked. */
function buildModules(rawModules){
  return (rawModules || []).map((mod, mi) => {
    const modNum = String(mi + 1);
    const sub = (mod.subModules || []).map((sm, si) => {
      const subNum = `${modNum}.${si + 1}`;
      const tests = (sm.tests || []).map((t, ti) => ({
        id: `${subNum}.${ti + 1}`,
        text: t.text,
        status: (t.status === 'pass' || t.status === 'fail') ? t.status : 'pending',
        note: typeof t.note === 'string' ? t.note : ''
      }));
      return { num: subNum, title: sm.title, tests, pinned: false, locked: false, collapsed: true };
    });
    return { num: modNum, title: mod.title, subModules: sub, pinned: false, locked: false, collapsed: true };
  });
}

let modules = buildModules([]);

function allTests(){
  const out = [];
  modules.forEach(m => m.subModules.forEach(sm => sm.tests.forEach(t => out.push(t))));
  return out;
}

function buildJumpNav(){
  jumpModuleSel.innerHTML = '<option value="">Jump to module…</option>';
  modules.forEach(mod => {
    const opt = document.createElement('option');
    opt.value = mod.num;
    opt.textContent = `${mod.num}. ${mod.title}`;
    jumpModuleSel.appendChild(opt);
  });
}

function jumpTo(id){
  // Expand the target (and its parent module, for a sub-module) in the data
  // model first, since render() rebuilds the DOM from that model.
  if (id.startsWith('mod-')){
    const mod = modules.find(m => m.num === id.slice(4));
    if (mod && !mod.locked) mod.collapsed = false;
  } else if (id.startsWith('sub-')){
    const subNum = id.slice(4);
    for (const mod of modules){
      const sm = mod.subModules.find(s => s.num === subNum);
      if (sm){
        if (!mod.locked) mod.collapsed = false;
        if (!sm.locked) sm.collapsed = false;
        break;
      }
    }
  }
  render();
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

jumpModuleSel.addEventListener('change', () => {
  const modNum = jumpModuleSel.value;
  jumpSubmoduleSel.innerHTML = '<option value="">Jump to sub-module…</option>';
  
  if (!modNum){
    jumpSubmoduleSel.style.display = 'none';
    return;
  }

  // Reset filter to 'all' when jump nav is used
  currentFilter = 'all';
  document.querySelectorAll('.stat-tile').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));

  const mod = modules.find(m => m.num === modNum);
  if (mod && mod.subModules.length){
    mod.subModules.forEach(sm => {
      const opt = document.createElement('option');
      opt.value = sm.num;
      opt.textContent = `${sm.num} · ${sm.title}`;
      jumpSubmoduleSel.appendChild(opt);
    });
    jumpSubmoduleSel.style.display = '';
  } else {
    jumpSubmoduleSel.style.display = 'none';
  }
  jumpTo(`mod-${modNum}`);
});

jumpSubmoduleSel.addEventListener('change', () => {
  if (jumpSubmoduleSel.value){
    // Reset filter to 'all' when jump nav is used
    currentFilter = 'all';
    document.querySelectorAll('.stat-tile').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
    jumpTo(`sub-${jumpSubmoduleSel.value}`);
  }
});

function toggleCollapseModule(modNum){
  const mod = modules.find(m => m.num === modNum);
  if (mod && !mod.locked) mod.collapsed = !mod.collapsed;
  render();
}

function toggleCollapseSub(subNum){
  for (const mod of modules){
    const sm = mod.subModules.find(s => s.num === subNum);
    if (sm && !sm.locked){ sm.collapsed = !sm.collapsed; break; }
  }
  render();
}

function togglePinModule(modNum){
  const mod = modules.find(m => m.num === modNum);
  if (mod) mod.pinned = !mod.pinned;
  render();
}

function togglePinSub(subNum){
  for (const mod of modules){
    const sm = mod.subModules.find(s => s.num === subNum);
    if (sm){ sm.pinned = !sm.pinned; break; }
  }
  render();
}

function toggleLockModule(modNum){
  const mod = modules.find(m => m.num === modNum);
  if (mod){
    mod.locked = !mod.locked;
    if (mod.locked) mod.collapsed = true;
  }
  render();
}

function toggleLockSub(subNum){
  for (const mod of modules){
    const sm = mod.subModules.find(s => s.num === subNum);
    if (sm){
      sm.locked = !sm.locked;
      if (sm.locked) sm.collapsed = true;
      break;
    }
  }
  render();
}

function closeAllMenus(){
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('.module.menu-open').forEach(m => m.classList.remove('menu-open'));
  openMenuKey = null;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) closeAllMenus();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllMenus();
});

/* Builds the ellipsis-vertical "more options" button + its Pin/Lock dropdown,
   shared by module headers and sub-module headers. */
function buildMenuWrap(kind, num, pinned, locked, onPin, onLock){
  const key = `${kind}-${num}`;
  const wrap = document.createElement('div');
  wrap.className = 'menu-wrap';

  const btn = document.createElement('button');
  btn.className = 'icon-btn' + ((pinned || locked) ? ' active-state' : '');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.title = 'More options';
  btn.innerHTML = icon('ellipsisVertical');

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';

  const pinItem = document.createElement('button');
  pinItem.type = 'button';
  pinItem.className = 'dropdown-item';
  pinItem.innerHTML = `${icon(pinned ? 'pinOff' : 'pin')}<span>${pinned ? 'Unpin' : 'Pin'}</span>`;
  pinItem.addEventListener('click', (e) => { e.stopPropagation(); closeAllMenus(); onPin(); });

  const lockItem = document.createElement('button');
  lockItem.type = 'button';
  lockItem.className = 'dropdown-item';
  lockItem.innerHTML = `${icon(locked ? 'lockOpen' : 'lock')}<span>${locked ? 'Unlock' : 'Lock'}</span>`;
  lockItem.addEventListener('click', (e) => { e.stopPropagation(); closeAllMenus(); onLock(); });

  menu.appendChild(pinItem);
  menu.appendChild(lockItem);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('open');
    closeAllMenus();
    if (!isOpen){
      menu.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      openMenuKey = key;
      const moduleEl = wrap.closest('.module');
      if (moduleEl) moduleEl.classList.add('menu-open');
    }
  });

  wrap.appendChild(btn);
  wrap.appendChild(menu);
  return wrap;
}

function renderPinnedBar(){
  pinnedItems.innerHTML = '';
  let hasPinned = false;

  modules.forEach(mod => {
    if (mod.pinned){
      hasPinned = true;
      pinnedItems.appendChild(buildPinnedChip(`${mod.num}. ${mod.title}`, `mod-${mod.num}`, () => togglePinModule(mod.num)));
    }
    mod.subModules.forEach(sm => {
      if (sm.pinned){
        hasPinned = true;
        pinnedItems.appendChild(buildPinnedChip(`${sm.num} · ${sm.title}`, `sub-${sm.num}`, () => togglePinSub(sm.num)));
      }
    });
  });

  pinnedBar.style.display = hasPinned ? 'flex' : 'none';
}

function buildPinnedChip(label, targetId, onUnpin){
  const chip = document.createElement('div');
  chip.className = 'pinned-chip';
  const btn = document.createElement('button');
  btn.className = 'pinned-chip-label';
  btn.textContent = label;
  btn.addEventListener('click', () => jumpTo(targetId));
  const unpin = document.createElement('button');
  unpin.className = 'pinned-unpin';
  unpin.title = 'Unpin';
  unpin.innerHTML = icon('x', 'icon-sm');
  unpin.addEventListener('click', onUnpin);
  chip.appendChild(btn);
  chip.appendChild(unpin);
  return chip;
}

function updateSuiteChrome(){
  document.body.classList.toggle('suite-loaded', suiteLoaded);
}

/* Export / Reset only make sense once test cases exist. */
function updateActionButtons(){
  const hasData = allTests().length > 0;
  document.getElementById('export-btn').disabled = !hasData;
  document.getElementById('export-pdf-btn').disabled = !hasData;
  document.getElementById('export-json-btn').disabled = !hasData;
  document.getElementById('export-report-btn').disabled = !hasData;
  document.getElementById('reset-btn').disabled = !hasData;
  if (!hasData) closeExportMenu();
  updateSuiteChrome();
}

const FILTER_LABELS = {
  all: 'All',
  pending: 'Pending',
  pass: 'Passed',
  fail: 'Failed'
};

function buildEmptyState({ variant, iconName, title, hint, actionsHtml }){
  return `
    <div class="empty-state empty-state--${variant}" role="status">
      <div class="empty-icon" aria-hidden="true">${icon(iconName, 'icon-lg')}</div>
      <h2 class="empty-title">${title}</h2>
      <p class="empty-hint">${hint}</p>
      ${actionsHtml ? `<div class="empty-actions">${actionsHtml}</div>` : ''}
    </div>`;
}

function wireEmptyImportActions(){
  const importBtn = document.getElementById('empty-import-btn');
  if (importBtn) importBtn.addEventListener('click', () => document.getElementById('import-btn').click());
  const sampleBtn = document.getElementById('load-sample-btn');
  if (sampleBtn) sampleBtn.addEventListener('click', loadSample);
}

function renderIdleEmpty(){
  const actions = [
    `<button class="btn primary" id="empty-import-btn" type="button">${icon('upload')}<span>Import JSON</span></button>`,
    showSample ? `<button class="btn" id="load-sample-btn" type="button">${icon('download')}<span>Load sample data</span></button>` : ''
  ].filter(Boolean).join('');
  root.innerHTML = buildEmptyState({
    variant: 'idle',
    iconName: 'inbox',
    title: 'No test cases loaded',
    hint: 'Import a test-cases JSON file to begin your QA run. Nothing is stored on the server — everything stays in this browser tab.',
    actionsHtml: actions
  });
  wireEmptyImportActions();
}

function renderEmptySuite(){
  const actions = [
    `<button class="btn primary" id="empty-import-btn" type="button">${icon('upload')}<span>Import another file</span></button>`,
    showSample ? `<button class="btn" id="load-sample-btn" type="button">${icon('download')}<span>Load sample data</span></button>` : ''
  ].filter(Boolean).join('');
  root.innerHTML = buildEmptyState({
    variant: 'empty-suite',
    iconName: 'fileJson',
    title: 'This file has no test cases',
    hint: 'The JSON loaded successfully, but it doesn’t contain any tests yet. Add modules with test cases, or import a different file.',
    actionsHtml: actions
  });
  wireEmptyImportActions();
}

function updateFilterEmptyState(){
  let el = document.getElementById('filter-empty');
  const anyVisible = !!root.querySelector('.module:not(.filtered-out)');
  const show = suiteLoaded && allTests().length > 0 && currentFilter !== 'all' && !anyVisible;

  if (!show){
    if (el){
      el.hidden = true;
      el.innerHTML = '';
    }
    return;
  }

  if (!el){
    el = document.createElement('div');
    el.id = 'filter-empty';
    root.appendChild(el);
  }

  const label = FILTER_LABELS[currentFilter] || currentFilter;
  el.hidden = false;
  el.innerHTML = buildEmptyState({
    variant: 'filter',
    iconName: 'search',
    title: `No ${label.toLowerCase()} cases`,
    hint: `Nothing matches the <strong>${label}</strong> filter right now. Clear the filter to see the full suite, or keep working — matching cases will appear here as statuses change.`,
    actionsHtml: `<button class="btn primary" id="clear-filter-btn" type="button">Show all cases</button>`
  });
  const clearBtn = document.getElementById('clear-filter-btn');
  if (clearBtn){
    clearBtn.addEventListener('click', () => {
      currentFilter = 'all';
      document.querySelectorAll('.stat-tile').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
      applyFilter();
    });
  }
}

function render(){
  updateActionButtons();
  closeMobileNav();
  root.innerHTML = '';
  buildJumpNav();

  if (!suiteLoaded){
    renderIdleEmpty();
    renderPinnedBar();
    updateStats();
    return;
  }

  if (allTests().length === 0){
    renderEmptySuite();
    renderPinnedBar();
    updateStats();
    return;
  }

  modules.forEach(mod => {    const modEl = document.createElement('section');
    modEl.className = 'module' + (mod.collapsed ? ' collapsed' : '');
    modEl.id = `mod-${mod.num}`;

    const head = document.createElement('div');
    head.className = 'module-head';

    const headLeft = document.createElement('div');
    headLeft.className = 'module-head-left';
    headLeft.innerHTML = `
      <span class="chevron-icon">${icon('chevronDown')}</span>
      <span class="module-num">${mod.num}.</span>
      <span class="module-title">${escapeHtml(mod.title)}</span>
      ${mod.locked ? `<span class="lock-badge" title="Locked">${icon('lock', 'icon-sm')}</span>` : ''}
    `;

    const headMeta = document.createElement('div');
    headMeta.className = 'module-meta';
    headMeta.appendChild(buildMenuWrap('mod', mod.num, mod.pinned, mod.locked,
      () => togglePinModule(mod.num), () => toggleLockModule(mod.num)));

    const headProgress = document.createElement('div');
    headProgress.className = 'module-head-progress';
    headProgress.innerHTML = `
      <div class="mini-bar" data-mod-bar="${mod.num}">
        <div class="progress-seg pass" style="width:0%"></div>
        <div class="progress-seg fail" style="width:0%"></div>
      </div>
      <span class="module-count" data-mod-count="${mod.num}"></span>
    `;

    head.appendChild(headLeft);
    head.appendChild(headMeta);
    head.appendChild(headProgress);
    head.addEventListener('click', () => toggleCollapseModule(mod.num));
    modEl.appendChild(head);

    const body = document.createElement('div');
    body.className = 'module-body';

    mod.subModules.forEach(sm => {
      const smEl = document.createElement('div');
      smEl.className = 'submodule' + (sm.collapsed ? ' collapsed' : '');
      smEl.id = `sub-${sm.num}`;
      smEl.dataset.subId = sm.num;

      const smTitle = document.createElement('div');
      smTitle.className = 'submodule-title';

      const smHeadLeft = document.createElement('div');
      smHeadLeft.className = 'submodule-head-left';
      smHeadLeft.innerHTML = `
        <span class="chevron-icon">${icon('chevronDown')}</span>
        <span class="sub-num">${sm.num}.</span>
        <span class="sub-title-text">${escapeHtml(sm.title)}</span>
        ${sm.locked ? `<span class="lock-badge" title="Locked">${icon('lock', 'icon-sm')}</span>` : ''}
      `;

      const smMeta = document.createElement('div');
      smMeta.className = 'submodule-meta';
      smMeta.appendChild(buildMenuWrap('sub', sm.num, sm.pinned, sm.locked,
        () => togglePinSub(sm.num), () => toggleLockSub(sm.num)));

      const smProgress = document.createElement('div');
      smProgress.className = 'submodule-head-progress';
      smProgress.innerHTML = `
        <div class="mini-bar" data-sub-bar="${sm.num}">
          <div class="progress-seg pass" style="width:0%"></div>
          <div class="progress-seg fail" style="width:0%"></div>
        </div>
        <span class="sub-count" data-sub-count="${sm.num}"></span>
      `;

      smTitle.appendChild(smHeadLeft);
      smTitle.appendChild(smMeta);
      smTitle.appendChild(smProgress);
      smTitle.addEventListener('click', () => toggleCollapseSub(sm.num));
      smEl.appendChild(smTitle);

      const smBody = document.createElement('div');
      smBody.className = 'submodule-body';
      const locked = mod.locked || sm.locked;
      sm.tests.forEach(t => smBody.appendChild(renderTestRow(t, locked)));
      smEl.appendChild(smBody);

      body.appendChild(smEl);
    });

    modEl.appendChild(body);
    root.appendChild(modEl);
  });

  renderPinnedBar();
  updateStats();
}

function renderTestRow(t, locked){
  const row = document.createElement('div');
  row.className = 'test-row' + (locked ? ' locked' : '');
  row.dataset.status = t.status;
  row.dataset.testId = t.id;

  const main = document.createElement('div');
  main.className = 'test-main';
  main.innerHTML = `
    <span class="status-dot ${t.status}"></span>
    <span class="test-id">${t.id}.</span>
    <span class="test-text">${escapeHtml(t.text)}</span>
    <div class="test-controls">
      <span class="status-select-wrap" data-val="${t.status}">
        <select class="status-select" data-val="${t.status}" ${locked ? 'disabled' : ''}>
          <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="pass" ${t.status === 'pass' ? 'selected' : ''}>Pass</option>
          <option value="fail" ${t.status === 'fail' ? 'selected' : ''}>Fail</option>
        </select>
      </span>
      <button type="button" class="note-toggle ${t.note.trim() ? 'has-note' : ''}" ${locked ? 'disabled' : ''}>${icon('notePlus', 'icon-sm')}<span>Note</span></button>
    </div>`;
  row.appendChild(main);

  const noteBox = document.createElement('div');
  noteBox.className = 'note-box';
  noteBox.innerHTML = `
    <textarea placeholder="Optional note — reproduction steps, screenshot ref, ticket link…" ${locked ? 'disabled' : ''}></textarea>`;
  row.appendChild(noteBox);

  const textarea = noteBox.querySelector('textarea');
  textarea.value = t.note;
  const noteToggle = main.querySelector('.note-toggle');
  const select = main.querySelector('.status-select');
  const selectWrap = main.querySelector('.status-select-wrap');
  const dot = main.querySelector('.status-dot');

  select.addEventListener('change', () => {
    t.status = select.value;
    row.dataset.status = t.status;
    select.dataset.val = t.status;
    selectWrap.dataset.val = t.status;
    dot.className = 'status-dot ' + t.status;
    updateStats();
  });

  noteToggle.addEventListener('click', () => {
    noteBox.classList.toggle('open');
  });

  textarea.addEventListener('input', () => {
    t.note = textarea.value;
    noteToggle.classList.toggle('has-note', t.note.trim().length > 0);
  });

  return row;
}

function updateStats(){
  const tests = allTests();
  const total = tests.length;
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  const pending = tests.filter(t => t.status === 'pending').length;
  const tested = passed + failed;
  const pct = total ? Math.round((tested / total) * 100) : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-passed').textContent = passed;
  document.getElementById('stat-failed').textContent = failed;
  document.getElementById('stat-pending').textContent = pending;

  const fillEl = document.getElementById('progress-fill');
  const labelEl = document.getElementById('progress-label');
  const trackEl = document.getElementById('progress-track');
  fillEl.style.width = pct + '%';
  labelEl.textContent = pct + '% completed';
  trackEl.setAttribute('aria-valuenow', String(pct));
  // Label sits centered; once the fill covers most of the bar, switch to
  // high-contrast text so it stays readable on the primary/accent fill.
  trackEl.dataset.contrast = pct >= 42 ? 'on-fill' : 'on-track';

  // per-module and per-sub-module mini stats
  modules.forEach(mod => {
    const mTests = mod.subModules.flatMap(sm => sm.tests);
    const mTotal = mTests.length;
    const mPass = mTests.filter(t => t.status === 'pass').length;
    const mFail = mTests.filter(t => t.status === 'fail').length;
    const countEl = document.querySelector(`[data-mod-count="${mod.num}"]`);
    if (countEl) countEl.textContent = `${mPass + mFail}/${mTotal}`;
    const barEl = document.querySelector(`[data-mod-bar="${mod.num}"]`);
    if (barEl){
      barEl.children[0].style.width = (mTotal ? (mPass/mTotal*100) : 0) + '%';
      barEl.children[1].style.width = (mTotal ? (mFail/mTotal*100) : 0) + '%';
    }

    mod.subModules.forEach(sm => {
      const sTotal = sm.tests.length;
      const sPass = sm.tests.filter(t => t.status === 'pass').length;
      const sFail = sm.tests.filter(t => t.status === 'fail').length;
      const sCountEl = document.querySelector(`[data-sub-count="${sm.num}"]`);
      if (sCountEl) sCountEl.textContent = `${sPass + sFail}/${sTotal}`;
      const sBarEl = document.querySelector(`[data-sub-bar="${sm.num}"]`);
      if (sBarEl){
        sBarEl.children[0].style.width = (sTotal ? (sPass/sTotal*100) : 0) + '%';
        sBarEl.children[1].style.width = (sTotal ? (sFail/sTotal*100) : 0) + '%';
      }
    });
  });

  applyFilter();
}

function applyFilter(){
  document.querySelectorAll('.test-row').forEach(row => {
    const show = currentFilter === 'all' || row.dataset.status === currentFilter;
    row.classList.toggle('filtered-out', !show);
  });

  // Hide sub-module blocks that have no visible test rows left. While a
  // status filter is active, auto-expand sub-modules with visible matches
  // (otherwise the default-collapsed state would hide everything the filter
  // is meant to surface); restore the saved collapsed state once back to "All".
  document.querySelectorAll('.submodule').forEach(smEl => {
    const hasVisible = !!smEl.querySelector('.test-row:not(.filtered-out)');
    smEl.classList.toggle('filtered-out', !hasVisible);

    const subNum = smEl.dataset.subId;
    const parentMod = modules.find(m => m.subModules.some(s => s.num === subNum));
    const sm = parentMod && parentMod.subModules.find(s => s.num === subNum);

    if (currentFilter !== 'all'){
      if (hasVisible && sm && !sm.locked) smEl.classList.remove('collapsed');
    } else {
      smEl.classList.toggle('collapsed', !!(sm && sm.collapsed));
    }
  });

  // Hide whole modules that have no visible sub-modules left; same
  // auto-expand / restore behavior as sub-modules above.
  document.querySelectorAll('.module').forEach(modEl => {
    const hasVisible = !!modEl.querySelector('.submodule:not(.filtered-out)');
    modEl.classList.toggle('filtered-out', !hasVisible);

    const modNum = modEl.id.replace('mod-', '');
    const mod = modules.find(m => m.num === modNum);
    if (currentFilter !== 'all'){
      if (hasVisible && mod && !mod.locked) modEl.classList.remove('collapsed');
    } else {
      modEl.classList.toggle('collapsed', !!(mod && mod.collapsed));
    }
  });
  updateFilterEmptyState();
}

// KPI card click handlers for filtering
document.querySelectorAll('.stat-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    const filter = tile.dataset.filter;
    if (filter){
      currentFilter = filter;
      // Reset jump nav when filter is applied
      jumpModuleSel.value = '';
      jumpSubmoduleSel.value = '';
      jumpSubmoduleSel.style.display = 'none';
      // Update active state on KPI cards
      document.querySelectorAll('.stat-tile').forEach(t => t.classList.toggle('active', t === tile));
      applyFilter();
    }
  });
});

/* ---------- Export menu: Download PDF | Download JSON ---------- */
const exportBtn = document.getElementById('export-btn');
const exportMenu = document.getElementById('export-menu');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const exportReportBtn = document.getElementById('export-report-btn');

function closeExportMenu(){
  exportMenu.classList.remove('open');
  exportBtn.setAttribute('aria-expanded', 'false');
}
function openExportMenu(){
  closeAllMenus();
  exportMenu.classList.add('open');
  exportBtn.setAttribute('aria-expanded', 'true');
}

exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (exportBtn.disabled) return;
  if (exportMenu.classList.contains('open')) closeExportMenu();
  else openExportMenu();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.export-wrap')) closeExportMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeExportMenu();
});

/* ---------- Mobile hamburger nav ---------- */
const headChrome = document.querySelector('.head-chrome');
const headActions = document.getElementById('head-actions');
const navToggle = document.getElementById('nav-toggle');
const NAV_ICON_OPEN = '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>';
const NAV_ICON_CLOSE = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';

function setMobileNavOpen(open){
  if (!headActions || !navToggle) return;
  headActions.classList.toggle('is-open', open);
  if (headChrome) headChrome.classList.toggle('nav-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  const icon = navToggle.querySelector('.nav-toggle-icon');
  if (icon) icon.innerHTML = open ? NAV_ICON_CLOSE : NAV_ICON_OPEN;
  if (!open) closeExportMenu();
}
function closeMobileNav(){ setMobileNavOpen(false); }
function toggleMobileNav(){ setMobileNavOpen(!headActions.classList.contains('is-open')); }

navToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMobileNav();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.head-chrome')) closeMobileNav();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileNav();
});
document.getElementById('theme-toggle').addEventListener('click', () => {
  if (window.matchMedia('(max-width:900px)').matches) closeMobileNav();
});
document.getElementById('import-btn').addEventListener('click', () => closeMobileNav());
document.getElementById('reset-btn').addEventListener('click', () => closeMobileNav());
exportPdfBtn.addEventListener('click', () => closeMobileNav());
exportJsonBtn.addEventListener('click', () => closeMobileNav());
exportReportBtn.addEventListener('click', () => closeMobileNav());

function downloadJson(){
  const payload = {
    docTitle: docTitle,
    modules: modules.map(mod => ({
      title: mod.title,
      subModules: mod.subModules.map(sm => ({
        title: sm.title,
        tests: sm.tests.map(t => ({ text: t.text, status: t.status, note: t.note }))
      }))
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qa-test-results-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadPdf(){
  const originalLabel = exportPdfBtn.querySelector('span').textContent;
  exportPdfBtn.disabled = true;
  exportJsonBtn.disabled = true;
  exportReportBtn.disabled = true;
  exportBtn.disabled = true;
  exportPdfBtn.querySelector('span').textContent = 'Generating…';
  closeExportMenu();

  document.querySelectorAll('.module.collapsed').forEach(m => m.classList.add('was-collapsed'));
  document.querySelectorAll('.submodule.collapsed').forEach(m => m.classList.add('was-collapsed-sub'));
  document.body.classList.add('generating-pdf');

  const opt = {
    margin:       [10, 10, 12, 10],
    filename:     `qa-test-report-${new Date().toISOString().slice(0,10)}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['css', 'legacy'] }
  };

  const restore = () => {
    document.body.classList.remove('generating-pdf');
    document.querySelectorAll('.was-collapsed').forEach(m => { m.classList.add('collapsed'); m.classList.remove('was-collapsed'); });
    document.querySelectorAll('.was-collapsed-sub').forEach(m => { m.classList.add('collapsed'); m.classList.remove('was-collapsed-sub'); });
    exportPdfBtn.querySelector('span').textContent = originalLabel;
    updateActionButtons();
  };

  html2pdf().set(opt).from(document.body).save().then(restore).catch(() => {
    restore();
    alert('PDF generation failed. Please try again.');
  });
}

exportPdfBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (exportPdfBtn.disabled) return;
  downloadPdf();
});
exportJsonBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (exportJsonBtn.disabled) return;
  closeExportMenu();
  downloadJson();
});
exportReportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (exportReportBtn.disabled) return;
  closeExportMenu();
  openReportModal();
});

/* ---------- Toast notification ---------- */
const toast = document.getElementById('toast');
let toastTimeout = null;

function showToast(message, duration = 3000){
  toast.textContent = message;
  toast.classList.add('show');
  
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/* ---------- Generate report modal (passed + failed with notes) ---------- */
const reportModal = document.getElementById('report-modal');
const reportModalBody = document.getElementById('report-modal-body');
const reportCopyBtn = document.getElementById('report-copy-btn');
const reportCopyLabel = document.getElementById('report-copy-label');
const reportDownloadBtn = document.getElementById('report-download-btn');
let latestReportMarkdown = '';
let latestReportPlainText = '';
let latestReportClipboardHtml = '';

function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Which "Included test cases" checkboxes are on — set from the report
   settings panel (cog button in the report modal header). "all" and the
   three specific filters are mutually exclusive as a group: checking "all"
   clears the other three and vice versa (see the checkbox wiring below).
   Kept as in-memory session state, same as filters/pinned/locked elsewhere
   in the app — persists across repeat "Generate report" opens, not across
   page reloads. */
let reportSettings = { all: true, passed: false, passedWithNote: false, failedOnly: false };

function testMatchesReportSettings(t, settings){
  const s = settings || reportSettings;
  if (t.status !== 'pass' && t.status !== 'fail') return false; // pending never included
  if (s.all) return true;
  if (!s.passed && !s.passedWithNote && !s.failedOnly) return true; // nothing checked — same as "all"

  const hasNote = !!(t.note && t.note.trim());
  if (s.passed && t.status === 'pass' && !hasNote) return true;
  if (s.passedWithNote && t.status === 'pass' && hasNote) return true;
  if (s.failedOnly && t.status === 'fail') return true;
  return false;
}

function collectReportCases(settings){
  // Preserve JSON order: module → sub-module → tests; filtered by the
  // Included Test Cases report setting (defaults to all pass/fail cases).
  const sections = [];
  let passed = 0;
  let failed = 0;

  modules.forEach(mod => {
    const subSections = [];
    mod.subModules.forEach(sm => {
      const cases = sm.tests.filter(t => testMatchesReportSettings(t, settings));
      if (!cases.length) return;
      cases.forEach(t => {
        if (t.status === 'pass') passed += 1;
        else failed += 1;
      });
      subSections.push({ num: sm.num, title: sm.title, cases });
    });
    if (subSections.length){
      sections.push({ num: mod.num, title: mod.title, subModules: subSections });
    }
  });

  return { sections, passed, failed, total: passed + failed };
}

/* Escapes Teams' typed-markdown emphasis/code markers inside dev/QA-authored
   text (titles, test text, notes) so a stray "*", "_", "~", or "`" in a test
   case doesn't accidentally toggle bold/italic/strikethrough/code once pasted
   into a Teams chat. Structural markers (#, >, list numbers) aren't escaped
   here since this text is always inserted mid-line, never at line start. */
function escapeTeamsMarkdown(str){
  return String(str).replace(/([*_~`\\])/g, '\\$1');
}

/* Builds the report as Microsoft Teams' subset markdown (# / ## / ### headings,
   **bold**, > blockquote) — see README for the supported-syntax reference.
   This is what Download saves as a .md file: a real markdown file, opened by
   markdown-aware tools (VS Code, GitHub, Obsidian, ...) that actually parse
   this syntax. It is NOT used for the clipboard anymore — Teams' typed-
   markdown only converts syntax as you type it, so pasting this text in
   verbatim just inserts the literal '#'/'**'/'>' characters (confirmed:
   whenever the rich text/html clipboard write isn't available and this was
   used as the plain-text fallback, that's exactly what showed up pasted into
   Teams). buildReportPlainText() below is the clipboard's plain-text form. */
function buildReportMarkdown(data){
  const generatedAt = new Date().toLocaleString();
  const lines = [];
  lines.push(`# ${escapeTeamsMarkdown(docTitle)}`);
  lines.push('');
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push(`**Summary:** ${data.passed} passed, ${data.failed} failed (${data.total} included; pending omitted)`);
  lines.push('');

  if (!data.total){
    lines.push('No passed or failed cases yet.');
    return lines.join('\n');
  }

  data.sections.forEach(mod => {
    lines.push(`## ${mod.num}. ${escapeTeamsMarkdown(mod.title)}`);
    lines.push('');
    mod.subModules.forEach(sm => {
      lines.push(`### ${sm.num}. ${escapeTeamsMarkdown(sm.title)}`);
      lines.push('');
      sm.cases.forEach(t => {
        const status = t.status === 'pass' ? 'Passed' : 'Failed';
        // No markdown list marker here — t.id is already the full compound
        // number (module.sub.case), so a "1." list prefix in front of it
        // would just double up with it once rendered (# 1.1.1 → "1. 1.1.1").
        lines.push(`${t.id} **[${status}]** — ${escapeTeamsMarkdown(t.text)}`);
        if (t.note && t.note.trim()){
          t.note.trim().split(/\n/).forEach((noteLine, ni) => {
            const text = escapeTeamsMarkdown(noteLine);
            lines.push(ni === 0 ? `> Note: ${text}` : `> ${text}`);
          });
        }
      });
      lines.push('');
    });
  });

  return lines.join('\n').trim() + '\n';
}

/* Builds the report as clean plain text — no markdown syntax characters at
   all, since nothing pastes this through a markdown parser (see the note on
   buildReportMarkdown() above). This is the text/plain half of the rich
   clipboard write, and the whole payload on the older-browser fallback path
   (navigator.clipboard.writeText / execCommand('copy')) — so it needs to
   read fine entirely on its own, unformatted. Only one blank line between
   modules; everything inside a module (sub-module heading, case lines,
   notes) stays tight, one line each, to avoid the oversized gaps a blank
   line per line-group produces once Teams turns each into its own
   paragraph. */
function buildReportPlainText(data){
  const generatedAt = new Date().toLocaleString();
  const lines = [];
  lines.push(docTitle);
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Summary: ${data.passed} passed, ${data.failed} failed (${data.total} included; pending omitted)`);

  if (!data.total){
    lines.push('');
    lines.push('No passed or failed cases yet.');
    return lines.join('\n');
  }

  data.sections.forEach(mod => {
    lines.push('');
    lines.push(`${mod.num}. ${mod.title}`);
    mod.subModules.forEach(sm => {
      lines.push(`${sm.num}. ${sm.title}`);
      sm.cases.forEach(t => {
        const status = t.status === 'pass' ? 'Passed' : 'Failed';
        lines.push(`${t.id} [${status}] — ${t.text}`);
        if (t.note && t.note.trim()){
          t.note.trim().split(/\n/).forEach(noteLine => {
            lines.push(`Note: ${noteLine}`);
          });
        }
      });
    });
  });

  return lines.join('\n').trim() + '\n';
}

/* Builds the report as a plain semantic HTML fragment (real <h1>/<h2>/<h3>,
   <strong>, <p>, <blockquote> — no CSS classes/styling, no <ol>/<li>) for the
   text/html clipboard entry. Teams' compose box (like Word/Outlook/Slack) is
   a rich-text editor: pasting HTML renders it as formatted rich text, while
   pasting plain markdown syntax just inserts the literal characters. This is
   what actually makes a pasted chat message look like a formatted report —
   buildReportMarkdown() above only supplies the text/plain fallback + the
   .md download. Kept deliberately unstyled (no class names, no <div>s) so
   Teams' paste sanitizer has nothing to strip and nothing surprising bleeds
   into the chat's own styling.

   Test cases are plain <p> lines, not an <ol> list: nested lists don't chain
   into compound "1.1.1"-style numbering in any rich-text editor (each level
   just restarts its own counter), and we already have the full compound
   number as text (t.id) — an auto-numbered <li> on top of that would double
   up ("1. 1.1.1 ..."), which is what the previous version did. */
function buildReportClipboardHtml(data){
  if (!data.total){
    return `<p><strong>No passed or failed cases yet.</strong></p>`;
  }

  const generatedAt = new Date().toLocaleString();
  let html = `<h1>${escapeHtml(docTitle)}</h1>`;
  html += `<p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>`;
  html += `<p><strong>Summary:</strong> ${data.passed} passed, ${data.failed} failed (${data.total} included; pending omitted)</p>`;

  data.sections.forEach(mod => {
    html += `<h2>${escapeHtml(mod.num)}. ${escapeHtml(mod.title)}</h2>`;
    mod.subModules.forEach(sm => {
      html += `<h3>${escapeHtml(sm.num)}. ${escapeHtml(sm.title)}</h3>`;
      sm.cases.forEach(t => {
        const status = t.status === 'pass' ? 'Passed' : 'Failed';
        const note = (t.note || '').trim();
        html += `<p>${escapeHtml(t.id)} <strong>[${escapeHtml(status)}]</strong> — ${escapeHtml(t.text)}</p>`;
        if (note){
          const noteHtml = note.split(/\n/).map(line => escapeHtml(line)).join('<br>');
          html += `<blockquote>Note: ${noteHtml}</blockquote>`;
        }
      });
    });
  });

  return html;
}

function buildReportHtml(data){
  if (!data.total){
    return `<div class="report-empty"><strong>No passed or failed cases yet</strong>Mark cases as Pass or Fail to include them in this report. Pending cases are omitted.</div>`;
  }

  const generatedAt = new Date().toLocaleString();
  let html = `<article class="report-doc">
    <header class="report-doc-header">
      <p class="report-doc-kicker">QA Test Report</p>
      <h1 class="report-doc-title">${escapeHtml(docTitle)}</h1>
      <p class="report-doc-meta">Generated: ${escapeHtml(generatedAt)}</p>
      <p class="report-doc-meta">Summary: ${data.passed} passed, ${data.failed} failed (${data.total} included; pending omitted)</p>
    </header>`;

  data.sections.forEach(mod => {
    html += `<section class="report-module">
      <h2 class="report-module-title">${escapeHtml(mod.num)}. ${escapeHtml(mod.title)}</h2>`;
    mod.subModules.forEach(sm => {
      html += `<div class="report-submodule">
        <h3 class="report-submodule-title">${escapeHtml(sm.num)} ${escapeHtml(sm.title)}</h3>
        <ol class="report-case-list">`;
      sm.cases.forEach(t => {
        const statusLabel = t.status === 'pass' ? 'Passed' : 'Failed';
        const note = (t.note || '').trim();
        html += `<li class="report-case-item">
          <p class="report-case-line"><span class="report-case-status-text">[${escapeHtml(statusLabel)}]</span> ${escapeHtml(t.id)} — ${escapeHtml(t.text)}</p>
          ${note ? `<ul class="report-note-list"><li><span class="report-note-label">Note:</span> ${escapeHtml(note)}</li></ul>` : ''}
        </li>`;
      });
      html += `</ol></div>`;
    });
    html += `</section>`;
  });

  html += `</article>`;
  return html;
}

/* Recomputes the filtered case list from the current reportSettings and
   rebuilds everything the modal shows/exports from it — called on open and
   again every time a report-setting checkbox changes, without re-checking
   the "does the suite have anything at all" gate below (the modal is
   already open at that point). */
function refreshReportModal(){
  const data = collectReportCases();
  latestReportMarkdown = buildReportMarkdown(data);
  latestReportPlainText = buildReportPlainText(data);
  latestReportClipboardHtml = buildReportClipboardHtml(data);
  reportModalBody.innerHTML = buildReportHtml(data);
  reportCopyLabel.textContent = 'Copy to clipboard';
  reportCopyBtn.disabled = !data.total;
  reportDownloadBtn.disabled = !data.total;
}

function openReportModal(){
  // Gate on the suite as a whole, ignoring the remembered report-setting
  // filter — "nothing to report" should mean the suite truly has no
  // passed/failed cases, not just none matching a leftover filter (that
  // case opens the modal and shows its own "no cases match" message with
  // the settings panel right there to fix it).
  const anyCases = collectReportCases({ all: true, passed: false, passedWithNote: false, failedOnly: false });
  if (anyCases.total === 0){
    showToast('No passed or failed tests yet. Mark tests as Pass or Fail to generate a report.');
    return;
  }

  refreshReportModal();
  reportModal.classList.add('open');
  reportModal.setAttribute('aria-hidden', 'false');
  document.getElementById('report-modal-close').focus();
}

function closeReportModal(){
  reportModal.classList.remove('open');
  reportModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('report-modal-close').addEventListener('click', closeReportModal);
reportModal.addEventListener('click', (e) => {
  if (e.target === reportModal) closeReportModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && reportModal.classList.contains('open')) closeReportModal();
});

/* ---------- Report settings (cog button — Included Test Cases filter) ---------- */
const reportSettingsBtn = document.getElementById('report-settings-btn');
const reportSettingsPanel = document.getElementById('report-settings-panel');
const reportSettingAll = document.getElementById('report-setting-all');
const reportSettingPassed = document.getElementById('report-setting-passed');
const reportSettingPassedNote = document.getElementById('report-setting-passed-note');
const reportSettingFailed = document.getElementById('report-setting-failed');

reportSettingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = reportSettingsPanel.classList.contains('open');
  closeAllMenus();
  if (!isOpen){
    reportSettingsPanel.classList.add('open');
    reportSettingsBtn.setAttribute('aria-expanded', 'true');
  }
});

// "All" and the three specific filters are one mutually-exclusive group:
// checking "all" clears the other three; checking any of the other three
// clears "all"; unchecking the last-checked specific filter falls back to
// "all" rather than leaving nothing selected (checkboxes stay in sync with
// reportSettings either way). The panel deliberately does NOT close on
// checkbox change — unlike the Pin/Lock dropdown items — so multiple boxes
// can be checked in one go; it closes via the cog button, outside click, or
// Escape (the existing menu-wrap/closeAllMenus machinery, reused as-is).
function syncReportSettingCheckboxes(){
  reportSettingAll.checked = reportSettings.all;
  reportSettingPassed.checked = reportSettings.passed;
  reportSettingPassedNote.checked = reportSettings.passedWithNote;
  reportSettingFailed.checked = reportSettings.failedOnly;
}

reportSettingAll.addEventListener('change', () => {
  reportSettings = { all: true, passed: false, passedWithNote: false, failedOnly: false };
  syncReportSettingCheckboxes();
  refreshReportModal();
});

function onSpecificReportSettingChange(key, checkbox){
  reportSettings.all = false;
  reportSettings[key] = checkbox.checked;
  if (!reportSettings.passed && !reportSettings.passedWithNote && !reportSettings.failedOnly){
    reportSettings = { all: true, passed: false, passedWithNote: false, failedOnly: false };
  }
  syncReportSettingCheckboxes();
  refreshReportModal();
}

reportSettingPassed.addEventListener('change', () => onSpecificReportSettingChange('passed', reportSettingPassed));
reportSettingPassedNote.addEventListener('change', () => onSpecificReportSettingChange('passedWithNote', reportSettingPassedNote));
reportSettingFailed.addEventListener('change', () => onSpecificReportSettingChange('failedOnly', reportSettingFailed));

function markCopied(){
  reportCopyLabel.textContent = 'Copied!';
  setTimeout(() => { reportCopyLabel.textContent = 'Copy to clipboard'; }, 1600);
}

reportCopyBtn.addEventListener('click', async () => {
  if (!latestReportMarkdown) return;

  // Preferred: write both text/html (rich — renders formatted on paste into
  // Teams/Word/Outlook/Slack) and text/plain (clean unformatted text — for
  // paste targets that don't accept rich HTML, and for whichever of the two
  // Teams itself prefers). Requires the async Clipboard API + ClipboardItem,
  // which isn't available/allowed in every browser (older/mobile browsers,
  // some non-Chromium engines) — when it throws, fall through below.
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write){
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([latestReportClipboardHtml], { type: 'text/html' }),
        'text/plain': new Blob([latestReportPlainText], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      markCopied();
      return;
    } catch (err) {
      // Fall through to the plain-text paths below.
    }
  }

  try {
    await navigator.clipboard.writeText(latestReportPlainText);
    markCopied();
  } catch (err) {
    // Fallback for older mobile browsers
    const ta = document.createElement('textarea');
    ta.value = latestReportPlainText;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      markCopied();
    } catch (e2) {
      alert('Could not copy to clipboard.');
    }
    document.body.removeChild(ta);
  }
});

reportDownloadBtn.addEventListener('click', () => {
  if (!latestReportMarkdown) return;
  const blob = new Blob([latestReportMarkdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qa-test-report-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ---------- Generic confirm modal — shared by Reset, Import, Load sample ---------- */
const confirmModal = document.getElementById('confirm-modal');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmMessageEl = document.getElementById('confirm-message');
let confirmCallback = null;

function confirmModalOpen(title, message, onYes){
  confirmTitleEl.textContent = title;
  confirmMessageEl.textContent = message;
  confirmCallback = onYes;
  confirmModal.classList.add('open');
}
function confirmModalClose(){
  confirmModal.classList.remove('open');
  confirmCallback = null;
}
document.getElementById('confirm-no').addEventListener('click', confirmModalClose);
document.getElementById('confirm-yes').addEventListener('click', () => {
  const cb = confirmCallback;
  confirmModalClose();
  if (cb) cb();
});
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) confirmModalClose();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmModal.classList.contains('open')) confirmModalClose();
});

/* Reset all — with confirmation */
document.getElementById('reset-btn').addEventListener('click', () => {
  confirmModalOpen(
    'Reset all test cases?',
    "This sets every test back to Pending and clears all notes. This can't be undone.",
    () => {
      allTests().forEach(t => { t.status = 'pending'; t.note = ''; });
      render();
    }
  );
});

/* ---------- Import ---------- */
const importInput = document.getElementById('import-input');
document.getElementById('import-btn').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
  const file = importInput.files[0];
  importInput.value = ''; // allow re-selecting the same file later
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try { parsed = JSON.parse(reader.result); }
    catch (e){ alert('Import failed: the file is not valid JSON.'); return; }
    applyImport(parsed);
  };
  reader.onerror = () => alert('Import failed: could not read the file.');
  reader.readAsText(file);
});

function validateImportShape(parsed){
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.modules)){
    return 'Missing a "modules" array at the top level.';
  }
  for (const m of parsed.modules){
    if (!m || typeof m.title !== 'string' || !Array.isArray(m.subModules)){
      return 'Each module needs a "title" string and a "subModules" array.';
    }
    for (const sm of m.subModules){
      if (!sm || typeof sm.title !== 'string' || !Array.isArray(sm.tests)){
        return 'Each sub-module needs a "title" string and a "tests" array.';
      }
      for (const t of sm.tests){
        if (!t || typeof t.text !== 'string'){
          return 'Each test needs a "text" string.';
        }
      }
    }
  }
  return null;
}

function applyImport(parsed){
  const err = validateImportShape(parsed);
  if (err){ alert('Import failed: ' + err); return; }

  const doImport = () => {
    if (typeof parsed.docTitle === 'string' && parsed.docTitle.trim()){
      docTitle = parsed.docTitle;
      docTitleEl.textContent = docTitle;
    }
    modules = buildModules(parsed.modules);
    suiteLoaded = true;
    currentFilter = 'all';
    document.querySelectorAll('.stat-tile').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
    render();
  };

  if (allTests().length > 0){
    confirmModalOpen(
      'Import test cases?',
      "This replaces all currently loaded test cases and progress. This can't be undone.",
      doImport
    );
  } else {
    doImport();
  }
}

/* ---------- Sample data (only offered when config.json enables it) ---------- */
function loadSample(){
  fetch('sample.json', { cache: 'no-store' })
    .then(res => { if (!res.ok) throw new Error('sample.json not found'); return res.json(); })
    .then(applyImport)
    .catch(() => alert('Could not load sample.json.'));
}

/* Warn before closing/reloading the tab while a suite is loaded — there is no
   persistence layer by design (see README), so this is the only guard
   against losing in-progress work before Export. */
window.addEventListener('beforeunload', (e) => {
  if (suiteLoaded){
    e.preventDefault();
    e.returnValue = '';
  }
});

render();

// Set initial active state for Total KPI card
document.querySelectorAll('.stat-tile').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));

fetch('config.json', { cache: 'no-store' })
  .then(res => (res.ok ? res.json() : {}))
  .then(cfg => { showSample = !!(cfg && cfg.showSample); })
  .catch(() => { showSample = false; })
  .finally(() => { render(); });
