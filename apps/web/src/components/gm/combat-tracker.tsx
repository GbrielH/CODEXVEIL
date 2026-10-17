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
  updateSceneEntity,
  type EncounterCombatant,
} from '@codexveil/database';
import { advanceTurn, orderCombatants, rewindTurn, startCombat, type Combatant } from '@codexveil/domain';
import { conditionLabel, conditionsLeftAfter, findSystem } from '@codexveil/rpg-systems';
import { ChevronLeft, ChevronRight, Flag, Play, Plus, Swords, X } from 'lucide-react';
import { useState } from 'react';
import { HealthBar } from '@/components/characters/health-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NumberInput } from '@/components/ui/number-input';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { GmTableContext } from './gm-table';

interface RosterEntry extends Combatant {
  source: EncounterCombatant;
  kind: 'character' | 'npc' | 'monster';
  hp: { current: number | null; max: number | null; temp: number } | null;
  armorClass: number | null;
  /** Condições com as rodadas restantes (`null` = até ser removida). */
  conditions: { key: string; label: string; rounds: number | null }[];
}

/** Ordem de iniciativa e controle de turnos (estrutura inicial, expansível). */
export function CombatTracker({ context }: { context: GmTableContext }) {
  const { encounter, entities, party, canManage, fail, reload, session, campaignId, systemId } = context;
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const system = findSystem(systemId);

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
  const ordered = orderCombatants(roster);

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
    run('O combate não foi criado', async () => {
      const client = getSupabaseBrowserClient();
      const encounterId = await createEncounter(client, { sessionId: session.id, campaignId, name: `Combate — sessão ${session.number}` });
      await addCombatants(client, encounterId, campaignId, [
        ...entities.map((entity) => ({ sessionEntityId: entity.id, initiative: null, tiebreaker: entity.initiativeBonus })),
        ...party.map((character) => ({ characterId: character.id, initiative: null, tiebreaker: characterTiebreaker(character.id) })),
      ]);
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

  const nextTurn = () =>
    run('O turno não foi alterado', async () => {
      if (!encounter) return;
      const ending = ordered.find((entry) => entry.id === encounter.activeCombatantId);
      await saveEncounterTurn(getSupabaseBrowserClient(), encounter.id, encounter.version, {
        status: 'active',
        ...advanceTurn(ordered, { round: encounter.round, activeCombatantId: encounter.activeCombatantId }),
      });
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

  const missingEntities = entities.filter((entity) => !encounter?.combatants.some((combatant) => combatant.sessionEntityId === entity.id));
  const missingCharacters = party.filter((character) => !encounter?.combatants.some((combatant) => combatant.characterId === character.id));

  if (!encounter) {
    return (
      <Card ornate>
        <CardHeader icon={<Swords className="h-5 w-5" aria-hidden="true" />} title="Combate" description="Nenhum combate em andamento nesta sessão." />
        {canManage ? (
          <Button onClick={() => void begin()} loading={busy} icon={<Swords className="h-4 w-4" aria-hidden="true" />} disabled={entities.length === 0 && party.length === 0}>
            Preparar combate
          </Button>
        ) : null}
        <p className="mt-2 text-xs text-fg-muted">O grupo e todas as entidades da cena entram na ordem de iniciativa. Informe os valores rolados na mesa.</p>
      </Card>
    );
  }

  const active = encounter.status === 'active';
  const activeIndex = ordered.findIndex((entry) => entry.id === encounter.activeCombatantId);

  return (
    <Card ornate className={cx(active && 'border-wine-400/50')}>
      <CardHeader
        icon={<Swords className="h-5 w-5" aria-hidden="true" />}
        title={encounter.name}
        description={active ? `Rodada ${encounter.round}` : 'Informe a iniciativa de cada combatente e comece.'}
        action={<Badge tone={active ? 'brand' : 'parchment'}>{encounterStatusLabels[encounter.status]}</Badge>}
      />

      {canManage ? (
        <div className="mb-4 flex flex-wrap gap-2">
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
                Próximo turno
              </Button>
            </>
          ) : (
            <Button loading={busy} disabled={ordered.length === 0} onClick={() => void saveTurn('O combate não começou', { status: 'active', ...startCombat(ordered) })} icon={<Play className="h-4 w-4" aria-hidden="true" />}>
              Começar combate
            </Button>
          )}
          <ConfirmDialog
            trigger={(open) => (
              <Button variant="ghost" onClick={open} icon={<Flag className="h-4 w-4" aria-hidden="true" />}>
                Encerrar
              </Button>
            )}
            title="Encerrar o combate?"
            description="A ordem de iniciativa é arquivada. Vida e condições continuam como estão; as durações restantes passam a contar pelo botão “Passar rodada” da ficha."
            confirmLabel="Encerrar combate"
            tone="primary"
            onConfirm={async () => {
              await saveTurn('O combate não foi encerrado', { status: 'ended', round: encounter.round, activeCombatantId: null });
            }}
          />
        </div>
      ) : null}

      <ol className="flex flex-col gap-1.5" aria-label="Ordem de iniciativa">
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
                {canManage ? (
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
                </p>
                <p className="text-xs text-fg-muted">
                  {entry.kind === 'character' ? 'Personagem' : entry.kind === 'npc' ? 'NPC' : 'Monstro'}
                  {entry.armorClass !== null ? ` · CA ${entry.armorClass}` : ''}
                  {` · desempate ${entry.tiebreaker >= 0 ? '+' : '−'}${Math.abs(entry.tiebreaker)}`}
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
                  <label className="flex items-center gap-1 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={entry.isDefeated}
                      onChange={(event) => void run('Alteração não salva', () => updateCombatant(getSupabaseBrowserClient(), entry.id, { isDefeated: event.target.checked }))}
                      className="h-4 w-4 accent-wine-500"
                    />
                    Fora
                  </label>
                  <Button size="icon" variant="ghost" aria-label={`Tirar ${entry.name} do combate`} onClick={() => void run('O combatente não foi removido', () => removeCombatant(getSupabaseBrowserClient(), entry.id))}>
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
          <span className="text-xs text-fg-muted">Fora da iniciativa:</span>
          {missingCharacters.map((character) => (
            <Button
              key={character.id}
              size="sm"
              variant="ghost"
              icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => void run('Não foi possível adicionar', () => addCombatants(getSupabaseBrowserClient(), encounter.id, campaignId, [{ characterId: character.id, initiative: null, tiebreaker: characterTiebreaker(character.id) }]))}
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
              onClick={() => void run('Não foi possível adicionar', () => addCombatants(getSupabaseBrowserClient(), encounter.id, campaignId, [{ sessionEntityId: entity.id, initiative: null, tiebreaker: entity.initiativeBonus }]))}
            >
              {entity.name}
            </Button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
