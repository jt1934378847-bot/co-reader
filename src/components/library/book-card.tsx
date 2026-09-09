'use client';

import { BookOpen, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';
import type { Book } from '@/lib/types';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface BookCardProps {
  book: Book;
  isSelected?: boolean;
  onDelete: () => void;
  onOpen: () => void;
}

export function BookCard({ book, isSelected, onDelete, onOpen }: BookCardProps) {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languageFlags: Record<string, string> = {
    en: '🇬🇧',
    ja: '🇯🇵',
    ko: '🇰🇷',
    zh: '🇨🇳'
  };

  const formatBadge =
    book.format === 'epub' ? 'EPUB' : book.format === 'pdf' ? 'PDF' : 'TXT';

  const handleCardClick = (_e: React.MouseEvent) => {
    onOpen();
  };

  return (
    <Card
      hover
      padding="none"
      className={`relative overflow-hidden cursor-pointer group ${
        isSelected ? 'ring-2 ring-[var(--accent-primary)]' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Cover / Placeholder */}
      <div
        className="h-36 flex items-center justify-center relative"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            className="object-cover"
          />
        ) : (
          <BookOpen className="h-12 w-12 text-[var(--text-muted)]" />
        )}

        <span className="absolute top-2 left-2 text-lg">
          {languageFlags[book.language]}
        </span>

        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium bg-black/50 text-white rounded">
          {formatBadge}
        </span>

        {/* Translation status indicator - hidden per user request */}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3
          className="font-medium text-sm truncate mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {book.title}
        </h3>
        <p
          className="text-xs truncate mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {book.author}
        </p>

        <div className="h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-primary)] transition-all duration-300"
            style={{ width: `${book.progress}%` }}
          />
        </div>
        <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
          {book.progress}% {t('read')}
        </p>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
        <span className="px-3 py-1 bg-black/70 text-white text-xs rounded-full">
          点击打开
        </span>
      </div>

      {/* Delete button */}
      <div
        ref={menuRef}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        data-menu-button
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          ⋮
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 py-1 w-28 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-lg z-10 animate-fade-in">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {t('delete')}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
