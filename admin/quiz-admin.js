/**
 * quiz-admin.js — Nhánh 2: Quản lý & Thêm Câu Hỏi Kiểm Tra
 * Hỗ trợ tạo mới câu hỏi trắc nghiệm (MCQ) & điền từ (FITB),
 * thiết lập đáp án đúng và hướng dẫn sửa lỗi cho người học khi làm sai,
 * lưu trữ và đồng bộ hóa qua IndexedDB (VocabMasterDB).
 */

(function () {
  'use strict';

  const state = {
    allQuestions: [],
    filteredQuestions: [],
    allTopics: [],
    selectedTopic: 'all',
    searchQuery: '',
    filterType: 'all',
    currentPage: 1,
    itemsPerPage: 15,
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

  function getTopicIcon(topic) {
    return DEFAULT_TOPIC_ICONS[topic] || '📝';
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

  async function init() {
    try {
      if (typeof initShared === 'function') {
        await initShared();
      }

      await VocabDB.open();
      if (typeof ensureDatabaseSeeded === 'function') {
        await ensureDatabaseSeeded();
      }

      bindFormEvents();
      bindFilterEvents();
      await loadData();
    } catch (err) {
      console.error('[QuizAdmin] Lỗi khởi tạo:', err);
      showToast('Có lỗi xảy ra khi nạp ngân hàng câu hỏi!', 'error');
    }
  }

  async function loadData() {
    try {
      // Nạp danh sách câu hỏi
      state.allQuestions = await VocabDB.getAll('quiz_questions');

      // Nạp danh sách các chủ đề từ store vocabulary để phong phú lựa chọn
      const vocabList = await VocabDB.getAll('vocabulary');
      const topicSet = new Set();

      Object.keys(DEFAULT_TOPIC_ICONS).forEach(t => topicSet.add(t));
      vocabList.forEach(v => { if (v.topic) topicSet.add(v.topic); });
      state.allQuestions.forEach(q => { if (q.topic) topicSet.add(q.topic); });

      state.allTopics = Array.from(topicSet);

      populateTopicSelect();
      renderTopicPills();
      applyFilters();
    } catch (e) {
      console.error('[QuizAdmin] Lỗi khi nạp dữ liệu:', e);
      showToast('Lỗi khi đọc câu hỏi từ IndexedDB!', 'error');
    }
  }

  function populateTopicSelect() {
    const select = document.getElementById('admin-q-topic');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = state.allTopics.map(t => {
      const count = state.allQuestions.filter(q => q.topic === t).length;
      return `<option value="${escapeHtml(t)}">${getTopicIcon(t)} ${escapeHtml(t)} (${count} câu hỏi)</option>`;
    }).join('');

    if (currentVal && state.allTopics.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  function renderTopicPills() {
    const container = document.getElementById('admin-q-topic-pills');
    if (!container) return;

    let html = `
      <button class="topic-pill ${state.selectedTopic === 'all' ? 'active' : ''}" data-topic="all">
        <span class="topic-pill-icon">🌐</span> Tất cả (${state.allQuestions.length})
      </button>
    `;

    // Chỉ hiển thị các topic có câu hỏi hoặc trong danh sách chính
    state.allTopics.forEach(t => {
      const count = state.allQuestions.filter(q => q.topic === t).length;
      if (count > 0 || DEFAULT_TOPIC_ICONS[t]) {
        html += `
          <button class="topic-pill ${state.selectedTopic === t ? 'active' : ''}" data-topic="${escapeHtml(t)}">
            <span class="topic-pill-icon">${getTopicIcon(t)}</span> ${escapeHtml(t)} (${count})
          </button>
        `;
      }
    });

    container.innerHTML = html;

    container.querySelectorAll('.topic-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedTopic = btn.getAttribute('data-topic');
        state.currentPage = 1;
        renderTopicPills();
        applyFilters();
      });
    });
  }

  function bindFormEvents() {
    // 1. Radio chuyển đổi loại câu hỏi (MCQ / FITB)
    const typeRadios = document.querySelectorAll('input[name="admin-q-type"]');
    const mcqFields = document.getElementById('admin-mcq-fields');
    const fitbFields = document.getElementById('admin-fitb-fields');
    const optInputs = ['admin-opt-a', 'admin-opt-b', 'admin-opt-c', 'admin-opt-d'].map(id => document.getElementById(id));
    const fitbWordInput = document.getElementById('admin-fitb-word');

    typeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'mcq' && radio.checked) {
          mcqFields.style.display = 'block';
          fitbFields.style.display = 'none';
          optInputs.forEach(i => { if (i) i.required = true; });
          if (fitbWordInput) fitbWordInput.required = false;
        } else if (radio.value === 'fitb' && radio.checked) {
          mcqFields.style.display = 'none';
          fitbFields.style.display = 'block';
          optInputs.forEach(i => { if (i) i.required = false; });
          if (fitbWordInput) fitbWordInput.required = true;
        }
      });
    });

    // 2. Submit form
    const form = document.getElementById('admin-quiz-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    // 3. Cancel button
    const cancelBtn = document.getElementById('admin-btn-cancel-q');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditing);
    }
  }

  function bindFilterEvents() {
    const searchInput = document.getElementById('admin-q-search');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          state.searchQuery = e.target.value.trim().toLowerCase();
          state.currentPage = 1;
          applyFilters();
        }, 250);
      });
    }

    const filterType = document.getElementById('admin-q-filter-type');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        state.filterType = e.target.value;
        state.currentPage = 1;
        applyFilters();
      });
    }
  }

  function applyFilters() {
    let list = [...state.allQuestions];

    // Filter by topic
    if (state.selectedTopic !== 'all') {
      list = list.filter(q => q.topic === state.selectedTopic);
    }

    // Filter by question type
    if (state.filterType !== 'all') {
      list = list.filter(q => (q.questionType || 'mcq') === state.filterType);
    }

    // Search query
    if (state.searchQuery) {
      const qLower = state.searchQuery;
      list = list.filter(q => {
        const text = (q.question || '').toLowerCase();
        const word = (q.correctWord || '').toLowerCase();
        const expl = (q.explanation || '').toLowerCase();
        const opts = (q.options || []).map(o => String(o).toLowerCase()).join(' ');
        return text.includes(qLower) || word.includes(qLower) || expl.includes(qLower) || opts.includes(qLower);
      });
    }

    state.filteredQuestions = list;
    renderStatsBar();
    renderQuestionsList();
    renderPagination();
  }

  function renderStatsBar() {
    const bar = document.getElementById('admin-q-stats-bar');
    if (!bar) return;

    const total = state.allQuestions.length;
    const filtered = state.filteredQuestions.length;
    const mcqCount = state.filteredQuestions.filter(q => (q.questionType || 'mcq') === 'mcq').length;
    const fitbCount = state.filteredQuestions.filter(q => q.questionType === 'fitb').length;

    bar.innerHTML = `
      <div>
        Hiển thị <strong>${filtered}</strong> / <strong>${total}</strong> câu hỏi
        ${state.selectedTopic !== 'all' ? `(Chủ đề: <em>${escapeHtml(state.selectedTopic)}</em>)` : ''}
      </div>
      <div style="display: flex; gap: 12px;">
        <span><i class="fa-solid fa-list-check" style="color: var(--color-primary);"></i> Trắc nghiệm: <strong>${mcqCount}</strong></span>
        <span><i class="fa-solid fa-pen-to-square" style="color: var(--color-warning);"></i> Điền từ: <strong>${fitbCount}</strong></span>
      </div>
    `;
  }

  function renderQuestionsList() {
    const container = document.getElementById('admin-questions-list');
    if (!container) return;

    if (state.filteredQuestions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed var(--border-glass);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 6px;">Không tìm thấy câu hỏi phù hợp</h4>
          <p style="color: var(--text-muted); font-size: 13px;">Hãy thử điều chỉnh bộ lọc hoặc thêm câu hỏi mới ở biểu mẫu bên cạnh.</p>
        </div>
      `;
      return;
    }

    const startIdx = (state.currentPage - 1) * state.itemsPerPage;
    const pageItems = state.filteredQuestions.slice(startIdx, startIdx + state.itemsPerPage);

    container.innerHTML = pageItems.map((q, idx) => {
      const qNumber = startIdx + idx + 1;
      const isMcq = (q.questionType || 'mcq') === 'mcq';
      const typeBadge = isMcq
        ? `<span class="badge" style="background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); font-size: 11px;"><i class="fa-solid fa-list-check"></i> Trắc nghiệm</span>`
        : `<span class="badge" style="background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); font-size: 11px;"><i class="fa-solid fa-pen-to-square"></i> Điền từ</span>`;

      // Highlight the blank if present
      let questionDisplay = escapeHtml(q.question || '');
      questionDisplay = questionDisplay.replace(/_______/g, `<span style="font-weight: 700; color: var(--color-accent); text-decoration: underline; padding: 0 4px;">_______</span>`);

      // Render options or answer
      let answerBlockHtml = '';
      if (isMcq && Array.isArray(q.options) && q.options.length > 0) {
        const letters = ['A', 'B', 'C', 'D'];
        answerBlockHtml = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0;">
            ${q.options.map((opt, oIdx) => {
              const letter = letters[oIdx] || '';
              const isCorrect = (q.correctAnswer === letter) || (q.correctWord && q.correctWord.toLowerCase() === String(opt).toLowerCase());
              return `
                <div style="padding: 6px 10px; border-radius: 6px; font-size: 13px; display: flex; align-items: center; gap: 8px;
                     ${isCorrect ? 'background: rgba(16, 185, 129, 0.12); border: 1px solid var(--color-success); font-weight: 600;' : 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); opacity: 0.8;'}">
                  <span style="font-weight: 700; color: ${isCorrect ? 'var(--color-success)' : 'var(--text-muted)'};">${letter}.</span>
                  <span style="flex-grow: 1;">${escapeHtml(opt)}</span>
                  ${isCorrect ? `<i class="fa-solid fa-check" style="color: var(--color-success);"></i>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        answerBlockHtml = `
          <div style="margin: 10px 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--text-muted);">Từ chính xác cần điền:</span>
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 13px;">
              ${escapeHtml(q.correctWord || q.correctAnswer || '')}
            </span>
          </div>
        `;
      }

      // Explanation / Error correction block
      const explHtml = q.explanation ? `
        <div style="margin-top: 10px; padding: 10px 14px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--admin-blue-light); font-size: 12.5px; line-height: 1.5;">
          <div style="font-weight: 600; color: var(--admin-blue-light); margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-lightbulb" style="color: var(--color-warning);"></i> Hướng dẫn sửa lỗi cho người học khi làm sai:
          </div>
          <div style="color: var(--text-main);">${escapeHtml(q.explanation)}</div>
        </div>
      ` : '';

      return `
        <div class="vocab-row-card" style="padding: 18px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-glass); transition: all 0.2s ease;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-weight: 700; color: var(--text-muted); font-size: 12px;">#${qNumber}</span>
              <span class="badge" style="background: rgba(255,255,255,0.06); font-size: 11px;">
                ${getTopicIcon(q.topic)} ${escapeHtml(q.topic || 'General')}
              </span>
              ${typeBadge}
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm btn-edit-q" data-id="${escapeHtml(q.id)}" title="Chỉnh sửa câu hỏi" style="padding: 4px 8px; font-size: 12px;">
                <i class="fa-solid fa-pen"></i> Sửa
              </button>
              <button class="btn btn-secondary btn-sm btn-del-q" data-id="${escapeHtml(q.id)}" title="Xóa câu hỏi" style="padding: 4px 8px; font-size: 12px; color: var(--color-accent);">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <div style="font-size: 14.5px; font-weight: 500; color: var(--text-main); line-height: 1.5; margin-bottom: 6px;">
            ${questionDisplay}
          </div>

          ${answerBlockHtml}
          ${explHtml}
        </div>
      `;
    }).join('');

    // Bind action buttons
    container.querySelectorAll('.btn-edit-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        startEditing(id);
      });
    });

    container.querySelectorAll('.btn-del-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteQuestion(id);
      });
    });
  }

  function renderPagination() {
    const container = document.getElementById('admin-q-pagination');
    if (!container) return;

    const totalPages = Math.ceil(state.filteredQuestions.length / state.itemsPerPage);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Prev Button
    html += `
      <button class="btn btn-secondary btn-sm" ${state.currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} id="q-page-prev">
        <i class="fa-solid fa-chevron-left"></i> Trước
      </button>
    `;

    // Page Numbers (limited window)
    const maxVisible = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      html += `<button class="btn btn-secondary btn-sm q-page-num" data-page="1">1</button>`;
      if (startPage > 2) html += `<span style="padding: 4px 8px; color: var(--text-muted);">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      const activeStyle = (p === state.currentPage) ? 'style="background: var(--color-primary); color: #fff; font-weight: 700;"' : '';
      html += `<button class="btn btn-secondary btn-sm q-page-num" data-page="${p}" ${activeStyle}>${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span style="padding: 4px 8px; color: var(--text-muted);">...</span>`;
      html += `<button class="btn btn-secondary btn-sm q-page-num" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next Button
    html += `
      <button class="btn btn-secondary btn-sm" ${state.currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} id="q-page-next">
        Sau <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;

    container.innerHTML = html;

    // Events
    const prevBtn = document.getElementById('q-page-prev');
    if (prevBtn && state.currentPage > 1) {
      prevBtn.addEventListener('click', () => {
        state.currentPage--;
        renderQuestionsList();
        renderPagination();
        scrollToTopList();
      });
    }

    const nextBtn = document.getElementById('q-page-next');
    if (nextBtn && state.currentPage < totalPages) {
      nextBtn.addEventListener('click', () => {
        state.currentPage++;
        renderQuestionsList();
        renderPagination();
        scrollToTopList();
      });
    }

    container.querySelectorAll('.q-page-num').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentPage = parseInt(btn.getAttribute('data-page'), 10);
        renderQuestionsList();
        renderPagination();
        scrollToTopList();
      });
    });
  }

  function scrollToTopList() {
    const list = document.getElementById('admin-questions-list');
    if (list) {
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const topic = document.getElementById('admin-q-topic').value;
    const typeRadios = document.getElementsByName('admin-q-type');
    let qType = 'mcq';
    for (const r of typeRadios) {
      if (r.checked) {
        qType = r.value;
        break;
      }
    }

    const question = document.getElementById('admin-q-text').value.trim();
    const explanation = document.getElementById('admin-q-explanation').value.trim();

    if (!topic || !question) {
      showToast('Vui lòng nhập đầy đủ chủ đề và nội dung câu hỏi!', 'error');
      return;
    }

    let options = [];
    let correctAnswer = '';
    let correctWord = '';

    if (qType === 'mcq') {
      const optA = document.getElementById('admin-opt-a').value.trim();
      const optB = document.getElementById('admin-opt-b').value.trim();
      const optC = document.getElementById('admin-opt-c').value.trim();
      const optD = document.getElementById('admin-opt-d').value.trim();

      if (!optA || !optB || !optC || !optD) {
        showToast('Vui lòng điền đủ 4 phương án A, B, C, D!', 'error');
        return;
      }

      options = [optA, optB, optC, optD];

      const corrRadios = document.getElementsByName('admin-correct-opt');
      for (const cr of corrRadios) {
        if (cr.checked) {
          correctAnswer = cr.value;
          break;
        }
      }

      const letterMap = { 'A': optA, 'B': optB, 'C': optC, 'D': optD };
      correctWord = letterMap[correctAnswer] || optA;

    } else {
      correctWord = document.getElementById('admin-fitb-word').value.trim();
      if (!correctWord) {
        showToast('Vui lòng nhập từ tiếng Anh chính xác cần điền!', 'error');
        return;
      }
      correctAnswer = correctWord;
      options = [];
    }

    try {
      if (state.editingId) {
        // Cập nhật câu hỏi hiện có
        const existing = state.allQuestions.find(q => q.id === state.editingId);
        const updatedQuestion = {
          ...(existing || {}),
          id: state.editingId,
          topic,
          questionType: qType,
          question,
          options,
          correctAnswer,
          correctWord,
          explanation: explanation || `Đáp án đúng là: ${correctAnswer} (${correctWord})`
        };

        await VocabDB.put('quiz_questions', updatedQuestion);
        showToast('Đã cập nhật câu hỏi thành công!', 'success');
      } else {
        // Thêm câu hỏi mới
        const newId = 'q-custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const newQuestion = {
          id: newId,
          topic,
          questionType: qType,
          question,
          options,
          correctAnswer,
          correctWord,
          explanation: explanation || `Đáp án đúng là: ${correctAnswer} (${correctWord})`,
          createdAt: Date.now()
        };

        await VocabDB.add('quiz_questions', newQuestion);
        showToast('Đã thêm câu hỏi mới thành công vào ngân hàng!', 'success');
      }

      resetForm();
      await loadData();
    } catch (err) {
      console.error('[QuizAdmin] Lỗi lưu câu hỏi:', err);
      showToast('Lỗi khi lưu câu hỏi vào cơ sở dữ liệu!', 'error');
    }
  }

  function startEditing(id) {
    const q = state.allQuestions.find(item => item.id === id);
    if (!q) return;

    state.editingId = id;

    // UI Heading
    const titleEl = document.getElementById('form-question-title');
    if (titleEl) {
      titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--color-warning);"></i> Chỉnh Sửa Câu Hỏi`;
    }

    // Set topic
    const topicSelect = document.getElementById('admin-q-topic');
    if (topicSelect) {
      topicSelect.value = q.topic || state.allTopics[0];
    }

    // Set question type
    const qType = q.questionType || 'mcq';
    const typeRadios = document.getElementsByName('admin-q-type');
    typeRadios.forEach(r => {
      r.checked = (r.value === qType);
    });

    // Trigger change event to show/hide sections
    const activeRadio = Array.from(typeRadios).find(r => r.checked);
    if (activeRadio) {
      activeRadio.dispatchEvent(new Event('change'));
    }

    // Set Question text
    const qText = document.getElementById('admin-q-text');
    if (qText) qText.value = q.question || '';

    // Options or FITB
    if (qType === 'mcq') {
      const opts = q.options || [];
      document.getElementById('admin-opt-a').value = opts[0] || '';
      document.getElementById('admin-opt-b').value = opts[1] || '';
      document.getElementById('admin-opt-c').value = opts[2] || '';
      document.getElementById('admin-opt-d').value = opts[3] || '';

      const corrRadios = document.getElementsByName('admin-correct-opt');
      corrRadios.forEach(cr => {
        cr.checked = (cr.value === q.correctAnswer);
      });
    } else {
      const fitbWord = document.getElementById('admin-fitb-word');
      if (fitbWord) fitbWord.value = q.correctWord || q.correctAnswer || '';
    }

    // Set explanation
    const expl = document.getElementById('admin-q-explanation');
    if (expl) expl.value = q.explanation || '';

    // Buttons
    const saveBtn = document.getElementById('admin-btn-save-q');
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Cập nhật câu hỏi`;
    }

    const cancelBtn = document.getElementById('admin-btn-cancel-q');
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-block';
    }

    // Scroll to form
    const form = document.getElementById('admin-quiz-form');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function resetForm() {
    state.editingId = null;

    const form = document.getElementById('admin-quiz-form');
    if (form) form.reset();

    // Default title
    const titleEl = document.getElementById('form-question-title');
    if (titleEl) {
      titleEl.innerHTML = `<i class="fa-solid fa-circle-question" style="color: var(--admin-accent);"></i> Thêm Câu Hỏi Mới`;
    }

    // Reset radios
    const typeRadios = document.getElementsByName('admin-q-type');
    typeRadios.forEach(r => {
      r.checked = (r.value === 'mcq');
    });

    const activeRadio = Array.from(typeRadios).find(r => r.checked);
    if (activeRadio) {
      activeRadio.dispatchEvent(new Event('change'));
    }

    const corrRadios = document.getElementsByName('admin-correct-opt');
    corrRadios.forEach(cr => {
      cr.checked = (cr.value === 'A');
    });

    // Reset buttons
    const saveBtn = document.getElementById('admin-btn-save-q');
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Lưu câu hỏi`;
    }

    const cancelBtn = document.getElementById('admin-btn-cancel-q');
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }
  }

  function cancelEditing() {
    resetForm();
    showToast('Đã hủy chỉnh sửa!', 'info');
  }

  async function deleteQuestion(id) {
    const q = state.allQuestions.find(item => item.id === id);
    const confirmMsg = q
      ? `Bạn có chắc chắn muốn xóa câu hỏi:\n"${q.question.substring(0, 80)}..."?`
      : 'Bạn có chắc chắn muốn xóa câu hỏi này?';

    if (!confirm(confirmMsg)) return;

    try {
      await VocabDB.delete('quiz_questions', id);
      showToast('Đã xóa câu hỏi khỏi ngân hàng!', 'success');

      if (state.editingId === id) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      console.error('[QuizAdmin] Lỗi xóa câu hỏi:', err);
      showToast('Lỗi khi xóa câu hỏi!', 'error');
    }
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

