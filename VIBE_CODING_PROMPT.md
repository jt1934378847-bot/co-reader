# Zen Reader Vibe Coding Prompt

## 项目背景
一个基于 Next.js + React + Zustand + Tailwind 的沉浸式外语电子书阅读器。

## 执行要求
- 每次只改一个文件，改完确认编译通过再继续
- 所有用户可见文案必须通过 `i18n.ts`，禁止硬编码
- 保持现有代码风格，不引入新依赖（除明确说明的 `mobi-to-epub`）
- 改完后运行 `npm run build` 验证

---

## Task 1：文案统一 — "高光笔记" 全部改为 "笔记"

### 修改文件
- `src/lib/i18n.ts`
- `src/components/deck/notebook-modal.tsx`

### 修改内容

**i18n.ts（4 处语言）：**
```typescript
// 中文（zh）
notebook: '笔记',
highlights: '笔记',
noVocabHint: '阅读时选中文本可添加笔记',
noMatchVocab: '未找到匹配的笔记',

// 英文（en）
notebook: 'Notes',
highlights: 'Notes',
noVocabHint: 'Select text while reading to add notes',
noMatchVocab: 'No matching notes found',

// 日文（ja）
notebook: 'ノート',
highlights: 'ノート',

// 韩文（ko）
notebook: '노트',
highlights: '노트',
```

**notebook-modal.tsx 硬编码文案：**
- `placeholder="搜索高光笔记..."` → `placeholder="搜索笔记..."`
- `'未找到匹配的高光'` → `'未找到匹配的笔记'`
- `'暂无高光笔记'` → `'暂无笔记'`
- `'选中文本后点击高光按钮添加'` → `'选中文本后点击笔记按钮添加'`
- `'共 x 个高光笔记'` → `'共 x 个笔记'`（使用 `t('highlights')` 的翻译会自动处理）

---

## Task 2：排版控件嵌入阅读界面

### 修改文件
- `src/components/reader/reader-footer.tsx`
- `src/components/reader/reader-content.tsx`（只读不改）

### 需求
在阅读界面底部展开面板（`isExpanded` 区域）增加字号/行高/宽度三控。

### 实现

**reader-footer.tsx — 在展开面板加排版控制区：**
```tsx
// 新增 import
import { useSettingsStore } from '@/lib/stores/settings-store';

// 在组件内读取和修改
const { fontSize, lineHeight, readingWidth, setFontSize, setLineHeight, setReadingWidth } = useSettingsStore();

// 在 isExpanded 区域（约第105行后）插入：
<div className="mt-3 pt-3 border-t border-[var(--border-color)]">
  <p className="text-xs text-[var(--text-muted)] mb-2">排版设置</p>
  <div className="grid grid-cols-3 gap-3">
    {/* 字号 */}
    <div>
      <label className="text-xs text-[var(--text-muted)]">字号 {fontSize}px</label>
      <div className="flex items-center gap-1 mt-1">
        <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">-</button>
        <span className="text-xs w-6 text-center">{fontSize}</span>
        <button onClick={() => setFontSize(Math.min(24, fontSize + 2))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">+</button>
      </div>
    </div>
    {/* 行高 */}
    <div>
      <label className="text-xs text-[var(--text-muted)]">行高 {lineHeight.toFixed(1)}</label>
      <div className="flex items-center gap-1 mt-1">
        <button onClick={() => setLineHeight(Math.max(1.2, +(lineHeight - 0.1).toFixed(1)))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">-</button>
        <span className="text-xs w-6 text-center">{lineHeight.toFixed(1)}</span>
        <button onClick={() => setLineHeight(Math.min(2.5, +(lineHeight + 0.1).toFixed(1)))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">+</button>
      </div>
    </div>
    {/* 宽度 */}
    <div>
      <label className="text-xs text-[var(--text-muted)]">宽度 {readingWidth}px</label>
      <div className="flex items-center gap-1 mt-1">
        <button onClick={() => setReadingWidth(Math.max(400, readingWidth - 20))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">-</button>
        <span className="text-xs w-8 text-center">{readingWidth}</span>
        <button onClick={() => setReadingWidth(Math.min(900, readingWidth + 20))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">+</button>
      </div>
    </div>
  </div>
</div>
```

**reader-content.tsx：** 确认从 `useSettingsStore()` 读取的 `fontSize`、`lineHeight`、`readingWidth` 正确应用到 `<article>` 样式（已有，无需修改）。

---

## Task 3：今日阅读时长 — 每次重进重置

### 修改文件
- `src/components/reader/reader-footer.tsx`

### 需求
- 每次打开书都重新开始计时（**不跨 session 累加**）
- 底部状态栏始终显示本次阅读时长（即使未在计时）
- 展开面板显示：本次阅读 + 今日累计

### 修改内容

