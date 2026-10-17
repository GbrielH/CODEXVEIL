'use client';

import { encounterStatusLabels, getCampaignTurn, type CampaignTurn } from '@codexveil/database';
import { turnModeLabels } from '@codexveil/domain';
import { dnd5eActions, dnd5eTurnGuides } from '@codexveil/rpg-systems/dnd5e';
import { Hourglass } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { LiveBadge } from '@/components/ui/save-status';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

interface TurnStatusProps {
  campaignId: string;
  /** Resumo carregado no servidor; `undefined` = carrega no navegador. */
  initialTurn?: CampaignTurn | null;
  /** Personagem de quem está vendo (para avisar "é a sua vez"). */
  ownCharacterId?: string | null;
  systemId: string;
}

/**
 * Turno atual da campanha para os jogadores (e o mestre): modo, rodada, de quem é a vez e a
 * ordem, ao vivo. Some quando não há turnos em andamento.
 */
export function TurnStatus({ campaignId, initialTurn, ownCharacterId = null, systemId }: TurnStatusProps) {
  const [turn, setTurn] = useState<CampaignTurn | null>(initialTurn ?? null);

  const reload = useCallback(async () => {
    try {
      setTurn(await getCampaignTurn(getSupabaseBrowserClient(), campaignId));
    } catch (error) {
      console.error('[codexveil] falha ao carregar o turno', error);
    }
  }, [campaignId]);

  useEffect(() => {
    if (initialTurn !== undefined) return;
    let active = true;
    getCampaignTurn(getSupabaseBrowserClient(), campaignId)
      .then((loaded) => {
        if (active) setTurn(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId, initialTurn]);

  const live = useRealtimeRefresh(`turno:${campaignId}`, [{ table: 'campaign_turns', filter: `campaign_id=eq.${campaignId}` }], () => void reload());

  if (!turn) return null;
  const mine = ownCharacterId !== null && turn.activeCharacterId === ownCharacterId;
  const guide = systemId === 'dnd5e' ? dnd5eTurnGuides[turn.mode] : null;
  const active = turn.status === 'active';

  return (
    <Card ornate className={cx(mine && 'border-parchment-300/70')}>
      <CardHeader
        icon={<Hourglass className="h-5 w-5" aria-hidden="true" />}
        title={turnModeLabels[turn.mode]}
        description={active ? `Rodada ${turn.round}` : 'O mestre está preparando a ordem dos turnos.'}
        action={
          <span className="flex items-center gap-2">
            <LiveBadge status={live} />
            <Badge tone={active ? 'brand' : 'parchment'}>{encounterStatusLabels[turn.status]}</Badge>
          </span>
        }
      />
      {active ? (
        <p className={cx('text-lg', mine ? 'font-display text-fg-accent' : 'text-fg')} aria-live="polite">
          {mine ? 'É a sua vez!' : turn.activeName ? `Vez de ${turn.activeName}` : 'Vez do mestre'}
        </p>
      ) : null}
      {turn.order.length > 0 ? (
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Ordem dos turnos">
          {turn.order.map((entry, index) => (
            <li
              key={entry.id}
              aria-current={entry.current ? 'step' : undefined}
              className={cx(
                'rounded-full border px-2.5 py-1 text-xs',
                entry.current ? 'border-parchment-300/70 bg-wine-900/60 text-fg-accent' : 'border-line text-fg-secondary',
                entry.defeated && 'line-through opacity-60',
                entry.characterId !== null && entry.characterId === ownCharacterId && !entry.current && 'border-wine-400/60',
              )}
            >
              {index + 1}. {entry.name}
            </li>
          ))}
        </ol>
      ) : null}
      {mine && guide ? (
        <div className="mt-4 rounded-md border border-line bg-sunken/60 p-3 text-sm">
          <p className="font-medium text-fg">No seu turno</p>
          <ul className="mt-1 list-disc pl-5 text-fg-secondary">
            {guide.economy.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-fg-secondary">
            <span className="font-medium text-fg">Ações comuns:</span> {guide.actions.map((key) => dnd5eActions[key].label).join(', ')}.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
