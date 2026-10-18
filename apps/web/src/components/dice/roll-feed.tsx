'use client';

import { clearDiceRolls, listDiceRolls, listTurnActions, type DiceRoll, type TurnAction } from '@codexveil/database';
import { describeDiceRoll, diceRollModeLabels, naturalD20, turnActionKindLabels } from '@codexveil/domain';
import { EyeOff, Radio, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' });
}

/**
 * Mural de rolagens da campanha, ao vivo. O mestre vê também as rolagens secretas; jogadores
 * veem as abertas e as próprias. O RLS decide o que chega a cada um.
 */
export function RollFeed({
  campaignId,
  initialRolls,
  canClear = false,
  limit = 50,
  compact = false,
}: {
  campaignId: string;
  initialRolls: DiceRoll[];
  canClear?: boolean;
  limit?: number;
  compact?: boolean;
}) {
  const [rolls, setRolls] = useState(initialRolls);
  const [actions, setActions] = useState<TurnAction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const client = getSupabaseBrowserClient();
      const [nextRolls, nextActions] = await Promise.all([listDiceRolls(client, campaignId, limit), listTurnActions(client, campaignId, limit)]);
      setRolls(nextRolls);
      setActions(nextActions);
      setError(null);
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível atualizar o mural.'));
    }
  }, [campaignId, limit]);

  const live = useRealtimeRefresh(
    `rolagens:${campaignId}`,
    [
      { table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` },
      { table: 'turn_actions', filter: `campaign_id=eq.${campaignId}` },
    ],
    () => void reload(),
  );

  // Ações do turno e rolagens soltas, na ordem em que aconteceram (a rolagem de uma ação aparece nela).
  const rollsById = new Map(rolls.map((roll) => [roll.id, roll]));
  const linked = new Set(actions.map((action) => action.rollId).filter(Boolean));
  const entries = [
    ...actions.map((action) => ({ type: 'action' as const, at: action.createdAt, action })),
    ...rolls.filter((roll) => !linked.has(roll.id)).map((roll) => ({ type: 'roll' as const, at: roll.createdAt, roll })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx('inline-flex items-center gap-1.5 text-xs', live === 'live' ? 'text-verdigris-300' : 'text-fg-muted')}>
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          {live === 'live' ? 'Ao vivo' : live === 'connecting' ? 'Conectando…' : 'Reconectando…'}
        </span>
        {canClear && rolls.length > 0 ? (
          <span className="ml-auto">
            <ConfirmDialog
              trigger={(open) => (
                <Button size="sm" variant="ghost" onClick={open} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
                  Limpar mural
                </Button>
              )}
              title="Limpar o mural de rolagens?"
              description="Todas as rolagens desta campanha serão apagadas para todos."
              confirmLabel="Limpar"
              onConfirm={async () => {
                await clearDiceRolls(getSupabaseBrowserClient(), campaignId);
                await reload();
              }}
            />
          </span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-ember-300">{error}</p> : null}
      {entries.length === 0 ? (
        <p className="text-sm text-fg-muted">Nada ainda. Ações dos turnos e rolagens da mesa aparecem aqui na hora.</p>
      ) : (
        <ol className={cx('flex flex-col gap-1.5 overflow-y-auto pr-1', compact ? 'max-h-80' : 'max-h-[32rem]')} aria-label="Ações e rolagens recentes">
          {entries.map((entry) => {
            if (entry.type === 'action') {
              const { action } = entry;
              const roll = action.rollId ? rollsById.get(action.rollId) : undefined;
              return (
                <li key={action.id} className="flex items-start gap-3 rounded-md border border-parchment-400/30 bg-sunken px-3 py-2">
                  <span className="tabular w-12 shrink-0 text-center font-display text-2xl text-fg-accent">{action.rollTotal ?? '·'}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium text-fg">{action.actorName}</span>
                      <Badge tone="parchment">{turnActionKindLabels[action.kind]}</Badge>
                      <span className="text-fg-secondary">
                        {action.label}
                        {action.targetName ? ` → ${action.targetName}` : ''}
                      </span>
                    </span>
                    <span className="block text-xs text-fg-muted">
                      Rodada {action.round}
                      {roll ? ` · ${roll.expression} → ${describeDiceRoll(roll)}` : ''}
                    </span>
                  </span>
                  <time dateTime={action.createdAt} className="shrink-0 text-xs text-fg-subtle">
                    {timeLabel(action.createdAt)}
                  </time>
                </li>
              );
            }
            const { roll } = entry;
            const natural = naturalD20(roll);
            return (
              <li
                key={roll.id}
                className={cx(
                  'flex items-start gap-3 rounded-md border px-3 py-2',
                  roll.visibility === 'gm' ? 'border-arcane-400/40 bg-info-bg/40' : 'border-line bg-raised',
                )}
              >
                <span
                  className={cx(
                    'tabular w-12 shrink-0 text-center font-display text-2xl',
                    natural === 20 ? 'text-verdigris-300' : natural === 1 ? 'text-ember-300' : 'text-fg-accent',
                  )}
                >
                  {roll.total}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-fg">{roll.rollerName}</span>
                    {roll.label ? <span className="text-fg-secondary">· {roll.label}</span> : null}
                    {roll.visibility === 'gm' ? (
                      <Badge tone="info" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />}>
                        Secreta
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block text-xs text-fg-muted">
                    {roll.expression} → {describeDiceRoll(roll)}
                    {roll.mode !== 'normal' ? ` · ${diceRollModeLabels[roll.mode]}` : ''}
                    {natural === 20 ? ' · 20 natural' : natural === 1 ? ' · 1 natural' : ''}
                  </span>
                </span>
                <time dateTime={roll.createdAt} className="shrink-0 text-xs text-fg-subtle">
                  {timeLabel(roll.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