**reader-footer.tsx：**
```tsx
// 将这段（约第80行）：
{isTimerRunning ? formatDuration(sessionDuration) : '00:00'}
// 改为：
{formatDuration(sessionDuration)}
// 解释：始终显示当前 session 时长
```

**在展开面板新增统计行：**
```tsx
<div className="grid grid-cols-2 gap-3 mt-3">
  <div className="p-2 rounded bg-[var(--bg-tertiary)]">
    <p className="text-xs text-[var(--text-muted)]">本次阅读</p>
    <p className="font-mono text-sm">{formatDuration(sessionDuration)}</p>
  </div>
  <div className="p-2 rounded bg-[var(--bg-tertiary)]">
    <p className="text-xs text-[var(--text-muted)]">今日累计</p>
    <p className="font-mono text-sm">
      {Math.floor(todayStats.readingTime / 3600)}h {Math.floor((todayStats.readingTime % 3600) / 60)}m
    </p>
  </div>
</div>
```

**无需修改 `session-store.ts`：** `startSession` 每次重置 `duration: 0` 符合需求。

---

## Task 4：导入格式扩展 — 支持 MOBI/AZW3

### 修改文件
- `src/lib/parsers/index.ts`
- `src/components/library/library-sidebar.tsx`
- `package.json`

### 需求
支持 `.epub`、`.txt`、`.pdf`、`.mobi`、`.azw3` 导入。

### 实现方案

**MOBI/AZW3 处理逻辑：**
由于 MOBI/AZW3 是二进制格式，最可靠方案是 **先转换为 EPUB，再用现有 `parseEPUB` 解析**。

**方案 A（推荐）：Calibre CLI 转换（服务器端）**
不适用，因为用户没有服务器。

**方案 B（客户端）：使用 `mobi-to-epub` 库**
```bash
npm install mobi-to-epub
```

**parsers/index.ts — 新增 MOBI 解析：**
```typescript
import { convertMobiToEpub } from 'mobi-to-epub';

export async function parseMOBI(file: File): Promise<{ content: string; title: string; author: string; coverImage?: string; chapters: Chapter[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const epubBuffer = await convertMobiToEpub(arrayBuffer);
  
  // 转换为 Blob File，复用 parseEPUB
  const epubFile = new File([epubBuffer], file.name.replace(/\.mobi$/i, '.epub'), { type: 'application/epub+zip' });
  return parseEPUB(epubFile);
}
```

**AZW3 处理：**
AZW3 本质与 MOBI 类似，直接复用 `parseMOBI`：
```typescript
export async function parseAZW3(file: File): Promise<...> {
  return parseMOBI(file); // 复用
}
```

**parseBook 函数修改：**
```typescript
export async function parseBook(file: File): Promise<Book> {
  const filename = file.name.toLowerCase();
  let format: BookFormat;
  let result: { content: string; title: string; author?: string; coverImage?: string; chapters?: Chapter[] };

  if (filename.endsWith('.epub')) {
    format = 'epub';
    result = await parseEPUB(file);
  } else if (filename.endsWith('.pdf')) {
    format = 'pdf';
    result = await parsePDF(file);
  } else if (filename.endsWith('.mobi')) {
    format = 'mobi';
    result = await parseMOBI(file);
  } else if (filename.endsWith('.azw3')) {
    format = 'azw3';
    result = await parseAZW3(file);
  } else {
    format = 'txt';
    result = await parseTextFile(file);
  }
  // ... 后续不变
}
```

**library-sidebar.tsx — 更新支持格式：**
```typescript
// 当前：
const validTypes = ['.epub', '.pdf', '.txt'];
// 改为：
const validTypes = ['.epub', '.pdf', '.txt', '.mobi', '.azw3'];

// 提示文案改：
// "支持 EPUB、MOBI、AZW3、PDF 和 TXT"
```

**package.json — 新增依赖：**
```json
"mobi-to-epub": "^1.0.0"
```

**fallback 方案（如果 `mobi-to-epub` 不可用）：**
若该库安装失败或无法使用，将 MOBI/AZW3 的处理改为：
```typescript
// 直接读取文本（会丢失格式但保留内容）
export async function parseMOBIFallback(file: File): Promise<{ content: string; title: string }> {
  // MOBI 格式有文本记录，可以尝试从二进制中提取
  const buffer = await file.arrayBuffer();
  const text = extractTextFromMobiBuffer(buffer); // 简单实现
  return { content: text, title: file.name.replace(/\.[^/.]+$/, '') };
}
```

---

## Task 5：生词/笔记内外一致

### 修改文件
- `src/components/deck/notebook-modal.tsx`
- `src/components/deck/vocab-modal.tsx`
- `src/app/page.tsx`
- `src/components/reader/reader-footer.tsx`

