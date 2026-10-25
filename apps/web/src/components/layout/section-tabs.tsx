'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
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

const seenKey = (campaignId: string) => `codexveil:sessao-vistos:${campaignId}`;

function readSeen(campaignId: string): Set<string> | null {
  try {
    const stored = window.localStorage.getItem(seenKey(campaignId));
    return stored ? new Set(JSON.parse(stored) as string[]) : null;
  } catch {
    return null;
  }
}

function writeSeen(campaignId: string, ids: readonly string[]) {
  try {
    window.localStorage.setItem(seenKey(campaignId), JSON.stringify(ids));
  } catch {
    // Sem armazenamento: o aviso vale só nesta página.
  }
}

/** Trechos da sessão que o jogador consegue ver (o RLS devolve só os liberados). */
async function visibleBlockIds(campaignId: string): Promise<string[]> {
  const { data } = await getSupabaseBrowserClient()
    .from('session_blocks')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('visibility', 'members');
  return (data ?? []).map((row) => row.id);
}

/**
 * Ponto de aviso na aba quando o mestre libera um trecho da sessão. Só aparece se surgiu um
 * trecho que o jogador ainda não viu (comparado com os vistos ao abrir a aba Sessão).
 */
function SessionAlert({ campaignId, active }: { campaignId: string; active: boolean }) {
  const [unseen, setUnseen] = useState(false);
  const check = useCallback(() => {
    void visibleBlockIds(campaignId).then((ids) => {
      const seen = readSeen(campaignId);
      if (active || seen === null) {
        // Na aba Sessão (ou na primeira vez): tudo o que está liberado conta como visto.
        writeSeen(campaignId, ids);
        setUnseen(false);
        return;
      }
      setUnseen(ids.some((id) => !seen.has(id)));
    });
  }, [campaignId, active]);
  useRealtimeRefresh(
    `aviso-sessao:${campaignId}`,
    [{ table: 'session_blocks', filter: `campaign_id=eq.${campaignId}` }],
    check,
  );
  useEffect(() => {
    const first = window.setTimeout(check, 0);
    return () => window.clearTimeout(first);
  }, [check]);
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
