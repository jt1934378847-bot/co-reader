'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, TestTube, Check, X, Loader2, Trash2, Database, Upload, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useCacheStore } from '@/lib/stores/cache-store';
import { useLibraryStore } from '@/lib/stores/library-store';
import { useToast } from '@/components/ui/toast';
import { Header } from '@/components/library/header';
import { useI18n } from '@/lib/i18n';
import type { APIConfig } from '@/lib/types';
import { LLMFetcher } from '@/lib/llm/fetcher';
import type { ThemeMode } from '@/lib/types';

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; model: string }> = {
  openai: { baseURL: 'https://api.openai.com', model: 'gpt-4o-mini' },
  anthropic: { baseURL: 'https://api.anthropic.com', model: 'claude-3-5-haiku-latest' },
  deepseek: { baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  moonshot: { baseURL: 'https://api.moonshot.com', model: 'moonshot-v1-8k' },
  custom: { baseURL: '', model: '' }
};

export default function SettingsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { t } = useI18n();
  const settings = useSettingsStore();

  const [apiConfig, setApiConfig] = useState<APIConfig>(
    settings.apiConfig || {
      provider: 'openai',
      apiKey: '',
      baseURL: '',
      model: ''
    }
  );

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Custom wallpaper
  const customWallpaper = settings.customWallpaper;
  const wallpaperOpacity = settings.wallpaperOpacity;
  const wallpaperBlur = settings.wallpaperBlur;
  const setCustomWallpaper = settings.setCustomWallpaper;
  const setWallpaperOpacity = settings.setWallpaperOpacity;
  const setWallpaperBlur = settings.setWallpaperBlur;
  const clearCustomWallpaper = settings.clearCustomWallpaper;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_WALLPAPER_SIZE = 5 * 1024 * 1024; // 5MB

  // Cache management
  const clearBookCache = useCacheStore((state) => state.clearBookCache);
  const clearAllTranslations = useCacheStore((state) => state.clearAllTranslations);
  const clearAllQA = useCacheStore((state) => state.clearAllQA);
  const books = useLibraryStore((state) => state.books);
  const [selectedBookForCache, setSelectedBookForCache] = useState<string>('');
  const [cacheStats, setCacheStats] = useState({ translationCount: 0, qaCount: 0, vocabCount: 0, grammarCount: 0 });

  // Hydrate cache stats on mount to avoid hydration mismatch
  useEffect(() => {
    useCacheStore.getState().getCacheStats().then(setCacheStats);
  }, []);

  // Sync with settings store on mount and when settings change
  useEffect(() => {
    if (settings.apiConfig) {
      setApiConfig(settings.apiConfig);
    }
  }, [settings.apiConfig]);

  const handleProviderChange = (provider: APIConfig['provider']) => {
    setApiConfig({
      ...apiConfig,
      provider,
      ...PROVIDER_DEFAULTS[provider]
    });
    setTestResult(null);
  };

  const handleTestConnection = useCallback(async () => {
    if (!apiConfig.apiKey || !apiConfig.baseURL) {
      addToast({ type: 'error', message: '请填写 API 密钥和接口地址' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const fetcher = new LLMFetcher(apiConfig);
      await fetcher.generate([
        {
          id: 'test',
          role: 'user',
          content: 'Say "Connection successful" if you can read this.',
          timestamp: new Date()
        }
      ]);
      setTestResult('success');
      addToast({ type: 'success', message: t('connectionSuccess') });
    } catch (error) {
      setTestResult('error');
      addToast({
        type: 'error',
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsTesting(false);
    }
  }, [apiConfig, addToast, t]);

  const handleWallpaperUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_WALLPAPER_SIZE) {
      addToast({ type: 'error', message: t('wallpaperHint') });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCustomWallpaper(base64);
      addToast({ type: 'success', message: '壁纸已上传' });
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  }, [setCustomWallpaper, addToast, t]);

  const handleClearWallpaper = useCallback(() => {
    clearCustomWallpaper();
  }, [clearCustomWallpaper]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      if (apiConfig.apiKey && apiConfig.baseURL) {
        settings.setApiConfig(apiConfig);
      }
      addToast({ type: 'success', message: t('settingsSaved') });
      router.push('/');
    } catch (error) {
      addToast({
        type: 'error',
        message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsSaving(false);
    }
  }, [apiConfig, settings, addToast, router, t]);

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          {/* Back button */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm mb-6 hover:text-[var(--accent-primary)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToHome')}
          </button>

          <h1 className="text-2xl font-serif font-semibold mb-6">{t('settings')}</h1>

          {/* Appearance */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">{t('appearance')}</h2>
            <Card>
              <div className="space-y-4">
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('theme')}</label>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'system'] as ThemeMode[]).map((themeOption) => (
                      <button
                        key={themeOption}
                        onClick={() => settings.setTheme(themeOption)}
                        className={`
                          px-4 py-2 rounded-lg text-sm capitalize transition-all
                          ${settings.theme === themeOption
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]'
                          }
                        `}
                      >
                        {t(themeOption)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Wallpaper */}
                <div>
                  <label className="flex items-center gap-2 block text-sm font-medium mb-2">
                    <Palette className="h-4 w-4" />
                    {t('customWallpaper')}
                    {customWallpaper && (
                      <span className="text-xs text-[var(--accent-primary)]">(已加载)</span>
                    )}
                  </label>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    {t('wallpaperHint')}
                  </p>
                  <div className="flex gap-4 items-start">
                    {/* Upload area */}
                    <div className="flex flex-col items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleWallpaperUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-16 rounded-lg border-2 border-dashed border-[var(--border-color)] flex items-center justify-center hover:border-[var(--accent-primary)] transition-colors overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-tertiary)' }}
                      >
                        {customWallpaper ? (
                          <img src={customWallpaper} alt="壁纸预览" className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="h-6 w-6 text-[var(--text-muted)]" />
                        )}
                      </button>
                      {customWallpaper ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearWallpaper}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          {t('clearWallpaper')}
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{t('dragOrClickToUpload')}</span>
                      )}
                    </div>

                    {/* Sliders - only show when wallpaper exists */}
                    {customWallpaper && (
                      <div className="flex-1 space-y-3">
                        {/* Opacity */}
                        <div>
                          <label className="flex items-center justify-between text-xs mb-1">
                            <span>{t('wallpaperOpacity')}</span>
                            <span>{wallpaperOpacity}%</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={wallpaperOpacity}
                            onChange={(e) => setWallpaperOpacity(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        {/* Blur */}
                        <div>
                          <label className="flex items-center justify-between text-xs mb-1">
                            <span>{t('wallpaperBlur')}</span>
                            <span>{wallpaperBlur}px</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            value={wallpaperBlur}
                            onChange={(e) => setWallpaperBlur(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('fontSize')}: {settings.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="14"
                    max="24"
                    value={settings.fontSize}
                    onChange={(e) => settings.setFontSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Line Height */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('lineHeight')}: {settings.lineHeight}
                  </label>
                  <input
                    type="range"
                    min="1.4"
                    max="2.2"
                    step="0.1"
                    value={settings.lineHeight}
                    onChange={(e) => settings.setLineHeight(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Reading Width */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('readingWidth')}: {settings.readingWidth}px
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="900"
                    step="20"
                    value={settings.readingWidth}
                    onChange={(e) => settings.setReadingWidth(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </Card>
          </section>

          {/* API Configuration */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">{t('aiApiConfig')}</h2>
            <Card>
              <div className="space-y-4">
                {/* Provider */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('provider')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'anthropic', label: 'Anthropic (Claude)' },
                      { value: 'deepseek', label: 'DeepSeek' },
                      { value: 'moonshot', label: 'Moonshot (月之暗面)' },
                      { value: 'custom', label: '自定义' }
                    ].map((p) => (
                      <button
                        key={p.value}
                        onClick={() => handleProviderChange(p.value as APIConfig['provider'])}
                        className={`
                          px-4 py-2 rounded-lg text-sm transition-all
                          ${apiConfig.provider === p.value
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]'
                          }
                        `}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('apiKey')}</label>
                  <Input
                    type="password"
                    value={apiConfig.apiKey}
                    onChange={(e) => {
                      setApiConfig({ ...apiConfig, apiKey: e.target.value });
                      setTestResult(null);
                    }}
                    placeholder="sk-..."
                  />
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('baseUrl')}</label>
                  <Input
                    type="url"
                    value={apiConfig.baseURL}
                    onChange={(e) => {
                      setApiConfig({ ...apiConfig, baseURL: e.target.value });
                      setTestResult(null);
                    }}
                    placeholder="https://api.openai.com"
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('model')}</label>
                  <Input
                    value={apiConfig.model}
                    onChange={(e) => setApiConfig({ ...apiConfig, model: e.target.value })}
                    placeholder="gpt-4o-mini"
                  />
                </div>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={`
                      p-3 rounded-lg flex items-center gap-2 text-sm
                      ${testResult === 'success'
                        ? 'bg-green-900/20 text-green-600'
                        : 'bg-red-900/20 text-red-600'
                      }
                    `}
                  >
                    {testResult === 'success' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    {testResult === 'success' ? t('connectionSuccess') : t('connectionFailed')}
                  </div>
                )}

                {/* Test Button */}
                <Button
                  variant="secondary"
                  onClick={handleTestConnection}
                  disabled={isTesting || !apiConfig.apiKey || !apiConfig.baseURL}
                  leftIcon={isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                >
                  {isTesting ? t('testing') : t('testConnection')}
                </Button>
              </div>
            </Card>
          </section>

          {/* Cache Management */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5" />
              缓存管理
            </h2>
            <Card>
              <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  缓存可加快翻译和 AI 回答的加载速度。清除缓存不会影响您的生词本和高光笔记。
                </p>

                {/* Cache Stats */}
                <div className="flex gap-4 text-sm">
                  <span>翻译缓存: <strong>{cacheStats.translationCount}</strong> 条</span>
                  <span>AI 问答缓存: <strong>{cacheStats.qaCount}</strong> 条</span>
                </div>

                {/* Clear by book */}
                {books.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">按书籍清除缓存</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedBookForCache}
                        onChange={(e) => setSelectedBookForCache(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <option value="">选择一本书...</option>
                        {books.map((book) => (
                          <option key={book.id} value={book.id}>{book.title}</option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (selectedBookForCache) {
                            clearBookCache(selectedBookForCache);
                            addToast({ type: 'success', message: '已清除该书缓存' });
                            setSelectedBookForCache('');
                          }
                        }}
                        disabled={!selectedBookForCache}
                        leftIcon={<Trash2 className="h-4 w-4" />}
                      >
                        清除
                      </Button>
                    </div>
                  </div>
                )}

                {/* Clear all */}
                <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      clearAllTranslations();
                      addToast({ type: 'success', message: '已清除所有翻译缓存' });
                    }}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    清除翻译缓存
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      clearAllQA();
                      addToast({ type: 'success', message: '已清除所有问答缓存' });
                    }}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    清除问答缓存
                  </Button>
                </div>
              </div>
            </Card>
          </section>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.push('/')}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {t('saveSettings')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
