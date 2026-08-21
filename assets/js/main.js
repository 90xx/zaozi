window.loadData = async function loadData() { /* 原函数体 */ };
// assets/js/main.js

// === 配置常量 ===
const STOP_WORDS = ['小说', '漫画'];
const NET_DISK_FIELDS = ['kk', 'bd', 'uc', 'xl', 'yd', 'lz'];
const CODE_FIELDS = ['kkm', 'bdm', 'ucm', 'xlm', 'ydm','lzm'];
const NET_DISK_NAMES = {
  'kk': '夸克', 'bd': '百度', 'uc': 'UC',
  'xl': '迅雷', 'yd': '移动', 'lz': '蓝奏'
};
const ITEMS_PER_PAGE = 20;

// === 全局状态 ===
let resources = [];
let currentListType = null;
// 🔥 关键：isVerified 必须挂载到 window，供 verify-gate.html 读取
window.isVerified = false;

// === DOM 引用（延迟获取，避免脚本加载时DOM未就绪）===
function getEl(id) { return document.getElementById(id); }

// === 核心数据加载函数（挂载到window供验证模块调用）===
window.loadData = async function loadData() {
  if (resources.length > 0) return;
  const loadingDiv = getEl('loading');
  loadingDiv.classList.remove('hidden');

  const dataFiles = ['./hanmannovel.json'];

  try {
    const responses = await Promise.all(
      dataFiles.map(url => fetch(url + '?t=' + Date.now()))
    );
    for (const res of responses) {
      if (!res.ok) throw new Error(`加载失败: ${res.url}`);
    }

    const allData = await Promise.all(responses.map(res => res.json()));
    resources = [];
    for (const data of allData) {
      if (Array.isArray(data)) resources.push(...data);
      else if (Array.isArray(data.items)) resources.push(...data.items);
    }

    loadingDiv.classList.add('hidden');
    renderTypeNav();
  } catch (err) {
    console.error('加载多数据源失败:', err);
    loadingDiv.innerHTML = `<p class="text-red-500 text-center">❌ 加载资源失败：${err.message || '未知错误'}</p>`;
  }
};

// === 链接提取逻辑 ===
function getRandomValidLinks(item) {
  const validDisks = NET_DISK_FIELDS
    .filter(field => item[field] && typeof item[field] === 'string' && item[field].trim() !== '' && item[field].startsWith('http'))
    .map(field => ({
      type: field === 'lz' ? 'lz' : 'normal',
      field,
      name: NET_DISK_NAMES[field] || field.toUpperCase(),
      url: item[field]
    }));

  if (validDisks.length === 0) return [];

  const randomIndex = Math.floor(Math.random() * validDisks.length);
  const selected = validDisks[randomIndex];

  let codeUrl = null;
  if (selected.type === 'lz') {
    const validSharePages = CODE_FIELDS
      .filter(field => item[field] && typeof item[field] === 'string' && item[field].trim() !== '' && item[field].startsWith('http'))
      .map(field => item[field]);
    if (validSharePages.length > 0) {
      const randomShareIndex = Math.floor(Math.random() * validSharePages.length);
      codeUrl = validSharePages[randomShareIndex];
    }
  }

  return [{
    mainType: selected.type,
    mainText: selected.name,
    mainUrl: selected.url,
    hasLz: !!item.lz && typeof item.lz === 'string' && item.lz.trim() !== '' && item.lz.startsWith('http'),
    codeUrl
  }];
}

// === 搜索清洗 ===
function cleanQuery(query) {
  let cleaned = query;
  STOP_WORDS.forEach(word => {
    cleaned = cleaned.replace(new RegExp(word, 'g'), '');
  });
  return cleaned.trim();
}

// === 分类导航渲染 ===
function renderTypeNav() {
  const typeNav = getEl('typeNav');
  const types = [...new Set(resources.map(item => item.type).filter(t => t))];
  typeNav.innerHTML = '';
  if (types.length === 0) return;

  let html = '<div class="flex flex-wrap justify-center gap-2">';
  types.forEach(type => {
    html += `<button data-type="${type}" class="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition">${type}</button>`;
  });
  html += '</div>';
  typeNav.innerHTML = html;

  typeNav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.isVerified) return;
      showListView(btn.dataset.type);
    });
  });
}

