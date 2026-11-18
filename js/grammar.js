/**
 * grammar.js — VocabMaster Grammar Page Logic
 * Quản lý 13 chủ điểm ngữ pháp, luyện viết câu chấm điểm, làm trắc nghiệm chia động từ.
 */

(function () {
  'use strict';

  const state = {
    lessons: [],
    selectedId: null,
    mcqState: {
      questions: [],
      currentIndex: 0,
      score: 0,
      hasAnswered: false
    }
  };

  async function loadData() {
    try {
      state.lessons = await VocabDB.getAll('grammar');
      if (state.lessons.length === 0 && typeof DEFAULT_GRAMMAR !== 'undefined') {
        state.lessons = [...DEFAULT_GRAMMAR];
        await VocabDB.bulkPut('grammar', state.lessons);
      }

      const countEl = document.getElementById('header-grammar-count');
      if (countEl) countEl.textContent = state.lessons.length;

      renderLessonList();

      if (state.lessons.length > 0) {
        selectLesson(state.lessons[0].id);
      }
    } catch (e) {
      console.error('[Grammar] Lỗi tải dữ liệu:', e);
      showToast('Lỗi khi nạp chủ điểm ngữ pháp!', 'error');
    }
  }

  function renderLessonList() {
    const container = document.getElementById('grammar-lesson-list');
    if (!container) return;

    container.innerHTML = state.lessons.map(l => {
      const isSelected = l.id === state.selectedId;
      return `
        <div class="grammar-nav-item ${isSelected ? 'active' : ''}" data-id="${l.id}" style="padding: 10px 14px; border-radius: 8px; cursor: pointer; margin-bottom: 6px; transition: all 0.2s; background: rgba(255,255,255,${isSelected ? '0.08' : '0.02'}); border: 1px solid ${isSelected ? 'var(--color-primary)' : 'transparent'};">
          <div style="font-weight: 600; font-size: 14px; color: ${isSelected ? 'var(--color-primary-light)' : 'var(--text-main)'};">
            <i class="fa-solid fa-bookmark" style="font-size: 11px; margin-right: 6px; color: ${isSelected ? 'var(--color-primary)' : 'var(--text-muted)'};"></i>
            ${escapeHtml(l.title)}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.grammar-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        selectLesson(el.dataset.id);
      });
    });
  }

  function selectLesson(id) {
    state.selectedId = id;
    renderLessonList();

    const lesson = state.lessons.find(l => l.id === id);
    if (!lesson) return;

    // View Elements
    document.getElementById('g-view-title').textContent = lesson.title;
    document.getElementById('g-view-formula').textContent = lesson.formula || '—';
    document.getElementById('g-view-explanation').textContent = lesson.explanation || 'Chưa có giải thích.';

    const egContainer = document.getElementById('g-view-examples');
    if (egContainer) {
      if (lesson.examples && lesson.examples.length > 0) {
        egContainer.innerHTML = lesson.examples.map(eg => `
          <div class="grammar-example-item" style="padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px; border-left: 2px solid var(--color-primary);">
            <div style="color: var(--text-main); font-weight: 500;">${escapeHtml(eg.sentence || eg.en || eg)}</div>
            ${eg.translation ? `<div style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">${escapeHtml(eg.translation)}</div>` : ''}
          </div>
        `).join('');
      } else {
        egContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">Chưa có ví dụ mẫu.</div>';
      }
    }

    // Delete custom lesson button
    const deleteContainer = document.getElementById('g-delete-action-container');
    if (deleteContainer) {
      if (lesson.id && lesson.id.startsWith('custom-')) {
        deleteContainer.innerHTML = `
          <button class="btn btn-danger btn-sm" onclick="window.deleteCustomGrammar('${lesson.id}')">
            <i class="fa-solid fa-trash"></i> Xóa chủ điểm này
          </button>
        `;
      } else {
        deleteContainer.innerHTML = '';
      }
    }

    // Setup practice tabs
    setupPractice(lesson);
  }

  function setupPractice(lesson) {
    // Reset writing input
    const writeInput = document.getElementById('g-write-sentence-input');
    const writeResult = document.getElementById('g-write-result');
    if (writeInput) writeInput.value = '';
    if (writeResult) writeResult.style.display = 'none';

    // Reset MCQ
    const mcqArea = document.getElementById('g-mcq-play-area');
    const mcqResult = document.getElementById('g-mcq-result-area');
    if (mcqArea) mcqArea.style.display = 'block';
    if (mcqResult) mcqResult.style.display = 'none';

    state.mcqState.questions = lesson.quiz || [];
    state.mcqState.currentIndex = 0;
    state.mcqState.score = 0;
    state.mcqState.hasAnswered = false;

    renderMcqQuestion();
  }

  function renderMcqQuestion() {
    const qs = state.mcqState.questions;
    const idx = state.mcqState.currentIndex;
    const container = document.getElementById('g-mcq-options-container');
    const qText = document.getElementById('g-mcq-q-text');
    const progressText = document.getElementById('g-mcq-progress-text');
    const nextBtn = document.getElementById('g-mcq-btn-next');
    const expBox = document.getElementById('g-mcq-explanation');

    if (!qs || qs.length === 0) {
      if (qText) qText.textContent = 'Chủ điểm này chưa có bài tập trắc nghiệm.';
      if (container) container.innerHTML = '';
      if (progressText) progressText.textContent = '';
      if (nextBtn) nextBtn.style.display = 'none';
      if (expBox) expBox.style.display = 'none';
      return;
    }

    if (idx >= qs.length) {
      showMcqResult();
      return;
    }

    const curQ = qs[idx];
    state.mcqState.hasAnswered = false;

    if (progressText) progressText.textContent = `Câu ${idx + 1} / ${qs.length} (Đúng: ${state.mcqState.score})`;
    if (qText) qText.textContent = curQ.question;
    if (nextBtn) nextBtn.style.display = 'none';
    if (expBox) expBox.style.display = 'none';

    if (container) {
      container.innerHTML = (curQ.options || []).map((opt, oIdx) => `
        <button class="btn btn-secondary btn-sm g-opt-btn" data-opt="${escapeHtml(opt)}" style="text-align: left; padding: 10px 14px; border-radius: 8px;">
          ${String.fromCharCode(65 + oIdx)}. ${escapeHtml(opt)}
        </button>
      `).join('');

      container.querySelectorAll('.g-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => handleMcqOptionClick(btn, curQ));
      });
    }
  }

  function handleMcqOptionClick(btn, curQ) {
    if (state.mcqState.hasAnswered) return;
    state.mcqState.hasAnswered = true;

    const chosen = btn.dataset.opt;
    const isCorrect = chosen === curQ.correct;

    const allBtns = document.querySelectorAll('#g-mcq-options-container .g-opt-btn');
    allBtns.forEach(b => {
      b.disabled = true;
      if (b.dataset.opt === curQ.correct) {
        b.style.borderColor = 'var(--color-success)';
        b.style.background = 'rgba(34,197,94,0.15)';
      }
    });

    if (isCorrect) {
      state.mcqState.score++;
      btn.style.borderColor = 'var(--color-success)';
      btn.style.background = 'rgba(34,197,94,0.15)';
      showToast('Chính xác! 🎉', 'success', 1000);
    } else {
      btn.style.borderColor = 'var(--color-danger)';
      btn.style.background = 'rgba(239,68,68,0.15)';
      showToast('Chưa đúng rồi! Xem giải thích bên dưới.', 'warning', 2000);
    }

    // Explanation & error correction
    const expBox = document.getElementById('g-mcq-explanation');
    if (expBox) {
      expBox.style.display = 'block';
      expBox.innerHTML = `
        <div style="font-weight: 700; color: ${isCorrect ? 'var(--color-success)' : 'var(--color-warning)'}; margin-bottom: 4px;">
          <i class="fa-solid fa-lightbulb"></i> Giải thích đáp án:
        </div>
        <div style="font-size: 13px;">${escapeHtml(curQ.explanation || `Đáp án đúng là: ${curQ.correct}`)}</div>
      `;
    }

    const nextBtn = document.getElementById('g-mcq-btn-next');
    if (nextBtn) {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = () => {
        state.mcqState.currentIndex++;
        renderMcqQuestion();
      };
    }
  }

  function showMcqResult() {
    const mcqArea = document.getElementById('g-mcq-play-area');
    const mcqResult = document.getElementById('g-mcq-result-area');
    if (mcqArea) mcqArea.style.display = 'none';
    if (mcqResult) mcqResult.style.display = 'flex';

    const total = state.mcqState.questions.length;
    const score = state.mcqState.score;
    const scoreEl = document.getElementById('g-mcq-res-score');
    if (scoreEl) scoreEl.textContent = `${score} / ${total}`;

    const retryBtn = document.getElementById('g-mcq-btn-restart');
    if (retryBtn) {
      retryBtn.onclick = () => {
        state.mcqState.currentIndex = 0;
        state.mcqState.score = 0;
        if (mcqArea) mcqArea.style.display = 'block';
        if (mcqResult) mcqResult.style.display = 'none';
        renderMcqQuestion();
      };
    }

    const finishBtn = document.getElementById('g-mcq-btn-finish');
    if (finishBtn) {
      finishBtn.onclick = () => {
        if (mcqArea) mcqArea.style.display = 'block';
        if (mcqResult) mcqResult.style.display = 'none';
        state.mcqState.currentIndex = 0;
        renderMcqQuestion();
      };
    }
  }

  function checkWrittenSentence() {
    const input = document.getElementById('g-write-sentence-input');
    const resultBox = document.getElementById('g-write-result');
    const scoreEl = document.getElementById('g-write-score-val');
    const feedbackEl = document.getElementById('g-write-feedback-txt');

    if (!input || !resultBox) return;

    const val = input.value.trim();
    if (!val) {
      showToast('Vui lòng nhập câu tiếng Anh cần kiểm tra!', 'warning');
      return;
    }

    // Heuristic checking
    let score = 10;
    let feedback = [];

    if (!/^[A-Z]/.test(val)) {
      score -= 1;
      feedback.push('Lưu ý viết hoa chữ cái đầu câu.');
    }
    if (!/[\.\?\!]$/.test(val)) {
      score -= 1;
      feedback.push('Lưu ý kết thúc câu bằng dấu chấm câu (., ?, !).');
    }
    const wordCount = val.split(/\s+/).length;
    if (wordCount < 4) {
      score -= 2;
      feedback.push('Câu hơi ngắn, hãy cố gắng đặt câu dài và đầy đủ thành phần hơn.');
    }

    if (feedback.length === 0) {
      feedback.push('Câu văn chuẩn ngữ pháp, bố cục rõ ràng!');
    }

    score = Math.max(6, score);

    resultBox.style.display = 'block';
    if (scoreEl) scoreEl.textContent = `${score} / 10`;
    if (feedbackEl) feedbackEl.textContent = feedback.join(' ');
    showToast(`Đã chấm điểm: ${score}/10! 🎯`, 'success');
  }

  window.deleteCustomGrammar = async function (id) {
    if (!confirm('Bạn có chắc chắn muốn xóa chủ điểm ngữ pháp này?')) return;
    try {
      await VocabDB.delete('grammar', id);
      showToast('Đã xóa chủ điểm thành công!', 'success');
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xóa chủ điểm', 'error');
    }
  };

  function bindEvents() {
    // Tabs: Write vs MCQ
    const tabWrite = document.getElementById('g-btn-tab-write');
    const tabMcq = document.getElementById('g-btn-tab-mcq');
    const contentWrite = document.getElementById('g-tab-content-write');
    const contentMcq = document.getElementById('g-tab-content-mcq');

    if (tabWrite && tabMcq) {
      tabWrite.addEventListener('click', () => {
        tabWrite.style.background = 'rgba(123, 97, 255, 0.15)';
        tabWrite.style.borderColor = 'var(--border-active)';
        tabMcq.style.background = 'transparent';
        tabMcq.style.borderColor = 'transparent';
        if (contentWrite) contentWrite.style.display = 'flex';
        if (contentMcq) contentMcq.style.display = 'none';
      });

      tabMcq.addEventListener('click', () => {
        tabMcq.style.background = 'rgba(123, 97, 255, 0.15)';
        tabMcq.style.borderColor = 'var(--border-active)';
        tabWrite.style.background = 'transparent';
        tabWrite.style.borderColor = 'transparent';
        if (contentWrite) contentWrite.style.display = 'none';
        if (contentMcq) contentMcq.style.display = 'block';
      });
    }

    // Submit written sentence
    const checkBtn = document.getElementById('g-btn-check-sentence');
    if (checkBtn) {
      checkBtn.addEventListener('click', checkWrittenSentence);
    }

    // Custom grammar form
    const form = document.getElementById('grammar-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('grammar-custom-title').value.trim();
        const formula = document.getElementById('grammar-custom-formula').value.trim();
        const explanation = document.getElementById('grammar-custom-explanation').value.trim();

        if (!title || !explanation) {
          showToast('Vui lòng điền đầy đủ tiêu đề và nội dung giải thích!', 'warning');
          return;
        }

        const newLesson = {
          id: `custom-g-${Date.now()}`,
          title,
          formula,
          explanation,
          examples: [],
          quiz: []
        };

        try {
          await VocabDB.put('grammar', newLesson);
          showToast('Đã thêm chủ điểm ngữ pháp mới thành công!', 'success');
          form.reset();
          await loadData();
          selectLesson(newLesson.id);
        } catch (err) {
          console.error(err);
          showToast('Lỗi khi lưu ngữ pháp', 'error');
        }
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

