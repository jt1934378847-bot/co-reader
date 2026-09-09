'use client';

import { useState, useCallback } from 'react';
import { Languages, Send, CheckCircle, XCircle, Sparkles, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useAI } from '@/lib/hooks/use-ai';
import { cleanAIResponse } from '@/lib/utils';
import type { BookLanguage, Message } from '@/lib/types';

interface TranslationExerciseProps {
  sourceText: string;
  sourceLang: BookLanguage;
  onTranslationExtracted?: (translation: string) => void;
}

interface TranslationResult {
  translation: string;
  score: number;
  feedback: string;
  alternatives?: string[];
}

export function TranslationExercise({
  sourceText,
  sourceLang,
  onTranslationExtracted
}: TranslationExerciseProps) {
  const [userTranslation, setUserTranslation] = useState('');
  const [referenceTranslation, setReferenceTranslation] = useState<string>('');
  const [isGettingReference, setIsGettingReference] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { generate, isConfigured } = useAI();

  const sourceLangName = {
    en: '英语',
    ja: '日语',
    ko: '韩语',
    zh: '中文'
  }[sourceLang] || '源语言';

  // Get reference translation from AI
  const handleGetReference = useCallback(async () => {
    if (!isConfigured || !sourceText.trim()) return;

    setIsGettingReference(true);
    try {
      const messages: Message[] = [
        {
          id: 'sys',
          role: 'system',
          content: `你是一位专业译者。请将以下${sourceLangName}文本翻译成中文（简体中文）。

【严格规则】
1. 只输出中文译文，不要输出任何其他内容
2. 不要包含分析、解释、备注或任何说明
3. 不要使用引号包裹译文
4. 保持原文的语气和风格

请直接输出译文：`,
          timestamp: new Date()
        },
        {
          id: 'user',
          role: 'user',
          content: sourceText,
          timestamp: new Date()
        }
      ];

      const response = await generate(messages);
      const clean = cleanAIResponse(response);
      setReferenceTranslation(clean);
      onTranslationExtracted?.(clean);
    } catch (err) {
      console.error('获取参考译文失败:', err);
    } finally {
      setIsGettingReference(false);
    }
  }, [isConfigured, sourceText, sourceLang, generate, sourceLangName, onTranslationExtracted]);

  // Evaluate user's translation
  const handleSubmit = useCallback(async () => {
    if (!userTranslation.trim() || !isConfigured) return;

    setIsSubmitting(true);

    try {
      const messages: Message[] = [
        {
          id: 'sys',
          role: 'system',
          content: `你是一位语言学习助手，负责评估用户的翻译练习质量。

【任务】
评估用户将${sourceLangName}文本翻译成中文的翻译质量。

【评估维度】
1. 准确性 - 语义是否准确传达
2. 通顺性 - 中文表达是否自然流畅
3. 规范性 - 是否符合中文语法规范

【强制要求】
1. 所有反馈必须使用中文
2. 直接返回 JSON 格式：{"score": 分数(0-100), "feedback": "简短反馈", "alternatives": ["可选的更好译文1", "更好译文2"]}
3. 不要输出任何思考过程或标签`,
          timestamp: new Date()
        },
        {
          id: 'user',
          role: 'user',
          content: `【原文】(${sourceLangName}):\n${sourceText}\n\n【用户译文】:\n${userTranslation}\n\n请评估翻译质量。`,
          timestamp: new Date()
        }
      ];

      const response = await generate(messages);
      const cleaned = cleanAIResponse(response);

      try {
        const parsed = JSON.parse(cleaned);
        setResult({
          translation: userTranslation,
          score: typeof parsed.score === 'number' ? parsed.score : 75,
          feedback: parsed.feedback || '翻译基本准确',
          alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : []
        });
      } catch {
        setResult({
          translation: userTranslation,
          score: 75,
          feedback: '翻译基本准确，可尝试更精炼的表达',
          alternatives: []
        });
      }
    } catch (err) {
      console.error('评估失败:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [userTranslation, sourceText, sourceLangName, isConfigured, generate]);

  const handleReset = useCallback(() => {
    setUserTranslation('');
    setResult(null);
  }, []);

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2 mb-4">
        <Languages className="h-5 w-5 text-[var(--accent-primary)]" />
        <h3 className="font-semibold">翻译练习</h3>
      </div>

      {!result ? (
        <>
          {/* Source text */}
          <div
            className="p-4 rounded-lg mb-4"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              原文 ({sourceLangName})
            </p>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {sourceText}
            </p>
          </div>

          {/* User input */}
          <Textarea
            value={userTranslation}
            onChange={(e) => setUserTranslation(e.target.value)}
            placeholder="在这里输入你的中文翻译..."
            className="min-h-[120px] mb-3"
            disabled={!isConfigured}
          />

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGetReference}
              disabled={!isConfigured || isGettingReference}
              leftIcon={isGettingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            >
              {isGettingReference ? '获取中...' : '查看参考'}
            </Button>

            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSubmit}
              disabled={!userTranslation.trim() || isSubmitting || !isConfigured}
              isLoading={isSubmitting}
              leftIcon={<Send className="h-4 w-4" />}
            >
              提交评估
            </Button>
          </div>

          {/* Reference translation */}
          {referenceTranslation && (
            <div
              className="mt-4 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '3px solid var(--accent-primary)' }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent-primary)' }}>
                参考译文
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {referenceTranslation}
              </p>
            </div>
          )}

          {!isConfigured && (
            <p className="text-xs text-center mt-2 text-[var(--text-muted)]">
              请在设置中配置 API Key 后使用翻译练习
            </p>
          )}
        </>
      ) : (
        <>
          {/* Results */}
          <div className="space-y-4 animate-slide-up">
            {/* Score */}
            <div className="text-center py-4">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-3"
                style={{
                  backgroundColor:
                    result.score >= 80
                      ? 'rgba(74, 124, 89, 0.2)'
                      : result.score >= 60
                      ? 'rgba(166, 144, 118, 0.2)'
                      : 'rgba(155, 77, 77, 0.2)'
                }}
              >
                <span
                  className="text-2xl font-bold"
                  style={{
                    color:
                      result.score >= 80
                        ? '#4A7C59'
                        : result.score >= 60
                        ? 'var(--accent-primary)'
                        : '#9B4D4D'
                  }}
                >
                  {result.score}
                </span>
              </div>
              <p className="text-sm font-medium">翻译评分</p>
            </div>

            {/* User translation */}
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                你的翻译：
              </p>
              <div
                className="p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                {result.translation}
              </div>
            </div>

            {/* Feedback */}
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="font-medium text-sm">反馈</span>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                {result.feedback}
              </p>

              {result.alternatives && result.alternatives.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">更好的译文：</p>
                  <ul className="space-y-1">
                    {result.alternatives.map((alt, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                        <span style={{ color: 'var(--text-secondary)' }}>{alt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Try again */}
            <Button variant="secondary" className="w-full" onClick={handleReset}>
              再试一次
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
