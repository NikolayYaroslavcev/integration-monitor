import { useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'как в системе', light: 'светлая', dark: 'тёмная' };

function readTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  const cycle = () => {
    const next = NEXT[theme];
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Тема: ${LABEL[theme]}. Переключить на: ${LABEL[NEXT[theme]]}`}
      title={`Тема: ${LABEL[theme]}`}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {theme === 'light' && (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3L6 14M14 6l1.3-1.3" />
          </>
        )}
        {theme === 'dark' && <path d="M16 12.2A6.5 6.5 0 017.8 4a6.5 6.5 0 108.2 8.2z" />}
        {theme === 'system' && (
          <>
            <circle cx="10" cy="10" r="6.5" />
            <path d="M10 3.5a6.5 6.5 0 010 13z" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </button>
  );
}
