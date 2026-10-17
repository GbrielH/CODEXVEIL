'use client';

import { clearDiceRolls, listDiceRolls, type DiceRoll } from '@codexveil/database';
import { describeDiceRoll, diceRollModeLabels, naturalD20 } from '@codexveil/domain';
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
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRolls(await listDiceRolls(getSupabaseBrowserClient(), campaignId, limit));
      setError(null);
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível atualizar o mural.'));
    }
  }, [campaignId, limit]);

  const live = useRealtimeRefresh(`rolagens:${campaignId}`, [{ table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` }], () => void reload());

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
      {rolls.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhuma rolagem ainda. As rolagens da mesa aparecem aqui na hora.</p>
      ) : (
        <ol className={cx('flex flex-col gap-1.5 overflow-y-auto pr-1', compact ? 'max-h-80' : 'max-h-[32rem]')} aria-label="Rolagens recentes">
          {rolls.map((roll) => {
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
