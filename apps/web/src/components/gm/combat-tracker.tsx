'use client';

import {
  addCombatants,
  applyCharacterCondition,
  createEncounter,
  encounterStatusLabels,
  removeCombatant,
  saveEncounterTurn,
  tickCharacterConditions,
  tickSceneEntityConditions,
  updateCombatant,
  updateEncounterSettings,
  updateSceneEntity,
  type EncounterCombatant,
} from '@codexveil/database';
import {
  TURN_MODES,
  advanceTurn,
  moveInTurnOrder,
  orderTurns,
  rewindTurn,
  startCombat,
  turnModeLabels,
  turnOrderModeLabels,
  type Combatant,
  type TurnEconomy,
  type TurnMode,
  type TurnOrderMode,
} from '@codexveil/domain';
import { conditionLabel, conditionsLeftAfter, findSystem } from '@codexveil/rpg-systems';
import { dnd5eActions, dnd5eTurnGuides } from '@codexveil/rpg-systems/dnd5e';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Play, Plus, Swords, X } from 'lucide-react';
import { useId, useState } from 'react';
import { HealthBar } from '@/components/characters/health-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { GmTableContext } from './gm-table';
import { GmTurnActions } from './turn-actions';

interface RosterEntry extends Combatant {
  source: EncounterCombatant;
  sortOrder: number;
  kind: 'character' | 'npc' | 'monster';
  hp: { current: number | null; max: number | null; temp: number } | null;
  armorClass: number | null;
  /** Condições com as rodadas restantes (`null` = até ser removida). */
  conditions: { key: string; label: string; rounds: number | null }[];
}

const EMPTY_ECONOMY: TurnEconomy = { action: false, bonusAction: false, reaction: false, movement: false };

