'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Moon,
  Sun,
  Settings,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { ThemeMode } from '@/lib/types';

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useSettingsStore();
  const { t } = useI18n();

  const isReaderPage = pathname?.startsWith('/reader');

  const themeIcons: Record<ThemeMode, React.ReactNode> = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Sparkles className="h-4 w-4" />
  };

  const cycleTheme = () => {
    const themes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <header
      className={`
        h-14 px-4 flex items-center justify-between
        bg-[var(--bg-secondary)] border-b border-[var(--border-color)]
        ${isReaderPage ? 'justify-end' : ''}
      `}
    >
      {/* Left side */}
      {!isReaderPage && (
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg hidden sm:block">Co-Reader</span>
          </Link>
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleTheme}
          title={`${t('theme')}: ${t(theme)}`}
          suppressHydrationWarning
        >
          {themeIcons[theme]}
        </Button>

        {/* Settings */}
        <Link href="/settings">
          <Button variant="ghost" size="sm" title={t('settings')} suppressHydrationWarning>
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
