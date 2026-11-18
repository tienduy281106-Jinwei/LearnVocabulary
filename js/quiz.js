/**
 * quiz.js — VocabMaster Quiz Logic
 * Kiểm tra từ vựng qua hình thức Trắc nghiệm (MCQ) hoặc Điền từ (FITB).
 * Tự động sửa lỗi và hướng dẫn khi người học làm sai đáp án.
 */

(function () {
  'use strict';

  const state = {
    allWords: [],
    questionBank: [],
    mode: 'mcq', // 'mcq' | 'fitb'
    questions: [],
    currentIndex: 0,
    score: 0,
    hasAnswered: false,
    selectedTopic: 'all',
    questionCount: 10,
    source: 'vocab',
    wrongAnswers: []
  };

  async function loadData() {
    try {
      state.allWords = await VocabDB.getAll('vocabulary');
      state.questionBank = await VocabDB.getAll('quiz_questions');
      populateTopicDropdown();
    } catch (e) {
      console.error('[Quiz] Lỗi tải dữ liệu:', e);
      showToast('Lỗi khi nạp dữ liệu kiểm tra!', 'error');
    }
  }

  function populateTopicDropdown() {
    const select = document.getElementById('quiz-filter-topic');
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

  function startQuiz(mode) {
    state.mode = mode;
    state.selectedTopic = document.getElementById('quiz-filter-topic').value || 'all';
    state.questionCount = document.getElementById('quiz-question-count').value || '10';
    state.source = document.getElementById('quiz-source') ? document.getElementById('quiz-source').value : 'vocab';

    let pool = [];

    if (state.source === 'both' && state.questionBank.length > 0) {
      // Dùng câu hỏi từ quiz_questions trước nếu có
      let qList = [...state.questionBank];
      if (state.selectedTopic !== 'all') {
        qList = qList.filter(q => q.topic === state.selectedTopic);
      }
      pool = qList.map(q => ({
        type: 'bank',
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        correctWord: q.correctWord,
        explanation: q.explanation || `Đáp án đúng là ${q.correctAnswer}: ${q.correctWord}`
      }));
    }

    // Nếu pool chưa đủ hoặc source là vocab, sinh từ kho từ vựng
    let vocabPool = [...state.allWords];
    if (state.selectedTopic !== 'all') {
      vocabPool = vocabPool.filter(v => (v.topic || 'General') === state.selectedTopic);
    }

    if (pool.length === 0 && vocabPool.length < 4) {
      const warning = document.getElementById('quiz-empty-warning');
      if (warning) {
        warning.style.display = 'block';
        warning.innerHTML = `<p style="color: var(--color-warning); font-weight: 500;">
          <i class="fa-solid fa-triangle-exclamation"></i> Chủ đề này cần ít nhất 4 từ vựng để tạo câu hỏi kiểm tra. Hiện chỉ có ${vocabPool.length} từ.
        </p>`;
      }
      return;
    }

    const warning = document.getElementById('quiz-empty-warning');
    if (warning) warning.style.display = 'none';

    // Sinh câu hỏi từ kho từ vựng
    // Shuffle vocabPool
    for (let i = vocabPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [vocabPool[i], vocabPool[j]] = [vocabPool[j], vocabPool[i]];
    }

    const generatedQs = vocabPool.map(target => {
      // 3 distractors
      const others = vocabPool.filter(v => v.id !== target.id);
      const distractors = [];
      while (distractors.length < 3 && others.length > 0) {
        const randIdx = Math.floor(Math.random() * others.length);
        distractors.push(others.splice(randIdx, 1)[0]);
      }

      const allOpts = [target, ...distractors];
      for (let i = allOpts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOpts[i], allOpts[j]] = [allOpts[j], allOpts[i]];
      }

      const letterMap = ['A', 'B', 'C', 'D'];
      const correctIdx = allOpts.findIndex(o => o.id === target.id);

      return {
        type: 'vocab',
        targetWord: target.word,
        targetDef: target.definition,
        targetPronunciation: target.pronunciation,
        targetExample: target.example,
        options: allOpts.map(o => o.definition),
        correctAnswer: letterMap[correctIdx],
        correctWord: target.word,
        explanation: `Đáp án đúng là: ${letterMap[correctIdx]}. ${target.definition} (từ tiếng Anh: "${target.word}")`
      };
    });

    // Kết hợp pool
    const combinedPool = [...pool, ...generatedQs];
    for (let i = combinedPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combinedPool[i], combinedPool[j]] = [combinedPool[j], combinedPool[i]];
    }

    let finalCount = combinedPool.length;
    if (state.questionCount !== 'all') {
      const num = parseInt(state.questionCount, 10);
      if (!isNaN(num) && num > 0) finalCount = Math.min(num, combinedPool.length);
    }

    state.questions = combinedPool.slice(0, finalCount);
    state.currentIndex = 0;
    state.score = 0;
    state.hasAnswered = false;
    state.wrongAnswers = [];

    // Switch screen
    document.getElementById('quiz-setup-screen').style.display = 'none';
    document.getElementById('quiz-play-screen').style.display = 'block';
    document.getElementById('quiz-result-screen').style.display = 'none';

    renderQuestion();
  }

  function renderQuestion() {
    const q = state.questions[state.currentIndex];
    const total = state.questions.length;

    state.hasAnswered = false;

    // Header info
    document.getElementById('quiz-progress-text').textContent = `Câu hỏi ${state.currentIndex + 1} / ${total}`;
    document.getElementById('quiz-score-live').textContent = `Điểm: ${state.score}`;
    document.getElementById('quiz-progress-fill').style.width = `${((state.currentIndex + 1) / total) * 100}%`;

    // Next button
    const nextBtn = document.getElementById('quiz-btn-next');
    if (nextBtn) nextBtn.style.display = 'none';

    // Remove any previous explanation box
    const oldExp = document.getElementById('quiz-explanation-box');
    if (oldExp) oldExp.remove();

    const qLabel = document.getElementById('quiz-q-label');
    const qText = document.getElementById('quiz-q-text');
    const qSub = document.getElementById('quiz-q-sub');

    const mcqContainer = document.getElementById('quiz-options-container');
    const fitbContainer = document.getElementById('quiz-input-container');

    if (state.mode === 'mcq') {
      if (mcqContainer) mcqContainer.style.display = 'grid';
      if (fitbContainer) fitbContainer.style.display = 'none';

      if (q.type === 'bank') {
        qLabel.textContent = 'Chọn đáp án đúng nhất để hoàn thành câu:';
        qText.textContent = q.question;
        qSub.textContent = '';
      } else {
        qLabel.textContent = 'Hãy tìm nghĩa tiếng Việt đúng của từ:';
        qText.innerHTML = `${escapeHtml(q.targetWord)} <span style="font-size: 16px; color: var(--text-muted); font-weight: normal; margin-left: 8px;">${q.targetPronunciation || ''}</span>`;
        qSub.textContent = q.targetExample ? `Ví dụ: "${q.targetExample}"` : '';
      }

      const letters = ['A', 'B', 'C', 'D'];
      mcqContainer.innerHTML = q.options.map((opt, idx) => `
        <button class="quiz-option-btn" data-letter="${letters[idx]}" data-idx="${idx}">
          <span class="option-letter">${letters[idx]}</span>
          <span class="option-text">${escapeHtml(opt)}</span>
        </button>
      `).join('');

      mcqContainer.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleMCQAnswer(btn, q));
      });

    } else {
      // FITB mode
      if (mcqContainer) mcqContainer.style.display = 'none';
      if (fitbContainer) fitbContainer.style.display = 'flex';

      if (q.type === 'bank') {
        qLabel.textContent = 'Nhập từ tiếng Anh còn thiếu vào ô trống:';
        qText.textContent = q.question;
        qSub.textContent = `Gợi ý: Từ bắt đầu bằng "${(q.correctWord || '')[0]}"...`;
      } else {
        qLabel.textContent = 'Nhập từ tiếng Anh tương ứng với nghĩa:';
        qText.textContent = q.targetDef;
        qSub.textContent = q.targetPronunciation ? `Phiên âm: ${q.targetPronunciation}` : '';
      }

      const input = document.getElementById('quiz-input-answer');
      if (input) {
        input.value = '';
        input.disabled = false;
        input.focus();
      }

      const submitBtn = document.getElementById('quiz-btn-submit-answer');
      if (submitBtn) {
        submitBtn.onclick = () => handleFITBAnswer(q);
      }
    }
  }

  function handleMCQAnswer(selectedBtn, q) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    const chosenLetter = selectedBtn.dataset.letter;
    const isCorrect = chosenLetter === q.correctAnswer;

    const allButtons = document.querySelectorAll('.quiz-option-btn');
    allButtons.forEach(b => {
      b.disabled = true;
      if (b.dataset.letter === q.correctAnswer) {
        b.classList.add('correct');
      }
    });

    if (isCorrect) {
      state.score++;
      selectedBtn.classList.add('correct');
      showToast('Chính xác! 🎉', 'success', 1500);
    } else {
      selectedBtn.classList.add('wrong');
      // Ghi nhận câu sai để sửa lỗi
      state.wrongAnswers.push({
        question: q.type === 'bank' ? q.question : q.targetWord,
        userAnswer: selectedBtn.querySelector('.option-text').textContent,
        correctAnswer: q.correctAnswer,
        correctWord: q.correctWord,
        explanation: q.explanation
      });
      showCorrectionBox(q, false);
      showToast('Chưa đúng rồi! Xem hướng dẫn sửa lỗi bên dưới nhé.', 'warning', 2500);
    }

    document.getElementById('quiz-score-live').textContent = `Điểm: ${state.score}`;

    const nextBtn = document.getElementById('quiz-btn-next');
    if (nextBtn) {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = goToNextQuestion;
    }
  }

  function handleFITBAnswer(q) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    const input = document.getElementById('quiz-input-answer');
    const userVal = (input.value || '').trim().toLowerCase();
    const correctWord = (q.correctWord || q.targetWord || '').trim().toLowerCase();

    input.disabled = true;

    const isCorrect = userVal === correctWord;
    if (isCorrect) {
      state.score++;
      input.style.borderColor = 'var(--color-success)';
      showToast('Chính xác! Xuất sắc! 🎉', 'success', 1500);
    } else {
      input.style.borderColor = 'var(--color-danger)';
      state.wrongAnswers.push({
        question: q.type === 'bank' ? q.question : q.targetDef,
        userAnswer: userVal || '(để trống)',
        correctAnswer: '',
        correctWord: q.correctWord || q.targetWord,
        explanation: q.explanation || `Từ đúng là: "${q.correctWord || q.targetWord}"`
      });
      showCorrectionBox(q, false);
      showToast('Chưa chính xác! Xem đáp án đúng và sửa lỗi bên dưới.', 'warning', 2500);
    }

    document.getElementById('quiz-score-live').textContent = `Điểm: ${state.score}`;

    const nextBtn = document.getElementById('quiz-btn-next');
    if (nextBtn) {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = goToNextQuestion;
    }
  }

  function showCorrectionBox(q, isCorrect) {
    const playScreen = document.getElementById('quiz-play-screen');
    const existing = document.getElementById('quiz-explanation-box');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'quiz-explanation-box';
    box.style.cssText = `
      margin-top: 20px;
      padding: 14px 18px;
      border-radius: 10px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--color-danger);
      color: var(--text-main);
      animation: fadeIn 0.3s ease;
    `;
    box.innerHTML = `
      <div style="font-weight: 700; color: var(--color-danger); display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <i class="fa-solid fa-lightbulb" style="color: var(--color-warning);"></i> Hướng dẫn sửa lỗi cho bạn:
      </div>
      <div style="font-size: 14px; line-height: 1.5;">${escapeHtml(q.explanation || `Đáp án đúng là: ${q.correctWord}`)}</div>
    `;

    const nextBtn = document.getElementById('quiz-btn-next');
    if (nextBtn && nextBtn.parentNode) {
      playScreen.insertBefore(box, nextBtn.parentNode);
    } else {
      playScreen.appendChild(box);
    }
  }

  function goToNextQuestion() {
    state.currentIndex++;
    if (state.currentIndex < state.questions.length) {
      renderQuestion();
    } else {
      showResults();
    }
  }

  function showResults() {
    document.getElementById('quiz-play-screen').style.display = 'none';
    const resScreen = document.getElementById('quiz-result-screen');
    resScreen.style.display = 'block';

    const total = state.questions.length;
    const score = state.score;
    const percent = Math.round((score / total) * 100);

    document.getElementById('quiz-final-score').textContent = `${score}/${total}`;

    const titleEl = document.getElementById('quiz-result-title');
    const msgEl = document.getElementById('quiz-result-message');
    const iconEl = document.getElementById('quiz-result-icon');

    if (percent >= 80) {
      iconEl.className = 'fa-solid fa-trophy';
      titleEl.textContent = 'Xuất sắc! 🎉';
      msgEl.textContent = `Bạn đã hoàn thành bài kiểm tra với độ chính xác ${percent}%. Trí nhớ từ vựng rất ấn tượng!`;
    } else if (percent >= 50) {
      iconEl.className = 'fa-solid fa-medal';
      titleEl.textContent = 'Làm tốt lắm! 👍';
      msgEl.textContent = `Bạn đạt ${percent}% chính xác. Hãy ôn lại những từ chưa đúng để nhớ sâu hơn nhé!`;
    } else {
      iconEl.className = 'fa-solid fa-rotate-right';
      titleEl.textContent = 'Cố gắng lên nhé! 💪';
      msgEl.textContent = `Bạn đạt ${percent}% chính xác. Đừng nản lòng, hãy xem lại phần sửa lỗi và ôn Flashcards thêm nhé!`;
    }

    // Render danh sách lỗi sai cần sửa
    let wrongSection = document.getElementById('quiz-wrong-review-section');
    if (!wrongSection) {
      wrongSection = document.createElement('div');
      wrongSection.id = 'quiz-wrong-review-section';
      resScreen.insertBefore(wrongSection, resScreen.lastElementChild);
    }

    if (state.wrongAnswers.length > 0) {
      wrongSection.innerHTML = `
        <div style="margin-top: 25px; text-align: left; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 12px; padding: 16px 20px;">
          <h4 style="color: var(--color-danger); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-list-check"></i> Các câu cần xem lại & sửa lỗi (${state.wrongAnswers.length} câu):
          </h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${state.wrongAnswers.map((w, i) => `
              <div style="padding: 10px 14px; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid var(--color-danger); font-size: 13px;">
                <div style="font-weight: 600; color: var(--text-main);">${i + 1}. ${escapeHtml(w.question)}</div>
                <div style="margin-top: 4px; color: var(--text-muted);">
                  Bạn đã chọn: <span style="color: var(--color-danger); text-decoration: line-through;">${escapeHtml(w.userAnswer)}</span>
                  &nbsp;➔&nbsp; <strong style="color: var(--color-success);">${escapeHtml(w.explanation)}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      wrongSection.innerHTML = `
        <div style="margin-top: 20px; color: var(--color-success); font-weight: 600;">
          <i class="fa-solid fa-circle-check"></i> Bạn không sai câu nào! Thật tuyệt vời!
        </div>
      `;
    }
  }

  function bindEvents() {
    const mcqModeCard = document.getElementById('quiz-mode-mcq');
    const fitbModeCard = document.getElementById('quiz-mode-fitb');

    if (mcqModeCard) mcqModeCard.addEventListener('click', () => startQuiz('mcq'));
    if (fitbModeCard) fitbModeCard.addEventListener('click', () => startQuiz('fitb'));

    const btnRestart = document.getElementById('quiz-btn-restart');
    const btnExit = document.getElementById('quiz-btn-exit');

    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        document.getElementById('quiz-setup-screen').style.display = 'flex';
        document.getElementById('quiz-play-screen').style.display = 'none';
        document.getElementById('quiz-result-screen').style.display = 'none';
      });
    }

    if (btnExit) {
      btnExit.addEventListener('click', () => {
        window.location.href = 'index.html';
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

