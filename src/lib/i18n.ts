'use client';

import { create } from 'zustand';

export type Language = 'zh' | 'en';

const translations = {
  zh: {
    // Header
    settings: '设置',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',

    // Library
    library: '书库',
    importBook: '导入书籍',
    noBooks: '暂无书籍',
    noBooksHint: '推荐导入 EPUB 文件（支持 PDF、MOBI，部分格式可能识别不全）',
    books: '本',
    dropToImport: '拖放文件以导入',

    // Home
    welcome: '欢迎使用 Co-Reader',
    welcomeDesc: '沉浸式外语电子书阅读与深度学习空间。\n导入一本书，开启您的学习之旅。',
    importFirstBook: '导入您的第一本书',
    viewVocabDeck: '查看生词本',
    supportedFormats: '推荐 EPUB | 支持 PDF / MOBI（部分格式识别不全）',

    // Reader
    immersion: '沉浸',
    learning: '学习',
    backToLibrary: '返回书库',

    // Settings
    backToHome: '返回首页',
    appearance: '外观',
    fontSize: '字体大小',
    lineHeight: '行高',
    readingWidth: '阅读宽度',
    aiApiConfig: 'AI API 配置',
    provider: '提供商',
    apiKey: 'API 密钥',
    baseUrl: '接口地址',
    model: '模型',
    testConnection: '测试连接',
    testing: '测试中...',
    connectionSuccess: '连接成功！',
    connectionFailed: '连接失败',
    saveSettings: '保存设置',
    cancel: '取消',

    // Vocab
    vocabularyDeck: '生词本',
    searchVocab: '搜索词汇...',
    export: '导出',
    total: '共',
    wordsSaved: '个词已保存',
    noVocab: '暂无保存的词汇',
    noVocabHint: '阅读时选中文本可添加笔记',
    noMatchVocab: '未找到匹配的笔记',

    // Notebook
    notebook: '笔记',
    highlights: '笔记',

    // AI Study
    aiStudyAssistant: 'AI 学习助手',
    analyzeText: '分析文本',
    analyzing: '分析中...',
    configureApiHint: '在设置中配置您的 API 密钥以启用 AI 功能。',
    keyVocabulary: '核心词汇',
    grammarPoints: '语法要点',
    askQuestions: '提问',
    selectAndAnalyze: '选择文本并点击"分析"以提取词汇',
    grammarPatterns: '语法模式将显示在这里',
    askAboutText: '就文本内容提问...',
    thinking: '思考中...',

    // Back Translation
    backTranslationPractice: '回译练习',
    instructions: '说明：以下是原文的翻译。在不看原文的情况下，试着把它翻译回外语。',
    typeTranslation: `在这里输入您的翻译...`,
    submitForEvaluation: '提交评估',
    yourTranslation: '您的翻译：',
    suggestedTranslation: '建议翻译：',
    feedback: '反馈',
    suggestionsForImprovement: '改进建议',
    tryAnotherTranslation: '再试一次翻译',
    translationScore: '翻译得分',

    // Flow Dashboard
    todaysReading: '今日阅读',
    wordsRead: '已读单词',
    exercises: '练习',
    booksDone: '已完成',
    expandStats: '展开统计',
    collapseStats: '收起统计',

    // Book card
    read: '已读完',
    delete: '删除',
    open: '打开',

    // Actions
    add: '添加',
    save: '保存',
    close: '关闭',
    addToVocab: '添加到生词本',

    // Custom Wallpaper
    customWallpaper: '自定义壁纸',
    uploadWallpaper: '上传壁纸',
    wallpaperOpacity: '透明度',
    wallpaperBlur: '模糊度',
    clearWallpaper: '清除壁纸',
    wallpaperHint: '支持 jpg/png/webp，最大 5MB',
    dragOrClickToUpload: '拖拽或点击上传图片',

    // Toasts
    imported: '已导入：',
    bookRemoved: '书籍已移除',
    pdfTooLarge: 'PDF 体积过大（>5MB），请转换为 EPUB 后导入',
    formatEpub: 'EPUB — 推荐，章节识别最准确',
    formatMobi: 'MOBI/AZW3 — 支持导入，章节标题可能需手动校正',
    formatPdf: 'PDF — 仅限纯文字版且 < 5MB，扫描版请转 EPUB',
    formatTxt: 'TXT — 支持导入，无章节结构',
    addedToVocab: '已添加到生词本！',
    settingsSaved: '设置已保存！',
    apiNotConfigured: 'API 未配置，请在设置中设置您的 API 密钥。',

    // Selection Popover
    translate: '翻译',
    vocab: '生词',
    askAI: '提问',
    copy: '复制',
    highlight: '高光笔记',
  },
  en: {
    settings: 'Settings',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    library: 'Library',
    importBook: 'Import Book',
    noBooks: 'No books yet',
    noBooksHint: 'Recommended: EPUB files (PDF/MOBI supported, some formats may have limited support)',
    books: '',
    dropToImport: 'Drop files to import',
    welcome: 'Welcome to Co-Reader',
    welcomeDesc: 'Immersive foreign language e-book reading\nand deep learning space.\nImport a book to begin your learning journey.',
    importFirstBook: 'Import Your First Book',
    viewVocabDeck: 'View Vocabulary Deck',
    supportedFormats: 'Recommended: EPUB | PDF/MOBI (limited support)',
    immersion: 'Immersion',
    learning: 'Learning',
    backToLibrary: 'Back to Library',
    backToHome: 'Back to Home',
    appearance: 'Appearance',
    fontSize: 'Font Size',
    lineHeight: 'Line Height',
    readingWidth: 'Reading Width',
    aiApiConfig: 'AI API Configuration',
    provider: 'Provider',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    model: 'Model',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    connectionSuccess: 'Connection successful!',
    connectionFailed: 'Connection failed',
    saveSettings: 'Save Settings',
    cancel: 'Cancel',
    vocabularyDeck: 'Vocabulary Deck',
    searchVocab: 'Search vocabulary...',
    export: 'Export',
    total: 'Total:',
    wordsSaved: 'words saved',
    noVocab: 'No vocabulary saved yet',
    noVocabHint: 'Select text while reading to add words',
    noMatchVocab: 'No matching vocabulary found',
    notebook: 'Notes',
    highlights: 'Notes',
    aiStudyAssistant: 'AI Study Assistant',
    analyzeText: 'Analyze Text',
    analyzing: 'Analyzing...',
    configureApiHint: 'Configure your API key in Settings to enable AI features.',
    keyVocabulary: 'Key Vocabulary',
    grammarPoints: 'Grammar Points',
    askQuestions: 'Ask Questions',
    selectAndAnalyze: 'Select text and click "Analyze" to extract vocabulary',
    grammarPatterns: 'Grammar patterns will appear here',
    askAboutText: 'Ask about the text...',
    thinking: 'Thinking...',
    backTranslationPractice: 'Back-Translation Practice',
    instructions: 'Instructions: Below is a translation of the original text. Try to translate it back without looking at the original.',
    typeTranslation: 'Type your translation here...',
    submitForEvaluation: 'Submit for Evaluation',
    yourTranslation: 'Your translation:',
    suggestedTranslation: 'Suggested translation:',
    feedback: 'Feedback',
    suggestionsForImprovement: 'Suggestions for improvement',
    tryAnotherTranslation: 'Try Another Translation',
    translationScore: 'Translation Score',
    todaysReading: "Today's Reading",
    wordsRead: 'Words Read',
    exercises: 'Exercises',
    booksDone: 'Books Done',
    expandStats: 'Expand Stats',
    collapseStats: 'Collapse Stats',
    read: 'Finished',
    delete: 'Delete',
    open: 'Open',
    add: 'Add',
    save: 'Save',
    close: 'Close',
    addToVocab: 'Add to vocabulary',

    // Custom Wallpaper
    customWallpaper: 'Custom Wallpaper',
    uploadWallpaper: 'Upload Wallpaper',
    wallpaperOpacity: 'Opacity',
    wallpaperBlur: 'Blur',
    clearWallpaper: 'Clear Wallpaper',
    wallpaperHint: 'Supports jpg/png/webp, max 5MB',
    dragOrClickToUpload: 'Drag or click to upload image',
    imported: 'Imported:',
    bookRemoved: 'Book removed',
    pdfTooLarge: 'PDF too large (>5MB), please convert to EPUB',
    formatEpub: 'EPUB — Recommended, best chapter recognition',
    formatMobi: 'MOBI/AZW3 — Supported, chapter titles may need manual correction',
    formatPdf: 'PDF — Text-only only and < 5MB, scanned PDFs should be converted to EPUB',
    formatTxt: 'TXT — Supported, no chapter structure',
    addedToVocab: 'Added to vocabulary deck!',
    settingsSaved: 'Settings saved!',
    apiNotConfigured: 'API not configured. Please set up your API key in Settings.',
    translate: 'Translate',
    vocab: 'Vocab',
    askAI: 'Ask AI',
    copy: 'Copy',
    highlight: 'Highlight+Note',
  },
};

type TranslationKey = keyof typeof translations.zh;

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const useI18n = create<I18nState>()(
  (set, get) => ({
    language: 'zh',
    setLanguage: (language) => set({ language }),
    t: (key) => {
      const { language } = get();
      return translations[language][key] || translations.en[key] || key;
    },
  })
);
