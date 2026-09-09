import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface VocabEntry {
  id: string;
  term: string;
  reading?: string;
  translation: string;
  bookId: string;
  bookTitle: string;
  context: string;
  createdAt: Date;
}

interface GrammarPoint {
  id: string;
  structure: string;
  explanation: string;
  examples: string[];
  bookId: string;
  paragraphRef: string;
  createdAt: Date;
}

interface VocabState {
  vocabulary: VocabEntry[];
  grammarPoints: GrammarPoint[];
  _hasHydrated: boolean;
  addVocab: (entry: VocabEntry) => void;
  removeVocab: (id: string) => void;
  updateVocab: (id: string, updates: Partial<VocabEntry>) => void;
  addGrammar: (point: GrammarPoint) => void;
  removeGrammar: (id: string) => void;
  clearBookVocabs: (bookId: string) => void;
  exportToPrintableCSV: (items?: VocabEntry[]) => string;
  exportToReviewCSV: (items?: VocabEntry[]) => string;
  exportToAnki: (items?: VocabEntry[]) => string;
  exportToPrintableHTML: (items?: VocabEntry[]) => string;
  setHasHydrated: (state: boolean) => void;
}

export const useVocabStore = create<VocabState>()(
  persist(
    (set, get) => ({
      vocabulary: [],
      grammarPoints: [],
      _hasHydrated: false,

      addVocab: (entry) => set((state) => ({
        vocabulary: [...state.vocabulary, entry]
      })),

      removeVocab: (id) => set((state) => ({
        vocabulary: state.vocabulary.filter((v) => v.id !== id)
      })),

      updateVocab: (id, updates) => set((state) => ({
        vocabulary: state.vocabulary.map((v) =>
          v.id === id ? { ...v, ...updates } : v
        )
      })),

      addGrammar: (point) => set((state) => ({
        grammarPoints: [...state.grammarPoints, point]
      })),

      removeGrammar: (id) => set((state) => ({
        grammarPoints: state.grammarPoints.filter((g) => g.id !== id)
      })),

      clearBookVocabs: (bookId) => set((state) => ({
        vocabulary: state.vocabulary.filter((v) => v.bookId !== bookId),
        grammarPoints: state.grammarPoints.filter((g) => g.bookId !== bookId)
      })),

      exportToPrintableCSV: (items) => {
        const source = items || get().vocabulary;
        // 默写用：第一列中文释义，第二列空白（供手写默写）
        const headers = ['释义（中文）', '单词/短语（默写栏）'];
        const rows = source.map((v) => [v.translation, '']);
        const escape = (str: string) => {
          if (!str) return '""';
          return `"${str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
        };
        return [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
      },

      exportToReviewCSV: (items) => {
        const source = items || get().vocabulary;
        // 复习用：第一列原文+读音，第二列中文释义
        const headers = ['单词/短语', '释义（中文）'];
        const rows = source.map((v) => [
          v.reading ? `${v.term} (${v.reading})` : v.term,
          v.translation
        ]);
        const escape = (str: string) => {
          if (!str) return '""';
          return `"${str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
        };
        return [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
      },

      exportToAnki: (items) => {
        const source = items || get().vocabulary;
        return source.map((v) => {
          const front = v.reading ? `${v.term} (${v.reading})` : v.term;
          const back = `${v.translation}\n\n例句: ${v.context.slice(0, 120)}`;
          return `${front}\t${back}\t${v.bookTitle}`;
        }).join('\n');
      },

      exportToPrintableHTML: (items) => {
        const source = items || get().vocabulary;
        const title = source[0]?.bookTitle || '生词默写表';
        let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - 生词默写表</title>
  <style>
    body { font-family: -apple-system, "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 20px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #333; padding: 14px 16px; text-align: left; font-size: 14px; }
    th { background: #f0f0f0; font-weight: 600; }
    td:nth-child(2) { min-width: 250px; }
    .footer { margin-top: 24px; text-align: center; color: #999; font-size: 12px; }
    @media print {
      body { padding: 10px; }
      th { background: #eee !important; -webkit-print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${title} — 生词默写表</h1>
  <p class="no-print" style="color: #666; font-size: 13px; margin-bottom: 10px;">
    💡 提示：使用浏览器"文件 → 打印"功能，选择"另存为 PDF"即可导出
  </p>
  <table>
    <thead><tr><th style="width: 40%">释义（中文）</th><th style="width: 60%">单词/短语（默写栏）</th></tr></thead>
    <tbody>`;
        source.forEach((v) => {
          html += `<tr>
            <td>${v.translation.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            <td style="font-family: Georgia, serif; font-size: 15px;"></td>
          </tr>`;
        });
        html += `</tbody></table>
  <div class="footer">共 ${source.length} 个生词</div>
</body></html>`;
        return html;
      },

      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'zen-reader-vocab',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
