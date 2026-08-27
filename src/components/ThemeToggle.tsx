'use client';

import { useEffect, useState } from 'react';
import { applyTheme, loadTheme, saveTheme, type Theme } from '@/lib/local';
import { IconMoon, IconSun } from './Icons';

/** Light/dark switch. Defaults to the OS preference until the user chooses. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadTheme();
    setTheme(stored);
    applyTheme(stored);
    setReady(true);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => loadTheme() === 'system' && applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = ready && document.documentElement.classList.contains('dark');

  return (
    <button
      type="button"
      onClick={() => {
        const next: Theme = isDark ? 'light' : 'dark';
        setTheme(next);
        saveTheme(next);
        applyTheme(next);
      }}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-ink"
    >
      {theme === 'system' && !ready ? <IconSun /> : isDark ? <IconSun /> : <IconMoon />}
    </button>
  );
}
