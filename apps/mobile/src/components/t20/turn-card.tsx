import {
  endTurn,
  getCampaignTurn,
  performTurnAction,
  tickCharacterConditions,
  type CampaignTurn,
} from '@codexveil/database';
import { turnModeLabels } from '@codexveil/domain';
import { findT20Condition } from '@codexveil/rpg-systems/tormenta20';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useRealtimeRefresh } from '@/lib/hooks';
import { getSupabase } from '@/lib/supabase';

/** Registra o uso nas ações do turno, quando é a vez do personagem (silencioso fora dela). */
export async function logT20TurnUse(campaignId: string, characterId: string, label: string) {
  try {
    const client = getSupabase();
    const turn = await getCampaignTurn(client, campaignId);
    const me = turn?.order.find((entry) => entry.characterId === characterId);
    if (!turn || !me || turn.status !== 'active' || turn.activeCharacterId !== characterId) return;
    await performTurnAction(client, {
      combatantId: me.id,
      kind: 'free',
      label,
      targetCombatantId: null,
      grantsAction: false,
      rollExpression: null,
      manualTotal: null,
    });
  } catch {
    // Fora da vez ou sem sessão: o uso fica só na ficha.
  }
}

/** Turno do personagem de Tormenta20 na campanha: a vez, a ordem e "Encerrar turno" (tira 1 rodada das condições). */
export function T20TurnCard({
  campaignId,
  characterId,
  canAct,
  onConditionsEnded,
}: {
  campaignId: string;
  characterId: string;
  canAct: boolean;
  onConditionsEnded: (keys: string[]) => void;
}) {
  const toast = useToast();
  const [turn, setTurn] = useState<CampaignTurn | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTurn(await getCampaignTurn(getSupabase(), campaignId));
    } catch (error) {
      console.error('[codexveil] falha ao carregar o turno', error);
    }
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    getCampaignTurn(getSupabase(), campaignId)
      .then((next) => {
        if (active) setTurn(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  useRealtimeRefresh(
    `turno-t20:${campaignId}`,
    [{ table: 'campaign_turns', filter: `campaign_id=eq.${campaignId}` }],
    () => void reload(),
  );

  if (!turn) return null;
  const mine = turn.activeCharacterId === characterId && turn.status === 'active';

  return (
    <Card>
      <AppText variant="heading">
        {turnModeLabels[turn.mode]}
        {turn.status === 'active' ? ` · rodada ${turn.round}` : ''}
      </AppText>
      <AppText variant="small">
        {turn.status === 'active'
          ? mine
            ? 'É a sua vez!'
            : turn.activeName
              ? `Vez de ${turn.activeName}`
              : 'Vez do mestre'
          : 'O mestre está preparando a ordem.'}
      </AppText>
      {turn.order.length ? (
        <AppText variant="small">
          {turn.order
            .map((entry, index) => `${index + 1}. ${entry.name}${entry.current ? ' ◂' : ''}`)
            .join('   ')}
        </AppText>
      ) : null}
      {mine && canAct ? (
        <Button
          label="Encerrar turno"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const client = getSupabase();
              await endTurn(client, turn.encounterId);
              const ended = await tickCharacterConditions(client, characterId);
              onConditionsEnded(ended);
              toast({
                tone: 'success',
                title: 'Turno encerrado.',
                description: ended.length
                  ? `Terminou: ${ended.map((key) => findT20Condition(key)?.label ?? key).join(', ')}.`
                  : undefined,
              });
              await reload();
            } catch (error) {
              toast({
                tone: 'danger',
                title: 'O turno não foi encerrado',
                description: failureMessage(error),
              });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </Card>
  );
}
