/**
 * topic-quiz.js — VocabMaster Topic Quiz Logic
 * Kiểm tra từ vựng chuyên sâu theo từng chủ đề bài đọc IELTS với các chế độ MCQ, FITB, Audio và Match.
 * Tự động sửa lỗi và đưa ra lời giải thích chi tiết khi học viên trả lời sai.
 */

(function () {
  'use strict';

  const state = {
    allTopics: [],
    allVocab: [],
    questionBank: [],
    selectedTopic: 'Why We Need to Protect Polar Bears',
    mode: 'mcq', // 'mcq' | 'fitb' | 'audio' | 'match'
    questionCount: '20',
    questions: [],
    currentIndex: 0,
    score: 0,
    hasAnswered: false,
    timerSeconds: 0,
    timerInterval: null,
    wrongAnswers: [],
    matchState: {
      selectedEng: null,
      selectedVi: null,
      matchedCount: 0,
      totalPairs: 0
    }
  };

  const TOPIC_ICONS = {
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
      state.allVocab = await VocabDB.getAll('vocabulary');
      state.questionBank = await VocabDB.getAll('quiz_questions');

      buildTopicList();
      renderTopicCards();

      // Kiểm tra URL query param
      const urlParams = new URLSearchParams(window.location.search);
      const paramTopic = urlParams.get('topic');
      if (paramTopic && state.allTopics.some(t => t.name === paramTopic)) {
        selectTopic(paramTopic);
      }
    } catch (err) {
      console.error('[TopicQuiz] Lỗi nạp dữ liệu:', err);
      showToast('Lỗi khi nạp dữ liệu kiểm tra Topic!', 'error');
    }
  }

  function buildTopicList() {
    const topicsMap = new Map();

    // Lấy từ PDF_TOPIC_LIST nếu có
    if (typeof PDF_TOPIC_LIST !== 'undefined' && Array.isArray(PDF_TOPIC_LIST)) {
      PDF_TOPIC_LIST.forEach(t => {
        topicsMap.set(t.title, {
          name: t.title,
          icon: t.icon || TOPIC_ICONS[t.title] || '📖',
          questionCount: t.questionCount || 0,
          vocabCount: t.vocabCount || 0
        });
      });
    }

    // Đếm từ vựng và câu hỏi thực tế trong database
    state.allVocab.forEach(v => {
      const t = v.topic || 'General';
      if (!topicsMap.has(t)) {
        topicsMap.set(t, {
          name: t,
          icon: TOPIC_ICONS[t] || '🏷️',
          questionCount: 0,
          vocabCount: 0
        });
      }
      topicsMap.get(t).vocabCount++;
    });

    state.questionBank.forEach(q => {
      const t = q.topic;
      if (topicsMap.has(t)) {
        topicsMap.get(t).questionCount++;
      }
    });

    state.allTopics = Array.from(topicsMap.values());
  }

  function renderTopicCards() {
    const grid = document.getElementById('tquiz-cards-grid');
    if (!grid) return;

    grid.innerHTML = state.allTopics.map(t => {
      const isSelected = t.name === state.selectedTopic;
      return `
        <div class="tquiz-topic-card ${isSelected ? 'active' : ''}" data-topic="${escapeHtml(t.name)}" style="cursor: pointer; padding: 16px; border-radius: 12px; background: rgba(255,255,255,${isSelected ? '0.08' : '0.02'}); border: 2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-glass)'}; transition: all 0.2s; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 28px;">${t.icon}</span>
              ${isSelected ? '<span class="badge" style="background:var(--color-primary); color:#fff; font-size:11px; padding:2px 8px; border-radius:10px;"><i class="fa-solid fa-check"></i> Đang chọn</span>' : ''}
            </div>
            <h4 style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; line-height: 1.4;">${escapeHtml(t.name)}</h4>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 12px; font-size: 12px; color: var(--text-muted);">
            <span><i class="fa-solid fa-book"></i> ${t.vocabCount} từ vựng</span>
            <span><i class="fa-solid fa-circle-question"></i> ${t.questionCount} câu hỏi</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.tquiz-topic-card').forEach(card => {
      card.addEventListener('click', () => {
        selectTopic(card.dataset.topic);
      });
    });

    updateSelectedTopicTitle();
  }

  function selectTopic(topicName) {
    state.selectedTopic = topicName;
    renderTopicCards();
  }

  function updateSelectedTopicTitle() {
    const titleEl = document.getElementById('tquiz-selected-topic-title');
    if (titleEl) titleEl.textContent = state.selectedTopic;
  }

  function startQuiz() {
    // Lấy câu hỏi từ questionBank cho topic này
    let questions = state.questionBank.filter(q => q.topic === state.selectedTopic);

    // Nếu không có trong questionBank, sinh từ kho từ vựng của topic
    if (questions.length === 0) {
      const topicVocab = state.allVocab.filter(v => (v.topic || 'General') === state.selectedTopic);
      if (topicVocab.length < 4) {
        showToast('Chủ đề này chưa có đủ từ vựng để tạo bài kiểm tra!', 'warning');
        return;
      }

      // Tự động sinh câu hỏi từ từ vựng
      const letters = ['A', 'B', 'C', 'D'];
      questions = topicVocab.map(target => {
        const others = topicVocab.filter(v => v.id !== target.id);
        const distractors = [];
        while (distractors.length < 3 && others.length > 0) {
          const randIdx = Math.floor(Math.random() * others.length);
          distractors.push(others.splice(randIdx, 1)[0]);
        }
        const opts = [target, ...distractors];
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]];
        }
        const correctIdx = opts.findIndex(o => o.id === target.id);

        return {
          id: `synth-${target.id}`,
          topic: state.selectedTopic,
          question: target.example ? target.example.replace(new RegExp(`\\b${target.word}\\b`, 'gi'), '_______') : `Từ nào có nghĩa là "${target.definition}"?`,
          options: opts.map(o => o.word),
          correctAnswer: letters[correctIdx],
          correctWord: target.word,
          explanation: `Đáp án đúng là: ${letters[correctIdx]} (${target.word}) - Nghĩa: ${target.definition}`,
          questionType: 'mcq'
        };
      });
    }

    if (questions.length === 0) {
      showToast('Không có câu hỏi nào cho chủ đề này!', 'warning');
      return;
    }

    // Trộn ngẫu nhiên câu hỏi
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const countSel = document.getElementById('tquiz-question-count-select');
    let limit = countSel ? countSel.value : '20';
    if (limit !== 'all') {
      const num = parseInt(limit, 10);
      if (!isNaN(num) && num > 0) {
        state.questions = shuffled.slice(0, num);
      } else {
        state.questions = shuffled;
      }
    } else {
      state.questions = shuffled;
    }

    state.currentIndex = 0;
    state.score = 0;
    state.hasAnswered = false;
    state.wrongAnswers = [];
    state.timerSeconds = 0;

    // Bắt đầu timer
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.timerSeconds++;
      const mins = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
      const secs = String(state.timerSeconds % 60).padStart(2, '0');
      const timerEl = document.getElementById('tquiz-timer-text');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    // Switch screen
    document.getElementById('tquiz-setup-screen').style.display = 'none';
    document.getElementById('tquiz-play-arena').style.display = 'block';
    document.getElementById('tquiz-result-screen').style.display = 'none';

    // Set topic badge
    const icon = TOPIC_ICONS[state.selectedTopic] || '📖';
    document.getElementById('tquiz-arena-topic-badge').textContent = `${icon} ${state.selectedTopic}`;

    const modeBadgeMap = {
      mcq: 'Trắc nghiệm (MCQ)',
      fitb: 'Gõ từ tiếng Anh (FITB)',
      audio: 'Luyện nghe phát âm',
      match: 'Ghép từ & Định nghĩa'
    };
    document.getElementById('tquiz-arena-mode-badge').textContent = modeBadgeMap[state.mode] || 'Trắc nghiệm';

    if (state.mode === 'match') {
      setupMatchMode();
    } else {
      renderCurrentQuestion();
    }
  }

  function renderCurrentQuestion() {
    state.hasAnswered = false;
    const total = state.questions.length;
    const q = state.questions[state.currentIndex];

    document.getElementById('tquiz-q-num').textContent = `Câu hỏi ${state.currentIndex + 1} / ${total}`;
    document.getElementById('tquiz-live-score').textContent = `Điểm: ${state.score}`;
    document.getElementById('tquiz-progress-fill').style.width = `${((state.currentIndex + 1) / total) * 100}%`;

    const nextBtn = document.getElementById('tquiz-btn-next');
    if (nextBtn) nextBtn.style.display = 'none';

    // Clear previous explanation
    const oldExp = document.getElementById('tquiz-correction-box');
    if (oldExp) oldExp.remove();

    const qBox = document.getElementById('tquiz-question-box');
    const qText = document.getElementById('tquiz-q-text');
    const qSub = document.getElementById('tquiz-q-sub');
    const mcqContainer = document.getElementById('tquiz-options-container');
    const fitbContainer = document.getElementById('tquiz-fitb-container');
    const matchContainer = document.getElementById('tquiz-match-container');

    if (matchContainer) matchContainer.style.display = 'none';

    if (state.mode === 'mcq') {
      if (mcqContainer) mcqContainer.style.display = 'grid';
      if (fitbContainer) fitbContainer.style.display = 'none';

      qText.textContent = q.question;
      qSub.textContent = '';

      const letters = ['A', 'B', 'C', 'D'];
      mcqContainer.innerHTML = (q.options || []).map((opt, idx) => `
        <button class="quiz-option-btn" data-letter="${letters[idx]}" data-text="${escapeHtml(opt)}">
          <span class="option-letter">${letters[idx]}</span>
          <span class="option-text">${escapeHtml(opt)}</span>
        </button>
      `).join('');

      mcqContainer.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleMCQAnswer(btn, q));
      });

    } else if (state.mode === 'fitb') {
      if (mcqContainer) mcqContainer.style.display = 'none';
      if (fitbContainer) fitbContainer.style.display = 'flex';

      qText.textContent = q.question;
      qSub.textContent = `Gợi ý: Từ bắt đầu bằng chữ "${(q.correctWord || '')[0]}"...`;

      const input = document.getElementById('tquiz-input-answer');
      if (input) {
        input.value = '';
        input.disabled = false;
        input.style.borderColor = 'var(--border-glass)';
        input.focus();
      }

      const submitBtn = document.getElementById('tquiz-btn-submit-fitb');
      if (submitBtn) {
        submitBtn.onclick = () => handleFITBAnswer(q);
      }

    } else if (state.mode === 'audio') {
      if (mcqContainer) mcqContainer.style.display = 'grid';
      if (fitbContainer) fitbContainer.style.display = 'none';

      qText.innerHTML = `
        <button class="btn btn-secondary" onclick="speak('${escapeHtml(q.correctWord)}')" style="padding: 12px 24px; font-size: 16px; border-radius: 30px; display: inline-flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <i class="fa-solid fa-volume-high" style="color: var(--color-primary-light);"></i> Nhấn để nghe phát âm
        </button>
      `;
      qSub.textContent = 'Hãy nghe và chọn từ vựng đúng nhất được phát âm:';

      // Tự động phát âm lần đầu
      setTimeout(() => speak(q.correctWord), 300);

      const letters = ['A', 'B', 'C', 'D'];
      mcqContainer.innerHTML = (q.options || []).map((opt, idx) => `
        <button class="quiz-option-btn" data-letter="${letters[idx]}" data-text="${escapeHtml(opt)}">
          <span class="option-letter">${letters[idx]}</span>
          <span class="option-text">${escapeHtml(opt)}</span>
        </button>
      `).join('');

      mcqContainer.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleMCQAnswer(btn, q));
      });
    }
  }

  function handleMCQAnswer(selectedBtn, q) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    const chosenLetter = selectedBtn.dataset.letter;
    const isCorrect = chosenLetter === q.correctAnswer;

    const allButtons = document.querySelectorAll('#tquiz-options-container .quiz-option-btn');
    allButtons.forEach(b => {
      b.disabled = true;
      if (b.dataset.letter === q.correctAnswer) {
        b.classList.add('correct');
      }
    });

    if (isCorrect) {
      state.score++;
      selectedBtn.classList.add('correct');
      showToast('Chính xác! 🎉', 'success', 1200);
    } else {
      selectedBtn.classList.add('wrong');
      state.wrongAnswers.push({
        question: q.question,
        chosen: selectedBtn.querySelector('.option-text').textContent,
        correctLetter: q.correctAnswer,
        correctWord: q.correctWord,
        explanation: q.explanation
      });
      showCorrectionBox(q);
      showToast('Chưa đúng rồi! Xem hướng dẫn sửa lỗi bên dưới nhé.', 'warning', 2500);
    }

    document.getElementById('tquiz-live-score').textContent = `Điểm: ${state.score}`;

    const nextBtn = document.getElementById('tquiz-btn-next');
    if (nextBtn) {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = nextQuestion;
    }
  }

  function handleFITBAnswer(q) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    const input = document.getElementById('tquiz-input-answer');
    const userVal = (input.value || '').trim().toLowerCase();
    const correctVal = (q.correctWord || '').trim().toLowerCase();

    input.disabled = true;

    const isCorrect = userVal === correctVal;
    if (isCorrect) {
      state.score++;
      input.style.borderColor = 'var(--color-success)';
      showToast('Chính xác! Xuất sắc! 🎉', 'success', 1200);
    } else {
      input.style.borderColor = 'var(--color-danger)';
      state.wrongAnswers.push({
        question: q.question,
        chosen: userVal || '(để trống)',
        correctLetter: '',
        correctWord: q.correctWord,
        explanation: q.explanation || `Từ cần điền là: "${q.correctWord}"`
      });
      showCorrectionBox(q);
      showToast('Chưa chính xác! Xem hướng dẫn sửa lỗi bên dưới.', 'warning', 2500);
    }

    document.getElementById('tquiz-live-score').textContent = `Điểm: ${state.score}`;

    const nextBtn = document.getElementById('tquiz-btn-next');
    if (nextBtn) {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = nextQuestion;
    }
  }

  function showCorrectionBox(q) {
    const arena = document.getElementById('tquiz-play-arena');
    const existing = document.getElementById('tquiz-correction-box');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'tquiz-correction-box';
    box.style.cssText = `
      margin-top: 20px;
      padding: 16px 20px;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--color-danger);
      color: var(--text-main);
      animation: fadeIn 0.3s ease;
    `;
    box.innerHTML = `
      <div style="font-weight: 700; color: var(--color-danger); display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <i class="fa-solid fa-lightbulb" style="color: var(--color-warning);"></i> Hướng dẫn sửa lỗi cho bạn:
      </div>
      <div style="font-size: 14px; line-height: 1.5;">${escapeHtml(q.explanation || `Đáp án đúng: ${q.correctAnswer} - ${q.correctWord}`)}</div>
    `;

    const nextBtn = document.getElementById('tquiz-btn-next');
    if (nextBtn && nextBtn.parentNode) {
      arena.insertBefore(box, nextBtn.parentNode);
    } else {
      arena.appendChild(box);
    }
  }

  function nextQuestion() {
    state.currentIndex++;
    if (state.currentIndex < state.questions.length) {
      renderCurrentQuestion();
    } else {
      endQuiz();
    }
  }

  // --- MATCH MODE (GHÉP CẶP TỪ & ĐỊNH NGHĨA) ---
  function setupMatchMode() {
    const qBox = document.getElementById('tquiz-question-box');
    const mcqContainer = document.getElementById('tquiz-options-container');
    const fitbContainer = document.getElementById('tquiz-fitb-container');
    const matchContainer = document.getElementById('tquiz-match-container');

    if (qBox) qBox.style.display = 'none';
    if (mcqContainer) mcqContainer.style.display = 'none';
    if (fitbContainer) fitbContainer.style.display = 'none';
    if (matchContainer) matchContainer.style.display = 'block';

    const topicVocab = state.allVocab.filter(v => (v.topic || 'General') === state.selectedTopic);
    const pool = [...topicVocab].slice(0, 10);
    state.matchState.totalPairs = pool.length;
    state.matchState.matchedCount = 0;
    state.matchState.selectedEng = null;
    state.matchState.selectedVi = null;

    const engCards = pool.map(v => ({ id: v.id, text: v.word, type: 'eng' }));
    const viCards = pool.map(v => ({ id: v.id, text: v.definition, type: 'vi' }));

    // Shuffle both
    engCards.sort(() => Math.random() - 0.5);
    viCards.sort(() => Math.random() - 0.5);

    const matchGrid = document.getElementById('tquiz-match-grid');
    matchGrid.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;" id="match-col-eng">
        ${engCards.map(c => `
          <button class="match-card" data-id="${c.id}" data-type="eng" style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 2px solid var(--border-glass); color: var(--text-main); font-weight: 600; text-align: left; cursor: pointer; transition: all 0.2s;">
            <i class="fa-solid fa-font" style="color: var(--color-primary-light); margin-right: 8px;"></i> ${escapeHtml(c.text)}
          </button>
        `).join('')}
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;" id="match-col-vi">
        ${viCards.map(c => `
          <button class="match-card" data-id="${c.id}" data-type="vi" style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 2px solid var(--border-glass); color: var(--text-main); font-weight: 500; text-align: left; cursor: pointer; transition: all 0.2s;">
            <i class="fa-solid fa-language" style="color: var(--color-secondary); margin-right: 8px;"></i> ${escapeHtml(c.text)}
          </button>
        `).join('')}
      </div>
    `;

    matchGrid.querySelectorAll('.match-card').forEach(btn => {
      btn.addEventListener('click', () => handleMatchCardClick(btn));
    });
  }

  function handleMatchCardClick(btn) {
    if (btn.classList.contains('matched')) return;

    const type = btn.dataset.type;
    const id = btn.dataset.id;

    if (type === 'eng') {
      document.querySelectorAll('#match-col-eng .match-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.matchState.selectedEng = { btn, id };
    } else {
      document.querySelectorAll('#match-col-vi .match-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.matchState.selectedVi = { btn, id };
    }

    if (state.matchState.selectedEng && state.matchState.selectedVi) {
      const eng = state.matchState.selectedEng;
      const vi = state.matchState.selectedVi;

      if (eng.id === vi.id) {
        // Matched!
        eng.btn.classList.remove('selected');
        vi.btn.classList.remove('selected');
        eng.btn.classList.add('matched');
        vi.btn.classList.add('matched');
        eng.btn.style.borderColor = 'var(--color-success)';
        vi.btn.style.borderColor = 'var(--color-success)';
        eng.btn.style.background = 'rgba(34,197,94,0.15)';
        vi.btn.style.background = 'rgba(34,197,94,0.15)';

        state.matchState.matchedCount++;
        state.score++;
        document.getElementById('tquiz-live-score').textContent = `Điểm: ${state.score}`;
        showToast('Ghép đúng cặp! 🎉', 'success', 800);

        if (state.matchState.matchedCount === state.matchState.totalPairs) {
          setTimeout(endQuiz, 1000);
        }
      } else {
        // Mismatched
        eng.btn.style.borderColor = 'var(--color-danger)';
        vi.btn.style.borderColor = 'var(--color-danger)';
        showToast('Chưa đúng cặp rồi!', 'warning', 1000);

        setTimeout(() => {
          eng.btn.classList.remove('selected');
          vi.btn.classList.remove('selected');
          eng.btn.style.borderColor = 'var(--border-glass)';
          vi.btn.style.borderColor = 'var(--border-glass)';
        }, 600);
      }

      state.matchState.selectedEng = null;
      state.matchState.selectedVi = null;
    }
  }

  function endQuiz() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    document.getElementById('tquiz-play-arena').style.display = 'none';
    const resScreen = document.getElementById('tquiz-result-screen');
    resScreen.style.display = 'block';

    const isMatch = state.mode === 'match';
    const total = isMatch ? state.matchState.totalPairs : state.questions.length;
    const score = state.score;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    const mins = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
    const secs = String(state.timerSeconds % 60).padStart(2, '0');

    document.getElementById('tquiz-res-score').textContent = `${score}/${total}`;
    document.getElementById('tquiz-res-percent').textContent = `${percent}% Chính xác`;
    document.getElementById('tquiz-res-time').textContent = `${mins}:${secs}`;
    document.getElementById('tquiz-res-correct').textContent = score;
    document.getElementById('tquiz-res-wrong').textContent = total - score;

    const iconEl = document.getElementById('tquiz-res-icon');
    const titleEl = document.getElementById('tquiz-res-title');
    const subEl = document.getElementById('tquiz-res-subtitle');

    if (percent >= 80) {
      iconEl.className = 'fa-solid fa-trophy';
      titleEl.textContent = 'Xuất sắc! 🎉';
      subEl.textContent = 'Bạn đã làm chủ hoàn toàn các từ vựng thuộc chủ đề này!';
    } else if (percent >= 50) {
      iconEl.className = 'fa-solid fa-medal';
      titleEl.textContent = 'Rất tốt! 👏';
      subEl.textContent = 'Kết quả ghi nhớ từ vựng rất ấn tượng. Hãy tiếp tục duy trì nhé!';
    } else {
      iconEl.className = 'fa-solid fa-rotate-right';
      titleEl.textContent = 'Cần cố gắng hơn! 💪';
      subEl.textContent = 'Hãy dùng Flashcards ôn lại bài trước khi làm bài test nhé!';
    }

    // Wrong review box
    const wrongBox = document.getElementById('tquiz-wrong-review-box');
    const wrongList = document.getElementById('tquiz-wrong-list');

    if (state.wrongAnswers.length > 0) {
      wrongBox.style.display = 'block';
      wrongList.innerHTML = state.wrongAnswers.map((w, idx) => `
        <div style="padding: 12px 16px; background: rgba(0,0,0,0.25); border-radius: 8px; border-left: 3px solid var(--color-danger); font-size: 13px;">
          <div style="font-weight: 600; color: var(--text-main); line-height: 1.4;">${idx + 1}. ${escapeHtml(w.question)}</div>
          <div style="margin-top: 6px; color: var(--text-muted);">
            Bạn chọn: <span style="color: var(--color-danger); text-decoration: line-through;">${escapeHtml(w.chosen)}</span>
            &nbsp;➔&nbsp; <strong style="color: var(--color-success);">${escapeHtml(w.explanation)}</strong>
          </div>
        </div>
      `).join('');
    } else {
      wrongBox.style.display = 'none';
    }
  }

  function bindEvents() {
    // Mode cards selection
    const modeCards = document.querySelectorAll('.tquiz-mode-card');
    modeCards.forEach(card => {
      card.addEventListener('click', () => {
        modeCards.forEach(c => {
          c.classList.remove('active');
          c.style.borderColor = 'var(--border-glass)';
        });
        card.classList.add('active');
        card.style.borderColor = 'var(--color-primary)';
        state.mode = card.dataset.tmode;
      });
    });

    // Start button
    const startBtn = document.getElementById('btn-start-tquiz-custom');
    if (startBtn) {
      startBtn.addEventListener('click', startQuiz);
    }

    // Exit button
    const exitBtn = document.getElementById('btn-exit-tquiz');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        if (confirm('Bạn có muốn dừng bài kiểm tra này?')) {
          if (state.timerInterval) clearInterval(state.timerInterval);
          document.getElementById('tquiz-setup-screen').style.display = 'block';
          document.getElementById('tquiz-play-arena').style.display = 'none';
          document.getElementById('tquiz-result-screen').style.display = 'none';
        }
      });
    }

    // Retry and change topic
    const retryBtn = document.getElementById('btn-tquiz-retry');
    const changeTopicBtn = document.getElementById('btn-tquiz-change-topic');

    if (retryBtn) retryBtn.addEventListener('click', startQuiz);
    if (changeTopicBtn) {
      changeTopicBtn.addEventListener('click', () => {
        document.getElementById('tquiz-setup-screen').style.display = 'block';
        document.getElementById('tquiz-play-arena').style.display = 'none';
        document.getElementById('tquiz-result-screen').style.display = 'none';
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

