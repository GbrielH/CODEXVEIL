'use client';

import { Bell, ScrollText, Search, Swords } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cx } from '@/lib/cx';

export interface SearchEntry {
  kind: 'campaign' | 'character';
  name: string;
  href: string;
  /** "D&D 5e · Mestre", "Humano · Paladino 4"… */
  detail: string;
}

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Barra superior (telas largas): busca rápida das suas campanhas e personagens, convites
 * pendentes (sino) e o perfil.
 */
export function TopBar({ displayName, entries, invites }: { displayName: string; entries: SearchEntry[]; invites: number }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return entries.filter((entry) => words.every((word) => plain(`${entry.name} ${entry.detail}`).includes(word))).slice(0, 8);
  }, [entries, query]);

  const go = (entry: SearchEntry) => {
    setOpen(false);
    setQuery('');
    router.push(entry.href as Route);
  };

  return (
    <div className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-line bg-canvas/80 px-6 backdrop-blur-xl lg:flex 2xl:px-10">
      <div className="relative w-full max-w-xl">
        <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-raised/80 px-4 focus-within:border-wine-400/60 focus-within:shadow-[0_0_0_3px_rgb(107_59_198/0.25)]">
          <Search className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          <input
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={listId}
            aria-label="Buscar campanhas e personagens"
            placeholder="Buscar campanhas, personagens…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((current) => Math.min(results.length - 1, current + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((current) => Math.max(0, current - 1));
              } else if (event.key === 'Enter' && results[active]) {
                event.preventDefault();
                go(results[active]);
              } else if (event.key === 'Escape') setOpen(false);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
        </label>
        {open && query.trim() ? (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-xl border border-line-strong bg-raised shadow-2xl">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-fg-muted">Nada encontrado.</li>
            ) : (
              results.map((entry, index) => (
                <li key={entry.href} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(entry)}
                    className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left', index === active ? 'bg-wine-900/60' : 'hover:bg-hover')}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-wine-400/25 bg-wine-950 text-wine-300">
                      {entry.kind === 'campaign' ? <ScrollText className="h-4 w-4" aria-hidden="true" /> : <Swords className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-fg">{entry.name}</span>
                      <span className="block truncate text-xs text-fg-muted">{entry.detail}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/painel"
          aria-label={invites ? `${invites} convite(s) pendente(s)` : 'Sem convites pendentes'}
          title={invites ? `${invites} convite(s) pendente(s)` : 'Sem convites pendentes'}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-fg-muted hover:bg-hover hover:text-fg"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {invites ? (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-wine-500 px-1 text-[10px] font-semibold text-parchment-50">{invites}</span>
          ) : null}
        </Link>
        <Link href="/perfil" aria-label="Perfil" className="rounded-full ring-2 ring-wine-400/40 hover:ring-wine-300">
          <Avatar name={displayName} size="sm" />
        </Link>
      </div>
    </div>
  );
}
