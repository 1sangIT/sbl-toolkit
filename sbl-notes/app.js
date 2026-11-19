const KEYS = {
  URL: 'sbl_mob_gas_url',
  SECRET: 'sbl_mob_api_secret',
  CACHE: 'sbl_mob_cached_tree'
};

const FILE_TYPE_META = {
  doc: { label: '문서', badgeClass: 'badge-doc' },
  sheet: { label: '시트', badgeClass: 'badge-sheet' },
  slide: { label: '슬라이드', badgeClass: 'badge-slide' },
  pdf: { label: 'PDF', badgeClass: 'badge-pdf' },
  image: { label: '이미지', badgeClass: 'badge-image' },
  text: { label: '텍스트', badgeClass: 'badge-text' }
};

const state = {
  gasUrl: localStorage.getItem(KEYS.URL) || '',
  apiSecret: localStorage.getItem(KEYS.SECRET) || '',
  root: null,
  allDocs: [],
  folderIndex: {},
  pinnedIds: new Set(),
  selectedFolderId: '__ALL__',
  typeFilter: 'all',
  searchQuery: '',
  remoteSearchDocs: null,
  docsCollapsed: false
};

const els = {
  setupView: document.getElementById('setupView'),
  mainView: document.getElementById('mainView'),
  btnMobileBack: document.getElementById('btnMobileBack'),
  brandDot: document.getElementById('brandDot'),
  headerTitle: document.getElementById('headerTitle'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnSettings: document.getElementById('btnSettings'),
  btnOpenSettingsFromSetup: document.getElementById('btnOpenSettingsFromSetup'),
  btnNewDoc: document.getElementById('btnNewDoc'),
  btnNewRootFolder: document.getElementById('btnNewRootFolder'),
  searchInput: document.getElementById('searchInput'),
  loadingBar: document.getElementById('loadingBar'),
  workspace: document.getElementById('workspace'),
  paneDocs: document.getElementById('paneDocs'),
  btnCollapseDocs: document.getElementById('btnCollapseDocs'),
  railDocs: document.getElementById('railDocs'),
  treeContainer: document.getElementById('treeContainer'),
  docListTitle: document.getElementById('docListTitle'),
  docListCount: document.getElementById('docListCount'),
  typeFilterBar: document.getElementById('typeFilterBar'),
  docListContainer: document.getElementById('docListContainer'),
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettings: document.getElementById('btnCloseSettings'),
  inputGasUrl: document.getElementById('inputGasUrl'),
  inputApiSecret: document.getElementById('inputApiSecret'),
  testResult: document.getElementById('testResult'),
  btnTestConn: document.getElementById('btnTestConn'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),
  toast: document.getElementById('toast')
};

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 2600);
}

function setLoading(flag, text = '동기화 중...') {
  els.loadingBar.textContent = text;
  els.loadingBar.classList.toggle('hidden', !flag);
}

async function gasGet(params, u, s) {
  const url = new URL(u || state.gasUrl);
  url.searchParams.set('secret', s || state.apiSecret);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || '요청 실패');
  return json;
}

async function gasPost(payload) {
  const res = await fetch(state.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({ ...payload, secret: state.apiSecret })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || '요청 실패');
  return json;
}

