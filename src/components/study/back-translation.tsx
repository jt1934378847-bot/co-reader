'use client';

import { useState, useCallback, useEffect } from 'react';
import { ArrowLeftRight, Send, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useAI } from '@/lib/hooks/use-ai';
import { cleanAIResponse } from '@/lib/utils';
import type { BackTranslationResult, Message } from '@/lib/types';

interface BackTranslationExerciseProps {
  originalText: string;
  translatedText: string; // The AI translation shown to user
  targetLang: string;
  onComplete?: (result: BackTranslationResult) => void;
  onNeedTranslation?: () => Promise<string>;
}

export function BackTranslationExercise({
  originalText,
  translatedText,
  targetLang,
  onComplete,
  onNeedTranslation
}: BackTranslationExerciseProps) {
  const [userTranslation, setUserTranslation] = useState('');
  const [result, setResult] = useState<BackTranslationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState(translatedText);

  const { generateWithCallback, isConfigured } = useAI();

  // Get translation if needed when component mounts or originalText changes
  useEffect(() => {
    const getTranslation = async () => {
      if (!translatedText && onNeedTranslation) {
        const translation = await onNeedTranslation();
        setCurrentTranslation(translation);
      } else {
        setCurrentTranslation(translatedText);
      }
    };
    getTranslation();
  }, [translatedText, onNeedTranslation]);

  const handleSubmit = useCallback(async () => {
    if (!userTranslation.trim() || !isConfigured) return;

    setIsSubmitting(true);

    try {
      const messages: Message[] = [
        {
          id: 'system',
          role: 'system',
          content: `你是一位语言学习助手，负责评估回译练习的质量。原文是${targetLang}，用户的译文是将中文翻译回${targetLang}。

【强制要求】
1. 所有 feedback、improvements 必须使用中文。
2. 禁止输出思考过程或推理标签。
3. 直接返回 JSON，不要添加 markdown 代码块标记。
4. 评分标准：0-100分，90以上为优秀，70-89为良好，50-69为一般，50以下需要改进。
5. 重点评估：语义准确性、语法正确性、表达自然度。`,
          timestamp: new Date()
        },
        {
          id: 'user',
          role: 'user',
          content: `【原文】(${targetLang}):\n${originalText}\n\n【AI 翻译】:\n${currentTranslation}\n\n【用户回译】:\n${userTranslation}\n\n请评估用户回译的质量。`,
          timestamp: new Date()
        }
      ];

      let fullResponse = '';
      await generateWithCallback(messages, (chunk) => {
        fullResponse += chunk;
      });

      // Clean the response first
      const cleanedResponse = cleanAIResponse(fullResponse);

      // Try to parse the JSON response
      let parsedResult: Partial<BackTranslationResult> = {};
      try {
        parsedResult = JSON.parse(cleanedResponse);
      } catch {
        // If parsing fails, use a default evaluation
        parsedResult = {
          score: 75,
          feedback: '你的翻译基本表达了原意。',
          improvements: ['注意更加贴合原文语境', '关注词汇的精确含义']
        };
      }

      // Ensure improvements is always an array
      let improvements: string[] = [];
      const imp = parsedResult.improvements as string | string[] | undefined;
      if (imp) {
        if (Array.isArray(imp)) {
          improvements = imp;
        } else if (typeof imp === 'string') {
          // If it's a string, split by newlines or common separators
          improvements = imp.split(/[；；\n]/).filter(Boolean);
        }
      }

      const evalResult: BackTranslationResult = {
        originalText,
        userTranslation,
        suggestedTranslation: translatedText,
        score: typeof parsedResult.score === 'number' ? parsedResult.score : 75,
        feedback: parsedResult.feedback || '不错的尝试！',
        improvements
      };

      setResult(evalResult);
      onComplete?.(evalResult);
    } catch (error) {
      console.error('Evaluation failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [userTranslation, originalText, currentTranslation, targetLang, isConfigured, onComplete, generateWithCallback]);

  const handleReset = useCallback(() => {
    setUserTranslation('');
    setResult(null);
  }, []);

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2 mb-4">
        <ArrowLeftRight className="h-5 w-5 text-[var(--accent-primary)]" />
        <h3 className="font-semibold">回译练习</h3>
      </div>

      {!result ? (
        <>
          {/* Instructions */}
          <div
            className="p-4 rounded-lg mb-4"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <p className="text-sm mb-2">
              <strong>说明：</strong>以下是中文翻译。请在不查看原文的情况下，
              尝试将其翻译回{targetLang}。
            </p>
            {!currentTranslation ? (
              <p className="text-sm italic p-3 rounded mt-2" style={{ color: 'var(--text-muted)' }}>
                正在获取翻译...
              </p>
            ) : (
              <p
                className="text-sm p-3 rounded mt-2"
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
              >
                {currentTranslation}
              </p>
            )}
          </div>

          {/* User input */}
          <Textarea
            value={userTranslation}
            onChange={(e) => setUserTranslation(e.target.value)}
            placeholder={`在这里输入你的${targetLang}翻译...`}
            className="min-h-[120px] mb-3"
            disabled={!isConfigured || !currentTranslation}
          />

          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            disabled={!userTranslation.trim() || isSubmitting || !isConfigured}
            isLoading={isSubmitting}
            leftIcon={<Send className="h-4 w-4" />}
          >
            提交评估
          </Button>

          {!isConfigured && (
            <p className="text-xs text-center mt-2 text-[var(--text-muted)]">
              请在设置中配置 API Key 后使用 AI 评估
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

            {/* Comparison */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  你的翻译：
                </p>
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  {result.userTranslation}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  参考翻译：
                </p>
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  {result.suggestedTranslation}
                </div>
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
              <p className="text-sm mb-3">{result.feedback}</p>

              {result.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">改进建议：</p>
                  <ul className="space-y-1">
                    {result.improvements.map((improvement, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        {improvement.includes('语法') || improvement.includes('Grammar') ? (
                          <XCircle className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>{improvement}</span>
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
