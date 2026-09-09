import type { APIConfig, Message } from '@/lib/types';

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  deepseek: 'deepseek-chat',
  moonshot: 'moonshot-v1-8k',
  custom: ''
};

// Tags to filter out from AI responses
const REASONING_TAGS = [
  'dimodal_thinking',
  'settings',
  'reasoning',
  'thought',
  'thinking'
];

function filterReasoningTags(text: string): string {
  let result = text;
  for (const tag of REASONING_TAGS) {
    result = result.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'gi'), '');
    // Also handle unclosed tags at end of text
    result = result.replace(new RegExp(`<${tag}>[^<]*$`, 'gi'), '');
  }
  return result;
}

export class LLMFetcher {
  private config: APIConfig;
  private maxRetries: number = 3;
  private baseDelayMs: number = 1000;

  constructor(config: APIConfig, maxRetries?: number) {
    this.config = config;
    if (maxRetries !== undefined) this.maxRetries = maxRetries;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount: number = 0,
    signal?: AbortSignal
  ): Promise<Response> {
    // Check if aborted before making request
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    const response = await fetch(url, { ...options, signal });

    // Handle rate limiting (429) with exponential backoff
    if (response.status === 429 && retryCount < this.maxRetries) {
      // Check if aborted before retrying
      if (signal?.aborted) {
        throw new Error('Aborted');
      }
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : this.baseDelayMs * Math.pow(2, retryCount);

      console.log(`[fetcher] Rate limited. Retrying in ${delayMs}ms (attempt ${retryCount + 1}/${this.maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delayMs));
      return this.fetchWithRetry(url, options, retryCount + 1, signal);
    }

    // Handle server errors (5xx) with exponential backoff
    if (response.status >= 500 && response.status < 600 && retryCount < this.maxRetries) {
      // Check if aborted before retrying
      if (signal?.aborted) {
        throw new Error('Aborted');
      }
      const delayMs = this.baseDelayMs * Math.pow(2, retryCount);
      console.log(`[fetcher] Server error ${response.status}. Retrying in ${delayMs}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return this.fetchWithRetry(url, options, retryCount + 1, signal);
    }

    return response;
  }

  async *streamGenerate(messages: Message[], signal?: AbortSignal): AsyncGenerator<string> {
    console.log('[fetcher] Calling /api/chat with provider:', this.config.provider);
    const response = await this.fetchWithRetry('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: this.config.provider,
        apiKey: this.config.apiKey,
        model: this.config.model || DEFAULT_MODELS[this.config.provider],
        baseURL: this.config.baseURL,
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      })
    }, 0, signal);

    console.log('[fetcher] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            let content = '';

            if (this.config.provider === 'anthropic') {
              content = parsed.delta?.text || parsed.content?.[0]?.text || '';
            } else {
              content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
            }

            if (content) {
              // Filter reasoning tags and yield immediately
              const filtered = filterReasoningTags(content);
              if (filtered.trim()) {
                yield filtered;
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Output remaining buffer
    const finalFiltered = filterReasoningTags(buffer);
    if (finalFiltered.trim()) {
      yield finalFiltered;
    }
  }

  async generate(messages: Message[], signal?: AbortSignal): Promise<LLMResponse> {
    const chunks: string[] = [];

    for await (const chunk of this.streamGenerate(messages, signal)) {
      chunks.push(chunk);
    }

    return {
      content: chunks.join('')
    };
  }
}

export function createLLMFetcher(config: APIConfig): LLMFetcher {
  return new LLMFetcher(config);
}
