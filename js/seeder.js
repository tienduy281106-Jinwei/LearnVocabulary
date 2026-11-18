/**
 * seeder.js — Khởi tạo & nạp dữ liệu ban đầu vào IndexedDB (VocabMasterDB)
 * Đảm bảo dữ liệu từ vựng theo chủ đề, câu hỏi kiểm tra, ngữ pháp luôn sẵn sàng.
 */

(function (global) {
  'use strict';

  async function ensureDatabaseSeeded() {
    try {
      await VocabDB.open();

      // 1. Đồng bộ Từ vựng (Vocabulary)
      const existingVocab = await VocabDB.getAll('vocabulary');
      const existingIds = new Set(existingVocab.map(v => v.id));
      const existingWords = new Set(existingVocab.map(v => (v.word || '').toLowerCase()));

      const toAddVocab = [];

      // Nạp DEFAULT_VOCABULARY nếu chưa có
      if (typeof DEFAULT_VOCABULARY !== 'undefined' && Array.isArray(DEFAULT_VOCABULARY)) {
        DEFAULT_VOCABULARY.forEach(item => {
          if (!existingIds.has(item.id) && !existingWords.has(item.word.toLowerCase())) {
            toAddVocab.push({
              ...item,
              topic: item.topic || 'General'
            });
            existingIds.add(item.id);
            existingWords.add(item.word.toLowerCase());
          }
        });
      }

      // Nạp 9 chủ đề IELTS từ PDF_TOPICS_VOCABULARY
      if (typeof PDF_TOPICS_VOCABULARY !== 'undefined' && Array.isArray(PDF_TOPICS_VOCABULARY)) {
        PDF_TOPICS_VOCABULARY.forEach(item => {
          const key = `${item.word.toLowerCase()}__${item.topic}`;
          if (!existingIds.has(item.id)) {
            toAddVocab.push(item);
            existingIds.add(item.id);
          }
        });
      }

      if (toAddVocab.length > 0) {
        await VocabDB.bulkPut('vocabulary', toAddVocab);
        console.log(`[Seeder] Đã nạp thêm ${toAddVocab.length} từ vựng mới vào IndexedDB.`);
      }

      // 2. Đồng bộ Ngân hàng câu hỏi kiểm tra (quiz_questions)
      const existingQuestions = await VocabDB.getAll('quiz_questions');
      if (existingQuestions.length === 0 && typeof PDF_QUIZ_QUESTIONS !== 'undefined' && Array.isArray(PDF_QUIZ_QUESTIONS)) {
        await VocabDB.bulkPut('quiz_questions', PDF_QUIZ_QUESTIONS);
        console.log(`[Seeder] Đã nạp ${PDF_QUIZ_QUESTIONS.length} câu hỏi kiểm tra từ PDF vào IndexedDB.`);
      }

      // 3. Đồng bộ Ngữ pháp (Grammar)
      const existingGrammar = await VocabDB.getAll('grammar');
      if (existingGrammar.length === 0 && typeof DEFAULT_GRAMMAR !== 'undefined' && Array.isArray(DEFAULT_GRAMMAR)) {
        await VocabDB.bulkPut('grammar', DEFAULT_GRAMMAR);
        console.log(`[Seeder] Đã nạp ${DEFAULT_GRAMMAR.length} bài học ngữ pháp.`);
      }

      // 4. Đồng bộ Câu hỏi Đấu hạng (Rank questions)
      const existingRank = await VocabDB.getAll('rank_questions');
      if (existingRank.length === 0 && typeof RANK_QUESTIONS !== 'undefined') {
        const flatRankQuestions = [];
        for (const [tier, qList] of Object.entries(RANK_QUESTIONS)) {
          qList.forEach((q, idx) => {
            flatRankQuestions.push({
              id: `rank-${tier}-${idx + 1}`,
              rank_level: tier,
              question: q.question,
              options: q.options,
              correct: q.correct,
              explanation: q.explanation
            });
          });
        }
        if (flatRankQuestions.length > 0) {
          await VocabDB.bulkPut('rank_questions', flatRankQuestions);
          console.log(`[Seeder] Đã nạp ${flatRankQuestions.length} câu hỏi đấu hạng ngữ pháp.`);
        }
      }

      // 5. Đồng bộ Tập đặt câu mẫu (Sentences)
      const existingSentences = await VocabDB.getAll('sentences');
      if (existingSentences.length === 0 && typeof DEFAULT_SENTENCES !== 'undefined' && Array.isArray(DEFAULT_SENTENCES)) {
        await VocabDB.bulkPut('sentences', DEFAULT_SENTENCES);
      }

      return true;
    } catch (err) {
      console.error('[Seeder] Lỗi khi nạp dữ liệu ban đầu:', err);
      return false;
    }
  }

  global.ensureDatabaseSeeded = ensureDatabaseSeeded;

})(window);