/** Ações de D&D mais comuns no modo atual (referência rápida para a mesa). */
function TurnGuide({ mode }: { mode: TurnMode }) {
  const guide = dnd5eTurnGuides[mode];
  return (
    <details className="mt-4 rounded-md border border-line bg-sunken/50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-fg-secondary">Regras do turno · {turnModeLabels[mode]}</summary>
      <p className="mt-2 text-fg-secondary">{guide.intro}</p>
      <ul className="mt-2 list-disc pl-5 text-fg-secondary">
        {guide.economy.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <dl className="mt-3 grid gap-x-3 gap-y-1.5 sm:grid-cols-[8rem_1fr]">
        {guide.actions.map((key) => (
          <div key={key} className="contents">
            <dt className="font-medium text-fg">{dnd5eActions[key].label}</dt>
            <dd className="text-fg-secondary">{dnd5eActions[key].summary}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-fg-muted">Resumo das regras do SRD 5.2.1.</p>
    </details>
  );
}

/**
 * Turnos da sessão: combate, exploração, investigação ou interação social. A ordem segue a
 * iniciativa ou a ordem definida pelo mestre; os jogadores veem de quem é a vez (sem os
 * participantes ocultos), ao vivo.
 */
export function CombatTracker({ context }: { context: GmTableContext }) {
  const { encounter, entities, party, canManage, fail, reload, session, campaignId, systemId, turnSettings } = context;
  const [busy, setBusy] = useState(false);
  const [newMode, setNewMode] = useState<TurnMode>(turnSettings.defaultMode);
  const { toast } = useToast();
  const id = useId();
  const system = findSystem(systemId);
  const isDnd = systemId === 'dnd5e';

  const characterTiebreaker = (characterId: string): number => {
    const character = party.find((entry) => entry.id === characterId);
    if (!character || !system) return 0;
    try {
      return system.initiativeBonus(system.parseSheet(character.sheet));
    } catch {
      return 0;
    }
  };

  const roster: RosterEntry[] = (encounter?.combatants ?? [])
    .map((combatant): RosterEntry | null => {
      if (combatant.sessionEntityId) {
        const entity = entities.find((entry) => entry.id === combatant.sessionEntityId);
        if (!entity) return null;
        return {
          id: combatant.id,
          name: entity.name,
          initiative: combatant.initiative,
          tiebreaker: combatant.tiebreaker,
          isDefeated: combatant.isDefeated,
          sortOrder: combatant.sortOrder,
          source: combatant,
          kind: entity.kind,
          hp: entity.hpMax === null && entity.hpCurrent === null ? null : { current: entity.hpCurrent, max: entity.hpMax, temp: entity.hpTemp },
          armorClass: entity.armorClass,
          conditions: entity.conditions.map((key) => ({ key, label: conditionLabel(systemId, key), rounds: entity.conditionRounds[key] ?? null })),
        };
      }
      const character = party.find((entry) => entry.id === combatant.characterId);
      if (!character) return null;
      const hp = character.resources.find((resource) => resource.display === 'health');
      return {
        id: combatant.id,
        name: character.name,
        initiative: combatant.initiative,
        tiebreaker: combatant.tiebreaker,
        isDefeated: combatant.isDefeated,
        sortOrder: combatant.sortOrder,
        source: combatant,
        kind: 'character',
        hp: hp ? { current: hp.current, max: hp.max, temp: hp.temp } : null,
        armorClass: null,
        conditions: character.conditions.map((condition) => ({
          key: condition.key,
          label: conditionLabel(systemId, condition.key, condition.level),
          rounds: condition.roundsRemaining,
        })),
      };
    })
    .filter((entry): entry is RosterEntry => entry !== null);
  const orderMode: TurnOrderMode = encounter?.orderMode ?? 'initiative';
  const ordered = orderTurns(roster, orderMode);

  const run = async (title: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (error) {
      fail(title, error);
    } finally {
      setBusy(false);
    }
  };

  const begin = () =>
    run('Os turnos não foram preparados', async () => {
      const client = getSupabaseBrowserClient();
      const encounterId = await createEncounter(client, {
        sessionId: session.id,
        campaignId,
        name: `${turnModeLabels[newMode]} — sessão ${session.number}`,
        mode: newMode,
        orderMode: turnSettings.defaultOrder,
      });
      const combatants = [
        ...party.map((character) => ({ characterId: character.id, initiative: null, tiebreaker: characterTiebreaker(character.id) })),
        // NPCs e monstros só entram no combate; nos outros modos o mestre os adiciona se quiser.
        ...(newMode === 'combat' ? entities.map((entity) => ({ sessionEntityId: entity.id, initiative: null, tiebreaker: entity.initiativeBonus })) : []),
      ];
      await addCombatants(
        client,
        encounterId,
        campaignId,
        combatants.map((combatant, index) => ({ ...combatant, sortOrder: (index + 1) * 10 })),
      );
    });

  const saveTurn = (title: string, state: { status: 'preparing' | 'active' | 'ended'; round: number; activeCombatantId: string | null }) =>
    run(title, async () => {
      if (!encounter) return;
      await saveEncounterTurn(getSupabaseBrowserClient(), encounter.id, encounter.version, state);
    });

  /**
   * Fim do turno de um combatente: as condições dele perdem 1 rodada e as que chegam a zero
   * terminam (com as que continuam depois, como Caído após Inconsciente).
   */
  const tickConditions = async (entry: RosterEntry): Promise<string[]> => {
    const client = getSupabaseBrowserClient();
    const characterId = entry.source.characterId;
    if (characterId) {
      const ended = await tickCharacterConditions(client, characterId);
      const remaining = entry.conditions.map((condition) => condition.key).filter((key) => !ended.includes(key));
      for (const next of conditionsLeftAfter(systemId, ended, remaining)) await applyCharacterCondition(client, characterId, next);
      return ended;
    }
    const entityId = entry.source.sessionEntityId;
    if (entityId) {
      const ended = await tickSceneEntityConditions(client, entityId);
      const remaining = entry.conditions.map((condition) => condition.key).filter((key) => !ended.includes(key));
      const left = conditionsLeftAfter(systemId, ended, remaining);
      if (left.length > 0) await updateSceneEntity(client, entityId, { conditions: [...remaining, ...left] });
      return ended;
    }
    return [];
  };

  /** No início do turno, o participante recupera ação, ação bônus, movimento e reação. */
  const resetEconomy = async (combatantId: string | null) => {
    const next = roster.find((entry) => entry.id === combatantId);
    if (!next || !Object.values(next.source.turnState).some(Boolean)) return;
    await updateCombatant(getSupabaseBrowserClient(), next.id, { turnState: EMPTY_ECONOMY });
  };

  const nextTurn = () =>
    run('O turno não foi alterado', async () => {
      if (!encounter) return;
      const ending = ordered.find((entry) => entry.id === encounter.activeCombatantId);
      const next = advanceTurn(ordered, { round: encounter.round, activeCombatantId: encounter.activeCombatantId });
      await saveEncounterTurn(getSupabaseBrowserClient(), encounter.id, encounter.version, { status: 'active', ...next });
      await resetEconomy(next.activeCombatantId);
      if (!ending || !ending.conditions.some((condition) => condition.rounds !== null)) return;
      try {
        const ended = await tickConditions(ending);
        if (ended.length > 0) {
          toast({ tone: 'info', title: `${ending.name}: terminou ${ended.map((key) => conditionLabel(systemId, key)).join(', ')}.` });
        }
      } catch (error) {
        fail(`${ending.name}: o turno passou, mas a duração das condições não foi atualizada`, error);
      }
    });

  const changeOrderMode = (mode: TurnOrderMode) =>
    run('A ordem não foi alterada', async () => {
      if (!encounter) return;
      const client = getSupabaseBrowserClient();
      if (mode === 'manual') {
        // A ordem manual começa igual à ordem atual da iniciativa.
        const current = orderTurns(roster, 'initiative');
        for (const [index, entry] of current.entries()) {
          if (entry.sortOrder !== (index + 1) * 10) await updateCombatant(client, entry.id, { sortOrder: (index + 1) * 10 });
        }
      }
      await updateEncounterSettings(client, encounter.id, { orderMode: mode });
    });

  const move = (entry: RosterEntry, direction: -1 | 1) =>
    run('A ordem não foi alterada', async () => {
      const client = getSupabaseBrowserClient();
      for (const change of moveInTurnOrder(ordered, entry.id, direction)) {
        const current = ordered.find((item) => item.id === change.id);
        if (current && current.sortOrder !== change.sortOrder) await updateCombatant(client, change.id, { sortOrder: change.sortOrder });
      }
    });

  const missingEntities = entities.filter((entity) => !encounter?.combatants.some((combatant) => combatant.sessionEntityId === entity.id));
  const missingCharacters = party.filter((character) => !encounter?.combatants.some((combatant) => combatant.characterId === character.id));
  const nextSortOrder = Math.max(0, ...roster.map((entry) => entry.sortOrder)) + 10;

  if (!encounter) {
    return (
      <Card ornate>
        <CardHeader icon={<Swords className="h-5 w-5" aria-hidden="true" />} title="Turnos" description="Nenhum turno em andamento nesta sessão." />
        {canManage ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex w-56 flex-col gap-1.5">
              <label htmlFor={`${id}-mode`} className="text-sm font-medium">
                Modo
              </label>
              <Select id={`${id}-mode`} value={newMode} onChange={(event) => setNewMode(event.target.value as TurnMode)}>
                {TURN_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {turnModeLabels[mode]}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={() => void begin()} loading={busy} icon={<Swords className="h-4 w-4" aria-hidden="true" />} disabled={entities.length === 0 && party.length === 0}>
              Preparar turnos
            </Button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-fg-muted">
          O grupo entra na ordem; no combate, as criaturas da cena também. Ordem padrão: {turnOrderModeLabels[turnSettings.defaultOrder].toLowerCase()} (mude
          nas configurações da campanha).
        </p>
        {isDnd ? <TurnGuide mode={newMode} /> : null}
      </Card>
    );
  }

  const active = encounter.status === 'active';
  const activeIndex = ordered.findIndex((entry) => entry.id === encounter.activeCombatantId);
  const activeEntry = active ? ordered[activeIndex] : undefined;

  return (
    <Card ornate className={cx(active && 'border-wine-400/50')}>
      <CardHeader
        icon={<Swords className="h-5 w-5" aria-hidden="true" />}
        title={encounter.name}
        description={
          active
            ? `${turnModeLabels[encounter.mode]} · rodada ${encounter.round}`
            : orderMode === 'initiative'
              ? 'Informe a iniciativa de cada participante e comece.'
              : 'Ajuste a ordem com as setas e comece.'
        }
        action={<Badge tone={active ? 'brand' : 'parchment'}>{encounterStatusLabels[encounter.status]}</Badge>}
      />

      {canManage ? (
        <div className="mb-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-encounter-mode`} className="text-xs font-medium text-fg-secondary">
                Modo
              </label>
              <Select
                id={`${id}-encounter-mode`}
                size="sm"
                value={encounter.mode}
                onChange={(event) => void run('O modo não foi alterado', () => updateEncounterSettings(getSupabaseBrowserClient(), encounter.id, { mode: event.target.value as TurnMode }))}
              >
                {TURN_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {turnModeLabels[mode]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-order-mode`} className="text-xs font-medium text-fg-secondary">
                Ordem dos turnos
              </label>
              <Select id={`${id}-order-mode`} size="sm" value={orderMode} onChange={(event) => void changeOrderMode(event.target.value as TurnOrderMode)}>
                <option value="initiative">{turnOrderModeLabels.initiative}</option>
                <option value="manual">{turnOrderModeLabels.manual}</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {active ? (
              <>
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => void saveTurn('O turno não foi alterado', { status: 'active', ...rewindTurn(ordered, { round: encounter.round, activeCombatantId: encounter.activeCombatantId }) })}
                  icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
                >
                  Anterior
                </Button>
                <Button loading={busy} onClick={() => void nextTurn()} icon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}>
                  Passar o turno
                </Button>
              </>
            ) : (
              <Button
                loading={busy}
                disabled={ordered.length === 0}
                onClick={() =>
                  void run('Os turnos não começaram', async () => {
                    const start = startCombat(ordered);
                    await saveEncounterTurn(getSupabaseBrowserClient(), encounter.id, encounter.version, { status: 'active', ...start });
                    await resetEconomy(start.activeCombatantId);
                  })
                }
                icon={<Play className="h-4 w-4" aria-hidden="true" />}
              >
                {encounter.mode === 'combat' ? 'Começar combate' : 'Começar turnos'}
              </Button>
            )}
            <ConfirmDialog
              trigger={(open) => (
                <Button variant="ghost" onClick={open} icon={<Flag className="h-4 w-4" aria-hidden="true" />}>
                  Encerrar
                </Button>
              )}
              title="Encerrar os turnos?"
              description="A ordem é arquivada e some da tela dos jogadores. Vida e condições continuam como estão; as durações restantes passam a contar pelo botão “Passar rodada” da ficha."
              confirmLabel="Encerrar"
              tone="primary"
              onConfirm={async () => {
                await saveTurn('Os turnos não foram encerrados', { status: 'ended', round: encounter.round, activeCombatantId: null });
              }}
            />
          </div>
        </div>
      ) : null}

      {activeEntry && canManage ? (
        <GmTurnActions
          campaignId={campaignId}
          encounterId={encounter.id}
          round={encounter.round}
          actor={{ id: activeEntry.id, name: activeEntry.name }}
          targets={ordered.filter((entry) => entry.id !== activeEntry.id && !entry.isDefeated).map((entry) => ({ id: entry.id, name: entry.name }))}
        />
      ) : null}

      <ol className="flex flex-col gap-1.5" aria-label="Ordem dos turnos">
        {ordered.map((entry, index) => {
          const isTurn = active && index === activeIndex;
          return (
            <li
              key={entry.id}
              aria-current={isTurn ? 'step' : undefined}
              className={cx(
                'flex items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                isTurn ? 'border-parchment-300/70 bg-wine-900/60' : 'border-line bg-raised',
                entry.isDefeated && 'opacity-55',
              )}
            >
              <div className="w-16 shrink-0">
                {orderMode === 'manual' ? (
                  canManage ? (
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0 || busy} aria-label={`Subir ${entry.name}`} onClick={() => void move(entry, -1)}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={index === ordered.length - 1 || busy}
                        aria-label={`Descer ${entry.name}`}
                        onClick={() => void move(entry, 1)}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : (
                    <span className="tabular font-display text-lg">{index + 1}º</span>
                  )
                ) : canManage ? (
                  <NumberInput
                    aria-label={`Iniciativa de ${entry.name}`}
                    value={entry.initiative}
                    min={-50}
                    max={100}
                    allowEmpty
                    onCommit={(value) => void run('Iniciativa não salva', () => updateCombatant(getSupabaseBrowserClient(), entry.id, { initiative: value }))}
                    className="h-9 text-base"
                  />
                ) : (
                  <span className="tabular font-display text-lg">{entry.initiative ?? '—'}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-sm font-medium', isTurn ? 'text-fg-accent' : 'text-fg', entry.isDefeated && 'line-through')}>
                  {isTurn ? <span className="sr-only">Turno atual: </span> : null}
                  {entry.name}
                  {entry.source.isHidden ? <span className="ml-2 text-xs font-normal text-amber-300">(oculto dos jogadores)</span> : null}
                </p>
                <p className="text-xs text-fg-muted">
                  {entry.kind === 'character' ? 'Personagem' : entry.kind === 'npc' ? 'NPC' : 'Monstro'}
                  {entry.armorClass !== null ? ` · CA ${entry.armorClass}` : ''}
                  {orderMode === 'initiative' ? ` · desempate ${entry.tiebreaker >= 0 ? '+' : '−'}${Math.abs(entry.tiebreaker)}` : ''}
                </p>
                {entry.conditions.length > 0 ? (
                  <p className="text-xs text-amber-300">
                    {entry.conditions.map((condition) => (condition.rounds === null ? condition.label : `${condition.label} (${condition.rounds} rod.)`)).join(' · ')}
                  </p>
                ) : null}
                {entry.hp ? <HealthBar current={entry.hp.current} max={entry.hp.max} temp={entry.hp.temp} showValues={false} className="mt-1" /> : null}
              </div>
              {canManage ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={entry.source.isHidden ? `Mostrar ${entry.name} aos jogadores` : `Ocultar ${entry.name} dos jogadores`}
                    title={entry.source.isHidden ? 'Mostrar aos jogadores' : 'Ocultar dos jogadores'}
                    onClick={() => void run('Alteração não salva', () => updateCombatant(getSupabaseBrowserClient(), entry.id, { isHidden: !entry.source.isHidden }))}
                  >
                    {entry.source.isHidden ? <EyeOff className="h-4 w-4 text-amber-300" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                  <label className="flex items-center gap-1 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={entry.isDefeated}
                      onChange={(event) => void run('Alteração não salva', () => updateCombatant(getSupabaseBrowserClient(), entry.id, { isDefeated: event.target.checked }))}
                      className="h-4 w-4 accent-wine-500"
                    />
                    Fora
                  </label>
                  <Button size="icon" variant="ghost" aria-label={`Tirar ${entry.name} dos turnos`} onClick={() => void run('O participante não foi removido', () => removeCombatant(getSupabaseBrowserClient(), entry.id))}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {canManage && (missingEntities.length > 0 || missingCharacters.length > 0) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-fg-muted">Fora da ordem:</span>
          {missingCharacters.map((character) => (
            <Button
              key={character.id}
              size="sm"
              variant="ghost"
              icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() =>
                void run('Não foi possível adicionar', () =>
                  addCombatants(getSupabaseBrowserClient(), encounter.id, campaignId, [
                    { characterId: character.id, initiative: null, tiebreaker: characterTiebreaker(character.id), sortOrder: nextSortOrder },
                  ]),
                )
              }
            >
              {character.name}
            </Button>
          ))}
          {missingEntities.map((entity) => (
            <Button
              key={entity.id}
              size="sm"
              variant="ghost"
              icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() =>
                void run('Não foi possível adicionar', () =>
                  addCombatants(getSupabaseBrowserClient(), encounter.id, campaignId, [
                    { sessionEntityId: entity.id, initiative: null, tiebreaker: entity.initiativeBonus, sortOrder: nextSortOrder },
                  ]),
                )
              }
            >
              {entity.name}
            </Button>
          ))}
        </div>
      ) : null}

      {isDnd ? <TurnGuide mode={encounter.mode} /> : null}
    </Card>
  );
}
