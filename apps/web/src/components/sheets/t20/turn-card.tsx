'use client';

import { endTurn, getCampaignTurn, tickCharacterConditions, type CampaignTurn } from '@codexveil/database';
import { findT20Condition } from '@codexveil/rpg-systems/tormenta20';
import { turnModeLabels } from '@codexveil/domain';
import { Hourglass } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { LiveBadge } from '@/components/ui/save-status';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

/**
 * Turno do personagem de Tormenta20 na campanha: de quem é a vez, a ordem e "Encerrar turno",
 * que também tira 1 rodada das condições do personagem.
 */
export function T20TurnCard({ campaignId, characterId, canAct, onConditionsEnded }: { campaignId: string; characterId: string; canAct: boolean; onConditionsEnded: (keys: string[]) => void }) {
  const { toast } = useToast();
  const [turn, setTurn] = useState<CampaignTurn | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTurn(await getCampaignTurn(getSupabaseBrowserClient(), campaignId));
    } catch (error) {
      console.error('[codexveil] falha ao carregar o turno', error);
    }
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    getCampaignTurn(getSupabaseBrowserClient(), campaignId)
      .then((next) => {
        if (active) setTurn(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  const live = useRealtimeRefresh(`turno-t20:${campaignId}`, [{ table: 'campaign_turns', filter: `campaign_id=eq.${campaignId}` }], () => void reload());

  if (!turn) return null;
  const mine = turn.activeCharacterId === characterId && turn.status === 'active';

  const finish = async () => {
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      await endTurn(client, turn.encounterId);
      const ended = await tickCharacterConditions(client, characterId);
      onConditionsEnded(ended);
      toast({ tone: 'success', title: 'Turno encerrado.', description: ended.length ? `Terminou: ${ended.map((key) => findT20Condition(key)?.label ?? key).join(', ')}.` : undefined });
      await reload();
    } catch (error) {
      toast({ tone: 'danger', title: 'O turno não foi encerrado', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card ornate className={cx(mine && 'animate-turn-glow border-parchment-300/70')}>
      <CardHeader
        icon={<Hourglass className="h-5 w-5" aria-hidden="true" />}
        title={`${turnModeLabels[turn.mode]}${turn.status === 'active' ? ` · rodada ${turn.round}` : ''}`}
        description={turn.status === 'active' ? (mine ? 'É a sua vez!' : turn.activeName ? `Vez de ${turn.activeName}` : 'Vez do mestre') : 'O mestre está preparando a ordem.'}
        action={<LiveBadge status={live} />}
      />
      {turn.order.length ? (
        <ol className="mb-3 flex flex-wrap gap-1.5" aria-label="Ordem dos turnos">
          {turn.order.map((entry, index) => (
            <li
              key={entry.id}
              className={cx('rounded-full border px-2.5 py-1 text-xs', entry.current ? 'border-parchment-300/70 bg-wine-900/60 text-fg-accent' : 'border-line text-fg-secondary', entry.defeated && 'line-through opacity-60')}
            >
              {index + 1}. {entry.name}
            </li>
          ))}
        </ol>
      ) : null}
      {mine && canAct ? (
        <Button loading={busy} onClick={() => void finish()}>
          Encerrar turno
        </Button>
      ) : null}
    </Card>
  );
}