// === 清单视图 ===
function showListView(type) {
  currentListType = type;
  getEl('listTitle').textContent = `${type}清单`;
  getEl('mainContainer').classList.add('hidden');
  getEl('navSection').classList.add('hidden');
  getEl('listView').classList.remove('hidden');

  const listSearchBtn = getEl('listSearchBtn');
  const listSearchInput = getEl('listSearchInput');

  listSearchBtn.removeEventListener('click', handleListSearch);
  listSearchBtn.addEventListener('click', handleListSearch);
  listSearchInput.removeEventListener('keypress', handleListSearchOnEnter);
  listSearchInput.addEventListener('keypress', handleListSearchOnEnter);

  renderListPage(1);
}

function handleListSearch() {
  if (!window.isVerified) return;
  const rawQuery = getEl('listSearchInput').value.trim();
  if (!rawQuery) { renderListPage(1); return; }

  const query = cleanQuery(rawQuery);
  if (!query) { getEl('listSearchInput').value = ''; renderListPage(1); return; }

  const items = resources.filter(item => item.type === currentListType);
  const hits = items.filter(item => {
    const title = (item.title || '').toLowerCase().replace(/[\s\u2000-\u206F]/g, '');
    const q = query.toLowerCase().replace(/[\s\u2000-\u206F]/g, '');
    return title.includes(q);
  });

  const groups = {};
  hits.forEach(item => {
    const initial = (item.initial || '#').toUpperCase();
    if (!groups[initial]) groups[initial] = [];
    groups[initial].push(item);
  });

  const sortedInitials = Object.keys(groups).sort();
  const allEntries = [];
  sortedInitials.forEach(initial => {
    allEntries.push({ type: 'header', initial });
    groups[initial].forEach(item => allEntries.push({ type: 'item', data: item }));
  });

  renderGroupedEntries(allEntries);
  getEl('listPagination').classList.add('hidden');
}

function handleListSearchOnEnter(e) {
  if (e.key === 'Enter') handleListSearch();
}

// === 分组渲染 ===
function renderGroupedEntries(entries) {
  let html = '';
  entries.forEach(entry => {
    if (entry.type === 'header') {
      html += `<h3 class="text-xl font-bold text-gray-700 border-l-4 border-blue-500 pl-2">${entry.initial}</h3>`;
    } else {
      const item = entry.data;
      const links = getRandomValidLinks(item);
      html += `<div class="bg-white p-4 rounded-lg shadow">
        <h4 class="font-semibold text-blue-600">${item.title}</h4>`;

      if (links.length > 0) {
        const link = links[0];
        html += `<a href="${link.mainUrl}" target="_blank" class="block mt-1 text-green-600">${link.mainText}</a>`;
        if (link.hasLz && link.mainType === 'lz' && link.codeUrl) {
          html += `<a href="${link.codeUrl}" target="_blank" class="block mt-1 text-green-600">提取码</a>`;
        }
      } else {
        html += `<p class="text-gray-500 mt-1">暂无有效链接</p>`;
      }
      html += `</div>`;
    }
  });

  getEl('groupedList').innerHTML = html || '<p class="text-center text-gray-500">未找到相关资源</p>';
}

// === 分页 ===
function renderListPage(page) {
  const items = resources.filter(item => item.type === currentListType);
  const groups = {};
  items.forEach(item => {
    const initial = (item.initial || '#').toUpperCase();
    if (!groups[initial]) groups[initial] = [];
    groups[initial].push(item);
  });

  const sortedInitials = Object.keys(groups).sort();
  const allEntries = [];
  sortedInitials.forEach(initial => {
    allEntries.push({ type: 'header', initial });
    groups[initial].forEach(item => allEntries.push({ type: 'item', data: item }));
  });

  const totalPages = Math.ceil(allEntries.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  renderGroupedEntries(allEntries.slice(start, start + ITEMS_PER_PAGE));
  renderPagination(page, totalPages);
}

function renderPagination(current, total) {
  const div = getEl('listPagination');
  if (total <= 1) { div.classList.add('hidden'); return; }
  div.classList.remove('hidden');

  let html = '';
  const max = 5;
  let start = Math.max(1, current - Math.floor(max / 2));
  let end = Math.min(total, start + max - 1);
  if (end - start + 1 < max) start = Math.max(1, end - max + 1);

  if (current > 1) html += `<button data-page="${current - 1}" class="px-3 py-1 border rounded">❮</button>`;
  for (let i = start; i <= end; i++) {
    html += i === current
      ? `<span class="px-3 py-1 bg-blue-500 text-white rounded">${i}</span>`
      : `<button data-page="${i}" class="px-3 py-1 border rounded">${i}</button>`;
  }
  if (current < total) html += `<button data-page="${current + 1}" class="px-3 py-1 border rounded">❯</button>`;

  div.innerHTML = html;
  div.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.isVerified) r