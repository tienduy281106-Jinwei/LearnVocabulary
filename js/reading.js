/**
 * reading.js — IELTS Reading Passages Hub
 * Giới thiệu 9 bài đọc IELTS Reading, liên kết trực tiếp tới Từ vựng, Flashcards và Kiểm tra.
 */

(function () {
  'use strict';

  const PASSAGES = [
    {
      id: 'polar-bears',
      title: 'Why We Need to Protect Polar Bears',
      icon: '🐻‍❄️',
      theme: 'Sinh thái & Sinh học tiến hóa',
      desc: 'Nghiên cứu về cơ chế thích nghi phi thường của gấu Bắc cực với chế độ ăn nhiều mỡ mà không bị tim mạch và loãng xương.',
      vocabCount: 62,
      questionCount: 74
    },
    {
      id: 'pyramid-djoser',
      title: 'The Step Pyramid of Djoser',
      icon: '🏛️',
      theme: 'Khảo cổ & Lịch sử cổ đại',
      desc: 'Quá trình kiến trúc sư tài ba Imhotep thiết kế và xây dựng kim tự tháp bậc thang Saqqara đầu tiên trong lịch sử nhân loại.',
      vocabCount: 109,
      questionCount: 99
    },
    {
      id: 'future-work',
      title: 'The Future of Work',
      icon: '💼',
      theme: 'Kinh tế & Trí tuệ nhân tạo',
      desc: 'Tác động sâu rộng của tự động hóa và thuật toán đối với lực lượng lao động toàn cầu trong nền kinh tế tri thức.',
      vocabCount: 97,
      questionCount: 99
    },
    {
      id: 'white-horse',
      title: 'Uffington White Horse',
      icon: '🐎',
      theme: 'Di sản & Khảo cổ học',
      desc: 'Hình khắc khổng lồ hình ngựa trắng trên nền đá phấn đồi Oxfordshire có niên đại hơn 3.000 năm từ thời Đồ đồng.',
      vocabCount: 101,
      questionCount: 109
    },
    {
      id: 'multitudes',
      title: 'I Contain Multitudes',
      icon: '🔬',
      theme: 'Khoa học & Vi sinh vật',
      desc: 'Cuốn sách của Ed Yong hé lộ thế giới bí ẩn của hàng nghìn tỷ vi sinh vật cộng sinh cùng cơ thể người và động vật.',
      vocabCount: 143,
      questionCount: 135
    },
    {
      id: 'wise-decisions',
      title: 'How to Make Wise Decisions',
      icon: '🧠',
      theme: 'Tâm lý học hành vi',
      desc: 'Nghiên cứu của các nhà tâm lý về sự khiêm tốn trí tuệ và kỹ thuật tách cái tôi (ego-decentering) để đưa ra phán đoán sáng suốt.',
      vocabCount: 135,
      questionCount: 115
    },
    {
      id: 'roman-ships',
      title: 'Roman Shipbuilding and Navigation',
      icon: '⛵',
      theme: 'Lịch sử Hàng hải La Mã',
      desc: 'Kỹ nghệ đóng thương thuyền và chiến hạm La Mã tinh xảo cùng phương pháp định hướng đi biển cổ đại trên Địa Trung Hải.',
      vocabCount: 103,
      questionCount: 89
    },
    {
      id: 'norway-glaciers',
      title: 'Ancient Artefacts in Norway Glaciers',
      icon: '🏔️',
      theme: 'Khảo cổ học sông băng',
      desc: 'Sự tan chảy của các sông băng ở Na Uy do biến đổi khí hậu hé lộ hàng nghìn cổ vật nguyên vẹn từ thời Viking và Đồ đá.',
      vocabCount: 100,
      questionCount: 81
    },
    {
      id: 'plant-thermometer',
      title: 'Plant Thermometer & Night Heat',
      icon: '🌱',
      theme: 'Thực vật học & Khí hậu',
      desc: 'Khám phá về sắc tố phytochrome hoạt động như một nhiệt kế phân tử đo nhiệt độ ban đêm để điều phối thời điểm ra hoa.',
      vocabCount: 64,
      questionCount: 62
    }
  ];

  function renderPassages() {
    const grid = document.getElementById('reading-cards-grid');
    if (!grid) return;

    grid.innerHTML = PASSAGES.map((p, idx) => {
      const topicEncoded = encodeURIComponent(p.title);

      return `
        <div class="panel" style="display: flex; flex-direction: column; justify-content: space-between; padding: 22px; border-radius: 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); transition: all 0.25s ease;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 32px;">${p.icon}</span>
              <span class="vocab-card-type" style="font-size: 11px; background: rgba(168,85,247,0.15); color: #c084fc;">
                ${escapeHtml(p.theme)}
              </span>
            </div>

            <h3 style="font-size: 17px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; line-height: 1.4;">
              ${idx + 1}. ${escapeHtml(p.title)}
            </h3>

            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 15px;">
              ${escapeHtml(p.desc)}
            </p>
          </div>

          <div>
            <div style="display: flex; gap: 15px; padding: 10px 0; border-top: 1px solid var(--border-glass); border-bottom: 1px solid var(--border-glass); margin-bottom: 15px; font-size: 12px; color: var(--text-muted);">
              <span><i class="fa-solid fa-book" style="color: var(--color-primary-light);"></i> <strong>${p.vocabCount}</strong> từ vựng</span>
              <span><i class="fa-solid fa-circle-question" style="color: var(--color-warning);"></i> <strong>${p.questionCount}</strong> câu hỏi</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
              <a href="vocabulary.html?topic=${topicEncoded}" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 7px 4px; text-align: center; justify-content: center;" title="Xem từ vựng">
                <i class="fa-solid fa-book-open"></i> Từ vựng
              </a>
              <a href="flashcards.html?topic=${topicEncoded}" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 7px 4px; text-align: center; justify-content: center;" title="Ôn Flashcard">
                <i class="fa-solid fa-clone"></i> Thẻ 3D
              </a>
              <a href="topic-quiz.html?topic=${topicEncoded}" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 7px 4px; text-align: center; justify-content: center;" title="Làm bài kiểm tra">
                <i class="fa-solid fa-play"></i> Kiểm tra
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
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
    renderPassages();
  });

})();

