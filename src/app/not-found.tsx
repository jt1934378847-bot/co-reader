'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <BookOpen
          className="h-16 w-16 mx-auto mb-6"
          style={{ color: 'var(--accent-primary)' }}
        />
        <h1
          className="text-4xl font-serif font-bold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          404
        </h1>
        <h2
          className="text-xl font-semibold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          页面未找到
        </h2>
        <p
          className="text-sm mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          抱歉，您访问的页面不存在或已被移除。
        </p>
        <Button
          variant="primary"
          onClick={() => router.push('/')}
          leftIcon={<Home className="h-4 w-4" />}
        >
          返回首页
        </Button>
      </div>
    </div>
  );
}
