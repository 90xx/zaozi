document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const resourceList = document.getElementById('resourceList');
  const noResults = document.getElementById('noResults');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let activeCategory = '全部';

  // ===== 搜索 + 筛选统一逻辑 =====
  function applyFilters() {
    const keyword = searchInput.value.trim().toLowerCase();
    const cards = resourceList.querySelectorAll('.resource-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const title = card.dataset.title.toLowerCase();
      const categories = JSON.parse(card.dataset.categories || '[]');

      const matchCategory = activeCategory === '全部' || categories.includes(activeCategory);
      const matchSearch = !keyword || title.includes(keyword);

      if (matchCategory && matchSearch) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    noResults.style.display = visibleCount === 0 ? '' : 'none';
  }

  // ===== 搜索框事件 =====
  // 实时搜索（输入即过滤）
  searchInput.addEventListener('input', applyFilters);

  // 按 Enter 也触发（兼容习惯）
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilters();
    }
  });

  // ===== 分类折叠/展开（完全由 JS 控制）=====
const toggleBtn = document.getElementById('toggleFilter');
if (toggleBtn) {
  const allFilterBtns = document.querySelectorAll('#filterBar .filter-btn');
  const SHOW_COUNT = 9; // "全部"(1) + 前8个分类 = 9个按钮可见
  let expanded = false;

  function updateVisibility() {
    allFilterBtns.forEach((btn, i) => {
      if (i < SHOW_COUNT) {
        btn.style.display = '';
      } else {
        btn.style.display = expanded ? '' : 'none';
      }
    });
    toggleBtn.textContent = expanded ? '收起 ▲' : '展开全部 ▼';
  }

  // 初始化：隐藏超出部分的按钮
  updateVisibility();

  toggleBtn.addEventListener('click', () => {
    expanded = !expanded;
    updateVisibility();
  });
}


  // ===== 分类按钮事件 =====
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      applyFilters();
    });
  });
});