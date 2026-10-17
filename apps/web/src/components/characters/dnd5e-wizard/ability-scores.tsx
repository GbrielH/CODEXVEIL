'use client';

import {
  ABILITIES,
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  RANDOM_SCORE_MAX,
  RANDOM_SCORE_MIN,
  STANDARD_ARRAY,
  abilityLabels,
  abilityModifier,
  abilityScoreMethodLabels,
  finalAbilityScores,
  formatModifier,
  pointBuyCost,
  rollAbilityScore,
  type Ability,
  type AbilityScoreMethod,
  type ClassDefinition,
  type Dnd5eDraft,
} from '@codexveil/rpg-systems/dnd5e';
import { Dices, Minus, Plus, Sparkles } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cx } from '@/lib/cx';

export interface RollState {
  pool: (number | null)[];
  /** Índice da rolagem atribuída a cada atributo. */
  assignment: Partial<Record<Ability, number>>;
}

export const EMPTY_ROLLS: RollState = { pool: [null, null, null, null, null, null], assignment: {} };

type Scores = Dnd5eDraft['baseScores'];

interface AbilityScoresProps {
  draft: Dnd5eDraft;
  methods: readonly AbilityScoreMethod[];
  classDef: ClassDefinition | undefined;
  rolls: RollState;
  error?: string | undefined;
  onMethod: (method: AbilityScoreMethod, scores: Scores) => void;
  onScores: (scores: Scores) => void;
  onRolls: (rolls: RollState) => void;
}

const emptyScores = (): Scores => ({ str: null, dex: null, con: null, int: null, wis: null, cha: null });

