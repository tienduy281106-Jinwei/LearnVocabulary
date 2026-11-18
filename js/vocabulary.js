/**
 * vocabulary.js — VocabMaster Vocabulary Page Logic
 * Quản lý kho từ vựng cá nhân, thêm/sửa/xóa từ vựng, lọc theo chủ đề và phân trang.
 */

(function () {
  'use strict';

  const state = {
    allWords: [],
    filteredWords: [],
    selectedTopic: 'all',
    searchQuery: '',
    filterType: 'all',
    filterStatus: 'all',
    currentPage: 1,
    itemsPerPage: 24,
    editingId: null
  };

  const DEFAULT_TOPIC_ICONS = {
    "Why We Need to Protect Polar Bears": "🐻‍❄️",
    "The Step Pyramid of Djoser": "🏛️",
    "The Future of Work": "💼",
    "Uffington White Horse": "🐎",
    "I Contain Multitudes": "🔬",
    "How to Make Wise Decisions": "🧠",
    "Roman Shipbuilding and Navigation": "⛵",
    "Ancient Artefacts in Norway Glaciers": "🏔️",
    "Plant Thermometer & Night Heat": "🌱",
    "Coming and Going": "✈️",
    "General": "📚"
  };

  async function loadData() {
    try {
      state.allWords = await VocabDB.getAll('vocabulary');
      renderTopicUI();
      applyFilters();
    } catch (err) {
      console.error('[Vocab] Lỗi nạp từ vựng:', err);
      showToast('Lỗi khi tải kho từ vựng!', 'error');
    }
  }

  function getAvailableTopics() {
    const topicsMap = new Map();
    // Khởi tạo các topic chính
    Object.keys(DEFAULT_TOPIC_ICONS).forEach(tName => {
      topicsMap.set(tName, {
        name: tName,
        icon: DEFAULT_TOPIC_ICONS[tName],
        total: 0,
        mastered: 0
      });
    });

    state.allWords.forEach(v => {
      const tKey = v.topic || 'General';
      if (!topicsMap.has(tKey)) {
        topicsMap.set(tKey, {
          name: tKey,
          icon: DEFAULT_TOPIC_ICONS[tKey] || '🏷️',
          total: 0,
          mastered: 0
        });
      }
      const item = topicsMap.get(tKey);
      item.total++;
      if (v.status === 'mastered' || v.status === 'learned') {
        item.mastered++;
      }
    });

    return Array.from(topicsMap.values()).filter(t => t.total > 0 || t.name === 'General');
  }

  function renderTopicUI() {
    const topics = getAvailableTopics();
    const pillsWrapper = document.getElementById('topic-pills-wrapper');
    const selectFilter = document.getElementById('vocab-filter-topic');
    const formTopicSelect = document.getElementById('vocab-topic');

    // 1. Render Topic Pills
    if (pillsWrapper) {
      let pillsHtml = `
        <button class="topic-pill ${state.selectedTopic === 'all' ? 'active' : ''}" data-topic="all">
          <span class="topic-pill-icon">🌐</span> Tất cả (${state.allWords.length})
        </button>
      `;
      topics.forEach(t => {
        pillsHtml += `
          <button class="topic-pill ${state.selectedTopic === t.name ? 'active' : ''}" data-topic="${escapeHtml(t.name)}">
            <span class="topic-pill-icon">${t.icon}</span> ${escapeHtml(t.name)} (${t.total})
          </button>
        `;
      });
      pillsWrapper.innerHTML = pillsHtml;

      pillsWrapper.querySelectorAll('.topic-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          state.selectedTopic = btn.dataset.topic;
          state.currentPage = 1;
          if (selectFilter) selectFilter.value = state.selectedTopic;
          renderTopicUI();
          applyFilters();
        });
      });
    }

    // 2. Render Form Select & Filter Select
    if (selectFilter) {
      const currentVal = selectFilter.value || 'all';
      let opts = `<option value="all">🌐 Tất cả chủ đề (${state.allWords.length} từ)</option>`;
      topics.forEach(t => {
        opts += `<option value="${escapeHtml(t.name)}">${t.icon} ${escapeHtml(t.name)} (${t.total} từ)</option>`;
      });
      selectFilter.innerHTML = opts;
      selectFilter.value = currentVal;
    }

    if (formTopicSelect) {
      const currentVal = formTopicSelect.value;
      let opts = '';
      topics.forEach(t => {
        opts += `<option value="${escapeHtml(t.name)}">${t.icon} ${escapeHtml(t.name)}</option>`;
      });
      formTopicSelect.innerHTML = opts;
      if (currentVal) formTopicSelect.value = currentVal;
    }

    // Update Quick test button
    const quickTestBtn = document.getElementById('btn-quick-topic-test');
    if (quickTestBtn) {
      quickTestBtn.onclick = () => {
        const topicParam = encodeURIComponent(state.selectedTopic);
        window.location.href = `topic-quiz.html?topic=${topicParam}`;
      };
    }
  }

  function applyFilters() {
    let list = [...state.allWords];

    // Topic
    if (state.selectedTopic !== 'all') {
      list = list.filter(v => (v.topic || 'General') === state.selectedTopic);
    }

    // Search query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(v =>
        (v.word && v.word.toLowerCase().includes(q)) ||
        (v.definition && v.definition.toLowerCase().includes(q)) ||
        (v.example && v.example.toLowerCase().includes(q))
      );
    }

    // Type
    if (state.filterType !== 'all') {
      list = list.filter(v => (v.type || '').toLowerCase() === state.filterType);
    }

    // Status
    if (state.filterStatus !== 'all') {
      if (state.filterStatus === 'mastered') {
        list = list.filter(v => v.status === 'mastered' || v.status === 'learned');
      } else if (state.filterStatus === 'learning') {
        list = list.filter(v => v.status !== 'mastered' && v.status !== 'learned');
      }
    }

    state.filteredWords = list;
    renderVocabCards();
    renderPagination();
    updateStatsBar();
  }

  function updateStatsBar() {
    const bar = document.getElementById('vocab-stats-bar');
    if (!bar) return;
    const total = state.filteredWords.length;
    const mastered = state.filteredWords.filter(v => v.status === 'mastered' || v.status === 'learned').length;
    bar.innerHTML = `
      <span>Hiển thị <strong>${total}</strong> từ vựng (${mastered} đã thuộc)</span>
      <span>Trang ${state.currentPage} / ${Math.max(1, Math.ceil(total / state.itemsPerPage))}</span>
    `;
  }

  function renderVocabCards() {
    const container = document.getElementById('vocab-cards-container');
    if (!container) return;

    if (state.filteredWords.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-folder-open" style="font-size: 48px; opacity: 0.5; margin-bottom: 12px;"></i>
          <h4 style="color: var(--text-main);">Không tìm thấy từ vựng nào</h4>
          <p style="font-size: 13px;">Hãy thử đổi từ khóa tìm kiếm hoặc chọn chủ đề khác.</p>
        </div>
      `;
      return;
    }

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paged = state.filteredWords.slice(start, start + state.itemsPerPage);

    container.innerHTML = paged.map(v => {
      const isMastered = v.status === 'mastered' || v.status === 'learned';
      const icon = DEFAULT_TOPIC_ICONS[v.topic] || '🏷️';

      return `
        <div class="vocab-card ${isMastered ? 'mastered' : ''}" data-id="${v.id}">
          <div class="vocab-card-header">
            <div>
              <span class="vocab-card-type">${escapeHtml(v.type || 'noun')}</span>
              <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${icon} ${escapeHtml(v.topic || 'General')}</span>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn-icon" onclick="window.toggleMastered('${v.id}')" title="${isMastered ? 'Đánh dấu cần học lại' : 'Đánh dấu đã thuộc'}" style="color: ${isMastered ? 'var(--color-success)' : 'var(--text-muted)'}">
                <i class="fa-${isMastered ? 'solid' : 'regular'} fa-circle-check"></i>
              </button>
              <button class="btn-icon" onclick="window.editVocab('${v.id}')" title="Chỉnh sửa">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon" onclick="window.deleteVocab('${v.id}')" title="Xóa từ" style="color: var(--color-danger);">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 8px;">
            <h4 class="vocab-card-word" style="font-size: 18px; font-weight: 700; color: var(--text-main); margin: 0;">${escapeHtml(v.word)}</h4>
            <button class="btn-icon" onclick="speak('${escapeHtml(v.word)}')" title="Phát âm" style="color: var(--color-primary-light);">
              <i class="fa-solid fa-volume-high" style="font-size: 12px;"></i>
            </button>
          </div>
          <div class="vocab-card-phonetic" style="font-size: 13px; color: var(--text-muted); font-family: monospace;">${escapeHtml(v.pronunciation || '')}</div>

          <p class="vocab-card-def" style="margin-top: 8px; font-weight: 500; color: var(--text-main);">${escapeHtml(v.definition || '')}</p>

          ${v.example ? `
            <div class="vocab-card-eg" style="font-size: 12px; margin-top: 6px; padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; border-left: 2px solid var(--color-primary-light);">
              <div style="color: var(--text-muted); font-style: italic;">"${escapeHtml(v.example)}"</div>
              ${v.exampleTranslation ? `<div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">${escapeHtml(v.exampleTranslation)}</div>` : ''}
            </div>
          ` : ''}

          ${v.grammarPattern ? `
            <div style="font-size: 11px; color: #ff9800; margin-top: 6px;">
              <i class="fa-solid fa-diagram-project"></i> ${escapeHtml(v.grammarPattern)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function renderPagination() {
    const container = document.getElementById('vocab-pagination-container');
    if (!container) return;

    const totalPages = Math.ceil(state.filteredWords.length / state.itemsPerPage);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let btns = '';
    btns += `<button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} data-p="${state.currentPage - 1}"><i class="fa-solid fa-chevron-left"></i></button>`;

    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= state.currentPage - 2 && p <= state.currentPage + 2)) {
        btns += `<button class="page-btn ${p === state.currentPage ? 'active' : ''}" data-p="${p}">${p}</button>`;
      } else if (p === state.currentPage - 3 || p === state.currentPage + 3) {
        btns += `<span style="color: var(--text-muted);">...</span>`;
      }
    }

    btns += `<button class="page-btn" ${state.currentPage === totalPages ? 'disabled' : ''} data-p="${state.currentPage + 1}"><i class="fa-solid fa-chevron-right"></i></button>`;
    container.innerHTML = btns;

    container.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.p);
        if (p >= 1 && p <= totalPages) {
          state.currentPage = p;
          renderVocabCards();
          renderPagination();
          updateStatsBar();
          window.scrollTo({ top: 300, behavior: 'smooth' });
        }
      });
    });
  }

  // Window global action helpers
  window.toggleMastered = async function (id) {
    try {
      const item = await VocabDB.get('vocabulary', id);
      if (!item) return;
      const isMastered = item.status === 'mastered' || item.status === 'learned';
      item.status = isMastered ? 'learning' : 'mastered';
      await VocabDB.put('vocabulary', item);
      await updateStatsHeader();
      await loadData();
      showToast(isMastered ? 'Đã chuyển sang cần học lại' : 'Đã đánh dấu đã thuộc! 🎉', 'success');
    } catch (e) {
      console.error(e);
      showToast('Lỗi cập nhật trạng thái', 'error');
    }
  };

  window.deleteVocab = async function (id) {
    if (!confirm('Bạn có chắc chắn muốn xóa từ vựng này khỏi kho?')) return;
    try {
      await VocabDB.delete('vocabulary', id);
      await updateStatsHeader();
      await loadData();
      showToast('Đã xóa từ vựng thành công', 'success');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xóa từ', 'error');
    }
  };

  window.editVocab = async function (id) {
    try {
      const item = await VocabDB.get('vocabulary', id);
      if (!item) return;

      state.editingId = id;
      document.getElementById('vocab-id').value = item.id;
      document.getElementById('vocab-word').value = item.word || '';
      document.getElementById('vocab-pronunciation').value = item.pronunciation || '';
      document.getElementById('vocab-definition').value = item.definition || '';
      document.getElementById('vocab-example').value = item.example || '';
      document.getElementById('vocab-example-translation').value = item.exampleTranslation || '';
      document.getElementById('vocab-grammar-pattern').value = item.grammarPattern || '';
      document.getElementById('vocab-topic').value = item.topic || 'General';

      // Checkboxes
      const checkboxes = document.querySelectorAll('input[name="vocab-type-cb"]');
      checkboxes.forEach(cb => {
        cb.checked = (cb.value === (item.type || 'noun'));
      });

      // Show advanced fields
      toggleAdvFields(true);

      document.getElementById('vocab-form-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Sửa từ vựng';
      document.getElementById('vocab-btn-submit').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cập nhật từ vựng';
      document.getElementById('vocab-btn-cancel').style.display = 'inline-block';

      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    }
  };

  function resetForm() {
    state.editingId = null;
    const form = document.getElementById('vocab-form');
    if (form) form.reset();
    document.getElementById('vocab-id').value = '';
    document.getElementById('vocab-form-title').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Thêm từ vựng mới';
    document.getElementById('vocab-btn-submit').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu từ vựng';
    document.getElementById('vocab-btn-cancel').style.display = 'none';
  }

  function toggleAdvFields(forceShow) {
    const row = document.getElementById('vocab-adv-fields-row');
    const eg = document.getElementById('vocab-adv-fields-eg');
    const egVi = document.getElementById('vocab-adv-fields-eg-vi');
    const grammar = document.getElementById('vocab-adv-fields-grammar');
    const isHidden = row.style.display === 'none';
    const show = (forceShow !== undefined) ? forceShow : isHidden;

    [row, eg, egVi, grammar].forEach(el => {
      if (el) el.style.display = show ? 'block' : 'none';
    });
    if (row && show) row.style.display = 'flex';
  }

  function bindEvents() {
    // Form submit
    const form = document.getElementById('vocab-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const word = document.getElementById('vocab-word').value.trim();
        const def = document.getElementById('vocab-definition').value.trim();
        if (!word || !def) {
          showToast('Vui lòng nhập từ tiếng Anh và nghĩa tiếng Việt!', 'warning');
          return;
        }

        const id = state.editingId || `custom-vocab-${Date.now()}`;
        const topic = document.getElementById('vocab-topic').value || 'General';
        const pronunciation = document.getElementById('vocab-pronunciation').value.trim();
        const example = document.getElementById('vocab-example').value.trim();
        const exampleTranslation = document.getElementById('vocab-example-translation').value.trim();
        const grammarPattern = document.getElementById('vocab-grammar-pattern').value.trim();

        // Selected type
        let selectedType = 'noun';
        const checkedBox = document.querySelector('input[name="vocab-type-cb"]:checked');
        if (checkedBox) selectedType = checkedBox.value;

        const record = {
          id,
          word,
          pronunciation,
          type: selectedType,
          definition: def,
          example,
          exampleTranslation,
          grammarPattern,
          topic,
          status: 'learning',
          createdAt: Date.now()
        };

        try {
          await VocabDB.put('vocabulary', record);
          showToast(state.editingId ? 'Đã cập nhật từ vựng thành công!' : 'Đã thêm từ vựng mới vào kho!', 'success');
          resetForm();
          await updateStatsHeader();
          await loadData();
        } catch (err) {
          console.error(err);
          showToast('Lỗi khi lưu từ vựng!', 'error');
        }
      });
    }

    // Cancel edit
    const cancelBtn = document.getElementById('vocab-btn-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', resetForm);
    }

    // Toggle advanced fields
    const advToggleBtn = document.getElementById('vocab-toggle-adv-btn');
    if (advToggleBtn) {
      advToggleBtn.addEventListener('click', () => toggleAdvFields());
    }

    // Search input
    const searchInput = document.getElementById('vocab-search');
    if (searchInput) {
      let debounce = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          state.searchQuery = e.target.value;
          state.currentPage = 1;
          applyFilters();
        }, 200);
      });
    }

    // Filter topic select
    const filterTopic = document.getElementById('vocab-filter-topic');
    if (filterTopic) {
      filterTopic.addEventListener('change', (e) => {
        state.selectedTopic = e.target.value;
        state.currentPage = 1;
        renderTopicUI();
        applyFilters();
      });
    }

    // Filter type select
    const filterType = document.getElementById('vocab-filter-type');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        state.filterType = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }

    // Filter status select
    const filterStatus = document.getElementById('vocab-filter-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        state.filterStatus = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await initShared();
    bindEvents();
    await loadData();
  });

})();

