'use client';

import {
  adjustCharacterResource,
  applyCharacterCondition,
  removeCharacterCondition,
  type PartyCharacter,
} from '@codexveil/database';
import { applyTrackOperation } from '@codexveil/domain';
import {
  conditionLabel,
  conditionsLeftAfter,
  findSystem,
  summarizeSheet,
} from '@codexveil/rpg-systems';
import { Users } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { ColoredName } from '@/components/dice/campaign-colors';
import { HealthBar } from '@/components/characters/health-bar';
import { Portrait } from '@/components/characters/portrait';
import { Card, CardHeader } from '@/components/ui/card';
import { characterPath } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ConditionApplier, ConditionChip } from './condition-applier';
import type { GmTableContext } from './gm-table';
import { HpQuickAdjust } from './hp-quick-adjust';

/** Estado resumido do grupo, com dano/cura e condições aplicáveis pelo mestre. */
export function PartyStatus({
  context,
  portraits,
  currentUserId,
}: {
  context: GmTableContext;
  portraits: Record<string, string>;
  currentUserId: string;
}) {
  const { party, setParty, fail, reload, canManage, systemId } = context;
  const conditions = findSystem(systemId)?.conditions ?? [];

  const adjustHp = async (
    character: PartyCharacter,
    operation: 'damage' | 'heal',
    amount: number,
  ) => {
    const hp = character.resources.find((resource) => resource.display === 'health');
    if (!hp) return;
    // Retorno imediato; o valor definitivo vem do banco (operação atômica).
    setParty((current) =>
      current.map((entry) =>
        entry.id === character.id
          ? {
              ...entry,
              resources: entry.resources.map((resource) =>
                resource.id === hp.id
                  ? { ...resource, ...applyTrackOperation(resource, operation, amount) }
                  : resource,
              ),
            }
          : entry,
      ),
    );
    try {
      const saved = await adjustCharacterResource(
        getSupabaseBrowserClient(),
        hp.id,
        operation,
        amount,
      );
      setParty((current) =>
        current.map((entry) =>
          entry.id === character.id
            ? {
                ...entry,
                resources: entry.resources.map((resource) =>
                  resource.id === saved.id ? saved : resource,
                ),
              }
            : entry,
        ),
      );
    } catch (error) {
      fail(`${character.name}: vida não alterada`, error);
    }
  };

  const addCondition = async (character: PartyCharacter, key: string, rounds: number | null) => {
    // Condições graduais (Exaustão) sobem 1 nível a cada aplicação.
    const maxLevel = conditions.find((condition) => condition.key === key)?.maxLevel;
    const current = character.conditions.find((condition) => condition.key === key)?.level ?? 0;
    const level = maxLevel ? Math.min(current + 1, maxLevel) : null;
    try {
      await applyCharacterCondition(getSupabaseBrowserClient(), character.id, key, level, rounds);
      await reload();
    } catch (error) {
      fail(`${character.name}: condição não aplicada`, error);
    }
  };

  const removeCondition = async (character: PartyCharacter, conditionId: string) => {
    const removed = character.conditions.find((condition) => condition.id === conditionId);
    try {
      const client = getSupabaseBrowserClient();
      await removeCharacterCondition(client, conditionId);
      const remaining = character.conditions
        .filter((condition) => condition.id !== conditionId)
        .map((condition) => condition.key);
      // Ex.: quem deixa de estar Inconsciente continua Caído.
      for (const next of conditionsLeftAfter(systemId, removed ? [removed.key] : [], remaining)) {
        await applyCharacterCondition(client, character.id, next);
      }
      await reload();
    } catch (error) {
      fail(`${character.name}: condição não removida`, error);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<Users className="h-5 w-5" aria-hidden="true" />}
        title="Grupo"
        description="Vida e condições atualizadas em tempo real."
      />
      {party.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum personagem vinculado à campanha.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {party.map((character) => {
            const hp = character.resources.find((resource) => resource.display === 'health');
            const summary = summarizeSheet(character.systemId, character.sheet);
            return (
              <li key={character.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-start gap-3">
                  <Portrait
                    name={character.name}
                    url={
                      character.portraitPath ? (portraits[character.portraitPath] ?? null) : null
                    }
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={characterPath(character.id) as Route}
                      className="block truncate font-medium text-fg-accent underline-offset-4 hover:underline"
                    >
                      <ColoredName characterId={character.id}>{character.name}</ColoredName>
                    </Link>
                    <p className="truncate text-xs text-fg-muted">
                      {summary.subtitle} ·{' '}
                      {character.ownerId === currentUserId ? 'você' : character.ownerName}
                    </p>
                    {hp ? (
                      <HealthBar
                        current={hp.current}
                        max={hp.max}
                        temp={hp.temp}
                        className="mt-1.5"
                      />
                    ) : null}
                  </div>
                  {hp && canManage ? (
                    <HpQuickAdjust
                      label={character.name}
                      onApply={(operation, amount) => void adjustHp(character, operation, amount)}
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-15">
                  {character.conditions.map((condition) => (
                    <ConditionChip
                      key={condition.id}
                      systemId={systemId}
                      conditionKey={condition.key}
                      label={conditionLabel(systemId, condition.key, condition.level)}
                      rounds={condition.roundsRemaining}
                      onRemove={
                        canManage ? () => void removeCondition(character, condition.id) : undefined
                      }
                      removeLabel={`Remover ${conditionLabel(systemId, condition.key, condition.level)} de ${character.name}`}
                    />
                  ))}
                  {canManage && conditions.length > 0 ? (
                    <ConditionApplier
                      systemId={systemId}
                      targetName={character.name}
                      appliedKeys={character.conditions.map((condition) => condition.key)}
                      onApply={(key, rounds) => addCondition(character, key, rounds)}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