export function AbilityScores({ draft, methods, classDef, rolls, error, onMethod, onScores, onRolls }: AbilityScoresProps) {
  const method = draft.abilityMethod;
  const scores = draft.baseScores;
  const final = finalAbilityScores(draft);

  const chooseMethod = (next: AbilityScoreMethod) => {
    if (next === method) return;
    onMethod(next, next === 'point_buy' ? (Object.fromEntries(ABILITIES.map((ability) => [ability, POINT_BUY_MIN])) as Scores) : emptyScores());
  };

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Método de geração" className="grid gap-2 sm:grid-cols-3">
        {methods.map((entry) => (
          <button
            key={entry}
            type="button"
            role="radio"
            aria-checked={entry === method}
            onClick={() => chooseMethod(entry)}
            className={cx(
              'flex flex-col gap-1 rounded-md border p-3 text-left text-sm',
              entry === method ? 'border-parchment-300/70 bg-parchment-200/10' : 'border-line hover:bg-hover',
            )}
          >
            <span className="font-medium text-fg">{abilityScoreMethodLabels[entry].name}</span>
            <span className="text-xs leading-relaxed text-fg-muted">{abilityScoreMethodLabels[entry].description}</span>
          </button>
        ))}
      </div>

      {method === 'standard_array' ? (
        <StandardArray scores={scores} classDef={classDef} onScores={onScores} />
      ) : method === 'point_buy' ? (
        <PointBuy scores={scores} onScores={onScores} />
      ) : (
        <RandomScores scores={scores} rolls={rolls} onScores={onScores} onRolls={onRolls} />
      )}

      {error ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <caption className="mb-2 text-left text-xs text-fg-subtle">
            Valor final = base + antecedente + talentos (e habilidades de 20º nível).
          </caption>
          <thead>
            <tr className="text-left text-xs text-fg-muted">
              <th className="py-1 pr-2 font-medium">Atributo</th>
              <th className="py-1 pr-2 font-medium">Base</th>
              <th className="py-1 pr-2 font-medium">Final</th>
              <th className="py-1 font-medium">Mod.</th>
            </tr>
          </thead>
          <tbody>
            {ABILITIES.map((ability) => {
              const base = scores[ability];
              const value = final?.[ability] ?? base;
              return (
                <tr key={ability} className="border-t border-line">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal text-fg-secondary">
                    {abilityLabels[ability].name}
                  </th>
                  <td className="tabular py-1.5 pr-2">{base ?? '—'}</td>
                  <td className={cx('tabular py-1.5 pr-2', value !== base && value !== null && 'text-fg-accent')}>{value ?? '—'}</td>
                  <td className="tabular py-1.5">{value === null ? '—' : formatModifier(abilityModifier(value))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StandardArray({ scores, classDef, onScores }: { scores: Scores; classDef: ClassDefinition | undefined; onScores: (scores: Scores) => void }) {
  const id = useId();
  const used = ABILITIES.map((ability) => scores[ability]).filter((value): value is number => value !== null);
  const remaining = [...STANDARD_ARRAY].filter((value) => {
    const times = STANDARD_ARRAY.filter((entry) => entry === value).length;
    return used.filter((entry) => entry === value).length < times;
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Valores livres: <span className="tabular text-fg">{remaining.length ? remaining.join(', ') : 'nenhum'}</span>
        </p>
        {classDef ? (
          <Button size="sm" variant="secondary" icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={() => onScores({ ...classDef.standardArray })}>
            Sugestão para {classDef.name}
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ABILITIES.map((ability) => (
          <label key={ability} htmlFor={`${id}-${ability}`} className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-fg">{abilityLabels[ability].name}</span>
            <Select
              id={`${id}-${ability}`}
              value={scores[ability] ?? ''}
              onChange={(event) => onScores({ ...scores, [ability]: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">—</option>
              {STANDARD_ARRAY.map((value, index) => {
                const takenElsewhere = ABILITIES.filter((other) => other !== ability && scores[other] === value).length;
                const available = STANDARD_ARRAY.filter((entry) => entry === value).length;
                return (
                  <option key={`${value}-${index}`} value={value} disabled={takenElsewhere >= available}>
                    {value}
                  </option>
                );
              })}
            </Select>
          </label>
        ))}
      </div>
    </div>
  );
}

function PointBuy({ scores, onScores }: { scores: Scores; onScores: (scores: Scores) => void }) {
  const cost = pointBuyCost(scores) ?? 0;
  const left = POINT_BUY_BUDGET - cost;
  const step = (ability: Ability, delta: number) => {
    const current = scores[ability] ?? POINT_BUY_MIN;
    const next = Math.min(POINT_BUY_MAX, Math.max(POINT_BUY_MIN, current + delta));
    onScores({ ...scores, [ability]: next });
  };
  return (
    <div className="flex flex-col gap-3">
      <p className={cx('text-sm', left < 0 ? 'text-danger' : 'text-fg-muted')}>
        Pontos restantes: <span className="tabular font-medium text-fg">{left}</span> de {POINT_BUY_BUDGET}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ABILITIES.map((ability) => {
          const value = scores[ability] ?? POINT_BUY_MIN;
          const nextCost = (POINT_BUY_COSTS[value + 1] ?? Infinity) - (POINT_BUY_COSTS[value] ?? 0);
          return (
            <div key={ability} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
              <span className="text-sm text-fg">{abilityLabels[ability].name}</span>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" aria-label={`Diminuir ${abilityLabels[ability].name}`} disabled={value <= POINT_BUY_MIN} onClick={() => step(ability, -1)}>
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="tabular w-8 text-center text-lg">{value}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Aumentar ${abilityLabels[ability].name}`}
                  disabled={value >= POINT_BUY_MAX || nextCost > left}
                  onClick={() => step(ability, 1)}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-fg-subtle">Custos: 8 = 0, 9 = 1, 10 = 2, 11 = 3, 12 = 4, 13 = 5, 14 = 7, 15 = 9.</p>
    </div>
  );
}

function RandomScores({
  scores,
  rolls,
  onScores,
  onRolls,
}: {
  scores: Scores;
  rolls: RollState;
  onScores: (scores: Scores) => void;
  onRolls: (rolls: RollState) => void;
}) {
  const id = useId();
  const apply = (next: RollState) => {
    onRolls(next);
    onScores(
      Object.fromEntries(
        ABILITIES.map((ability) => {
          const index = next.assignment[ability];
          return [ability, index === undefined ? null : (next.pool[index] ?? null)];
        }),
      ) as Scores,
    );
  };
  const rollAll = () => apply({ pool: Array.from({ length: 6 }, () => rollAbilityScore()), assignment: {} });
  const setPool = (index: number, text: string) => {
    const value = text === '' ? null : Math.trunc(Number(text));
    const pool = rolls.pool.map((entry, position) => (position === index ? (Number.isFinite(value) ? value : null) : entry));
    apply({ ...rolls, pool });
  };
  const assign = (ability: Ability, text: string) => {
    const assignment = { ...rolls.assignment };
    if (text === '') delete assignment[ability];
    else assignment[ability] = Number(text);
    apply({ ...rolls, assignment });
  };
  const taken = new Set(Object.values(rolls.assignment));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={<Dices className="h-4 w-4" aria-hidden="true" />} onClick={rollAll}>
          Rolar 4d6 seis vezes
        </Button>
        <p className="text-xs text-fg-muted">Ou digite os totais rolados na mesa ({RANDOM_SCORE_MIN} a {RANDOM_SCORE_MAX}).</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {rolls.pool.map((value, index) => (
          <label key={index} className="flex flex-col gap-1 text-xs text-fg-muted">
            Rolagem {index + 1}
            <input
              inputMode="numeric"
              value={value ?? ''}
              onChange={(event) => setPool(index, event.target.value)}
              className="tabular h-11 rounded-md border border-line-strong bg-sunken text-center text-lg text-fg"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ABILITIES.map((ability) => (
          <label key={ability} htmlFor={`${id}-${ability}`} className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-fg">{abilityLabels[ability].name}</span>
            <Select
              id={`${id}-${ability}`}
              value={rolls.assignment[ability] ?? ''}
              onChange={(event) => assign(ability, event.target.value)}
            >
              <option value="">—</option>
              {rolls.pool.map((value, index) =>
                value === null ? null : (
                  <option key={index} value={index} disabled={taken.has(index) && rolls.assignment[ability] !== index}>
                    {value} (rolagem {index + 1})
                  </option>
                ),
              )}
            </Select>
          </label>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {ABILITIES.map((ability) => `${abilityLabels[ability].name} ${scores[ability] ?? 'sem valor'}`).join(', ')}
      </p>
    </div>
  );
}
