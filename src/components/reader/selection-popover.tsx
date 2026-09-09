'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Languages, Highlighter, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

interface SelectionPopoverProps {
  position: { x: number; y: number };
  selectedText: string;
  onTranslate: () => void;
  onHighlight: () => void;
  onAskAI: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function SelectionPopover({
  position,
  selectedText,
  onTranslate,
  onHighlight,
  onAskAI,
  onClose,
  isLoading
}: SelectionPopoverProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close on the same click that opened it
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position if it would overflow
    if (x + rect.width > viewportWidth - 16) {
      x = viewportWidth - rect.width - 16;
    }

    // Adjust vertical position if it would go above the viewport
    if (y - rect.height < 16) {
      y = position.y + 24; // Show below instead
    } else {
      y = y - rect.height - 8; // Show above with gap
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(selectedText);
    onClose();
  }, [selectedText, onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 animate-fade-in"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`
      }}
    >
      <div
        className="flex items-center gap-0.5 p-1 rounded-xl shadow-lg border border-[var(--border-color)]"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={isLoading}
          title={t('copy')}
          className="px-2"
        >
          <Copy className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-[var(--border-color)]" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onTranslate}
          disabled={isLoading}
          title={t('translate')}
          className="px-2"
        >
          <Languages className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onHighlight}
          disabled={isLoading}
          title={t('highlight')}
          className="px-2"
        >
          <Highlighter className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onAskAI}
          disabled={isLoading}
          title={t('askAI')}
          className="px-2"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-[var(--border-color)]" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="px-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
