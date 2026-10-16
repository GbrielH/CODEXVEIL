'use client';

import {
  adjustCharacterResource,
  applyCharacterCondition,
  removeCharacterCondition,
  type PartyCharacter,
} from '@codexveil/database';
import { applyTrackOperation } from '@codexveil/domain';
import { conditionLabel, findSystem, summarizeSheet } from '@codexveil/rpg-systems';
import { Users, X } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { HealthBar } from '@/components/characters/health-bar';
import { Portrait } from '@/components/characters/portrait';
import { Card, CardHeader } from '@/components/ui/card';
import { characterPath } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { GmTableContext } from './gm-table';
import { HpQuickAdjust } from './hp-quick-adjust';

/** Estado resumido do grupo, com dano/cura e condições aplicáveis pelo mestre. */
export function PartyStatus({ context, portraits, currentUserId }: { context: GmTableContext; portraits: Record<string, string>; currentUserId: string }) {
  const { party, setParty, fail, reload, canManage, systemId } = context;
  const conditions = findSystem(systemId)?.conditions ?? [];

  const adjustHp = async (character: PartyCharacter, operation: 'damage' | 'heal', amount: number) => {
    const hp = character.resources.find((resource) => resource.display === 'health');
    if (!hp) return;
    // Retorno imediato; o valor definitivo vem do banco (operação atômica).
    setParty((current) =>
      current.map((entry) =>
        entry.id === character.id
          ? { ...entry, resources: entry.resources.map((resource) => (resource.id === hp.id ? { ...resource, ...applyTrackOperation(resource, operation, amount) } : resource)) }
          : entry,
      ),
    );
    try {
      const saved = await adjustCharacterResource(getSupabaseBrowserClient(), hp.id, operation, amount);
      setParty((current) =>
        current.map((entry) => (entry.id === character.id ? { ...entry, resources: entry.resources.map((resource) => (resource.id === saved.id ? saved : resource)) } : entry)),
      );
    } catch (error) {
      fail(`${character.name}: vida não alterada`, error);
    }
  };

  const addCondition = async (character: PartyCharacter, key: string) => {
    if (!key) return;
    try {
      await applyCharacterCondition(getSupabaseBrowserClient(), character.id, key, key === 'exhaustion' ? 1 : null);
      await reload();
    } catch (error) {
      fail(`${character.name}: condição não aplicada`, error);
    }
  };

  const removeCondition = async (character: PartyCharacter, conditionId: string) => {
    try {
      await removeCharacterCondition(getSupabaseBrowserClient(), conditionId);
      await reload();
    } catch (error) {
      fail(`${character.name}: condição não removida`, error);
    }
  };

  return (
    <Card>
      <CardHeader icon={<Users className="h-5 w-5" aria-hidden="true" />} title="Grupo" description="Vida e condições atualizadas em tempo real." />
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
                  <Portrait name={character.name} url={character.portraitPath ? (portraits[character.portraitPath] ?? null) : null} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={characterPath(character.id) as Route} className="block truncate font-medium text-fg-accent underline-offset-4 hover:underline">
                      {character.name}
                    </Link>
                    <p className="truncate text-xs text-fg-muted">
                      {summary.subtitle} · {character.ownerId === currentUserId ? 'você' : character.ownerName}
                    </p>
                    {hp ? <HealthBar current={hp.current} max={hp.max} temp={hp.temp} className="mt-1.5" /> : null}
                  </div>
                  {hp && canManage ? <HpQuickAdjust label={character.name} onApply={(operation, amount) => void adjustHp(character, operation, amount)} /> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-15">
                  {character.conditions.map((condition) => (
                    <span key={condition.id} className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-warning-bg py-0.5 pr-1 pl-2.5 text-xs text-amber-300">
                      {conditionLabel(systemId, condition.key, condition.level)}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => void removeCondition(character, condition.id)}
                          className="rounded-full p-0.5 hover:bg-amber-400/20"
                          aria-label={`Remover ${conditionLabel(systemId, condition.key, condition.level)} de ${character.name}`}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {canManage && conditions.length > 0 ? (
                    <select
                      aria-label={`Aplicar condição em ${character.name}`}
                      value=""
                      onChange={(event) => void addCondition(character, event.target.value)}
                      className="h-8 rounded-md border border-line bg-sunken px-2 text-xs text-fg-secondary"
                    >
                      <option value="">+ condição</option>
                      {conditions
                        .filter((condition) => !character.conditions.some((applied) => applied.key === condition.key))
                        .map((condition) => (
                          <option key={condition.key} value={condition.key}>
                            {condition.label}
                          </option>
                        ))}
                    </select>
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
