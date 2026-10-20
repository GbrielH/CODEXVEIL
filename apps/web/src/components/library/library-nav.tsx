import type { Route } from 'next';
import Link from 'next/link';
import { cx } from '@/lib/cx';
import { campaignPath } from '@/lib/routes';

export type LibraryTab =
  'all' | 'npc' | 'monster' | 'items' | 'srd-monsters' | 'srd-items' | 'books';

/**
 * Abas da biblioteca: registros da campanha (NPCs, monstros, itens) e, para o mestre, os
 * catálogos do SRD 5.2.1 de onde ele copia monstros e itens mágicos.
 */
export function LibraryNav({
  campaignId,
  active,
  isGm,
  systemId = 'dnd5e',
}: {
  campaignId: string;
  active: LibraryTab;
  isGm: boolean;
  systemId?: string;
}) {
  const base = campaignPath(campaignId, '/biblioteca');
  const tabs: { key: LibraryTab; href: string; label: string }[] = [
    { key: 'all', href: base, label: 'Todos' },
    { key: 'npc', href: `${base}?tipo=npcs`, label: 'NPCs' },
    { key: 'monster', href: `${base}?tipo=monstros`, label: 'Monstros' },
    { key: 'items', href: `${base}/itens`, label: 'Itens' },
  ];
  // O SRD é de D&D 5e; nas outras mesas, ameaças e itens vêm dos livros importados (aba Livros).
  if (isGm && systemId !== 'dnd5e') {
    tabs.push({
      key: 'books',
      href: campaignPath(campaignId, '/livros'),
      label: 'Ameaças e itens dos livros',
    });
  } else if (isGm) {
    tabs.push(
      { key: 'srd-monsters', href: `${base}/srd`, label: 'Bestiário SRD' },
      { key: 'srd-items', href: `${base}/srd-itens`, label: 'Itens mágicos SRD' },
    );
  }
  return (
    <nav aria-label="Seções da biblioteca" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href as Route}
            aria-current={tab.key === active ? 'page' : undefined}
            className={cx(
              '-mb-px flex h-11 items-center border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
              tab.key === active
                ? 'border-parchment-300 text-fg-accent'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
