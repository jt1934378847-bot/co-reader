# Co-Reader

Bilingual reader for language learners — EPUB / MOBI / PDF 双语阅读器，支持日、英、韩、中四种语言。

Built with **Next.js 16 · React 19 · TypeScript (strict) · Tailwind CSS v4 · Zustand · epub.js**

## Features

- 导入并阅读 EPUB / MOBI / PDF 电子书
- 段落级自动翻译（非中文 → 中文，中文 → 英文），带缓存
- 学习模式：AI 自动提炼核心词汇与语法要点，生成回译练习与提问
- 生词本：词汇与语法条目收藏，支持多选、全选与导出
- 日语振假名以 `漢字(かじ)` 形式内联显示
- 阅读进度与生词数据保存在本地（IndexedDB）

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

AI 翻译与学习功能需在 `/settings` 中配置 LLM API Key。

## Scripts

| 命令        | 说明                         |
| ----------- | ---------------------------- |
| `pnpm dev`  | 启动开发服务器               |
| `pnpm build`| 生产构建                     |
| `pnpm start`| 运行生产构建                 |
| `pnpm lint` | ESLint 检查                  |

## Deployment

- 线上版本部署于 PocketBay：https://co-reader.pocketbay.app
- `netlify.toml` 已配置 Netlify 构建（`pnpm install && pnpm build`，发布 `.next`，Node 20）