### 需求
- 主界面显示全部生词/笔记总数（加"全部"标签）
- 单本书的阅读界面只显示该书的生词/笔记
- 点击打开只过滤当前书的数据

### 实现

**notebook-modal.tsx：**
```typescript
interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: string; // 新增可选参数
}

// 在组件内过滤：
const filteredHighlights = bookId
  ? highlights.filter((h) => h.bookId === bookId)
  : highlights;
```

**vocab-modal.tsx：**
```typescript
interface VocabDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: string; // 新增
}

// 同样添加 bookId 过滤
```

**reader-footer.tsx — 传入 bookId：**
```typescript
// 当前调用：
<Button onClick={onOpenNotebook}>...</Button>
// 需改为在父组件 page.tsx 中传入 book.id
```

**page.tsx（阅读页）— 修改 modal 调用：**
```tsx
// 传给 NotebookModal 和 VocabDeckModal
<NotebookModal isOpen={showNotebook} onClose={() => setShowNotebook(false)} bookId={book?.id} />
<VocabDeckModal isOpen={showVocabModal} onClose={() => setShowVocabModal(false)} bookId={book?.id} />
```

**page.tsx（主界面）— 统计标签：**
```tsx
// 在生词/笔记数量后加标签
<span>{vocabulary.length} 个生词（全部书籍）</span>
<span>{highlights.length} 个笔记（全部书籍）</span>
```

---

## Task 6："已完成" → "已读完" + 进度阈值修复

### 修改文件
- `src/lib/i18n.ts`（4 个语言）
- `src/app/reader/[id]/page.tsx`

### 修改内容

**i18n.ts：**
```typescript
// 中文
read: '已读完',
// 英文
read: 'Finished',
// 日文
read: '読了',
// 韩文
read: '읽음',
```

**page.tsx — 进度阈值：**
```typescript
// 当前（约第189行）：
const isNowCompleted = newProgress === 100;
// 改为：
const isNowCompleted = newProgress >= 98;
// 避免进度卡在 99% 永远无法触发完成
```

---

## Task 7：导出生词格式增强

### 修改文件
- `src/lib/stores/vocab-store.ts`

### 新增导出格式

**1. Anki 制表符分隔格式（.txt）：**
```typescript
exportToAnki: () => {
  const { vocabulary } = get();
  return vocabulary.map((v) => {
    const front = v.reading ? `${v.term} (${v.reading})` : v.term;
    const back = `${v.translation}\n\n例句: ${v.context.slice(0, 120)}`;
    return `${front}\t${back}\t${v.bookTitle}`;
  }).join('\n');
},
```

**2. 纯文本复习卡片：**
```typescript
exportToSimpleReview: () => {
  const { vocabulary } = get();
  return vocabulary.map((v) => 
    `【${v.term}】\n释义: ${v.translation}\n${v.reading ? `读音: ${v.reading}\n` : ''}例句: ${v.context.slice(0, 120)}`
  ).join('\n\n---\n\n');
},
```

**3. 修复 CSV 转义：**
```typescript
exportToCSV: () => {
  const { vocabulary } = get();
  const headers = ['Term', 'Reading', 'Translation', 'Book', 'Context', 'Date Added'];
  
  const escape = (str: string) => {
    if (!str) return '""';
    return `"${str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
  };
  
  const rows = vocabulary.map((v) => [
    escape(v.term),
    escape(v.reading || ''),
    escape(v.translation),
    escape(v.bookTitle),
    escape(v.context),
    escape(new Date(v.createdAt).toISOString())
  ]);
  
  return [headers.join(','), ...rows].join('\n');
},
```

**vocab-modal.tsx — 增加导出按钮：**
```tsx
// 在导出菜单中增加两项
<button onClick={handleExportAnki}>Anki (.txt)</button>
<button onClick={handleExportSimpleReview}>复习卡片 (.txt)</button>
```

---

## Task 8：PDF 导入友好提示

### 修改文件
- `src/components/library/library-sidebar.tsx`

### 修改内容
```typescript
// 在 parseBook 调用前，如果是 PDF，先提示：
if (ext === '.pdf') {
  addToast({ 
    type: 'info', 
    message: 'PDF 解析可能不完整，建议先转换为 TXT 或 EPUB 以获得最佳体验' 
  });
}
```

---

## 执行顺序

1. **Task 1**（文案）— 基础，先改
2. **Task 3**（计时器）— 独立，可并行
3. **Task 5**（生词/笔记过滤）— 改组件 props
4. **Task 2**（排版控件）— 改 footer
5. **Task 6**（已读完 + 阈值）— 简单文案 + 一行逻辑
6. **Task 7**（导出格式）— 改 store
7. **Task 4**（MOBI/AZW3）— 最后，涉及新依赖
8. **Task 8**（PDF 提示）— 收尾

每改完一个文件运行 `npm run build` 验证。
