'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, BookText, MessageCircle, ChevronRight, ChevronDown, ChevronUp, Loader2, Settings, ArrowLeftRight, Languages } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAI } from '@/lib/hooks/use-ai';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useCacheStore } from '@/lib/stores/cache-store';
import { BackTranslationExercise } from '@/components/study/back-translation';
import { TranslationExercise } from '@/components/study/translation-exercise';
import { cleanAIResponse } from '@/lib/utils';
import type { VocabEntry, GrammarPoint, Message, BookLanguage } from '@/lib/types';

// Helper to fix common JSON formatting errors
function fixJSON(jsonStr: string): string | null {
  try {
    // Remove trailing commas before closing braces/brackets
    let fixed = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    // Fix unquoted property names (simple case)
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    // Remove control characters
    fixed = fixed.replace(/[\x00-\x1F\x7F]/g, '');
    // Basic validation
    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
}

// AI analysis response types (subset of full types)
interface AIVocabEntry {
  term: string;
  reading?: string;
  translation: string;
  context: string;
}

interface AIGrammarPoint {
  structure: string;
  explanation: string;
  examples: string[];
}

interface QAItem {
  id: string;
  question: string;
  answer: string;
  isExpanded: boolean;
  isStreaming: boolean;
}

interface AIStudyPanelProps {
  selectedText: string;
  context: string;
  bookLanguage: BookLanguage;
  bookId: string;
  chapterIndex?: number;
  paragraphIndex?: number;
  initialQuestion?: string;
  onAddVocab: (entry: { term: string; reading?: string; translation: string; context: string }) => void;
  onAddGrammar: (point: { structure: string; explanation: string; examples: string[] }) => void;
}

export function AIStudyPanel({
  selectedText,
  context,
  bookLanguage,
  bookId,
  chapterIndex = 0,
  paragraphIndex = 0,
  initialQuestion = '',
  onAddVocab,
  onAddGrammar
}: AIStudyPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [isAnalyzingVocab, setIsAnalyzingVocab] = useState(false);
  const [isAnalyzingGrammar, setIsAnalyzingGrammar] = useState(false);
  const [vocabulary, setVocabulary] = useState<AIVocabEntry[]>([]);
  const [grammar, setGrammar] = useState<AIGrammarPoint[]>([]);
  const [expandedSection, setExpandedSection] = useState<'vocab' | 'grammar' | 'qa' | 'back-translation' | 'translation-exercise'>('qa');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [translationForBackTrans, setTranslationForBackTrans] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);

  // QA Cache
  const getQA = useCacheStore((state) => state.getQA);
  const addQA = useCacheStore((state) => state.addQA);

  // Vocab and Grammar cache from global store
  const getVocab = useCacheStore((state) => state.getVocab);
  const addVocab = useCacheStore((state) => state.addVocab);
  const getGrammar = useCacheStore((state) => state.getGrammar);
  const addGrammar = useCacheStore((state) => state.addGrammar);

  const apiConfig = useSettingsStore((state) => state.apiConfig);
  const _hasHydrated = useSettingsStore((state) => state._hasHydrated);
  const { generateWithCallback, generate } = useAI();

  // Wait for store to hydrate from localStorage
  useEffect(() => {
    if (_hasHydrated) {
      setIsHydrated(true);
    }
  }, [_hasHydrated]);

  // Handle initial question from selection
  useEffect(() => {
    if (initialQuestion) {
      setCurrentQuestion(initialQuestion);
      setExpandedSection('qa');
    }
  }, [initialQuestion]);

  // Toggle QA item expand/collapse
  const toggleQaExpand = useCallback((id: string) => {
    setQaItems(prev => prev.map(item =>
      item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
    ));
  }, []);

  const isConfigured = isHydrated && !!apiConfig;

  // Text hash function for cache key
  const textHash = (text: string): string => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  // Check cache when selectedText changes
  useEffect(() => {
    if (selectedText) {
      const hash = textHash(selectedText);
      getVocab(bookId, chapterIndex, paragraphIndex, hash).then((cachedVocab) => {
        setVocabulary(cachedVocab || []);
      });
      getGrammar(bookId, chapterIndex, paragraphIndex, hash).then((cachedGrammar) => {
        setGrammar(cachedGrammar || []);
      });
    } else {
      setVocabulary([]);
      setGrammar([]);
    }
  }, [selectedText, getVocab, getGrammar, bookId, chapterIndex, paragraphIndex]);

  // Fetch vocabulary only
  const handleFetchVocab = useCallback(async () => {
    if (!isConfigured) {
      setError('请先前往「设置」页面配置 API Key，再使用 AI 分析功能。');
      return;
    }
    if (!selectedText) {
      setError('请先在左侧阅读区点击选中一个段落，再点击分析。');
      return;
    }

    const hash = textHash(selectedText);
    const cached = await getVocab(bookId, chapterIndex, paragraphIndex, hash);
    if (cached) {
      setVocabulary(cached);
      return;
    }

    setError(null);
    setIsAnalyzingVocab(true);

    const langNames: Record<BookLanguage, string> = {
      en: '英语',
      ja: '日语',
      ko: '韩语',
      zh: '中文'
    };
    const langName = langNames[bookLanguage] || '源语言';

    try {
      const messages: Message[] = [
        {
          id: 'system',
          role: 'system',
          content: `你是一位专业的${langName}词汇分析专家。请从用户输入的${langName}句子中提取核心词汇。

【输出格式要求】
请严格按照以下JSON格式输出，不要包含任何其他内容：

{
  "vocabulary": [
    {
      "term": "单词",
      "reading": "读音(假名或音标)",
      "translation": "中文翻译",
      "context": "在原句中的上下文"
    }
  ]
}

【强制要求】
1. 只提取实义词（名词、动词、形容词、副词），忽略助词、介词等
2. reading字段仅在需要注音时提供（如日语假名、英语音标）
3. 只输出JSON，不要输出任何解释、说明或思考过程
4. 如果没有词汇，返回空数组[]
5. 保持单词原形，不要变形`,
          timestamp: new Date()
        },
        {
          id: 'user',
          role: 'user',
          content: `请提取以下${langName}句子的核心词汇：\n\n${selectedText}`,
          timestamp: new Date()
        }
      ];

      let fullResponse = '';
      await generateWithCallback(messages, (chunk) => {
        fullResponse += chunk;
      });

      const cleanedResponse = cleanAIResponse(fullResponse);
      let jsonStr = '';
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      if (!jsonStr && fullResponse.trim()) {
        const rawMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (rawMatch) jsonStr = rawMatch[0];
      }

      let parsed = { vocabulary: [] as AIVocabEntry[] };
      if (jsonStr) {
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          const fixedJson = fixJSON(jsonStr);
          if (fixedJson) {
            try { parsed = JSON.parse(fixedJson); } catch { /* ignore */ }
          }
        }
      }

      const vocabResult = parsed.vocabulary || [];
      setVocabulary(vocabResult);
      addVocab({
        bookId,
        chapterIndex,
        paragraphIndex,
        textHash: hash,
        vocabulary: vocabResult
      });
    } catch (err) {
      console.error('Vocab fetch failed:', err);
    } finally {
      setIsAnalyzingVocab(false);
    }
  }, [isConfigured, selectedText, bookLanguage, bookId, chapterIndex, paragraphIndex, generateWithCallback, getVocab, addVocab]);

  // Fetch grammar only
  const handleFetchGrammar = useCallback(async () => {
    if (!isConfigured) return;
    if (!selectedText) return;

    const hash = textHash(selectedText);
    const cached = await getGrammar(bookId, chapterIndex, paragraphIndex, hash);
    if (cached) {
      setGrammar(cached);
      return;
    }

    setError(null);
    setIsAnalyzingGrammar(true);

    const langNames: Record<BookLanguage, string> = {
      en: '英语',
      ja: '日语',
      ko: '韩语',
      zh: '中文'
    };
    const langName = langNames[bookLanguage] || '源语言';

    try {
      const messages: Message[] = [
        {
          id: 'system',
          role: 'system',
          content: `你是一位专业的${langName}语法分析专家。请分析用户输入的${langName}句子，提取语法点。

【输出格式要求】
请严格按照以下JSON格式输出，不要包含任何其他内容：

{
  "grammar": [
    {
      "structure": "语法结构",
      "explanation": "语法解释",
      "examples": ["例句1", "例句2"]
    }
  ]
}

【强制要求】
1. 只提取重要语法点，忽略简单的助词用法
2. explanation要简洁，50字以内
3. 只输出JSON，不要输出任何解释、说明或思考过程
4. 如果没有语法点，返回空数组[]`,
          timestamp: new Date()
        },
        {
          id: 'user',
          role: 'user',
          content: `请分析以下${langName}句子的语法点：\n\n${selectedText}`,
          timestamp: new Date()
        }
      ];

      let fullResponse = '';
      await generateWithCallback(messages, (chunk) => {
        fullResponse += chunk;
      });

      const cleanedResponse = cleanAIResponse(fullResponse);
      let jsonStr = '';
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      if (!jsonStr && fullResponse.trim()) {
        const rawMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (rawMatch) jsonStr = rawMatch[0];
      }

      let parsed = { grammar: [] as AIGrammarPoint[] };
      if (jsonStr) {
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          const fixedJson = fixJSON(jsonStr);
          if (fixedJson) {
            try { parsed = JSON.parse(fixedJson); } catch { /* ignore */ }
          }
        }
      }

      const grammarResult = parsed.grammar || [];
      setGrammar(grammarResult);
      addGrammar({
        bookId,
        chapterIndex,
        paragraphIndex,
        textHash: hash,
        grammar: grammarResult
      });
    } catch (err) {
      console.error('Grammar fetch failed:', err);
    } finally {
      setIsAnalyzingGrammar(false);
    }
  }, [isConfigured, selectedText, bookLanguage, bookId, chapterIndex, paragraphIndex, generateWithCallback, getGrammar, addGrammar]);

  // Get translation for back-translation exercise
  const handleGetTranslationForBackTrans = useCallback(async () => {
    if (!isConfigured || !selectedText) return '';

    setIsTranslating(true);
    try {
      const messages: Message[] = [
        {
          id: 'sys',
          role: 'system',
          content: `你是一位专业译者。请将以下${getTargetLangName(bookLanguage)}文本翻译成中文（简体中文）。

【严格规则】
1. 只输出中文译文，不要输出任何其他内容
2. 不要包含分析、解释、备注或任何说明
3. 不要使用引号包裹译文
4. 不要输出任何标签如<thinking>、<reasoning>等
5. 不要输出英文或其他语言
6. 保持原文的语气和风格

请直接输出译文：`,
          timestamp: new Date()
        },
        { id: 'user', role: 'user', timestamp: new Date(), content: selectedText }
      ];

      const result = await generate(messages);
      const clean = cleanAIResponse(result);
      setTranslationForBackTrans(clean);
      return clean;
    } catch (err) {
      console.error('Translation failed:', err);
      return '';
    } finally {
      setIsTranslating(false);
    }
  }, [isConfigured, selectedText, bookLanguage, generate]);

  const handleAskQuestion = useCallback(async () => {
    if (!isConfigured || !currentQuestion.trim()) return;

    const question = currentQuestion.trim();
    setCurrentQuestion('');
    setIsAsking(true);
    setStreamingAnswer('');
    setError(null);

    // Create new QA item (question only, answer empty)
    const newItem: QAItem = {
      id: Date.now().toString(),
      question,
      answer: '',
      isExpanded: true, // New question expands by default
      isStreaming: true
    };
    setQaItems(prev => [...prev, newItem]);

    // Check QA cache
    const cachedQA = await getQA(bookId, question, context);
    if (cachedQA) {
      setQaItems(prev => prev.map(item =>
        item.id === newItem.id
          ? { ...item, answer: cachedQA.answer, isStreaming: false }
          : item
      ));
      setIsAsking(false);
      return;
    }

    const messages: Message[] = [
      {
        id: 'system',
        role: 'system',
        content: `你是一位专业的语言学习助手。请简洁、专业地回答用户关于外语学习的问题。

【回答要求】
1. 使用中文回答，保持简洁专业
2. 回答要有逻辑结构，条理清晰
3. 适当使用列表或分点来组织答案
4. 禁止输出任何思考过程、推理步骤或内部标签
5. 只输出最终答案，不加任何前缀说明`,
        timestamp: new Date()
      },
      {
        id: 'context',
        role: 'user',
        content: `【文本上下文】\n${context}\n\n【用户问题】\n${question}`,
        timestamp: new Date()
      }
    ];

    try {
      let fullAnswer = '';
      await generateWithCallback(messages, (chunk) => {
        fullAnswer += chunk;
        setStreamingAnswer(cleanAIResponse(fullAnswer));
      });

      const cleanAnswer = cleanAIResponse(fullAnswer);

      // Update QA item with answer
      setQaItems(prev => prev.map(item =>
        item.id === newItem.id
          ? { ...item, answer: cleanAnswer, isStreaming: false }
          : item
      ));
      setStreamingAnswer('');

      // Cache the QA result
      addQA({
        bookId,
        question,
        context: context,
        answer: cleanAnswer
      });
    } catch {
      const errorAnswer = '抱歉，AI 回答失败。请检查您的 API 配置。';
      setQaItems(prev => prev.map(item =>
        item.id === newItem.id
          ? { ...item, answer: errorAnswer, isStreaming: false }
          : item
      ));
      setStreamingAnswer('');
    } finally {
      setIsAsking(false);
    }
  }, [currentQuestion, isConfigured, bookId, context, generateWithCallback, getQA, addQA]);

  // Get target language name for back-translation
  const getTargetLangName = (lang: BookLanguage): string => {
    const map: Record<BookLanguage, string> = {
      en: '英语',
      ja: '日语',
      ko: '韩语',
      zh: '中文'
    };
    return map[lang] || '中文';
  };

  return (
    <aside
      className="w-[360px] h-full overflow-y-auto border-l border-[var(--border-color)]"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-[var(--accent-primary)]" />
          <h2 className="font-semibold">{t('aiStudyAssistant')}</h2>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mb-3 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(155,77,77,0.08)',
              color: '#9B4D4D',
              border: '1px solid rgba(155,77,77,0.2)'
            }}
          >
            {error}
          </div>
        )}

        {!isConfigured && (
          <div className="mb-4 p-3 rounded-lg text-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <p className="text-xs mb-2">{t('configureApiHint')}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/settings')}
              leftIcon={<Settings className="h-4 w-4" />}
            >
              {t('settings')}
            </Button>
          </div>
        )}

        {/* Vocabulary Section */}
        <div className="mb-4">
          <button
            onClick={() => {
              const newSection = expandedSection === 'vocab' ? 'qa' : 'vocab';
              setExpandedSection(newSection);
              // Auto-fetch vocabulary when expanding vocab section if not yet fetched
              if (newSection === 'vocab' && !vocabulary.length && selectedText && isConfigured) {
                handleFetchVocab();
              }
            }}
            className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            <div className="flex items-center gap-2">
              <BookText className="h-4 w-4" />
              <span className="font-medium text-sm">{t('keyVocabulary')}</span>
            </div>
            {expandedSection === 'vocab' ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {expandedSection === 'vocab' && (
            <div className="mt-2 space-y-2 animate-slide-up">
              {isAnalyzingVocab ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : vocabulary.length > 0 ? (
                vocabulary.map((item, i) => (
                  <Card key={i} padding="sm" className="relative group">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-medium text-sm">{item.term}</span>
                        {item.reading && (
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            [{item.reading}]
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddVocab(item)}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        + {t('add')}
                      </Button>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {item.translation}
                    </p>
                    <p className="text-xs mt-2 italic" style={{ color: 'var(--text-muted)' }}>
                      &quot;{item.context}&quot;
                    </p>
                  </Card>
                ))
              ) : !isConfigured ? (
                <p className="text-xs text-center py-4 text-[var(--text-muted)]">
                  请先配置 API Key 以使用 AI 功能
                </p>
              ) : !selectedText ? (
                <p className="text-xs text-center py-4 text-[var(--text-muted)]">
                  请先在左侧阅读区点击选中一个段落
                </p>
              ) : (
                <p className="text-xs text-center py-4 text-[var(--text-muted)]">
                  正在分析中...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Grammar Section */}
        <div className="mb-4">
          <button
            onClick={() => {
              const newSection = expandedSection === 'grammar' ? 'qa' : 'grammar';
              setExpandedSection(newSection);
              // Auto-fetch grammar when expanding grammar section if not yet fetched
              if (newSection === 'grammar' && !grammar.length && selectedText && isConfigured) {
                handleFetchGrammar();
              }
            }}
            className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium text-sm">{t('grammarPoints')}</span>
            </div>
            {expandedSection === 'grammar' ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {expandedSection === 'grammar' && (
            <div className="mt-2 space-y-2 animate-slide-up">
              {isAnalyzingGrammar ? (
                <Skeleton className="h-20 w-full" />
              ) : grammar.length > 0 ? (
                grammar.map((item, i) => (
                  <Card key={i} padding="sm">
                    <div className="mb-2">
                      <span className="font-medium text-sm">{item.structure}</span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {item.explanation}
                    </p>
                    {item.examples && item.examples.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.examples.map((ex, j) => (
                          <p key={j} className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            • {ex}
                          </p>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              ) : !isConfigured ? (
                <p className="text-xs text-center py-4 text-[var(--text-muted)]">
                  请先配置 API Key 以使用 AI 功能
                </p>
              ) : !selectedText ? (
                <p className="text-xs text-center py-4 text-[var(--text-muted)]">
                  请先在左侧阅读区点击选中一个段落
                </p>
              ) : (
                <p className="text-xs text-center py-4 text-[var(--text-muted)]">
                  暂无语法分析结果
                </p>
              )}
            </div>
          )}
        </div>

        {/* Translation Exercise */}
        {selectedText && (
          <div className="mb-4">
            <button
              onClick={() => setExpandedSection(expandedSection === 'translation-exercise' ? 'qa' : 'translation-exercise')}
              className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">翻译练习</span>
              </div>
              {expandedSection === 'translation-exercise' ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {expandedSection === 'translation-exercise' && (
              <div className="mt-2">
                <TranslationExercise
                  sourceText={selectedText}
                  sourceLang={bookLanguage}
                  onTranslationExtracted={(trans) => setTranslationForBackTrans(trans)}
                />
              </div>
            )}
          </div>
        )}

        {/* Back Translation Exercise */}
        {selectedText && (
          <div className="mb-4">
            <button
              onClick={() => setExpandedSection(expandedSection === 'back-translation' ? 'qa' : 'back-translation')}
              className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">回译练习</span>
              </div>
              {expandedSection === 'back-translation' ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {expandedSection === 'back-translation' && (
              <div className="mt-2">
                <BackTranslationExercise
                  originalText={selectedText}
                  translatedText={translationForBackTrans || ''}
                  targetLang={getTargetLangName(bookLanguage)}
                  onNeedTranslation={handleGetTranslationForBackTrans}
                />
              </div>
            )}
          </div>
        )}

        {/* Q&A Section */}
        <div className="mb-4">
          <button
            onClick={() => setExpandedSection('qa')}
            className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="font-medium text-sm">{t('askQuestions')}</span>
            </div>
            {expandedSection === 'qa' ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {expandedSection === 'qa' && (
            <div className="mt-2 space-y-2">
              {/* Q&A History Cards */}
              {qaItems.map((item) => (
                <Card
                  key={item.id}
                  padding="sm"
                  className="overflow-hidden cursor-pointer"
                  onClick={() => toggleQaExpand(item.id)}
                >
                  {/* Question header (always visible) */}
                  <div className="p-2 flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-medium text-white"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      问
                    </div>
                    <span className="text-sm font-medium truncate flex-1">
                      {item.question.length > 30 ? item.question.slice(0, 30) + '...' : item.question}
                    </span>
                    {item.isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                  </div>

                  {/* Answer content (visible when expanded) */}
                  {item.isExpanded && (
                    <div className="px-3 pb-3">
                      {item.isStreaming ? (
                        <div className="pl-8 text-sm animate-pulse text-[var(--text-muted)]">
                          {streamingAnswer || '正在思考...'}
                        </div>
                      ) : (
                        <div className="pl-8 text-sm leading-relaxed text-[var(--text-secondary)]">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}

              {/* Currently streaming indicator (when no card yet) */}
              {isAsking && qaItems.length === 0 && (
                <Card padding="sm" className="p-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-medium text-white"
                      style={{ backgroundColor: 'var(--accent-secondary)' }}
                    >
                      答
                    </div>
                    <span className="text-sm text-[var(--text-muted)]">正在思考...</span>
                  </div>
                  <div className="pl-8 text-sm animate-pulse text-[var(--text-muted)]">
                    {streamingAnswer}
                  </div>
                </Card>
              )}

              {/* Clear all button */}
              {qaItems.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setQaItems([]);
                  }}
                  className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                >
                  清空所有问答
                </button>
              )}

              {/* Input */}
              <div className="pt-2 border-t border-[var(--border-color)]">
                <Textarea
                  value={currentQuestion}
                  onChange={(e) => setCurrentQuestion(e.target.value)}
                  placeholder={t('askAboutText')}
                  className="min-h-[60px] mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={handleAskQuestion}
                  disabled={!currentQuestion.trim() || isAsking || !isConfigured}
                  isLoading={isAsking}
                >
                  {isAsking ? t('thinking') : '发送'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Cache clear button */}
        <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
          <button
            onClick={() => {
              if (confirm('确定要清除本书的所有 AI 分析缓存吗？')) {
                useCacheStore.getState().clearBookVocab(bookId);
                useCacheStore.getState().clearBookGrammar(bookId);
                useCacheStore.getState().clearBookQA(bookId);
                useCacheStore.getState().clearBookTranslations(bookId);
                setVocabulary([]);
                setGrammar([]);
                setQaItems([]);
              }
            }}
            className="w-full p-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
          >
            清除本书 AI 缓存
          </button>
        </div>
      </div>
    </aside>
  );
}
