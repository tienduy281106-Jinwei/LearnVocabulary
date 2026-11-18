/**
 * all-vocab.js — Bảng tổng hợp toàn bộ từ vựng
 * Hiển thị dạng bảng, hỗ trợ tìm kiếm, lọc theo chủ đề, phân trang, xuất CSV và sao chép.
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
    itemsPerPage: 50
  };

  async function loadData() {
    try {
      state.allWords = await VocabDB.getAll('vocabulary');
      populateTopicFilter();
      applyFilters();
    } catch (err) {
      console.error('[AllVocab] Lỗi nạp từ vựng:', err);
      showToast('Lỗi khi nạp dữ liệu từ vựng!', 'error');
    }
  }

  function populateTopicFilter() {
    const select = document.getElementById('all-vocab-filter-topic');
    if (!select) return;

    const topicsMap = new Map();
    state.allWords.forEach(v => {
      const t = v.topic || 'General';
      topicsMap.set(t, (topicsMap.get(t) || 0) + 1);
    });

    let opts = `<option value="all">🌐 Tất cả chủ đề (${state.allWords.length} từ)</option>`;
    Array.from(topicsMap.entries()).sort((a, b) => b[1] - a[1]).forEach(([tName, count]) => {
      opts += `<option value="${escapeHtml(tName)}">${escapeHtml(tName)} (${count} từ)</option>`;
    });
    select.innerHTML = opts;
  }

  function applyFilters() {
    let list = [...state.allWords];

    // Topic
    if (state.selectedTopic !== 'all') {
      list = list.filter(v => (v.topic || 'General') === state.selectedTopic);
    }

    // Search
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(v =>
        (v.word && v.word.toLowerCase().includes(q)) ||
        (v.definition && v.definition.toLowerCase().includes(q)) ||
        (v.example && v.example.toLowerCase().includes(q)) ||
        (v.grammarPattern && v.grammarPattern.toLowerCase().includes(q))
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
    renderTable();
    renderPagination();
    updateStatsBar();
  }

  function updateStatsBar() {
    const bar = document.getElementById('all-vocab-stats-bar');
    if (!bar) return;
    const total = state.filteredWords.length;
    const mastered = state.filteredWords.filter(v => v.status === 'mastered' || v.status === 'learned').length;
    const totalPages = state.itemsPerPage === 'all' ? 1 : Math.max(1, Math.ceil(total / state.itemsPerPage));

    bar.innerHTML = `
      <span>Tìm thấy <strong>${total}</strong> từ vựng (${mastered} đã thuộc)</span>
      <span>Trang ${state.currentPage} / ${totalPages}</span>
    `;
  }

  function renderTable() {
    const tbody = document.getElementById('all-vocab-table-body');
    if (!tbody) return;

    if (state.filteredWords.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-folder-open" style="font-size: 32px; opacity: 0.5; margin-bottom: 8px;"></i>
            <div>Không tìm thấy từ vựng nào khớp với bộ lọc.</div>
          </td>
        </tr>
      `;
      return;
    }

    let paged = state.filteredWords;
    let startIdx = 0;
    if (state.itemsPerPage !== 'all') {
      const perPage = parseInt(state.itemsPerPage, 10);
      startIdx = (state.currentPage - 1) * perPage;
      paged = state.filteredWords.slice(startIdx, startIdx + perPage);
    }

    tbody.innerHTML = paged.map((v, idx) => {
      const stt = startIdx + idx + 1;
      const isMastered = v.status === 'mastered' || v.status === 'learned';

      return `
        <tr style="border-bottom: 1px solid var(--border-glass); transition: background 0.15s;">
          <td style="text-align: center; font-weight: 600; color: var(--text-muted); padding: 12px 10px;">${stt}</td>
          <td style="padding: 12px 10px;">
            <div style="font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              <span>${escapeHtml(v.word)}</span>
              <button class="btn-icon" onclick="speak('${escapeHtml(v.word)}')" title="Phát âm" style="color: var(--color-primary-light); font-size: 11px;">
                <i class="fa-solid fa-volume-high"></i>
              </button>
            </div>
            ${v.pronunciation ? `<div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">${escapeHtml(v.pronunciation)}</div>` : ''}
          </td>
          <td style="padding: 12px 10px; font-size: 13px; color: var(--color-primary-light);">
            ${escapeHtml(v.topic || 'General')}
          </td>
          <td style="padding: 12px 10px;">
            <span class="vocab-card-type" style="font-size: 11px;">${escapeHtml(v.type || 'noun')}</span>
          </td>
          <td style="padding: 12px 10px; font-weight: 500; color: var(--text-main);">
            ${escapeHtml(v.definition || '')}
          </td>
          <td style="padding: 12px 10px; font-size: 12px; color: var(--text-muted);">
            ${v.grammarPattern ? `<div style="color: #ff9800; margin-bottom: 2px;"><i class="fa-solid fa-diagram-project"></i> ${escapeHtml(v.grammarPattern)}</div>` : ''}
            ${v.example ? `<div style="font-style: italic;">"${escapeHtml(v.example)}"</div>` : ''}
          </td>
          <td style="text-align: center; padding: 12px 10px;">
            <button class="btn-icon" onclick="window.toggleMasteredFromTable('${v.id}')" title="${isMastered ? 'Đã thuộc (Nhấn để hủy)' : 'Chưa thuộc (Nhấn để thuộc)'}" style="color: ${isMastered ? 'var(--color-success)' : 'var(--text-muted)'}; font-size: 16px;">
              <i class="fa-${isMastered ? 'solid' : 'regular'} fa-circle-check"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPagination() {
    const container = document.getElementById('all-vocab-pagination-container');
    if (!container) return;

    if (state.itemsPerPage === 'all') {
      container.innerHTML = '';
      return;
    }

    const perPage = parseInt(state.itemsPerPage, 10);
    const totalPages = Math.ceil(state.filteredWords.length / perPage);
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
          window.scrollTo({ top: 200, behavior: 'smooth' });
        }
      });
    });
  }

  window.toggleMasteredFromTable = async function (id) {
    try {
      const item = await VocabDB.get('vocabulary', id);
      if (!item) return;
      const isMastered = item.status === 'mastered' || item.status === 'learned';
      item.status = isMastered ? 'learning' : 'mastered';
      await VocabDB.put('vocabulary', item);
      await updateStatsHeader();
      await loadData();
      showToast(isMastered ? 'Đã đổi trạng thái: Cần học lại' : 'Đã đổi trạng thái: Đã thuộc! 🎉', 'success');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi cập nhật trạng thái', 'error');
    }
  };

  function exportToCSV() {
    if (state.filteredWords.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'warning');
      return;
    }

    const headers = ['STT', 'Tu_vung', 'Phien_am', 'Loai_tu', 'Nghia_tieng_Viet', 'Chu_de', 'Cu_phap', 'Vi_du', 'Trang_thai'];
    const rows = state.filteredWords.map((v, i) => [
      i + 1,
      `"${(v.word || '').replace(/"/g, '""')}"`,
      `"${(v.pronunciation || '').replace(/"/g, '""')}"`,
      `"${(v.type || '').replace(/"/g, '""')}"`,
      `"${(v.definition || '').replace(/"/g, '""')}"`,
      `"${(v.topic || 'General').replace(/"/g, '""')}"`,
      `"${(v.grammarPattern || '').replace(/"/g, '""')}"`,
      `"${(v.example || '').replace(/"/g, '""')}"`,
      v.status === 'mastered' ? 'Đã thuộc' : 'Đang học'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VocabMaster_Tu_Vung_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file CSV thành công!', 'success');
  }

  function copyTableToClipboard() {
    if (state.filteredWords.length === 0) {
      showToast('Không có dữ liệu để sao chép!', 'warning');
      return;
    }

    const textLines = state.filteredWords.map((v, i) => 
      `${i + 1}\t${v.word}\t${v.pronunciation || ''}\t${v.type || ''}\t${v.definition || ''}\t${v.topic || ''}`
    );
    const fullText = `STT\tTừ vựng\tPhiên âm\tLoại từ\tNghĩa\tChủ đề\n` + textLines.join('\n');

    navigator.clipboard.writeText(fullText).then(() => {
      showToast('Đã sao chép bảng vào bộ nhớ tạm!', 'success');
    }).catch(() => {
      showToast('Lỗi sao chép vào bộ nhớ tạm', 'error');
    });
  }

  function bindEvents() {
    const searchInput = document.getElementById('all-vocab-search');
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

    const topicSelect = document.getElementById('all-vocab-filter-topic');
    if (topicSelect) {
      topicSelect.addEventListener('change', (e) => {
        state.selectedTopic = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }

    const typeSelect = document.getElementById('all-vocab-filter-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        state.filterType = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }

    const statusSelect = document.getElementById('all-vocab-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        state.filterStatus = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }

    const perPageSelect = document.getElementById('all-vocab-per-page');
    if (perPageSelect) {
      perPageSelect.addEventListener('change', (e) => {
        state.itemsPerPage = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }

    const exportBtn = document.getElementById('all-vocab-btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);

    const copyBtn = document.getElementById('all-vocab-btn-copy');
    if (copyBtn) copyBtn.addEventListener('click', copyTableToClipboard);
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

