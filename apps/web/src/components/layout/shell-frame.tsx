'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSyncExternalStore, type ReactNode } from 'react';

/** Chave no navegador: o menu lateral fica do jeito que a pessoa deixou. */
const STORAGE_KEY = 'codexveil-sidebar';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function setCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Sem armazenamento: vale só nesta página.
  }
  for (const listener of listeners) listener();
}

function useCollapsed(): boolean {
  return useSyncExternalStore(subscribe, readCollapsed, () => false);
}

/**
 * Moldura das áreas autenticadas. `data-collapsed` encolhe o menu lateral para só ícones (os
 * filhos reagem com as variantes `group-data-[collapsed=true]/shell:`).
 */
export function ShellFrame({
  motion,
  children,
}: {
  motion: 'system' | 'reduce';
  children: ReactNode;
}) {
  const collapsed = useCollapsed();
  return (
    <div
      data-motion={motion}
      data-collapsed={collapsed}
      className="group/shell min-h-dvh lg:grid lg:grid-cols-[16rem_1fr] lg:transition-[grid-template-columns] lg:data-[collapsed=true]:grid-cols-[4.5rem_1fr]"
    >
      {children}
    </div>
  );
}

/** Botão de encolher/expandir o menu lateral. */
export function SidebarToggle() {
  const collapsed = useCollapsed();
  const label = collapsed ? 'Expandir o menu' : 'Encolher o menu';
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={() => setCollapsed(!collapsed)}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
