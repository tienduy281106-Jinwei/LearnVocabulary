/**
 * app.js — VocabMaster Dashboard Logic
 * Quản lý trang Bảng điều khiển (index.html) sử dụng IndexedDB
 */

(function () {
  'use strict';

  const MOTIVATIONAL_QUOTES = [
    { text: "The limits of my language mean the limits of my world.", author: "Ludwig Wittgenstein" },
    { text: "Learning another language is not only learning different words for the same things, but learning another way to think about things.", author: "Flora Lewis" },
    { text: "Language is the road map of a culture. It tells you where its people come from and where they are going.", author: "Rita Mae Brown" },
    { text: "One language sets you in a corridor for life. Two languages open every door along the way.", author: "Frank Smith" },
    { text: "To have another language is to possess a second soul.", author: "Charlemagne" },
    { text: "Change your language and you change your thoughts.", author: "Karl Albrecht" },
    { text: "Knowledge of languages is the doorway to wisdom.", author: "Roger Bacon" }
  ];

  async function renderDashboardStats() {
    try {
      const vocabList = await VocabDB.getAll('vocabulary');
      const sentences = await VocabDB.getAll('sentences');

      const total = vocabList.length;
      const mastered = vocabList.filter(v => v.status === 'mastered' || v.status === 'learned').length;
      const sentenceCount = sentences.length;

      const vEl = document.getElementById('dash-stat-vocab');
      const mEl = document.getElementById('dash-stat-mastered');
      const sEl = document.getElementById('dash-stat-sentences');

      if (vEl) vEl.textContent = total.toLocaleString('vi-VN');
      if (mEl) mEl.textContent = mastered.toLocaleString('vi-VN');
      if (sEl) sEl.textContent = sentenceCount.toLocaleString('vi-VN');

      renderRecentWords(vocabList);
    } catch (err) {
      console.error('[Dashboard] Lỗi tải dữ liệu stats:', err);
    }
  }

  function renderRecentWords(vocabList) {
    const container = document.getElementById('dashboard-recent-vocab');
    if (!container) return;

    if (!vocabList || vocabList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--text-muted);">
          <i class="fa-solid fa-book-open" style="font-size: 36px; margin-bottom: 10px; opacity: 0.5;"></i>
          <p>Chưa có từ vựng nào. Hãy thêm từ vựng mới!</p>
        </div>
      `;
      return;
    }

    // Sort by createdAt desc or take last items
    const recents = [...vocabList].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);

    container.innerHTML = recents.map(v => {
      const isMastered = v.status === 'mastered' || v.status === 'learned';
      const statusBadge = isMastered
        ? '<span class="badge" style="background: rgba(34,197,94,0.15); color: var(--color-success); font-size: 11px; padding: 2px 8px; border-radius: 12px;"><i class="fa-solid fa-circle-check"></i> Đã nhớ</span>'
        : '<span class="badge" style="background: rgba(99,102,241,0.15); color: var(--color-primary-light); font-size: 11px; padding: 2px 8px; border-radius: 12px;"><i class="fa-solid fa-book-open"></i> Đang học</span>';

      return `
        <div class="recent-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border-glass); transition: all 0.2s;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn-icon" onclick="speak('${escapeHtml(v.word)}')" title="Phát âm" style="background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-primary-light);">
              <i class="fa-solid fa-volume-high" style="font-size: 13px;"></i>
            </button>
            <div>
              <div style="font-weight: 600; font-size: 15px; color: var(--text-main);">
                ${escapeHtml(v.word)}
                <span style="font-size: 12px; color: var(--text-muted); font-weight: normal; margin-left: 6px;">${v.pronunciation || ''}</span>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                <span class="vocab-card-type" style="font-size: 11px; margin-right: 6px;">${v.type || 'noun'}</span>
                ${escapeHtml(v.definition || '')}
              </div>
            </div>
          </div>
          <div>
            ${statusBadge}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRandomQuote() {
    const qText = document.getElementById('quote-text');
    const qAuthor = document.getElementById('quote-author');
    if (!qText || !qAuthor) return;

    const random = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    qText.textContent = `"${random.text}"`;
    qAuthor.textContent = `— ${random.author}`;
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

  // Khởi động khi tải xong trang
  document.addEventListener('DOMContentLoaded', async () => {
    await initShared();
    renderRandomQuote();
    await renderDashboardStats();
  });

})();
