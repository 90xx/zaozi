document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const resourceList = document.getElementById('resourceList');
  const noResults = document.getElementById('noResults');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // 配置项
  const ITEMS_PER_PAGE = 12; // 每页显示数量，按需修改
  let currentPage = 1;
  let activeCategory = '全部';
  let currentFilteredData = [];

  // 自动创建分页容器（如果HTML中没有）
  let paginationContainer = document.getElementById('js-pagination');
  if (!paginationContainer) {
    paginationContainer = document.createElement('nav');
    paginationContainer.id = 'js-pagination';
    paginationContainer.className = 'hugo-pagination'; // 复用你之前的CSS类名
    resourceList.parentNode.insertBefore(paginationContainer, resourceList.nextSibling);
  }

  // ===== 核心：渲染当前页卡片 =====
  function renderPage() {
    resourceList.innerHTML = '';
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageData = currentFilteredData.slice(start, start + ITEMS_PER_PAGE);

    if (pageData.length === 0) {
      noResults.style.display = '';
      paginationContainer.innerHTML = '';
      return;
    }
    noResults.style.display = 'none';

    pageData.forEach(item => {
      const card = document.createElement('div');
      card.className = 'resource-card';
      // 保留 dataset 以便后续可能的操作
      card.dataset.title = item.title;
      card.dataset.categories = JSON.stringify(item.categories || []);

      // 生成分类标签
      const tagsHtml = (item.categories || [])
        .map(c => `<span class="tag">${c}</span>`)
        .join('');

      // ⚠️ 关键：过滤掉 #VALUE! 无效链接，并生成按钮
      let linksHtml = '';
      if (Array.isArray(item.links)) {
        item.links.forEach(link => {
          if (link.url && link.url !== '#VALUE!' && link.url.startsWith('http')) {
            // 根据平台名添加不同样式类（可选）
            const platformClass = link.platform.toLowerCase().replace(/\s+/g, '-');
            linksHtml += `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="download-btn btn-${platformClass}">${link.platform}</a>`;
          }
        });
      }

      card.innerHTML = `
        <div class="card-header">
          <h3>${item.title}</h3>
          <div class="tags">${tagsHtml}</div>
        </div>
        <div class="card-links">${linksHtml || '<span class="no-link">暂无有效链接</span>'}</div>
      `;
      resourceList.appendChild(card);
    });

    renderPagination();
  }

  // ===== 动态生成分页器 =====
  function renderPagination() {
    const totalPages = Math.ceil(currentFilteredData.length / ITEMS_PER_PAGE);
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (text, page, isActive = false, isDisabled = false) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      if (isActive) btn.className = 'active';
      if (isDisabled) {
        btn.disabled = true;
      } else {
        btn.onclick = () => goToPage(page);
      }
      return btn;
    };

    // 上一页
    paginationContainer.appendChild(createBtn('«', currentPage - 1, false, currentPage === 1));

    // 智能页码：始终显示首尾 + 当前页附近
    const delta = 2;
    const range = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    if (range[0] > 2) range.unshift('...');
    if (range[range.length - 1] < totalPages - 1) range.push('...');
    range.unshift(1);
    if (totalPages > 1) range.push(totalPages);

    range.forEach(p => {
      if (p === '...') {
        const span = document.createElement('span');
        span.textContent = '…';
        span.style.padding = '0 6px';
        paginationContainer.appendChild(span);
      } else {
        paginationContainer.appendChild(createBtn(p, p, p === currentPage));
      }
    });

    // 下一页
    paginationContainer.appendChild(createBtn('»', currentPage + 1, false, currentPage === totalPages));
  }

  function goToPage(page) {
    currentPage = page;
    renderPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== 统一筛选逻辑 =====
  function applyFilters() {
    const keyword = searchInput.value.trim().toLowerCase();
    currentFilteredData = RESOURCES.filter(item => {
      const matchCategory = activeCategory === '全部' ||
        (item.categories || []).includes(activeCategory);
      const matchSearch = !keyword || (item.title || '').toLowerCase().includes(keyword);
      return matchCategory && matchSearch;
    });
    currentPage = 1;
    renderPage();
  }

  // ===== 事件绑定（完全保留原有逻辑）=====
  searchInput.addEventListener('input', applyFilters);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applyFilters(); }
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      applyFilters();
    });
  });

  // 分类折叠/展开（完全保留）
  const toggleBtn = document.getElementById('toggleFilter');
  if (toggleBtn) {
    const allFilterBtns = document.querySelectorAll('#filterBar .filter-btn');
    const SHOW_COUNT = 9;
    let expanded = false;

    // SVG 图标常量
    const ICON_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    const ICON_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    function updateVisibility() {
      allFilterBtns.forEach((btn, i) => {
        btn.style.display = (i < SHOW_COUNT || expanded) ? '' : 'none';
      });
      toggleBtn.innerHTML = expanded
        ? '收起分类 ' + ICON_UP
        : '展开更多 ' + ICON_DOWN;
    }
    updateVisibility();
    toggleBtn.addEventListener('click', () => {
      expanded = !expanded;
      updateVisibility();
    });
  }

  // 初始化
  currentFilteredData = RESOURCES;
  renderPage();
});