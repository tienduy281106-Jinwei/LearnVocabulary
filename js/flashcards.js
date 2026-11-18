/**
 * flashcards.js — VocabMaster 3D Flashcards Logic
 * Học từ vựng qua thẻ ghi nhớ 3D, hỗ trợ lọc theo chủ đề, phát âm và lưu tiến độ vào IndexedDB.
 */

(function () {
  'use strict';

  const state = {
    allWords: [],
    sessionCards: [],
    currentIndex: 0,
    isFlipped: false,
    selectedTopic: 'all',
    limit: 50,
    knownCount: 0,
    againCount: 0
  };

  async function loadData() {
    try {
      state.allWords = await VocabDB.getAll('vocabulary');
      populateTopicFilter();
      startNewSession();
    } catch (err) {
      console.error('[Flashcards] Lỗi nạp dữ liệu:', err);
      showToast('Lỗi khi nạp từ vựng!', 'error');
    }
  }

  function populateTopicFilter() {
    const select = document.getElementById('flash-filter-topic');
    if (!select) return;

    // Lấy topic từ URL param nếu có
    const urlParams = new URLSearchParams(window.location.search);
    const paramTopic = urlParams.get('topic');

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

    if (paramTopic && (paramTopic === 'all' || topicsMap.has(paramTopic))) {
      state.selectedTopic = paramTopic;
      select.value = paramTopic;
    }
  }

  function startNewSession() {
    let pool = [...state.allWords];

    if (state.selectedTopic !== 'all') {
      pool = pool.filter(v => (v.topic || 'General') === state.selectedTopic);
    }

    if (pool.length === 0) {
      showEmptyState(true);
      return;
    }

    showEmptyState(false);
    showDoneState(false);

    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Limit
    if (state.limit !== 'all') {
      const lim = parseInt(state.limit, 10);
      if (!isNaN(lim) && lim > 0) {
        pool = pool.slice(0, lim);
      }
    }

    state.sessionCards = pool;
    state.currentIndex = 0;
    state.isFlipped = false;
    state.knownCount = 0;
    state.againCount = 0;

    renderCurrentCard();
  }

  function renderCurrentCard() {
    const total = state.sessionCards.length;
    if (total === 0) {
      showEmptyState(true);
      return;
    }

    if (state.currentIndex >= total) {
      showDoneState(true);
      return;
    }

    const card = state.sessionCards[state.currentIndex];

    // Reset flip
    state.isFlipped = false;
    const box = document.getElementById('flashcard-box');
    if (box) box.classList.remove('flipped');

    // Progress bar & counter
    const counter = document.getElementById('flashcard-counter');
    const fill = document.getElementById('flash-progress-fill');
    if (counter) counter.textContent = `${state.currentIndex + 1} / ${total} từ`;
    if (fill) fill.style.width = `${((state.currentIndex + 1) / total) * 100}%`;

    // Front
    document.getElementById('flash-word').textContent = card.word || '—';
    document.getElementById('flash-phonetic').textContent = card.pronunciation || '';
    document.getElementById('flash-type').textContent = card.type || 'noun';

    // Back
    document.getElementById('flash-definition').textContent = card.definition || '—';

    const egBox = document.getElementById('flash-example-box');
    const egEng = document.getElementById('flash-example');
    const egVi = document.getElementById('flash-example-translation');
    if (card.example) {
      egBox.style.display = 'block';
      egEng.textContent = `"${card.example}"`;
      egVi.textContent = card.exampleTranslation || '';
    } else {
      egBox.style.display = 'none';
    }

    const grammarWrap = document.getElementById('flash-grammar-pattern');
    const grammarTxt = document.getElementById('flash-grammar-pattern-text');
    if (card.grammarPattern && grammarWrap && grammarTxt) {
      grammarWrap.style.display = 'inline-flex';
      grammarTxt.textContent = card.grammarPattern;
    } else if (grammarWrap) {
      grammarWrap.style.display = 'none';
    }
  }

  function flipCard() {
    state.isFlipped = !state.isFlipped;
    const box = document.getElementById('flashcard-box');
    if (box) box.classList.toggle('flipped', state.isFlipped);
  }

  async function handleKnow() {
    const card = state.sessionCards[state.currentIndex];
    if (card) {
      state.knownCount++;
      card.status = 'mastered';
      try {
        await VocabDB.put('vocabulary', card);
        await updateStatsHeader();
      } catch (e) {
        console.error(e);
      }
    }
    state.currentIndex++;
    renderCurrentCard();
  }

  function handleAgain() {
    const card = state.sessionCards[state.currentIndex];
    if (card) {
      state.againCount++;
      // Đẩy lại cuối danh sách để học lại trong session này
      state.sessionCards.push(card);
    }
    state.currentIndex++;
    renderCurrentCard();
  }

  function showEmptyState(show) {
    const area = document.querySelector('.flashcard-area');
    const empty = document.getElementById('flash-empty-state');
    if (empty) empty.style.display = show ? 'block' : 'none';
    if (area) {
      const box = document.getElementById('flashcard-box');
      const controls = document.querySelector('.flashcard-controls');
      const bar = document.querySelector('.flashcard-progress-bar');
      if (box) box.style.display = show ? 'none' : 'block';
      if (controls) controls.style.display = show ? 'none' : 'flex';
      if (bar) bar.style.display = show ? 'none' : 'block';
    }
  }

  function showDoneState(show) {
    const done = document.getElementById('flash-done-state');
    const box = document.getElementById('flashcard-box');
    const controls = document.querySelector('.flashcard-controls');
    const bar = document.querySelector('.flashcard-progress-bar');

    if (done) {
      done.style.display = show ? 'block' : 'none';
      if (show) {
        const sum = document.getElementById('flash-done-summary');
        if (sum) {
          sum.innerHTML = `Bạn đã hoàn thành phiên ôn tập!<br>Đã nhớ: <strong style="color:var(--color-success);">${state.knownCount}</strong> từ | Cần ôn lại: <strong style="color:var(--color-danger);">${state.againCount}</strong> lượt.`;
        }
      }
    }
    if (box) box.style.display = show ? 'none' : 'block';
    if (controls) controls.style.display = show ? 'none' : 'flex';
    if (bar) bar.style.display = show ? 'none' : 'block';
  }

  function bindEvents() {
    // Card flip
    const box = document.getElementById('flashcard-box');
    if (box) {
      box.addEventListener('click', flipCard);
    }

    // Keyboard shortcuts (Space = flip, ArrowRight = know, ArrowLeft = again)
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
      } else if (e.code === 'ArrowRight' || e.key === '2') {
        handleKnow();
      } else if (e.code === 'ArrowLeft' || e.key === '1') {
        handleAgain();
      }
    });

    // Control buttons
    const btnKnow = document.getElementById('flash-btn-know');
    const btnAgain = document.getElementById('flash-btn-again');
    const btnSpeak = document.getElementById('flash-btn-speak');
    const btnRestart = document.getElementById('flash-btn-restart-session');
    const btnNewSess = document.getElementById('flash-btn-new-session');

    if (btnKnow) btnKnow.addEventListener('click', handleKnow);
    if (btnAgain) btnAgain.addEventListener('click', handleAgain);
    if (btnSpeak) {
      btnSpeak.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = state.sessionCards[state.currentIndex];
        if (card && card.word) speak(card.word);
      });
    }
    if (btnRestart) btnRestart.addEventListener('click', startNewSession);
    if (btnNewSess) btnNewSess.addEventListener('click', startNewSession);

    // Topic filter
    const topicSel = document.getElementById('flash-filter-topic');
    if (topicSel) {
      topicSel.addEventListener('change', (e) => {
        state.selectedTopic = e.target.value;
        startNewSession();
      });
    }

    // Limit filter
    const limitSel = document.getElementById('flash-filter-limit');
    if (limitSel) {
      limitSel.addEventListener('change', (e) => {
        state.limit = e.target.value;
        startNewSession();
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

