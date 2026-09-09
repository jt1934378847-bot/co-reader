import type { Message } from '@/lib/types';

const SYSTEM_PROMPTS = {
  translate: (targetLang: string) =>
    `You are a professional translator. Translate the following text into ${targetLang}. Provide only the translation, no explanations.`,

  analyzeVocab: () =>
    `You are a language learning assistant. Analyze the following text and extract 3-5 key vocabulary words that are important for language learners. For each word provide:
- word (the term)
- reading (pronunciation in brackets, especially for CJK languages)
- translation (brief definition)
- example (a sentence using the word)

Return your response as a JSON array of objects with keys: word, reading, translation, example. No other text.`,

  analyzeGrammar: () =>
    `You are a grammar expert helping language learners. Analyze the following text and identify 1-3 notable grammar structures or patterns. For each provide:
- structure (the grammatical pattern)
- explanation (how it works)
- example (from the text if possible, or a similar example)

Return your response as a JSON array of objects with keys: structure, explanation, examples (array). No other text.`,

  backTranslation: (originalText: string, targetLang: string) =>
    `You are a language learning assistant. The user is practicing ${targetLang} by doing a back-translation exercise.

The original text in ${targetLang} is:
"${originalText}"

A learner has translated this into Chinese:
[USER_TRANSLATION]

Compare the learner's translation with the original. Provide feedback in this JSON format:
{
  "score": (0-100 based on accuracy and naturalness),
  "feedback": (overall assessment in Chinese),
  "improvements": [(2-3 specific suggestions for improvement)]
}

Be encouraging but honest. Focus on meaning accuracy first, then natural expression.`,

  contextualQA: () =>
    `You are a helpful language learning assistant. The user is reading a text and has a question. Answer their question based on the context provided. Be clear, helpful, and educational. Respond in the language of their question (Chinese if asked in Chinese, English if asked in English, etc.).`
};

export function createTranslatePrompt(text: string, targetLang: string): Message[] {
  return [
    { id: '1', role: 'system', content: SYSTEM_PROMPTS.translate(targetLang), timestamp: new Date() },
    { id: '2', role: 'user', content: text, timestamp: new Date() }
  ];
}

export function createVocabAnalysisPrompt(text: string): Message[] {
  return [
    { id: '1', role: 'system', content: SYSTEM_PROMPTS.analyzeVocab(), timestamp: new Date() },
    { id: '2', role: 'user', content: text, timestamp: new Date() }
  ];
}

export function createGrammarAnalysisPrompt(text: string): Message[] {
  return [
    { id: '1', role: 'system', content: SYSTEM_PROMPTS.analyzeGrammar(), timestamp: new Date() },
    { id: '2', role: 'user', content: text, timestamp: new Date() }
  ];
}

export function createBackTranslationPrompt(
  originalText: string,
  userTranslation: string,
  targetLang: string
): Message[] {
  const systemPrompt = SYSTEM_PROMPTS.backTranslation(originalText, targetLang);
  const promptWithUserInput = systemPrompt.replace('[USER_TRANSLATION]', userTranslation);

  return [
    { id: '1', role: 'system', content: promptWithUserInput, timestamp: new Date() }
  ];
}

export function createContextualQAPrompt(context: string, question: string): Message[] {
  return [
    { id: '1', role: 'system', content: SYSTEM_PROMPTS.contextualQA(), timestamp: new Date() },
    { id: '2', role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}`, timestamp: new Date() }
  ];
}

export function parseJSONResponse<T>(content: string): T | null {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
  const jsonStr = jsonMatch[1] || content;

  try {
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    // Try to find JSON object in the content
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
