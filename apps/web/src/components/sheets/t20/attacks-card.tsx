'use client';

import type { CharacterItem } from '@codexveil/database';
import { d20Expression, type DiceRollMode } from '@codexveil/domain';
import {
  formatT20Bonus,
  resolveT20Attack,
  t20GripLabels,
  t20RageMaxBonus,
  t20WeaponStats,
  type T20Content,
  type T20Derived,
  type T20Sheet,
} from '@codexveil/rpg-systems/tormenta20';
import { Minus, Plus, Swords } from 'lucide-react';
import { useState } from 'react';
import { RollButton } from '@/components/dice/dice-roller';
import { Card, CardHeader } from '@/components/ui/card';

function useStoredRage(characterId: string): [number, (value: number) => void] {
  const key = `codexveil:t20-furia:${characterId}`;
  const [value, setValue] = useState(() => {
    try {
      return typeof window === 'undefined' ? 0 : Number(window.localStorage.getItem(key) ?? 0) || 0;
    } catch {
      return 0;
    }
  });
  return [
    value,
    (next) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Sem armazenamento: vale só nesta página.
      }
    },
  ];
}

/**
 * Ataques das armas equipadas (Tormenta20): acerto pela Luta ou Pontaria, dano com Força e o
 * crítico da arma, tudo calculado. Fúria para Bárbaros.
 */
export function T20AttacksCard({
  characterId,
  sheet,
  derived,
  items,
  content,
  mode,
  canAct,
  reminders = [],
}: {
  characterId: string;
  sheet: T20Sheet;
  derived: T20Derived;
  items: readonly CharacterItem[];
  content: T20Content | null;
  mode: DiceRollMode;
  canAct: boolean;
  /** Lembretes dos bônus de situação ligados (ataque e dano). */
  reminders?: readonly string[];
}) {
  const [rage, setRage] = useStoredRage(characterId);
  const rageMax = t20RageMaxBonus(sheet);
  const activeRage = Math.min(rage, rageMax);
  const weapons = items
    .filter((item) => item.isEquipped && item.category === 'weapon')
    .map((item) => ({ item, stats: t20WeaponStats(item.name, item.description, content) }));
  // Estilo de Uma Arma exige a outra mão livre: outra arma ou escudo equipado ocupa a mão.
  const shieldEquipped = items.some((item) => item.isEquipped && /escudo/i.test(item.name));

  return (
    <Card>
      <CardHeader icon={<Swords className="h-5 w-5" aria-hidden="true" />} title="Ataques" />
      {rageMax > 0 ? (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 ${activeRage ? 'ability-rage border-ember-400/60 bg-ember-400/15' : 'border-line bg-raised'}`}
        >
          <span>
            <span className="block font-display text-lg text-fg">
              {activeRage ? `Em Fúria (+${activeRage})` : 'Fúria'}
            </span>
            <span className="block text-xs text-fg-muted">
              2 PM: +2 no ataque e no dano corpo a corpo. A cada cinco níveis, +1 PM aumenta o bônus
              em +1 (máx. +{rageMax}).
            </span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canAct || activeRage === 0}
              onClick={() => setRage(activeRage <= 2 ? 0 : activeRage - 1)}
              aria-label="Diminuir a Fúria"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line hover:bg-hover disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!canAct || activeRage >= rageMax}
              onClick={() => setRage(activeRage === 0 ? 2 : activeRage + 1)}
              aria-label={activeRage ? 'Aumentar a Fúria' : 'Entrar em Fúria'}
              className="flex h-8 items-center justify-center gap-1 rounded-md border border-line px-2 text-sm hover:bg-hover disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {activeRage ? '' : 'Entrar'}
            </button>
          </span>
        </div>
      ) : null}
      {weapons.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nenhuma arma equipada. Equipe uma arma no Inventário (de preferência escolhida do livro)
          para atacar com ela.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {weapons.map(({ item, stats }) => {
            if (!stats) {
              return (
                <li key={item.id} className="py-3">
                  <p className="text-sm font-medium text-fg">{item.name}</p>
                  <p className="text-xs text-fg-muted">
                    Não encontrei o dano desta arma. Escolha-a pelo &quot;Escolher do livro&quot; no
                    Inventário, ou escreva na descrição: &quot;Dano 1d8 · Crítico 19/x3&quot;.
                  </p>
                </li>
              );
            }
            const attack = resolveT20Attack(stats, sheet, derived, {
              rage: activeRage,
              offHandBusy: shieldEquipped || weapons.length > 1,
              weaponName: item.name,
              reminders,
            });
            const critLabel = `${attack.critMargin < 20 ? `${attack.critMargin}` : '20'}/x${attack.critMultiplier}`;
            return (
              <li key={item.id} className="flex flex-col gap-2 py-3">
                <span>
                  <span className="block text-sm font-medium text-fg">{item.name}</span>
                  <span className="block text-xs text-fg-muted">
                    {[
                      stats.damage,
                      stats.damageType,
                      stats.kind === 'ranged'
                        ? 'disparo'
                        : stats.kind === 'thrown'
                          ? 'arremesso'
                          : stats.kind === 'melee-thrown'
                            ? 'corpo a corpo ou arremesso'
                            : 'corpo a corpo',
                      stats.grip ? t20GripLabels[stats.grip] : '',
                      stats.range && !/^[—–-]$/.test(stats.range) ? stats.range : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <RollButton
                    expression={d20Expression(attack.toHit)}
                    label={`Ataque: ${item.name}`}
                    mode={mode}
                    critRange={attack.critMargin}
                    className="w-full"
                  >
                    <span className="flex w-full flex-col items-center rounded-md border border-line-strong bg-raised px-2 py-1.5">
                      <span className="text-[11px] tracking-wider text-fg-muted uppercase">
                        Acerto
                      </span>
                      <span className="tabular font-display text-lg text-fg-accent">
                        {formatT20Bonus(attack.toHit)}
                      </span>
                    </span>
                  </RollButton>
                  <RollButton
                    expression={attack.damage}
                    label={`Dano: ${item.name}`}
                    className="w-full"
                  >
                    <span className="flex w-full flex-col items-center rounded-md border border-line-strong bg-raised px-2 py-1.5">
                      <span className="text-[11px] tracking-wider text-fg-muted uppercase">
                        Dano
                      </span>
                      <span className="tabular font-display text-lg text-ember-300">
                        {attack.damage}
                      </span>
                    </span>
                  </RollButton>
                  <RollButton
                    expression={attack.critical}
                    label={`Dano crítico: ${item.name}`}
                    className="w-full"
                    title={`Crítico com ${critLabel}: dados multiplicados por ${attack.critMultiplier}`}
                  >
                    <span className="flex w-full flex-col items-center rounded-md border border-amber-400/30 bg-raised px-2 py-1.5">
                      <span className="text-[11px] tracking-wider text-fg-muted uppercase">
                        Crítico ({critLabel})
                      </span>
                      <span className="tabular font-display text-lg text-amber-300">
                        {attack.critical}
                      </span>
                    </span>
                  </RollButton>
                </div>
                <p className="text-[11px] text-fg-subtle">Automático: {attack.notes.join(' · ')}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
