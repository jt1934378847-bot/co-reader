# Co-Reader Project

## 项目概述
沉浸式外语电子书阅读与深度学习应用，基于 Next.js 16 + React + Zustand构建。

## 品牌信息
- **网站名称**: Co-Reader
- **欢迎语**: `沉浸式外语电子书阅读与深度学习空间。\n导入一本书，开启您的学习之旅。`

## 技术栈
- **框架**: Next.js 16 (App Router)
- **状态管理**: Zustand (library-store, settings-store, vocab-store)
- **样式**: CSS Variables + Tailwind
- **电子书解析**: epubjs (EPUB), pdfjs-dist (PDF)
- **AI 接口**: 流式 SSE 通过 /api/chat

## 项目结构
```
src/
├── app/
│   ├── page.tsx           # 主页 - 书籍网格或欢迎页
│   ├── layout.tsx         # 根布局
│   ├── settings/          # 设置页面
│   └── reader/[id]/       # 阅读器页面
├── components/
│   ├── library/
│   │   ├── library-sidebar.tsx   # 书库栏
│   │   └── header.tsx            # 顶部导航
│   ├── reader/
│   │   ├── table-of-contents.tsx # 目录侧边栏
│   │   └── reader-footer.tsx     # 底部阅读时长栏
│   └── study/
│       ├── ai-sidebar.tsx        # 学习模式AI面板
│       ├── back-translation.tsx  # 回译练习
│       └── translation-exercise.tsx # 翻译练习
├── lib/
│   ├── stores/            # Zustand stores
│   ├── hooks/             # React hooks
│   ├── llm/               # LLM调用
│   └── i18n.ts            # 多语言配置
```

## 重要决策记录

### 1. 学习模式性能优化
- **问题**: 进入学习模式时，默认展开的"核心词汇"部分会自动触发AI分析，导致多个API同时调用造成拥堵
- **解决方案**: 将默认展开从"词汇"改为"问答"(qa)
- **文件**: `src/components/study/ai-sidebar.tsx`

### 2. 书籍导入后台翻译
- **需求**: 导入书籍后在后台翻译，不阻碍用户立即打开阅读
- **实现**: translateBookInBackground函数逐章节翻译，每章完成后更新chapter.translated状态
- **UI**: 目录中未翻译章节显示灰色

### 3. API配置持久化
- **问题**: API配置刷新后丢失
- **解决**: 使用zustand persist中间件保存到localStorage
- **文件**: `src/lib/stores/settings-store.ts`

### 4. 分析结果缓存
- **问题**: 选中相同段落需要重新加载AI分析
- **解决**: 在ai-sidebar.tsx中添加analysisCache，使用文本hash作为key
- **文件**: `src/components/study/ai-sidebar.tsx`

### 5. 速率限制处理
- **问题**: "请求频繁"错误
- **解决**: LLMFetcher添加智能重试
  - 429状态码或5xx错误时自动重试
  - 指数退避: 1s → 2s → 4s
  - 最多3次重试
  - 优先使用Retry-After响应头
- **文件**: `src/lib/llm/fetcher.ts`

### 6. 主页设计
- **需求**: 导入书籍后不再显示欢迎页
- **解决**: 当books.length > 0时显示书籍网格，用户可直接点击打开
- **文件**: `src/app/page.tsx`

### 7. AI学习助手动态语言适配
- **需求**: AI学习助手应根据导入书籍的语言类型输出
- **解决**: 根据bookLanguage参数动态生成系统提示词（日语/英语/韩语/中文）
- **文件**: `src/components/study/ai-sidebar.tsx`

### 8. AI学习助手JSON结构化输出
- **问题**: AI输出需要解析为结构化数据
- **解决**: 使用JSON格式请求和解析词汇、语法点
- **卡片显示**: 词汇卡片（单词、读音、翻译、上下文），语法卡片（结构、解释、例句）
- **类型**: 使用AIVocabEntry、AIGrammarPoint内部类型
- **文件**: `src/components/study/ai-sidebar.tsx`

## 状态管理
- **library-store**: books, currentBookId, addBook, removeBook, updateBook, setCurrentBook
- **settings-store**: theme, fontSize, lineHeight, apiConfig (持久化)
- **vocab-store**: vocabulary, grammar points
- **session-store**: currentSession, dailyStats, reading time tracking
- **cache-store**: translation/QA cache

## 多语言
支持: 中文(zh), English(en), 日本語(ja), 한국어(ko)
配置文件: `src/lib/i18n.ts`
