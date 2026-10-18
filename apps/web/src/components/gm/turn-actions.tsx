'use client';

import { listTurnActions, performTurnAction, type TurnAction } from '@codexveil/database';
import { TURN_ACTION_KINDS, d20Expression, turnActionKindLabels, turnBudget, type TurnActionKind } from '@codexveil/domain';
import { DND5E_ACTIONS, dnd5eActions } from '@codexveil/rpg-systems/dnd5e';
import { Swords } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/control-classes';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

interface Props {
  campaignId: string;
  encounterId: string;
  round: number;
  actor: { id: string; name: string };
  targets: { id: string; name: string }[];
}

/**
 * Ações do participante da vez registradas pelo mestre (NPCs, monstros ou qualquer
 * personagem): mesmo orçamento do jogador, com alvo e rolagem que aparecem no mural.
 */
export function GmTurnActions({ campaignId, encounterId, round, actor, targets }: Props) {
  const { toast } = useToast();
  const id = useId();
  const [actions, setActions] = useState<TurnAction[]>([]);
  const [kind, setKind] = useState<TurnActionKind>('action');
  const [label, setLabel] = useState('Ataque');
  const [bonus, setBonus] = useState<number | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setActions(await listTurnActions(getSupabaseBrowserClient(), campaignId, 60));
    } catch (error) {
      console.error('[codexveil] falha ao carregar as ações', error);
    }
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    listTurnActions(getSupabaseBrowserClient(), campaignId, 60)
      .then((loaded) => {
        if (active) setActions(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  useRealtimeRefresh(`acoes-mesa:${campaignId}`, [{ table: 'turn_actions', filter: `campaign_id=eq.${campaignId}` }], () => void reload());

  const mine = actions.filter((action) => action.combatantId === actor.id && action.round === round && action.encounterId === encounterId);
  const budget = turnBudget(mine);

  const act = async () => {
    const text = label.trim();
    if (!text) return;
    setBusy(true);
    try {
      const done = await performTurnAction(getSupabaseBrowserClient(), {
        combatantId: actor.id,
        kind,
        label: text,
        targetCombatantId: target || null,
        rollExpression: bonus === null ? null : d20Expression(bonus),
      });
      toast({ tone: 'success', title: `${actor.name}: ${done.label}${done.targetName ? ` → ${done.targetName}` : ''}`, description: done.rollTotal !== null ? `Resultado: ${done.rollTotal}` : undefined });
      await reload();
    } catch (error) {
      toast({ tone: 'danger', title: 'A ação não foi registrada', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={`Ações de ${actor.name}`} className="mb-3 flex flex-col gap-3 rounded-md border border-parchment-300/40 bg-wine-900/40 px-3 py-3">
      <p className="text-sm font-medium text-fg-accent">Vez de {actor.name}</p>
      <div className="flex flex-wrap gap-1.5">
        {(['action', 'bonus_action', 'movement', 'reaction'] as const).map((entry) => (
          <Badge key={entry} tone={budget[entry] > 0 ? 'success' : 'neutral'}>
            {turnActionKindLabels[entry]}: {budget[entry] > 0 ? 'disponível' : 'usada'}
          </Badge>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select id={`${id}-tipo`} aria-label="Tipo de ação" size="sm" value={kind} onChange={(event) => setKind(event.target.value as TurnActionKind)}>
          {TURN_ACTION_KINDS.map((entry) => (
            <option key={entry} value={entry}>
              {turnActionKindLabels[entry]}
            </option>
          ))}
        </Select>
        <Select id={`${id}-alvo`} aria-label="Alvo" size="sm" value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="">Sem alvo</option>
          {targets.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>
        <input
          aria-label="Ação (ex.: Garra, Disparada)"
          list={`${id}-sugestoes`}
          value={label}
          maxLength={120}
          onChange={(event) => setLabel(event.target.value)}
          className={controlClasses(false, 'h-8 text-xs')}
        />
        <datalist id={`${id}-sugestoes`}>
          <option value="Ataque" />
          {DND5E_ACTIONS.map((key) => (
            <option key={key} value={dnd5eActions[key].label} />
          ))}
        </datalist>
        <label className="flex items-center gap-2 text-xs text-fg-secondary">
          Rolar d20 +
          <NumberInput aria-label="Bônus da rolagem (vazio = sem rolagem)" value={bonus} min={-20} max={30} allowEmpty onCommit={setBonus} className="h-8 w-16 text-xs" />
        </label>
      </div>
      <div>
        <Button size="sm" loading={busy} disabled={!label.trim()} icon={<Swords className="h-4 w-4" aria-hidden="true" />} onClick={() => void act()}>
          Registrar ação
        </Button>
      </div>
      {mine.length > 0 ? (
        <ul className="text-xs text-fg-secondary">
          {[...mine].reverse().map((action) => (
            <li key={action.id}>
              {turnActionKindLabels[action.kind]}: {action.label}
              {action.targetName ? ` → ${action.targetName}` : ''}
              {action.rollTotal !== null ? ` (${action.rollTotal})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
