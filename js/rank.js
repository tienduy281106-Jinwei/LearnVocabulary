/**
 * rank.js — VocabMaster Rank Battles Logic
 * Đấu hạng ngữ pháp từ Đồng (Bronze) lên Thách đấu (Challenger) sử dụng IndexedDB.
 */

(function () {
  'use strict';

  const RANKS = [
    { key: 'bronze', name: 'Đồng (Bronze)', color: '#cd7f32', icon: 'fa-medal' },
    { key: 'silver', name: 'Bạc (Silver)', color: '#c0c0c0', icon: 'fa-medal' },
    { key: 'gold', name: 'Vàng (Gold)', color: '#ffd700', icon: 'fa-trophy' },
    { key: 'platinum', name: 'Bạch Kim (Platinum)', color: '#00ced1', icon: 'fa-shield-halved' },
    { key: 'diamond', name: 'Kim Cương (Diamond)', color: '#4169e1', icon: 'fa-gem' },
    { key: 'master', name: 'Cao Thủ (Master)', color: '#9370db', icon: 'fa-crown' },
    { key: 'challenger', name: 'Thách Đấu (Challenger)', color: '#ff4500', icon: 'fa-fire' }
  ];

  const state = {
    userRank: 'bronze',
    questions: [],
    currentIndex: 0,
    score: 0,
    hasAnswered: false,
    allRankQuestions: []
  };

  async function loadData() {
    try {
      state.userRank = await VocabDB.getSetting('userRank', 'bronze');
      state.allRankQuestions = await VocabDB.getAll('rank_questions');

      updateRankHeader();
      renderRankDashboard();
    } catch (e) {
      console.error('[Rank] Lỗi tải dữ liệu:', e);
      showToast('Lỗi khi nạp dữ liệu đấu hạng!', 'error');
    }
  }

  function updateRankHeader() {
    const rObj = RANKS.find(r => r.key === state.userRank) || RANKS[0];
    const headerRank = document.getElementById('header-current-rank');
    if (headerRank) headerRank.textContent = rObj.name.split(' ')[0];
  }

  function renderRankDashboard() {
    const rIdx = RANKS.findIndex(r => r.key === state.userRank);
    const curRank = RANKS[rIdx >= 0 ? rIdx : 0];

    const badge = document.getElementById('rank-badge-display');
    const nameEl = document.getElementById('rank-name-display');

    if (badge) {
      badge.style.background = `radial-gradient(circle, ${curRank.color} 0%, rgba(0,0,0,0.4) 100%)`;
      badge.style.borderColor = curRank.color;
      badge.innerHTML = `<i class="fa-solid ${curRank.icon}"></i>`;
    }
    if (nameEl) nameEl.textContent = curRank.name;

    // Render Rank Map
    const mapContainer = document.getElementById('rank-map-container');
    if (mapContainer) {
      mapContainer.innerHTML = RANKS.map((r, i) => {
        const isCurrent = r.key === state.userRank;
        const isPassed = i < rIdx;
        const isLocked = i > rIdx;

        let statusClass = 'locked';
        let statusBadge = '<span style="font-size: 11px; opacity: 0.6;"><i class="fa-solid fa-lock"></i> Khóa</span>';
        if (isCurrent) {
          statusClass = 'current';
          statusBadge = '<span style="font-size: 11px; color: var(--color-warning); font-weight: 700;"><i class="fa-solid fa-play"></i> Hiện tại</span>';
        } else if (isPassed) {
          statusClass = 'passed';
          statusBadge = '<span style="font-size: 11px; color: var(--color-success);"><i class="fa-solid fa-check"></i> Đã đạt</span>';
        }

        return `
          <div style="flex: 1 1 90px; text-align: center; padding: 12px 6px; border-radius: 10px; background: rgba(255,255,255,${isCurrent ? '0.08' : '0.02'}); border: 1px solid ${isCurrent ? curRank.color : 'var(--border-glass)'};">
            <div style="font-size: 24px; color: ${isLocked ? 'var(--text-muted)' : r.color}; margin-bottom: 4px;">
              <i class="fa-solid ${r.icon}"></i>
            </div>
            <div style="font-size: 12px; font-weight: 700; color: ${isLocked ? 'var(--text-muted)' : 'var(--text-main)'}; margin-bottom: 2px;">
              ${r.name.split(' ')[0]}
            </div>
            ${statusBadge}
          </div>
        `;
      }).join('');
    }
  }

  function startRankMatch() {
    // Lấy câu hỏi theo tier hiện tại
    let qList = state.allRankQuestions.filter(q => q.rank_level === state.userRank);

    // Fallback to data.js RANK_QUESTIONS if empty
    if (qList.length === 0 && typeof RANK_QUESTIONS !== 'undefined' && RANK_QUESTIONS[state.userRank]) {
      qList = RANK_QUESTIONS[state.userRank];
    }

    if (qList.length === 0) {
      showToast('Đang cập nhật ngân hàng câu hỏi cho hạng này!', 'info');
      return;
    }

    // Shuffle and pick 5
    const shuffled = [...qList].sort(() => Math.random() - 0.5);
    state.questions = shuffled.slice(0, 5);
    state.currentIndex = 0;
    state.score = 0;
    state.hasAnswered = false;

    document.getElementById('rank-dashboard-screen').style.display = 'none';
    document.getElementById('rank-play-screen').style.display = 'flex';
    document.getElementById('rank-result-screen').style.display = 'none';

    renderRankQuestion();
  }

  function renderRankQuestion() {
    state.hasAnswered = false;
    const total = state.questions.length;
    const q = state.questions[state.currentIndex];
    const curRank = RANKS.find(r => r.key === state.userRank) || RANKS[0];

    document.getElementById('rank-play-progress').textContent = `Câu hỏi ${state.currentIndex + 1} / ${total}`;
    document.getElementById('rank-play-score-live').textContent = `Số câu đúng: ${state.score}`;
    document.getElementById('rank-play-progress-fill').style.width = `${((state.currentIndex + 1) / total) * 100}%`;

    const tag = document.getElementById('rank-play-level-tag');
    if (tag) {
      tag.textContent = `Cấp độ: ${curRank.name}`;
      tag.style.color = curRank.color;
    }

    document.getElementById('rank-play-question-text').textContent = q.question;

    const optContainer = document.getElementById('rank-play-options');
    optContainer.innerHTML = (q.options || []).map((opt, i) => `
      <button class="quiz-option-btn rank-opt-btn" data-val="${escapeHtml(opt)}">
        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
        <span class="option-text">${escapeHtml(opt)}</span>
      </button>
    `).join('');

    // Hide feedback
    const fb = document.getElementById('rank-play-feedback');
    if (fb) fb.style.display = 'none';

    optContainer.querySelectorAll('.rank-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => handleRankAnswer(btn, q));
    });
  }

  function handleRankAnswer(selectedBtn, q) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    const chosen = selectedBtn.dataset.val;
    const isCorrect = chosen === q.correct;

    const allBtns = document.querySelectorAll('.rank-opt-btn');
    allBtns.forEach(b => {
      b.disabled = true;
      if (b.dataset.val === q.correct) {
        b.classList.add('correct');
      }
    });

    const fb = document.getElementById('rank-play-feedback');
    const fbStatus = document.getElementById('rank-play-feedback-status');
    const fbSub = document.getElementById('rank-feedback-subtitle');
    const fbNote = document.getElementById('rank-correct-answer-note');
    const fbNoteTxt = document.getElementById('rank-correct-answer-text');
    const fbExp = document.getElementById('rank-play-explanation-text');
    const fbIcon = document.getElementById('rank-feedback-icon');

    if (fb) fb.style.display = 'block';

    if (isCorrect) {
      state.score++;
      selectedBtn.classList.add('correct');
      if (fbStatus) fbStatus.textContent = 'Chính xác! 🎉';
      if (fbSub) fbSub.textContent = '+1 điểm leo rank';
      if (fbIcon) fbIcon.className = 'fa-solid fa-circle-check';
      if (fbNote) fbNote.style.display = 'none';
      showToast('Chính xác! Tiếp tục phát huy!', 'success', 1000);
    } else {
      selectedBtn.classList.add('wrong');
      if (fbStatus) fbStatus.textContent = 'Chưa chính xác!';
      if (fbSub) fbSub.textContent = 'Xem giải thích sửa lỗi bên dưới';
      if (fbIcon) fbIcon.className = 'fa-solid fa-circle-xmark';
      if (fbNote) {
        fbNote.style.display = 'flex';
        fbNoteTxt.textContent = q.correct;
      }
      showToast('Sai rồi! Xem giải thích bên dưới để sửa lỗi.', 'warning', 2000);
    }

    if (fbExp) fbExp.textContent = q.explanation || `Đáp án đúng là: ${q.correct}`;

    document.getElementById('rank-play-score-live').textContent = `Số câu đúng: ${state.score}`;

    const nextBtn = document.getElementById('rank-play-btn-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        state.currentIndex++;
        if (state.currentIndex < state.questions.length) {
          renderRankQuestion();
        } else {
          endRankMatch();
        }
      };
    }
  }

  async function endRankMatch() {
    document.getElementById('rank-play-screen').style.display = 'none';
    const resScreen = document.getElementById('rank-result-screen');
    resScreen.style.display = 'flex';

    const total = state.questions.length;
    const score = state.score;
    const passed = score >= 4;

    const rIdx = RANKS.findIndex(r => r.key === state.userRank);

    document.getElementById('rank-res-score-detail').textContent = `Đúng: ${score} / ${total} câu hỏi`;

    const titleEl = document.getElementById('rank-res-title');
    const descEl = document.getElementById('rank-res-desc');
    const badgeEl = document.getElementById('rank-res-badge-display');
    const actionBtn = document.getElementById('rank-res-btn-action');

    if (passed) {
      // Thăng hạng
      if (rIdx < RANKS.length - 1) {
        state.userRank = RANKS[rIdx + 1].key;
        await VocabDB.putSetting('userRank', state.userRank);
        updateRankHeader();

        const nextR = RANKS[rIdx + 1];
        titleEl.textContent = 'THĂNG HẠNG THÀNH CÔNG! 🏆';
        descEl.textContent = `Chúc mừng bạn đã xuất sắc vượt qua bài thi và đạt danh hiệu ${nextR.name}!`;
        badgeEl.style.background = `radial-gradient(circle, ${nextR.color} 0%, rgba(0,0,0,0.5) 100%)`;
        badgeEl.innerHTML = `<i class="fa-solid ${nextR.icon}"></i>`;
        actionBtn.textContent = 'Tiếp tục leo hạng tiếp theo';
      } else {
        titleEl.textContent = 'ĐỈNH CAO THÁCH ĐẤU! 👑';
        descEl.textContent = 'Bạn đã đạt cấp bậc cao nhất trong hệ thống! Trình độ ngữ pháp của bạn đạt chuẩn chuyên gia!';
        actionBtn.textContent = 'Đấu trận đỉnh cao';
      }
    } else {
      titleEl.textContent = 'CHƯA THĂNG HẠNG';
      descEl.textContent = `Bạn cần trả lời đúng ít nhất 4/5 câu để thăng hạng (hiện đạt ${score}/5). Hãy cố gắng ở trận sau nhé!`;
      actionBtn.textContent = 'Thử lại trận này';
    }

    actionBtn.onclick = () => {
      startRankMatch();
    };

    const exitBtn = document.getElementById('rank-res-btn-exit');
    if (exitBtn) {
      exitBtn.onclick = () => {
        document.getElementById('rank-dashboard-screen').style.display = 'flex';
        document.getElementById('rank-play-screen').style.display = 'none';
        document.getElementById('rank-result-screen').style.display = 'none';
        renderRankDashboard();
      };
    }
  }

  function bindEvents() {
    const startBtn = document.getElementById('rank-btn-start');
    if (startBtn) {
      startBtn.addEventListener('click', startRankMatch);
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

