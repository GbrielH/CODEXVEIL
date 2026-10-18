'use client';

import {
  adjustCharacterResource,
  applyCharacterCondition,
  endTurn,
  getCampaignTurn,
  getSessionState,
  listTurnActions,
  performTurnAction,
  tickCharacterConditions,
  type CampaignTurn,
  type CharacterAbility,
  type TurnAction,
} from '@codexveil/database';
import { d20Expression, turnActionKindLabels, turnBudget, turnModeLabels, type TurnActionKind } from '@codexveil/domain';
import {
  DND5E_ACTIONS,
  attackRollBonus,
  dnd5eActions,
  dnd5eConditionsLeftAfter,
  dnd5eSpellDataSchema,
  featureTurnCost,
  findDnd5eCondition,
  spellNamePt,
  spellTurnCost,
  isAttackAvailable,
} from '@codexveil/rpg-systems/dnd5e';
import { Footprints, Hourglass, ShieldAlert, Sparkles, Swords } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { LiveBadge } from '@/components/ui/save-status';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { parseAttack } from './play-tab';
import { useSheet } from './context';

interface Option {
  key: string;
  label: string;
  kind: TurnActionKind;
  grantsAction: boolean;
  roll: string | null;
  ability: CharacterAbility | null;
}

/**
 * Turno do personagem na campanha: de quem é a vez e, na vez dele, as ações com o orçamento do
 * D&D (1 ação, 1 ação bônus, movimento e 1 reação), alvo, rolagem registrada no mural e o botão
 * de encerrar o turno. Quando alguém mira o personagem, aparece a opção de reagir.
 */
