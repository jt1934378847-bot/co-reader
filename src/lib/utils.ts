import type { BookLanguage } from '@/lib/types';

// Global translation cache to avoid re-translating same paragraphs across sessions
export const globalTranslationCache = new Map<string, string>();

export function getFromCache(text: string): string | undefined {
  return globalTranslationCache.get(text);
}

export function setToCache(text: string, translation: string): void {
  globalTranslationCache.set(text, translation);
}

export function getLanguageName(lang: BookLanguage): string {
  const map: Record<BookLanguage, string> = {
    en: '英语',
    ja: '日语',
    ko: '韩语',
    zh: '中文'
  };
  return map[lang] || '未知语言';
}

export function getTargetLanguage(sourceLang: BookLanguage): string {
  // 中文小说 → 翻译为英文；其他语言 → 翻译为中文
  return sourceLang === 'zh' ? '英语' : '中文';
}

export function cleanAIResponse(text: string): string {
  // First remove all XML/HTML tags and their content
  let cleaned = text
    .replace(/<[^>]*>[\s\S]*?<\/[^>]*>/gi, '')
    .replace(/<[^>]+\/>/gi, '')
    // Remove common reasoning/thinking tags and their content
    .replace(/<dimodal_thinking>[\s\S]*?<\/dimodal_thinking>/gi, '')
    .replace(/<settings>[\s\S]*?<\/settings>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    // Remove any remaining angle brackets with content (residual tags)
    .replace(/<[^>]+>/g, '')
    // Remove lines that are only whitespace or common unwanted patterns
    .replace(/^[\s\n\r]+$/gm, '\n')
    .trim();

  // Remove common non-translation patterns that might appear
  cleaned = cleaned
    // Remove lines starting with common prefixes that aren't translation
    .replace(/^[^，。！？、；：""''（）【】一-龥\n]*[Tt]ranslat(?:e|ion|ing)[\s\S]*$/gm, '')
    .replace(/^[^，。！？、；：""''（）【】一-龥\n]*[Ss]ource[\s\S]*$/gm, '')
    .replace(/^[^，。！？、；：""''（）【】一-龥\n]*[Oo]riginal[\s\S]*$/gm, '')
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    // Normalize multiple newlines
    .replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}
