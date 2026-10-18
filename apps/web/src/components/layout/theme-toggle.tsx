'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cx } from '@/lib/cx';

export type Theme = 'dark' | 'light';

/** Chave no navegador; lida antes da pintura pelo script do layout raiz. */
export const THEME_STORAGE_KEY = 'codexveil-theme';
const THEME_COLORS: Record<Theme, string> = { dark: '#171719', light: '#F3EDE0' };

/** Aplica o tema salvo antes da primeira pintura (evita piscar o tema escuro). */
export const themeBootScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'){document.documentElement.dataset.theme='light';}}catch(e){}`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sem armazenamento (navegação privada): o tema vale só nesta página.
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  for (const listener of listeners) listener();
}

/** Alterna entre o tema escuro (padrão) e o claro; a escolha fica salva neste navegador. */
export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, (): Theme => 'dark');
  const next: Theme = theme === 'light' ? 'dark' : 'light';
  const label = next === 'light' ? 'Usar tema claro' : 'Usar tema escuro';
  const Icon = theme === 'light' ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={compact ? label : undefined}
      title={label}
      className={cx(
        compact
          ? 'flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg'
          : 'flex h-9 items-center gap-2 rounded-md px-2 text-sm text-fg-muted hover:bg-hover hover:text-fg',
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {compact ? null : next === 'light' ? 'Claro' : 'Escuro'}
    </button>
  );
}