export function TurnPlay() {
  const { character, abilities, items, derived, resources, conditions, permissions, reloadConditions, setResources } = useSheet();
  const campaignId = character.campaign?.id ?? null;
  const { toast } = useToast();
  const id = useId();
  const [turn, setTurn] = useState<CampaignTurn | null>(null);
  const [actions, setActions] = useState<TurnAction[]>([]);
  const [choice, setChoice] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true);
  const [physicalDice, setPhysicalDice] = useState(false);
  const [manual, setManual] = useState('');

  const reload = useCallback(async () => {
    if (!campaignId) return;
    try {
      const client = getSupabaseBrowserClient();
      const [nextTurn, nextActions, inProgress] = await Promise.all([
        getCampaignTurn(client, campaignId),
        listTurnActions(client, campaignId, 60),
        getSessionState(client, campaignId),
      ]);
      setTurn(nextTurn);
      setActions(nextActions);
      setPlaying(inProgress.playing);
      setPhysicalDice(inProgress.physicalDice);
    } catch (error) {
      console.error('[codexveil] falha ao carregar o turno', error);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    const client = getSupabaseBrowserClient();
    Promise.all([getCampaignTurn(client, campaignId), listTurnActions(client, campaignId, 60), getSessionState(client, campaignId)])
      .then(([nextTurn, nextActions, inProgress]) => {
        if (!active) return;
        setTurn(nextTurn);
        setActions(nextActions);
        setPlaying(inProgress.playing);
        setPhysicalDice(inProgress.physicalDice);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  const live = useRealtimeRefresh(
    `turno-ficha:${campaignId ?? 'nenhuma'}`,
    [
      { table: 'campaign_turns', filter: `campaign_id=eq.${campaignId ?? ''}` },
      { table: 'turn_actions', filter: `campaign_id=eq.${campaignId ?? ''}` },
    ],
    () => void reload(),
    Boolean(campaignId),
  );

  const options = useMemo<Option[]>(() => {
    const list: Option[] = [];
    for (const ability of abilities) {
      if (ability.kind === 'attack') {
        if (!isAttackAvailable(ability.name, items)) continue;
        const data = parseAttack(ability.data);
        list.push({ key: ability.id, label: `Atacar: ${ability.name}`, kind: 'action', grantsAction: false, roll: d20Expression(attackRollBonus(data, derived)), ability });
      } else if (ability.kind === 'spell') {
        const parsed = dnd5eSpellDataSchema.safeParse(ability.data ?? {});
        const cost = spellTurnCost(parsed.success ? parsed.data.castingTime : '');
        list.push({
          key: ability.id,
          label: `Magia: ${spellNamePt(ability.name)}`,
          kind: cost.kind,
          grantsAction: false,
          roll: derived.spellcasting ? d20Expression(derived.spellcasting.attackBonus) : null,
          ability,
        });
      } else {
        const cost = featureTurnCost(ability.name);
        if (cost) list.push({ key: ability.id, label: ability.name, kind: cost.kind, grantsAction: cost.grantsAction, roll: null, ability });
      }
    }
    for (const key of DND5E_ACTIONS) {
      if (key === 'attack' || key === 'magic') continue;
      list.push({ key: `acao:${key}`, label: dnd5eActions[key].label, kind: 'action', grantsAction: false, roll: null, ability: null });
    }
    return list;
  }, [abilities, items, derived]);

  if (!campaignId || !turn || character.campaign?.status !== 'active') return null;

  const me = turn.order.find((entry) => entry.characterId === character.id) ?? null;
  const mine = me !== null && turn.activeCharacterId === character.id && turn.status === 'active';
  const roundActions = me ? actions.filter((action) => action.combatantId === me.id && action.round === turn.round && action.encounterId === turn.encounterId) : [];
  const budget = turnBudget(roundActions);
  const targets = turn.order.filter((entry) => entry.id !== me?.id && !entry.defeated);
  const selected = options.find((option) => option.key === choice) ?? null;
  const incoming = actions.filter(
    (action) => action.targetCharacterId === character.id && action.encounterId === turn.encounterId && action.round >= turn.round - 1 && !dismissed.includes(action.id),
  );
  // Jogadores só agem com a sessão iniciada pelo mestre (o banco também recusa).
  const canAct = permissions.canEditPlay && me !== null && (playing || permissions.isGm);

  const act = async (option: Option, kind: TurnActionKind = option.kind) => {
    if (!me) return;
    setBusy(true);
    try {
      const done = await performTurnAction(getSupabaseBrowserClient(), {
        combatantId: me.id,
        kind,
        label: option.label,
        targetCombatantId: kind === 'movement' || !target ? null : target,
        grantsAction: option.grantsAction,
        // Dados presenciais: o app não rola; o jogador pode anotar o resultado do dado físico.
        rollExpression: physicalDice ? null : option.roll,
        manualTotal: physicalDice && manual.trim() !== '' && Number.isInteger(Number(manual)) ? Number(manual) : null,
      });
      // Habilidades com usos gastam 1 uso ao serem usadas.
      const resource = option.ability?.resourceId ? resources.find((entry) => entry.id === option.ability?.resourceId) : undefined;
      if (resource && resource.current > 0) {
        const updated = await adjustCharacterResource(getSupabaseBrowserClient(), resource.id, 'spend', 1);
        setResources((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      }
      toast({
        tone: 'success',
        title: `${turnActionKindLabels[kind]}: ${done.label}${done.targetName ? ` → ${done.targetName}` : ''}`,
        description: done.rollTotal !== null ? `Resultado: ${done.rollTotal}` : undefined,
      });
      setChoice('');
      setManual('');
      await reload();
    } catch (error) {
      toast({ tone: 'danger', title: 'A ação não foi registrada', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      await endTurn(client, turn.encounterId);
      // Fim do turno: as condições do personagem perdem 1 rodada.
      if (conditions.some((condition) => condition.roundsRemaining !== null)) {
        const ended = await tickCharacterConditions(client, character.id);
        const remaining = conditions.map((condition) => condition.key).filter((key) => !ended.includes(key));
        for (const next of dnd5eConditionsLeftAfter(ended, remaining)) await applyCharacterCondition(client, character.id, next);
        if (ended.length > 0) toast({ tone: 'info', title: `Terminou: ${ended.map((key) => findDnd5eCondition(key)?.label ?? key).join(', ')}.` });
        await reloadConditions();
      }
      toast({ tone: 'success', title: 'Turno encerrado.' });
      await reload();
    } catch (error) {
      toast({ tone: 'danger', title: 'O turno não foi encerrado', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  const reactions = options.filter((option) => option.kind === 'reaction');

  return (
    <Card ornate className={cx(mine && 'border-parchment-300/70')}>
      <CardHeader
        icon={<Hourglass className="h-5 w-5" aria-hidden="true" />}
        title={`${turnModeLabels[turn.mode]}${turn.status === 'active' ? ` · rodada ${turn.round}` : ''}`}
        description={turn.status === 'active' ? (mine ? 'É a sua vez!' : turn.activeName ? `Vez de ${turn.activeName}` : 'Vez do mestre') : 'O mestre está preparando a ordem.'}
        action={<LiveBadge status={live} />}
      />

      {!playing && !permissions.isGm ? (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-400/40 bg-warning-bg px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">A sessão ainda não começou: as ações e rolagens da mesa ficam liberadas quando o mestre iniciar.</span>
          <Button size="sm" variant="ghost" onClick={() => void reload()}>
            Verificar de novo
          </Button>
        </div>
      ) : null}

      {incoming.slice(0, 2).map((action) => (
        <div key={action.id} role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-ember-400/50 bg-danger-bg px-3 py-2 text-sm">
          <ShieldAlert className="h-4 w-4 text-ember-300" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <strong>{action.actorName}</strong> mirou você: {action.label}
            {action.rollTotal !== null ? ` (resultado ${action.rollTotal})` : ''}.
          </span>
          {canAct && budget.reaction > 0 && turn.status === 'active'
            ? [...reactions, { key: 'reacao', label: 'Reação', kind: 'reaction' as const, grantsAction: false, roll: null, ability: null }].map((option) => (
                <Button key={option.key} size="sm" variant="secondary" disabled={busy} onClick={() => void act(option, 'reaction')}>
                  {option.key === 'reacao' ? 'Usar reação' : option.label}
                </Button>
              ))
            : null}
          <Button size="sm" variant="ghost" onClick={() => setDismissed((current) => [...current, action.id])}>
            Ok
          </Button>
        </div>
      ))}

      {turn.order.length > 0 ? (
        <ol className="mb-3 flex flex-wrap gap-1.5" aria-label="Ordem dos turnos">
          {turn.order.map((entry, index) => (
            <li
              key={entry.id}
              className={cx(
                'rounded-full border px-2.5 py-1 text-xs',
                entry.current ? 'border-parchment-300/70 bg-wine-900/60 text-fg-accent' : 'border-line text-fg-secondary',
                entry.defeated && 'line-through opacity-60',
              )}
            >
              {index + 1}. {entry.name}
            </li>
          ))}
        </ol>
      ) : null}

      {mine && canAct ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" aria-label="O que ainda resta no turno">
            {(['action', 'bonus_action', 'movement', 'reaction'] as const).map((kind) => (
              <Badge key={kind} tone={budget[kind] > 0 ? 'success' : 'neutral'}>
                {turnActionKindLabels[kind]}: {budget[kind] > 0 ? (kind === 'action' && budget.action > 1 ? `${budget.action} disponíveis` : 'disponível') : 'usada'}
              </Badge>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-acao`} className="text-sm font-medium">
                O que fazer
              </label>
              <Select id={`${id}-acao`} value={choice} onChange={(event) => setChoice(event.target.value)} placeholder="Escolha…">
                <option value="">Escolha…</option>
                {options
                  .filter((option) => option.kind !== 'reaction')
                  .map((option) => (
                    <option key={option.key} value={option.key} disabled={option.kind !== 'free' && budget[option.kind as 'action' | 'bonus_action' | 'movement'] === 0}>
                      {option.label} ({turnActionKindLabels[option.kind]})
                    </option>
                  ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-alvo`} className="text-sm font-medium">
                Alvo
              </label>
              <Select id={`${id}-alvo`} value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Sem alvo</option>
                {targets.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {physicalDice ? (
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <label htmlFor={`${id}-dado`} className="text-sm font-medium">
                Resultado do dado físico (opcional)
              </label>
              <input
                id={`${id}-dado`}
                inputMode="numeric"
                value={manual}
                onChange={(event) => setManual(event.target.value.replace(/[^0-9-]/g, '').slice(0, 5))}
                placeholder="Ex.: 17"
                className="h-10 rounded-md border border-line bg-sunken px-3 text-sm text-fg placeholder:text-fg-muted"
              />
              <p className="text-xs text-fg-muted">Sessão com dados presenciais: role na mesa e anote o total, se quiser que fique no mural.</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button loading={busy} disabled={!selected} icon={<Swords className="h-4 w-4" aria-hidden="true" />} onClick={() => selected && void act(selected)}>
              {selected?.roll && !physicalDice ? 'Fazer e rolar' : 'Fazer'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || budget.movement === 0}
              icon={<Footprints className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void act({ key: 'movimento', label: 'Movimento', kind: 'movement', grantsAction: false, roll: null, ability: null })}
            >
              Ação de movimento
            </Button>
            <Button variant="ghost" loading={busy} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={() => void finish()}>
              Encerrar turno
            </Button>
          </div>
          <p className="text-xs text-fg-muted">
            Não há tempo limite: encerre quando terminar o roleplay. Fúria gasta a ação bônus; Surto de Ação libera mais uma ação. Tudo
            fica registrado no mural da mesa.
          </p>
        </div>
      ) : null}

      {roundActions.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-fg-secondary" aria-label="Suas ações nesta rodada">
          {[...roundActions].reverse().map((action) => (
            <li key={action.id}>
              {turnActionKindLabels[action.kind]}: {action.label}
              {action.targetName ? ` → ${action.targetName}` : ''}
              {action.rollTotal !== null ? ` (${action.rollTotal})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
