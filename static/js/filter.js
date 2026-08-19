document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const resourceList = document.getElementById('resourceList');
  const noResults = document.getElementById('noResults');

  // 配置项
  const ITEMS_PER_PAGE = 12;
  let currentPage = 1;
  let activeCategory = '全部';
  let currentFilteredData = [];

  // 自动创建分页容器
  let paginationContainer = document.getElementById('js-pagination');
  if (!paginationContainer) {
    paginationContainer = document.createElement('nav');
    paginationContainer.id = 'js-pagination';
    paginationContainer.className = 'hugo-pagination';
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
      card.dataset.title = item.title;
      card.dataset.categories = JSON.stringify(item.categories || []);
      card.dataset.date = item.date || '';

      const tagsHtml = (item.categories || [])
        .map(c => `<span class="tag">${c}</span>`)
        .join('');

      let linksHtml = '';
      if (Array.isArray(item.links)) {
        item.links.forEach(link => {
          if (link.url && link.url !== '#VALUE!' && link.url.startsWith('http')) {
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

    paginationContainer.appendChild(createBtn('«', currentPage - 1, false, currentPage === 1));

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

      // 🔑 有搜索关键词时，忽略分类筛选，搜全部资源
      if (keyword) {
        return matchSearch;
      }
      return matchCategory;
    });
    currentPage = 1;
    renderPage();
  }

  // ===== 更新所有按钮的高亮状态 =====
  function updateActiveButtons() {
    // 清除所有高亮
    document.querySelectorAll('.filter-btn, .filter-parent-btn').forEach(b => b.classList.remove('active'));

    // 高亮当前选中的子按钮
    document.querySelectorAll('.filter-btn').forEach(btn => {
      if (btn.dataset.category === activeCategory) {
        btn.classList.add('active');
      }
    });

    // 如果选中的是某个父分类的子分类，父按钮也高亮
    document.querySelectorAll('.filter-group').forEach(group => {
      const parentBtn = group.querySelector('.filter-parent-btn');
      const childBtns = group.querySelectorAll('.filter-btn');
      childBtns.forEach(btn => {
        if (btn.dataset.category === activeCategory) {
          parentBtn.classList.add('active');
        }
      });
      // 如果选中的就是父分类本身
      if (parentBtn.dataset.category === activeCategory) {
        parentBtn.classList.add('active');
      }
    });
  }

  // ===== 事件绑定：使用事件委托 =====
  searchInput.addEventListener('input', applyFilters);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applyFilters(); }
  });

  // 事件委托：监听整个 filterRow 的点击
  const filterRow = document.getElementById('filterRow');
  if (filterRow) {
    filterRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      // 阻止冒泡，避免触发 document 的关闭下拉
      e.stopPropagation();

      activeCategory = btn.dataset.category;
      updateActiveButtons();
      applyFilters();

      // 点击子分类后关闭下拉
      const children = btn.closest('.filter-children');
      if (children) {
        children.classList.remove('show');
        const parentBtn = children.parentElement.querySelector('.filter-parent-btn');
        if (parentBtn) parentBtn.classList.remove('open');
      }
    });
  }

  // 分类折叠/展开
  const toggleBtn = document.getElementById('toggleFilter');
  if (toggleBtn) {
    const filterRowEl = document.getElementById('filterRow');
    const allExtras = filterRowEl.querySelectorAll('.filter-extra');
    const SHOW_COUNT = 6;
    let expanded = false;

    const ICON_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    const ICON_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    function updateVisibility() {
      allExtras.forEach((el, i) => {
        if (i < SHOW_COUNT) {
          el.style.display = '';
          el.classList.remove('filter-extra-hidden');
        } else {
          el.style.display = expanded ? '' : 'none';
        }
      });
      toggleBtn.innerHTML = expanded
        ? '收起分类 ' + ICON_UP
        : '展开更多 ' + ICON_DOWN;

      // 如果没有需要隐藏的，隐藏按钮自身
      if (allExtras.length <= SHOW_COUNT) {
        toggleBtn.style.display = 'none';
      } else {
        toggleBtn.style.display = '';
      }
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