/**
 * vocab-admin.js — Nhánh 1: Quản lý và Thêm Lượng Từ Vựng Theo Chủ Đề
 * Hỗ trợ tạo topic mới, thêm/sửa/xóa từ vựng, nạp file CSV hàng loạt, lưu trữ IndexedDB.
 */

(function () {
  'use strict';

  const state = {
    allWords: [],
    filteredWords: [],
    topics: [],
    selectedTopic: 'all',
    searchQuery: '',
    filterType: 'all',
    currentPage: 1,
    itemsPerPage: 20,
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
      buildTopicList();
      populateTopicSelects();
      renderTopicPills();
      applyFilters();
    } catch (e) {
      console.error('[VocabAdmin] Lỗi nạp dữ liệu:', e);
      showToast('Lỗi khi nạp dữ liệu từ vựng!', 'error');
    }
  }

  function buildTopicList() {
    const topicsMap = new Map();

    Object.keys(DEFAULT_TOPIC_ICONS).forEach(t => {
      topicsMap.set(t, { name: t, icon: DEFAULT_TOPIC_ICONS[t], count: 0 });
    });

    state.allWords.forEach(v => {
      const t = v.topic || 'General';
      if (!topicsMap.has(t)) {
        topicsMap.set(t, { name: t, icon: '🏷️', count: 0 });
      }
      topicsMap.get(t).count++;
    });

    state.topics = Array.from(topicsMap.values());
  }

  function populateTopicSelects() {
    const select = document.getElementById('admin-vocab-topic');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = state.topics.map(t => `
      <option value="${escapeHtml(t.name)}">${t.icon} ${escapeHtml(t.name)} (${t.count} từ)</option>
    `).join('');

    if (currentVal && state.topics.some(t => t.name === currentVal)) {
      select.value = currentVal;
    }
  }

  function renderTopicPills() {
    const container = document.getElementById('admin-topic-pills');
    if (!container) return;

    let html = `
      <button class="topic-pill ${state.selectedTopic === 'all' ? 'active' : ''}" data-topic="all">
        <span class="topic-pill-icon">🌐</span> Tất cả (${state.allWords.length})
      </button>
    `;

    state.topics.forEach(t => {
      html += `
        <button class="topic-pill ${state.selectedTopic === t.name ? 'active' : ''}" data-topic="${escapeHtml(t.name)}">
          <span class="topic-pill-icon">${t.icon}</span> ${escapeHtml(t.name)} (${t.count})
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.topic-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedTopic = btn.dataset.topic;
        state.currentPage = 1;
        renderTopicPills();
        applyFilters();
      });
    });
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
        (v.grammarPattern && v.grammarPattern.toLowerCase().includes(q))
      );
    }

    // Type
    if (state.filterType !== 'all') {
      list = list.filter(v => (v.type || '').toLowerCase() === state.filterType);
    }

    state.filteredWords = list;
    renderTable();
    renderPagination();
    updateStatsBar();
  }

  function updateStatsBar() {
    const bar = document.getElementById('admin-vocab-stats-bar');
    if (!bar) return;
    const total = state.filteredWords.length;
    const totalPages = Math.max(1, Math.ceil(total / state.itemsPerPage));

    bar.innerHTML = `
      <span>Hiển thị <strong>${total}</strong> từ vựng (${state.selectedTopic === 'all' ? 'Toàn bộ hệ thống' : `Chủ đề: ${escapeHtml(state.selectedTopic)}`})</span>
      <span>Trang ${state.currentPage} / ${totalPages}</span>
    `;
  }

  function renderTable() {
    const tbody = document.getElementById('admin-vocab-tbody');
    if (!tbody) return;

    if (state.filteredWords.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-folder-open" style="font-size: 32px; opacity: 0.5; margin-bottom: 8px;"></i>
            <div>Không có từ vựng nào trong chủ đề này. Hãy thêm từ vựng mới!</div>
          </td>
        </tr>
      `;
      return;
    }

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paged = state.filteredWords.slice(start, start + state.itemsPerPage);

    tbody.innerHTML = paged.map((v, i) => {
      const stt = start + i + 1;
      return `
        <tr style="border-bottom: 1px solid var(--border-glass); transition: background 0.15s;">
          <td style="text-align: center; color: var(--text-muted); padding: 12px 10px;">${stt}</td>
          <td style="padding: 12px 10px;">
            <div style="font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
              <span>${escapeHtml(v.word)}</span>
              <button class="btn-icon" onclick="speak('${escapeHtml(v.word)}')" title="Phát âm" style="color: var(--color-primary-light); font-size: 11px;">
                <i class="fa-solid fa-volume-high"></i>
              </button>
            </div>
            ${v.pronunciation ? `<div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">${escapeHtml(v.pronunciation)}</div>` : ''}
          </td>
          <td style="padding: 12px 10px; font-size: 13px; color: var(--admin-accent-light);">
            ${escapeHtml(v.topic || 'General')}
          </td>
          <td style="padding: 12px 10px;">
            <span class="vocab-card-type" style="font-size: 11px;">${escapeHtml(v.type || 'noun')}</span>
          </td>
          <td style="padding: 12px 10px; font-weight: 500; color: var(--text-main);">
            ${escapeHtml(v.definition || '')}
          </td>
          <td style="padding: 12px 10px; font-size: 12px; color: var(--text-muted);">
            ${v.grammarPattern ? `<div style="color: #ff9800;"><i class="fa-solid fa-diagram-project"></i> ${escapeHtml(v.grammarPattern)}</div>` : ''}
            ${v.example ? `<div style="font-style: italic; margin-top: 2px;">"${escapeHtml(v.example)}"</div>` : ''}
          </td>
          <td style="text-align: center; padding: 12px 10px;">
            <div style="display: flex; justify-content: center; gap: 6px;">
              <button class="btn-icon" onclick="window.editAdminVocab('${v.id}')" title="Sửa từ" style="color: var(--color-primary-light);">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon" onclick="window.deleteAdminVocab('${v.id}')" title="Xóa từ" style="color: var(--color-danger);">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPagination() {
    const container = document.getElementById('admin-vocab-pagination');
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
          renderTable();
          renderPagination();
          updateStatsBar();
        }
      });
    });
  }

  window.editAdminVocab = async function (id) {
    try {
      const item = await VocabDB.get('vocabulary', id);
      if (!item) return;

      state.editingId = id;
      document.getElementById('admin-vocab-id').value = item.id;
      document.getElementById('admin-vocab-word').value = item.word || '';
      document.getElementById('admin-vocab-pronunciation').value = item.pronunciation || '';
      document.getElementById('admin-vocab-type').value = item.type || 'noun';
      document.getElementById('admin-vocab-definition').value = item.definition || '';
      document.getElementById('admin-vocab-example').value = item.example || '';
      document.getElementById('admin-vocab-translation').value = item.exampleTranslation || '';
      document.getElementById('admin-vocab-grammar').value = item.grammarPattern || '';
      document.getElementById('admin-vocab-topic').value = item.topic || 'General';

      document.getElementById('form-vocab-title').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color: var(--admin-accent);"></i> Sửa Từ Vựng';
      document.getElementById('admin-btn-save-vocab').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cập nhật từ vựng';
      document.getElementById('admin-btn-cancel-edit').style.display = 'inline-block';

      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    }
  };

  window.deleteAdminVocab = async function (id) {
    if (!confirm('Bạn có chắc chắn muốn xóa từ vựng này khỏi hệ thống?')) return;
    try {
      await VocabDB.delete('vocabulary', id);
      showToast('Đã xóa từ vựng thành công!', 'success');
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xóa từ vựng', 'error');
    }
  };

  function resetForm() {
    state.editingId = null;
    const form = document.getElementById('admin-vocab-form');
    if (form) form.reset();
    document.getElementById('admin-vocab-id').value = '';
    document.getElementById('form-vocab-title').innerHTML = '<i class="fa-solid fa-plus-circle" style="color: var(--admin-accent);"></i> Thêm Từ Vựng Mới';
    document.getElementById('admin-btn-save-vocab').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu từ vựng';
    document.getElementById('admin-btn-cancel-edit').style.display = 'none';
  }

  function handleCsvImport(file) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        showToast('File CSV trống!', 'warning');
        return;
      }

      let count = 0;
      const newItems = [];
      const now = Date.now();

      lines.forEach((line, idx) => {
        // Skip header if contains 'Từ' or 'word'
        if (idx === 0 && (line.toLowerCase().includes('từ') || line.toLowerCase().includes('word'))) return;

        // Simple CSV parse
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 2 && parts[0] && parts[1]) {
          const word = parts[0];
          const pronunciation = parts.length > 2 ? parts[1] : '';
          const type = parts.length > 3 ? parts[2].toLowerCase() : 'noun';
          const definition = parts.length > 3 ? parts[3] : parts[1];
          const topic = parts.length > 4 ? parts[4] : (state.selectedTopic !== 'all' ? state.selectedTopic : 'General');

          newItems.push({
            id: `csv-vocab-${now}-${idx}`,
            word,
            pronunciation,
            type,
            definition,
            topic: topic || 'General',
            status: 'learning',
            createdAt: now + idx
          });
          count++;
        }
      });

      if (newItems.length > 0) {
        await VocabDB.bulkPut('vocabulary', newItems);
        showToast(`Đã nhập thành công ${count} từ vựng mới vào DB! 🎉`, 'success');
        await loadData();
      } else {
        showToast('Không đọc được dữ liệu hợp lệ từ file!', 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function bindEvents() {
    // Form submit
    const form = document.getElementById('admin-vocab-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const word = document.getElementById('admin-vocab-word').value.trim();
        const definition = document.getElementById('admin-vocab-definition').value.trim();
        const topic = document.getElementById('admin-vocab-topic').value || 'General';

        if (!word || !definition) {
          showToast('Vui lòng nhập từ tiếng Anh và nghĩa tiếng Việt!', 'warning');
          return;
        }

        const id = state.editingId || `admin-vocab-${Date.now()}`;
        const item = {
          id,
          word,
          pronunciation: document.getElementById('admin-vocab-pronunciation').value.trim(),
          type: document.getElementById('admin-vocab-type').value || 'noun',
          definition,
          example: document.getElementById('admin-vocab-example').value.trim(),
          exampleTranslation: document.getElementById('admin-vocab-translation').value.trim(),
          grammarPattern: document.getElementById('admin-vocab-grammar').value.trim(),
          topic,
          status: 'learning',
          createdAt: Date.now()
        };

        try {
          await VocabDB.put('vocabulary', item);
          showToast(state.editingId ? 'Đã cập nhật từ vựng thành công!' : 'Đã thêm từ vựng mới vào chủ đề!', 'success');
          resetForm();
          await loadData();
        } catch (err) {
          console.error(err);
          showToast('Lỗi khi lưu từ vựng!', 'error');
        }
      });
    }

    const cancelEditBtn = document.getElementById('admin-btn-cancel-edit');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);

    // Search input
    const searchInput = document.getElementById('admin-vocab-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }

    // Type filter
    const typeFilter = document.getElementById('admin-filter-type');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        state.filterType = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }

    // Create Topic Modal
    const modal = document.getElementById('modal-create-topic');
    const openModalBtn = document.getElementById('btn-create-topic-modal');
    const closeModalBtn = document.getElementById('btn-close-topic-modal');
    const cancelModalBtn = document.getElementById('btn-cancel-topic-modal');
    const topicForm = document.getElementById('form-new-topic');

    if (openModalBtn && modal) {
      openModalBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    }
    if (closeModalBtn && modal) {
      closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    if (cancelModalBtn && modal) {
      cancelModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    if (topicForm) {
      topicForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-topic-name').value.trim();
        const icon = document.getElementById('new-topic-icon').value.trim() || '🏷️';
        if (!name) return;

        DEFAULT_TOPIC_ICONS[name] = icon;
        modal.style.display = 'none';
        topicForm.reset();

        showToast(`Đã tạo chủ đề mới: ${icon} ${name}`, 'success');

        // Thêm ngay 1 từ mẫu để IndexedDB ghi nhận topic mới
        const placeholderWord = {
          id: `topic-seed-${Date.now()}`,
          word: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
          pronunciation: '',
          type: 'noun',
          definition: `Chủ đề ${name}`,
          topic: name,
          status: 'learning',
          createdAt: Date.now()
        };
        await VocabDB.put('vocabulary', placeholderWord);

        await loadData();
        state.selectedTopic = name;
        renderTopicPills();
        applyFilters();
      });
    }

    // CSV import triggers
    const csvBtn = document.getElementById('btn-trigger-csv-import');
    const fileInput = document.getElementById('admin-csv-file');
    if (csvBtn && fileInput) {
      csvBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleCsvImport(e.target.files[0]);
        }
      });
    }

    // Export CSV
    const exportBtn = document.getElementById('admin-btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const headers = ['Từ', 'Phiên âm', 'Loại từ', 'Nghĩa', 'Chủ đề', 'Cú pháp'];
        const rows = state.filteredWords.map(v => [
          `"${(v.word || '').replace(/"/g, '""')}"`,
          `"${(v.pronunciation || '').replace(/"/g, '""')}"`,
          `"${(v.type || '').replace(/"/g, '""')}"`,
          `"${(v.definition || '').replace(/"/g, '""')}"`,
          `"${(v.topic || 'General').replace(/"/g, '""')}"`,
          `"${(v.grammarPattern || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VocabMaster_Admin_Export_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất dữ liệu ra CSV thành công!', 'success');
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