function applyTree(root) {
  state.root = root;
  state.allDocs = [];
  state.folderIndex = {};
  function walk(node) {
    state.folderIndex[node.id] = node;
    (node.docs || []).forEach((d) => state.allDocs.push(d));
    (node.children || []).forEach((c) => walk(c));
  }
  if (root) {
    walk(root);
    state.allDocs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
}

async function refresh(silent = false) {
  if (!state.gasUrl || !state.apiSecret) {
    els.setupView.classList.remove('hidden');
    els.mainView.classList.add('hidden');
    return;
  }
  els.setupView.classList.add('hidden');
  els.mainView.classList.remove('hidden');
  if (!silent) setLoading(true);
  try {
    const res = await gasGet({ action: 'tree' });
    applyTree(res.root);
    if (Array.isArray(res.pinnedIds)) state.pinnedIds = new Set(res.pinnedIds);
    localStorage.setItem(KEYS.CACHE, JSON.stringify(res.root));
    renderAll();
  } catch (e) {
    showToast('오류: ' + e.message);
  } finally {
    setLoading(false);
  }
}

function showMobilePane(which) {
  els.workspace.classList.toggle('show-tree', which === 'tree');
  els.workspace.classList.toggle('show-docs', which === 'docs');
  els.btnMobileBack.classList.toggle('hidden', which === 'tree');
  els.brandDot.classList.toggle('hidden', which === 'docs');
  els.headerTitle.textContent = which === 'tree' ? 'SBL Notes' : els.docListTitle.textContent;
}

function getFileUrl(doc) {
  const ft = doc.fileType || 'doc';
  if (ft === 'doc') return `https://docs.google.com/document/d/${doc.id}/edit`;
  if (ft === 'sheet') return `https://docs.google.com/spreadsheets/d/${doc.id}/edit`;
  if (ft === 'slide') return `https://docs.google.com/presentation/d/${doc.id}/edit`;
  return `https://drive.google.com/file/d/${doc.id}/view`;
}

function renderTree() {
  els.treeContainer.innerHTML = '';
  if (!state.root) return;

  const addRow = (id, label, count, depth = 0) => {
    const row = document.createElement('div');
    row.className = 'tree-row' + (state.selectedFolderId === id ? ' active' : '');
    row.style.paddingLeft = `${10 + depth * 16}px`;
    row.innerHTML = `<div class="tree-left"><span class="tree-label">${label}</span></div><span class="tree-count">${count}</span>`;
    row.addEventListener('click', () => {
      state.selectedFolderId = id;
      state.remoteSearchDocs = null;
      if (state.docsCollapsed) {
        state.docsCollapsed = false;
        els.paneDocs.classList.remove('collapsed');
        els.railDocs.classList.add('hidden');
      }
      renderAll();
      showMobilePane('docs');
    });
    els.treeContainer.appendChild(row);
  };

  addRow('__ALL__', '모든 노트', state.allDocs.length);
  addRow('__PINNED__', '★ 즐겨찾기', state.allDocs.filter((d) => state.pinnedIds.has(d.id)).length);
  const div = document.createElement('div');
  div.className = 'tree-divider';
  els.treeContainer.appendChild(div);

  function walk(node, depth) {
    addRow(node.id, (depth > 0 ? '└ ' : '') + node.name, node.totalDocCount, depth);
    (node.children || []).forEach((c) => walk(c, depth + 1));
  }
  (state.root.children || []).forEach((c) => walk(c, 0));
}

function renderDocs() {
  let docs = [];
  if (state.remoteSearchDocs !== null) docs = [...state.remoteSearchDocs];
  else if (state.selectedFolderId === '__ALL__') docs = [...state.allDocs];
  else if (state.selectedFolderId === '__PINNED__') docs = state.allDocs.filter((d) => state.pinnedIds.has(d.id));
  else docs = (state.folderIndex[state.selectedFolderId]?.docs || []).slice();

  if (state.typeFilter !== 'all') docs = docs.filter((d) => (d.fileType || 'doc') === state.typeFilter);
  if (state.remoteSearchDocs === null && state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    docs = docs.filter((d) => d.name.toLowerCase().includes(q));
  }
  docs.sort((a, b) => (state.pinnedIds.has(b.id) ? 1 : 0) - (state.pinnedIds.has(a.id) ? 1 : 0) || new Date(b.updatedAt) - new Date(a.updatedAt));

  els.docListTitle.textContent =
    state.remoteSearchDocs !== null ? `검색: "${state.searchQuery}"` :
    state.selectedFolderId === '__ALL__' ? '모든 노트' :
    state.selectedFolderId === '__PINNED__' ? '즐겨찾기' :
    (state.folderIndex[state.selectedFolderId]?.name || '문서');
  els.docListCount.textContent = String(docs.length);

  els.docListContainer.innerHTML = '';
  if (!docs.length) {
    els.docListContainer.innerHTML = '<div class="empty-state">파일이 없습니다.</div>';
    return;
  }

  docs.forEach((doc) => {
    const meta = FILE_TYPE_META[doc.fileType || 'doc'] || FILE_TYPE_META.doc;
    const a = document.createElement('a');
    a.className = 'doc-item';
    a.href = getFileUrl(doc);
    a.target = '_blank';
    a.rel = 'noopener';
    const dt = new Date(doc.updatedAt);
    const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
    a.innerHTML = `
      <div class="doc-top">
        <span class="badge ${meta.badgeClass}">${meta.label}</span>
        <div class="doc-title">${state.pinnedIds.has(doc.id) ? '★ ' : ''}${doc.name}</div>
      </div>
      <div class="doc-meta">
        <span>${dateStr}</span>
        ${doc.folderName ? `<span class="doc-folder-tag">${doc.folderName}</span>` : ''}
      </div>
    `;
    els.docListContainer.appendChild(a);
  });
}

function renderAll() {
  renderTree();
  renderDocs();
}

// Events
els.btnMobileBack.addEventListener('click', () => showMobilePane('tree'));
els.btnRefresh.addEventListener('click', () => refresh(false));
els.btnCollapseDocs.addEventListener('click', () => {
  state.docsCollapsed = true;
  els.paneDocs.classList.add('collapsed');
  els.railDocs.classList.remove('hidden');
});
els.railDocs.addEventListener('click', () => {
  state.docsCollapsed = false;
  els.paneDocs.classList.remove('collapsed');
  els.railDocs.classList.add('hidden');
});

els.btnNewDoc.addEventListener('click', async () => {
  const now = new Date();
  const def = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} 새 문서`;
  const title = prompt('새 문서 제목', def);
  if (!title) return;
  const folderId = (state.selectedFolderId !== '__ALL__' && state.selectedFolderId !== '__PINNED__') ? state.selectedFolderId : (state.root?.id || '');
  setLoading(true, '문서 생성 중...');
  try {
    const res = await gasPost({ action: 'createDoc', fileType: 'doc', folderId, title: title.trim() });
    window.open(getFileUrl(res.doc), '_blank');
    await refresh(true);
  } catch (e) {
    showToast('생성 실패: ' + e.message);
  } finally {
    setLoading(false);
  }
});

els.btnNewRootFolder.addEventListener('click', async () => {
  const name = prompt('새 폴더 이름');
  if (!name || !name.trim()) return;
  setLoading(true, '폴더 생성 중...');
  try {
    await gasPost({ action: 'createFolder', parentFolderId: state.root?.id, name: name.trim() });
    await refresh(true);
  } catch (e) {
    showToast('폴더 생성 실패: ' + e.message);
  } finally {
    setLoading(false);
  }
});

els.typeFilterBar.querySelectorAll('.filter-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    state.typeFilter = chip.dataset.filter;
    els.typeFilterBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    renderDocs();
  });
});

els.searchInput.addEventListener('input', () => {
  state.searchQuery = els.searchInput.value;
  state.remoteSearchDocs = null;
  renderDocs();
});
els.searchInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && state.searchQuery.trim()) {
    setLoading(true, '본문 검색 중...');
    try {
      const res = await gasGet({ action: 'search', q: state.searchQuery.trim() });
      state.remoteSearchDocs = res.docs || [];
      renderAll();
      showMobilePane('docs');
    } catch (err) {
      showToast('검색 오류: ' + err.message);
    } finally {
      setLoading(false);
    }
  }
});

const openSettings = () => {
  els.inputGasUrl.value = state.gasUrl;
  els.inputApiSecret.value = state.apiSecret;
  els.testResult.classList.add('hidden');
  els.settingsModal.classList.remove('hidden');
};
els.btnSettings.addEventListener('click', openSettings);
els.btnOpenSettingsFromSetup.addEventListener('click', openSettings);
els.btnCloseSettings.addEventListener('click', () => els.settingsModal.classList.add('hidden'));
els.settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => els.settingsModal.classList.add('hidden'));

els.btnTestConn.addEventListener('click', async () => {
  els.testResult.className = 'test-result';
  els.testResult.textContent = '확인 중...';
  els.testResult.classList.remove('hidden');
  try {
    const res = await gasGet({ action: 'ping' }, els.inputGasUrl.value.trim(), els.inputApiSecret.value.trim());
    els.testResult.className = 'test-result ok';
    els.testResult.textContent = '✓ ' + res.message;
  } catch (e) {
    els.testResult.className = 'test-result err';
    els.testResult.textContent = '✕ ' + e.message;
  }
});

els.btnSaveSettings.addEventListener('click', () => {
  state.gasUrl = els.inputGasUrl.value.trim();
  state.apiSecret = els.inputApiSecret.value.trim();
  localStorage.setItem(KEYS.URL, state.gasUrl);
  localStorage.setItem(KEYS.SECRET, state.apiSecret);
  els.settingsModal.classList.add('hidden');
  refresh(false);
});

const cached = localStorage.getItem(KEYS.CACHE);
if (cached) {
  try { applyTree(JSON.parse(cached)); renderAll(); } catch (e) {}
}
refresh(Boolean(cached));
