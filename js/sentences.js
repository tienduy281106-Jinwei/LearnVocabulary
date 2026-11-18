/**
 * sentences.js — VocabMaster Sentences Logic
 * Quản lý luyện tập đặt câu với từ vựng, lưu trữ vào IndexedDB.
 */

(function () {
  'use strict';

  const state = {
    sentences: [],
    searchQuery: '',
    editingId: null
  };

  async function loadData() {
    try {
      state.sentences = await VocabDB.getAll('sentences');

      const countEl = document.getElementById('header-sentences-count');
      if (countEl) countEl.textContent = state.sentences.length;

      renderSentences();
    } catch (err) {
      console.error('[Sentences] Lỗi nạp câu:', err);
      showToast('Lỗi khi nạp danh sách câu!', 'error');
    }
  }

  function renderSentences() {
    const container = document.getElementById('sentences-list-container');
    if (!container) return;

    let list = [...state.sentences];
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        (s.sentence && s.sentence.toLowerCase().includes(q)) ||
        (s.translation && s.translation.toLowerCase().includes(q)) ||
        (s.word && s.word.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-pen-nib" style="font-size: 40px; opacity: 0.5; margin-bottom: 12px;"></i>
          <h4 style="color: var(--text-main);">Chưa có câu nào được lưu</h4>
          <p style="font-size: 13px;">Hãy nhập từ vựng và viết câu ứng dụng đầu tiên ở khung bên trái!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(s => `
      <div class="panel" style="padding: 16px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
          <span class="vocab-card-type" style="font-size: 11px; background: rgba(99,102,241,0.2); color: var(--color-primary-light);">
            <i class="fa-solid fa-tag"></i> ${escapeHtml(s.word || 'Vocabulary')}
          </span>
          <div style="display: flex; gap: 6px;">
            <button class="btn-icon" onclick="speak('${escapeHtml(s.sentence)}')" title="Nghe đọc câu" style="color: var(--color-primary-light);">
              <i class="fa-solid fa-volume-high"></i>
            </button>
            <button class="btn-icon" onclick="window.editSentence('${s.id}')" title="Sửa câu">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon" onclick="window.deleteSentence('${s.id}')" title="Xóa câu" style="color: var(--color-danger);">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        <div style="font-size: 15px; font-weight: 600; color: var(--text-main); line-height: 1.5;">
          ${escapeHtml(s.sentence)}
        </div>
        ${s.translation ? `
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
            ${escapeHtml(s.translation)}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  window.editSentence = async function (id) {
    try {
      const s = await VocabDB.get('sentences', id);
      if (!s) return;

      state.editingId = id;
      document.getElementById('sentence-id').value = s.id;
      document.getElementById('sentence-target-word').value = s.word || '';
      document.getElementById('sentence-en').value = s.sentence || '';
      document.getElementById('sentence-vi').value = s.translation || '';

      document.getElementById('sentence-form-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Sửa câu đã đặt';
      document.getElementById('sentence-btn-submit').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cập nhật câu';
      document.getElementById('sentence-btn-cancel').style.display = 'inline-block';

      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    }
  };

  window.deleteSentence = async function (id) {
    if (!confirm('Bạn có chắc chắn muốn xóa câu này?')) return;
    try {
      await VocabDB.delete('sentences', id);
      showToast('Đã xóa câu thành công!', 'success');
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xóa câu', 'error');
    }
  };

  function resetForm() {
    state.editingId = null;
    const form = document.getElementById('sentence-form');
    if (form) form.reset();
    document.getElementById('sentence-id').value = '';
    document.getElementById('sentence-form-title').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Đặt câu tiếng Anh mới';
    document.getElementById('sentence-btn-submit').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu câu đã đặt';
    document.getElementById('sentence-btn-cancel').style.display = 'none';
  }

  function bindEvents() {
    const form = document.getElementById('sentence-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const word = document.getElementById('sentence-target-word').value.trim();
        const sentence = document.getElementById('sentence-en').value.trim();
        const translation = document.getElementById('sentence-vi').value.trim();

        if (!word || !sentence) {
          showToast('Vui lòng nhập từ vựng và câu tiếng Anh!', 'warning');
          return;
        }

        const id = state.editingId || `custom-s-${Date.now()}`;
        const record = {
          id,
          word,
          sentence,
          translation,
          createdAt: Date.now()
        };

        try {
          await VocabDB.put('sentences', record);
          showToast(state.editingId ? 'Đã cập nhật câu thành công!' : 'Đã lưu câu đặt mới!', 'success');
          resetForm();
          await loadData();
        } catch (err) {
          console.error(err);
          showToast('Lỗi khi lưu câu!', 'error');
        }
      });
    }

    const cancelBtn = document.getElementById('sentence-btn-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

    const searchInput = document.getElementById('sentence-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderSentences();
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

