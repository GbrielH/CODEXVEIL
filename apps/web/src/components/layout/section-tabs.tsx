'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { cx } from '@/lib/cx';

export interface SectionTab {
  href: Route;
  label: string;
  /** Marca como ativa apenas na rota exata (para a aba "visão geral"). */
  exact?: boolean;
  /** Aviso ao vivo: o mestre liberou algo na aba Sessão desta campanha (só para jogadores). */
  sessionAlertCampaignId?: string;
}

/** Ponto de aviso na aba quando o mestre libera um trecho da sessão (some ao abrir a aba). */
function SessionAlert({ campaignId, active }: { campaignId: string; active: boolean }) {
  const [unseen, setUnseen] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  useRealtimeRefresh(
    `aviso-sessao:${campaignId}`,
    [{ table: 'session_blocks', filter: `campaign_id=eq.${campaignId}` }],
    () => {
      // A assinatura também avisa ao conectar: só conta o que muda depois de abrir a página.
      if (!active && Date.now() - mountedAt > 3000) setUnseen(true);
    },
  );
  useEffect(() => {
    if (!active) return;
    const clear = window.setTimeout(() => setUnseen(false), 0);
    return () => window.clearTimeout(clear);
  }, [active]);
  if (!unseen || active) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-wine-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-wine-200">
      <span className="h-2 w-2 animate-pulse rounded-full bg-wine-400" aria-hidden="true" />
      Novo
    </span>
  );
}

/** Abas de navegação entre seções de uma página (rolam horizontalmente no celular). */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  '-mb-px flex h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors',
                  active
                    ? 'border-parchment-300 text-fg-accent'
                    : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {tab.label}
                {tab.sessionAlertCampaignId ? (
                  <SessionAlert campaignId={tab.sessionAlertCampaignId} active={active} />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
