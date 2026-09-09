import { NextRequest, NextResponse } from 'next/server';

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  moonshot: 'https://api.moonshot.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  custom: ''
};

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

function getRateLimitInfo(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    const resetTime = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(ip, { count: 1, resetTime });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetTime };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetTime: record.resetTime };
}

export async function POST(request: NextRequest) {
  // Rate limiting - properly parse IP from proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitInfo = getRateLimitInfo(ip);

  if (!rateLimitInfo.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0'
        }
      }
    );
  }

  // Request body size limit
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return NextResponse.json(
      { error: 'Request body too large. Maximum size is 1MB.' },
      { status: 413 }
    );
  }

  try {
    const { provider, apiKey, model, messages, baseURL } = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat API] Request:', { provider, model, hasApiKey: !!apiKey, messageCount: messages?.length });
    }

    let endpoint = PROVIDER_ENDPOINTS[provider];
    if (provider === 'custom' && baseURL) {
      endpoint = `${baseURL.replace(/\/$/, '')}/v1/chat/completions`;
    }

    if (!endpoint) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Chat API] Unknown provider:', provider);
      }
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat API] Calling:', endpoint);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let body: Record<string, unknown> = {
      model: model || (provider === 'openai' ? 'gpt-4o-mini' : provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'deepseek-chat'),
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content
      })),
      stream: true
    };

    if (provider === 'anthropic') {
      body = {
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 4096,
        messages: messages.filter((m: { role: string }) => m.role !== 'system'),
        system: messages.find((m: { role: string }) => m.role === 'system')?.content
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat API] Response status:', response.status);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `API error: ${response.status} ${response.statusText} - ${errorText}` },
        { status: response.status }
      );
    }

    // For streaming responses, pipe them through
    if (body.stream) {
      // Directly pipe the response body without buffering
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Non-streaming response
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
