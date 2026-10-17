'use client';

import {
  applyCharacterCondition,
  removeCharacterCondition,
  setCharacterConditionLevel,
  tickCharacterConditions,
  type CharacterCondition,
} from '@codexveil/database';
import {
  describeDnd5eConditionEffects,
  dnd5eConditionDurations,
  dnd5eConditions,
  dnd5eConditionsLeftAfter,
  findDnd5eCondition,
  formatDnd5eConditionRounds,
  type Dnd5eActiveCondition,
} from '@codexveil/rpg-systems/dnd5e';
import { Hourglass, Minus, Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { controlClasses } from '@/components/ui/control-classes';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

const CUSTOM_CONDITION = '__custom';
const CUSTOM_DURATION = 'custom';
const MAX_ROUNDS = 10000;

function parseRounds(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 1 && value <= MAX_ROUNDS ? value : null;
}

/** Regras completas da condição, recolhidas por padrão. */
function ConditionRules({ condition }: { condition: Dnd5eActiveCondition }) {
  const rules = condition.definition?.rules ?? [];
  if (rules.length === 0) return null;
  return (
    <details className="group mt-1">
      <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg-secondary">Regras da condição</summary>
      <ul className="mt-1.5 flex flex-col gap-1 border-l border-amber-400/30 pl-3 text-xs text-fg-secondary">
        {rules.map((rule) => (
          <li key={rule.title}>
            <span className="font-semibold text-fg">{rule.title}.</span> {rule.text}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Condições do personagem com as regras do SRD 5.2.1: duração em rodadas, condições impostas
 * por outras (ex.: Paralisado → Incapacitado) e os efeitos que a ficha aplica sozinha.
 */
export function ConditionsPanel() {
  const { conditions, conditionEffects, permissions, character, run, reloadConditions } = useSheet();
  const { toast } = useToast();
  const id = useId();
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [level, setLevel] = useState('1');
  const [duration, setDuration] = useState('');
  const [customRounds, setCustomRounds] = useState('');
  const [busy, setBusy] = useState(false);
  const client = getSupabaseBrowserClient;

  const definition = findDnd5eCondition(selected);
  const key = selected === CUSTOM_CONDITION ? custom.trim() : selected;
  const rounds = duration === CUSTOM_DURATION ? parseRounds(customRounds) : duration ? Number(duration) : null;
  const roundsInvalid = duration === CUSTOM_DURATION && rounds === null;
  const byKey = new Map(conditions.map((condition) => [condition.key, condition]));
  const timed = conditions.some((condition) => condition.roundsRemaining !== null);
  const effectLines = describeDnd5eConditionEffects(conditionEffects);

  /** Aplica as condições que continuam depois que outras terminam (Inconsciente → Caído). */
  const applyLeftovers = async (endedKeys: string[], remainingKeys: string[]) => {
    const left = dnd5eConditionsLeftAfter(endedKeys, remainingKeys);
    for (const next of left) await applyCharacterCondition(client(), character.id, next);
    return left;
  };

  const apply = async () => {
    if (!key || roundsInvalid) return;
    setBusy(true);
    const levelValue = definition?.maxLevel ? Math.min(Math.max(Number(level) || 1, 1), definition.maxLevel) : null;
    const ok = await run(() => applyCharacterCondition(client(), character.id, key, levelValue, rounds), {
      failure: 'A condição não foi aplicada',
    });
    setBusy(false);
    if (ok === undefined) return;
    setSelected('');
    setCustom('');
    setLevel('1');
    setDuration('');
    setCustomRounds('');
    await reloadConditions();
  };

  const remove = async (condition: CharacterCondition) => {
    const left = await run(
      async () => {
        await removeCharacterCondition(client(), condition.id);
        const remaining = conditions.filter((entry) => entry.id !== condition.id).map((entry) => entry.key);
        return applyLeftovers([condition.key], remaining);
      },
      { failure: 'A condição não foi removida' },
    );
    if (left === undefined) return;
    await reloadConditions();
    if (left.length > 0) {
      toast({ tone: 'info', title: `Continua ${left.map((entry) => findDnd5eCondition(entry)?.label ?? entry).join(' e ')}.` });
    }
  };

  const changeLevel = async (condition: CharacterCondition, next: number) => {
    const ok = await run(
      () => (next <= 0 ? removeCharacterCondition(client(), condition.id) : setCharacterConditionLevel(client(), condition.id, next)),
      { failure: 'O nível não foi alterado' },
    );
    if (ok !== undefined) await reloadConditions();
  };

  const passRound = async () => {
    setBusy(true);
    const result = await run(
      async () => {
        const ended = await tickCharacterConditions(client(), character.id);
        const remaining = conditions
          .filter((condition) => !ended.includes(condition.key))
          .map((condition) => condition.key);
        const left = await applyLeftovers(ended, remaining);
        return { ended, left };
      },
      { failure: 'A rodada não foi registrada' },
    );
    setBusy(false);
    if (result === undefined) return;
    await reloadConditions();
    const names = result.ended.map((entry) => findDnd5eCondition(entry)?.label ?? entry);
    toast({
      tone: 'info',
      title: names.length > 0 ? `Terminou: ${names.join(', ')}.` : 'Rodada registrada.',
      description: result.left.length > 0 ? `Continua ${result.left.map((entry) => findDnd5eCondition(entry)?.label ?? entry).join(' e ')}.` : undefined,
    });
  };

  const implied = conditionEffects.conditions.filter((condition) => condition.impliedBy && !byKey.has(condition.key));

  return (
    <Card>
      <CardHeader
        title="Condições"
        description="Regras do SRD 5.2.1. A duração diminui no fim de cada turno do personagem; no combate, a contagem acompanha os turnos do mestre."
        action={
          permissions.canEditPlay && timed ? (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void passRound()} icon={<Hourglass className="h-4 w-4" aria-hidden="true" />}>
              Passar rodada
            </Button>
          ) : undefined
        }
      />

      {conditions.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhuma condição ativa.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {conditions.map((condition) => {
            const view = conditionEffects.conditions.find((entry) => entry.key === condition.key);
            const info = findDnd5eCondition(condition.key);
            const label = view?.label ?? condition.key;
            return (
              <li key={condition.id} className="rounded-md border border-amber-400/30 bg-warning-bg/60 px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-300">
                      {label}
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 px-2 text-[11px] font-medium text-fg-secondary">
                        <Hourglass className="h-3 w-3" aria-hidden="true" />
                        {condition.roundsRemaining === null ? 'até ser removida' : `${formatDnd5eConditionRounds(condition.roundsRemaining)} restantes`}
                      </span>
                    </p>
                    {view?.suppressedBy ? (
                      <p className="text-xs text-fg-muted">Sem efeito: imunidade ({view.suppressedBy}).</p>
                    ) : info ? (
                      <p className="text-xs text-fg-secondary">{info.summary}</p>
                    ) : (
                      <p className="text-xs text-fg-muted">Condição personalizada, sem efeitos automáticos.</p>
                    )}
                    {info?.includes?.length ? (
                      <p className="mt-0.5 text-xs text-fg-muted">
                        Impõe também: {info.includes.map((entry) => findDnd5eCondition(entry)?.label ?? entry).join(', ')}.
                      </p>
                    ) : null}
                    {view ? <ConditionRules condition={view} /> : null}
                  </div>
                  {permissions.canEditPlay && info?.maxLevel ? (
                    <div className="flex items-center gap-1" role="group" aria-label={`Nível de ${info.label}`}>
                      <Button size="icon" variant="ghost" onClick={() => void changeLevel(condition, (condition.level ?? 1) - 1)} aria-label={`Diminuir ${info.label}`}>
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={(condition.level ?? 1) >= info.maxLevel}
                        onClick={() => void changeLevel(condition, (condition.level ?? 1) + 1)}
                        aria-label={`Aumentar ${info.label}`}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                  {permissions.canEditPlay ? (
                    <Button size="icon" variant="ghost" onClick={() => void remove(condition)} aria-label={`Remover ${label}`}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {implied.map((condition) => (
            <li key={`imposta-${condition.key}`} className="rounded-md border border-line px-3 py-2">
              <p className="text-sm font-semibold text-fg-secondary">
                {condition.label} <span className="text-xs font-normal text-fg-muted">· imposta por {condition.impliedBy}</span>
              </p>
              {condition.definition ? <p className="text-xs text-fg-muted">{condition.definition.summary}</p> : null}
              <ConditionRules condition={condition} />
            </li>
          ))}
        </ul>
      )}

      {effectLines.length > 0 ? (
        <section aria-labelledby={`${id}-efeitos`} className="mt-4 rounded-md border border-line bg-sunken/60 p-3">
          <h3 id={`${id}-efeitos`} className="eyebrow mb-2">
            Efeitos em vigor
          </h3>
          <dl className="flex flex-col gap-1.5 text-sm">
            {effectLines.map((line) => (
              <div key={`${line.label}-${line.detail}`} className="grid gap-x-3 sm:grid-cols-[10rem_1fr]">
                <dt className={cx('font-medium', line.severe ? 'text-ember-300' : 'text-fg')}>{line.label}</dt>
                <dd className="text-fg-secondary">{line.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-fg-muted">Os números da ficha (iniciativa, deslocamento, ataques e testes) já mostram esses efeitos.</p>
        </section>
      ) : null}

      {permissions.canEditPlay ? (
        <form
          className="mt-4 flex flex-col gap-3 border-t border-line pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void apply();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-condition`} className="text-sm font-medium">
                Aplicar condição
              </label>
              <Select
                id={`${id}-condition`}
                value={selected}
                onChange={(event) => {
                  const next = event.target.value;
                  setSelected(next);
                  // Cada vez que recebe Exaustão, o personagem ganha 1 nível.
                  const max = findDnd5eCondition(next)?.maxLevel;
                  if (max) setLevel(String(Math.min((byKey.get(next)?.level ?? 0) + 1, max)));
                }}
              >
                <option value="">Escolha…</option>
                {dnd5eConditions.map((condition) => (
                  <option key={condition.key} value={condition.key}>
                    {condition.label}
                    {byKey.has(condition.key) ? ' (já aplicada)' : ''}
                  </option>
                ))}
                <option value={CUSTOM_CONDITION}>Outra (personalizada)</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-duration`} className="text-sm font-medium">
                Duração
              </label>
              <Select id={`${id}-duration`} value={duration} onChange={(event) => setDuration(event.target.value)}>
                {dnd5eConditionDurations.map((preset) => (
                  <option key={preset.label} value={preset.rounds === null ? '' : String(preset.rounds)}>
                    {preset.label}
                  </option>
                ))}
                <option value={CUSTOM_DURATION}>Outra (em rodadas)</option>
              </Select>
            </div>
          </div>
          {selected === CUSTOM_CONDITION || definition?.maxLevel || duration === CUSTOM_DURATION ? (
            <div className="flex flex-wrap gap-3">
              {selected === CUSTOM_CONDITION ? (
                <input
                  aria-label="Nome da condição personalizada"
                  value={custom}
                  maxLength={40}
                  onChange={(event) => setCustom(event.target.value)}
                  placeholder="Ex.: Abençoado"
                  className={controlClasses(false, 'h-11 min-w-0 flex-1 text-sm')}
                />
              ) : null}
              {definition?.maxLevel ? (
                <label className="flex items-center gap-2 text-sm">
                  Nível
                  <input
                    inputMode="numeric"
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                    className={controlClasses(false, 'tabular h-11 w-16 text-center')}
                  />
                </label>
              ) : null}
              {duration === CUSTOM_DURATION ? (
                <label className="flex items-center gap-2 text-sm">
                  Rodadas
                  <input
                    inputMode="numeric"
                    value={customRounds}
                    onChange={(event) => setCustomRounds(event.target.value)}
                    aria-invalid={roundsInvalid && customRounds !== '' ? true : undefined}
                    placeholder="Ex.: 3"
                    className={controlClasses(roundsInvalid && customRounds !== '', 'tabular h-11 w-24 text-center')}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {definition ? (
            <p className="text-xs text-fg-muted">
              <span className="font-medium text-fg-secondary">{definition.label}:</span> {definition.summary}
            </p>
          ) : null}
          <div>
            <Button type="submit" variant="secondary" loading={busy} disabled={!key || roundsInvalid} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Aplicar
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
