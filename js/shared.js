/**
 * shared.js — VocabMaster Shared Utilities
 * Provides common UI scaffolding, navigation, theme management, and helpers
 * used across every page of the application.
 *
 * Usage: include this script (after db.js) in every HTML page, then call
 *   await initShared();
 * in a DOMContentLoaded listener or top-level async IIFE.
 */

(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════
   * 1.  NAVBAR TEMPLATE
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Returns the sidebar HTML string.
   * The caller inserts it into #sidebar-mount.
   * @returns {string}
   */
  function buildNavbarHTML() {
    const links = [
      { href: 'index.html',       icon: 'fa-chart-pie',          label: 'Bảng điều khiển' },
      { href: 'vocabulary.html',  icon: 'fa-book-open',          label: 'Kho từ vựng' },
      { href: 'all-vocab.html',   icon: 'fa-table-list',         label: 'Tổng hợp tất cả từ vựng' },
      { href: 'flashcards.html',  icon: 'fa-clone',              label: 'Ôn tập Flashcards' },
      { href: 'quiz.html',        icon: 'fa-circle-question',    label: 'Kiểm tra từ vựng' },
      { href: 'topic-quiz.html',  icon: 'fa-clipboard-check',    label: 'Kiểm tra theo Topic', accentIcon: true },
      { href: 'grammar.html',     icon: 'fa-graduation-cap',     label: 'Góc ngữ pháp' },
      { href: 'rank.html',        icon: 'fa-trophy',             label: 'Đấu hạng ngữ pháp' },
      { href: 'sentences.html',   icon: 'fa-pen-nib',            label: 'Tập đặt câu' },
      { href: 'reading.html',     icon: 'fa-book-open-reader',   label: 'Đọc hiểu' },
    ];

    const adminLinks = [
      { href: 'admin/vocab-manager.html', icon: 'fa-database',     label: 'Quản lý từ vựng' },
      { href: 'admin/quiz-manager.html',  icon: 'fa-list-check',   label: 'Quản lý câu hỏi' },
    ];

    // Determine the current page filename for active-state detection
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    // For pages inside admin/ the pathname will contain 'admin/'
    const currentFull = location.pathname.replace(/\\/g, '/');
    // Prefix to adjust hrefs when rendering navbar from an admin/ subdirectory
    const isInAdmin = currentFull.includes('/admin/');
    const rootPrefix = isInAdmin ? '../' : '';

    function navItem({ href, icon, label, accentIcon = false }) {
      // Adjust href when inside admin/ subdirectory
      // admin/* hrefs (like admin/vocab-manager.html) need no prefix from admin/ pages
      // root hrefs (like index.html) need '../' prefix when in admin/
      const isAdminHref = href.startsWith('admin/');
      let resolvedHref;
      if (isInAdmin) {
        // From admin/ page: root links get '../', admin links become just the filename
        resolvedHref = isAdminHref ? href.replace('admin/', '') : '../' + href;
      } else {
        resolvedHref = href;
      }

      // Determine active state
      const hrefPage = href.replace(/^.*\//, ''); // basename
      let isActive = false;
      if (isAdminHref) {
        isActive = currentFull.endsWith(hrefPage) || currentFull.endsWith('admin/' + hrefPage);
      } else {
        isActive = currentPage === hrefPage;
      }

      const iconStyle = accentIcon ? ' style="color:var(--color-accent);"' : '';
      return `
        <li class="nav-item${isActive ? ' active' : ''}">
          <a class="nav-link" href="${resolvedHref}">
            <i class="fa-solid ${icon}"${iconStyle}></i> ${label}
          </a>
        </li>`;
    }

    const mainItems = links.map(navItem).join('');
    const adminItems = adminLinks.map(navItem).join('');

    return `
<aside class="sidebar">
  <div class="brand">
    <div class="brand-logo">LV</div>
    <span class="brand-name">Learning Vocabulary</span>
  </div>

  <ul class="nav-menu">
    ${mainItems}

    <!-- Quản trị dropdown -->
    <li class="nav-item nav-item--dropdown" id="admin-nav-item">
      <button class="nav-link nav-link--dropdown" id="admin-nav-toggle" type="button"
              aria-expanded="false" aria-controls="admin-submenu">
        <i class="fa-solid fa-screwdriver-wrench"></i> Quản trị
        <i class="fa-solid fa-chevron-down nav-dropdown-arrow" id="admin-dropdown-arrow"></i>
      </button>
      <ul class="nav-submenu" id="admin-submenu" aria-hidden="true">
        ${adminItems}
      </ul>
    </li>
  </ul>

  <div class="sidebar-footer">
    <button class="theme-toggle-btn" id="theme-toggle" type="button">
      <div class="theme-icon-container">
        <i class="fa-solid fa-moon" id="theme-icon"></i>
        <span id="theme-text">Chế độ tối</span>
      </div>
      <i class="fa-solid fa-rotate"></i>
    </button>
  </div>
</aside>`;
  }

  /* ═══════════════════════════════════════════════════════════════
   * 2.  THEME
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Applies the saved theme to <html> and updates the toggle button text/icon.
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (!icon || !text) return;
    if (theme === 'dark') {
      icon.className = 'fa-solid fa-moon';
      text.textContent = 'Chế độ tối';
    } else {
      icon.className = 'fa-solid fa-sun';
      text.textContent = 'Chế độ sáng';
    }
  }

  /**
   * Reads the stored theme preference (DB → localStorage fallback → 'dark').
   * @returns {Promise<string>}
   */
  async function loadTheme() {
    let theme = 'dark';
    try {
      theme = await VocabDB.getSetting('theme', 'dark');
    } catch (_) {
      theme = localStorage.getItem('theme') || 'dark';
    }
    return theme;
  }

  /**
   * Wires up the #theme-toggle button click handler.
   */
  function bindThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        await VocabDB.putSetting('theme', next);
      } catch (_) {
        localStorage.setItem('theme', next);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
   * 3.  ADMIN DROPDOWN
   * ═══════════════════════════════════════════════════════════════ */

  function bindAdminDropdown() {
    const toggle = document.getElementById('admin-nav-toggle');
    const submenu = document.getElementById('admin-submenu');
    const arrow = document.getElementById('admin-dropdown-arrow');
    if (!toggle || !submenu) return;

    // Auto-open if the current page is inside admin/
    const currentFull = location.pathname.replace(/\\/g, '/');
    const isAdminPage = currentFull.includes('/admin/');
    if (isAdminPage) {
      submenu.style.display = 'block';
      toggle.setAttribute('aria-expanded', 'true');
      submenu.setAttribute('aria-hidden', 'false');
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    }

    toggle.addEventListener('click', () => {
      const isOpen = submenu.style.display === 'block';
      submenu.style.display = isOpen ? 'none' : 'block';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      submenu.setAttribute('aria-hidden', String(isOpen));
      if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
    });
  }

  /* ═══════════════════════════════════════════════════════════════
   * 4.  STATS HEADER
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Updates a "global stats" header bar if the page has one.
   * Expects elements with IDs: header-total-vocab, header-mastered-vocab, stats-total, stats-learned.
   */
  async function updateStatsHeader() {
    const headerTotal    = document.getElementById('header-total-vocab');
    const headerMastered = document.getElementById('header-mastered-vocab');
    const totalEl        = document.getElementById('stats-total');
    const learnedEl      = document.getElementById('stats-learned');
    const newEl          = document.getElementById('stats-new');
    const reviewEl       = document.getElementById('stats-review');

    if (!headerTotal && !headerMastered && !totalEl && !learnedEl && !newEl && !reviewEl) return;

    try {
      const all = await VocabDB.getAll('vocabulary');
      const total    = all.length;
      const mastered = all.filter(v => v.status === 'mastered' || v.status === 'learned').length;
      const isNew    = all.filter(v => v.status === 'learning' || v.status === 'new' || !v.status).length;
      const review   = all.filter(v => v.status === 'review').length;

      if (headerTotal)    headerTotal.textContent    = total;
      if (headerMastered) headerMastered.textContent = mastered;
      if (totalEl)        totalEl.textContent        = total;
      if (learnedEl)      learnedEl.textContent      = mastered;
      if (newEl)          newEl.textContent          = isNew;
      if (reviewEl)       reviewEl.textContent       = review;
    } catch (e) {
      console.warn('[shared] updateStatsHeader failed:', e);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * 5.  PUBLIC UTILITY FUNCTIONS
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Returns the list of unique topic names from the vocabulary store.
   * @returns {Promise<string[]>}
   */
  async function getActiveTopics() {
    try {
      const all = await VocabDB.getAll('vocabulary');
      const topics = [...new Set(all.map(v => v.topic).filter(Boolean))];
      return topics.sort((a, b) => a.localeCompare(b, 'vi'));
    } catch (e) {
      console.error('[shared] getActiveTopics error:', e);
      return [];
    }
  }

  /**
   * Navigates to another page, resolving relative to the app root.
   * @param {string} page — e.g. 'vocabulary.html' or 'admin/quiz-manager.html'
   */
  function navigateTo(page) {
    if (!page) return;
    // Determine root by walking up from the current path until we're at app root
    // Simple strategy: use the href directly (pages are co-located with index.html)
    const isInSubdir = location.pathname.replace(/\\/g, '/').includes('/admin/');
    const prefix = isInSubdir ? '../' : '';
    location.href = prefix + page;
  }

  /**
   * Shows a temporary toast notification.
   * @param {string} msg   — message text (may contain HTML)
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   * @param {number} [duration=3000] — ms before auto-dismiss
   */
  function showToast(msg, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText =
        'position:fixed;bottom:30px;right:30px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(container);
    }

    const colorMap = {
      success: 'var(--color-success, #22c55e)',
      error:   'var(--color-danger,  #ef4444)',
      warning: 'var(--color-warning, #f59e0b)',
      info:    'var(--color-primary, #7b61ff)',
    };
    const iconMap = {
      success: 'fa-circle-check',
      error:   'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info:    'fa-circle-info',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.style.cssText = `
      display:flex;align-items:center;gap:10px;
      padding:12px 18px;border-radius:10px;
      background:var(--bg-glass,rgba(30,30,50,0.95));
      border:1px solid ${colorMap[type] || colorMap.info};
      color:var(--text-main,#f1f5f9);
      box-shadow:0 4px 24px rgba(0,0,0,0.3);
      font-size:14px;min-width:220px;max-width:360px;
      animation:toastIn 0.25s ease;
    `;
    toast.innerHTML = `
      <i class="fa-solid ${iconMap[type] || iconMap.info}" style="color:${colorMap[type] || colorMap.info};font-size:16px;flex-shrink:0;"></i>
      <span>${msg}</span>
    `;

    // Inject keyframe once
    if (!document.getElementById('toast-style')) {
      const style = document.createElement('style');
      style.id = 'toast-style';
      style.textContent = `
        @keyframes toastIn  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastOut { from { opacity:1; transform:translateY(0);    } to { opacity:0; transform:translateY(16px); } }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.25s ease forwards';
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }

  /**
   * Formats a Unix timestamp (ms or s) into a Vietnamese locale date-time string.
   * @param {number} ts — timestamp in milliseconds (or seconds if < 1e10)
   * @returns {string}
   */
  function formatDate(ts) {
    if (!ts) return '—';
    // Accept both ms and s timestamps
    const ms = ts < 1e10 ? ts * 1000 : ts;
    return new Date(ms).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  /**
   * Speaks the given text using the Web Speech API.
   * Uses an English (US) voice if available.
   * @param {string} text
   */
  function speak(text) {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.9;
    utter.pitch = 1;

    // Try to pick a natural English voice
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en') && !v.localService === false)
                 || voices.find(v => v.lang.startsWith('en'));
    if (enVoice) utter.voice = enVoice;

    window.speechSynthesis.speak(utter);
  }

  /* ═══════════════════════════════════════════════════════════════
   * 5.5 ROBOT MASCOT TYPEWRITER
   * ═══════════════════════════════════════════════════════════════ */
  function initRobotMascot() {
    const typewriterEl = document.getElementById('robot-typewriter');
    const dateEl = document.getElementById('current-date-txt');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('vi-VN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    if (!typewriterEl) return;

    const messages = [
      "Xin chào bạn! Chúc bạn một ngày học tập hiệu quả! 🚀",
      "Hôm nay chúng ta cùng học thêm từ vựng mới nhé! 📚",
      "Luyện tập hàng ngày là chìa khóa để chinh phục IELTS! 🎯"
    ];
    let msgIdx = 0, charIdx = 0, isDeleting = false;

    function typeStep() {
      const current = messages[msgIdx];
      if (!isDeleting) {
        typewriterEl.textContent = current.slice(0, charIdx + 1);
        charIdx++;
        if (charIdx === current.length) {
          isDeleting = true;
          setTimeout(typeStep, 2500);
          return;
        }
      } else {
        typewriterEl.textContent = current.slice(0, charIdx - 1);
        charIdx--;
        if (charIdx === 0) {
          isDeleting = false;
          msgIdx = (msgIdx + 1) % messages.length;
          setTimeout(typeStep, 600);
          return;
        }
      }
      setTimeout(typeStep, isDeleting ? 40 : 80);
    }
    typeStep();
  }

  /* ═══════════════════════════════════════════════════════════════
   * 6.  initShared — MAIN ENTRY POINT
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Initialises shared features:
   *   1. Opens the IndexedDB (runs migration & seed on first load)
   *   2. Renders the sidebar into #sidebar-mount (if present)
   *   3. Applies the saved theme
   *   4. Binds theme toggle & admin dropdown
   *   5. Updates the stats header (if present)
   *
   * @returns {Promise<void>}
   */
  async function initShared() {
    // 1 — Open DB and migrate/seed
    try {
      await VocabDB.open();
      const migrationDone = await VocabDB.getSetting('_migrationDone', false);
      if (!migrationDone) {
        const result = await VocabDB.migrateFromLocalStorage();
        if (result.migrated.length > 0) {
          await VocabDB.putSetting('_migrationDone', true);
        }
      }
      if (typeof global.ensureDatabaseSeeded === 'function') {
        await global.ensureDatabaseSeeded();
      }
    } catch (e) {
      console.error('[shared] DB init error:', e);
    }

    // 2 — Render navbar
    const mount = document.getElementById('sidebar-mount');
    if (mount) {
      mount.innerHTML = buildNavbarHTML();
    }

    // 3 — Apply theme
    const theme = await loadTheme();
    applyTheme(theme);

    // 4 — Bind UI handlers
    bindThemeToggle();
    bindAdminDropdown();

    // 5 — Mascot & date
    initRobotMascot();

    // 6 — Stats header
    await updateStatsHeader();
  }

  /* ═══════════════════════════════════════════════════════════════
   * 7.  GLOBAL EXPORT
   * ═══════════════════════════════════════════════════════════════ */

  global.initShared      = initShared;
  global.getActiveTopics = getActiveTopics;
  global.navigateTo      = navigateTo;
  global.showToast       = showToast;
  global.formatDate      = formatDate;
  global.speak           = speak;
  global.updateStatsHeader = updateStatsHeader;

})(window);
