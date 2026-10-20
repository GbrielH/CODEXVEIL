'use client';

import { conditionRoundsLabel, findSystem } from '@codexveil/rpg-systems';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/control-classes';
import { Select } from '@/components/ui/select';

const CUSTOM_DURATION = 'custom';

function parseRounds(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 1 && value <= 10000 ? value : null;
}

/** Selo de uma condição aplicada, com a duração restante e o resumo da regra na dica. */
export function ConditionChip({
  systemId,
  label,
  conditionKey,
  rounds,
  onRemove,
  removeLabel,
}: {
  systemId: string;
  label: string;
  conditionKey: string;
  rounds: number | null;
  onRemove?: (() => void) | undefined;
  removeLabel: string;
}) {
  const summary = findSystem(systemId)?.conditions.find(
    (condition) => condition.key === conditionKey,
  )?.summary;
  const duration = conditionRoundsLabel(systemId, rounds);
  return (
    <span
      title={[summary, `Duração: ${duration}.`].filter(Boolean).join(' ')}
      className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-warning-bg py-0.5 pr-1 pl-2.5 text-xs text-amber-300"
    >
      {label}
      {rounds !== null ? (
        <span className="tabular text-[10px] text-fg-secondary">· {rounds} rod.</span>
      ) : null}
      <span className="sr-only">
        {' '}
        ({duration}){summary ? `. ${summary}` : ''}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 hover:bg-amber-400/20"
          aria-label={removeLabel}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

/** Aplica uma condição com duração em rodadas (formato compacto da mesa do mestre). */
export function ConditionApplier({
  systemId,
  targetName,
  appliedKeys,
  onApply,
  allowLevels = true,
}: {
  systemId: string;
  targetName: string;
  appliedKeys: readonly string[];
  onApply: (key: string, rounds: number | null) => Promise<void>;
  /** Condições graduais podem ser aplicadas de novo para subir de nível (fichas guardam o nível). */
  allowLevels?: boolean;
}) {
  const system = findSystem(systemId);
  const [key, setKey] = useState('');
  const [duration, setDuration] = useState('');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  if (!system) return null;

  const rounds =
    duration === CUSTOM_DURATION ? parseRounds(custom) : duration ? Number(duration) : null;
  const invalid = duration === CUSTOM_DURATION && rounds === null;
  // Condições graduais (ex.: Exaustão) podem ser aplicadas de novo para subir de nível.
  const available = system.conditions.filter(
    (condition) => (allowLevels && condition.maxLevel) || !appliedKeys.includes(condition.key),
  );

  const submit = async () => {
    if (!key || invalid) return;
    setBusy(true);
    try {
      await onApply(key, rounds);
      setKey('');
      setDuration('');
      setCustom('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        size="sm"
        aria-label={`Aplicar condição em ${targetName}`}
        value={key}
        onChange={(event) => setKey(event.target.value)}
        className="w-40"
      >
        <option value="">+ condição</option>
        {available.map((condition) => (
          <option key={condition.key} value={condition.key}>
            {condition.label}
            {appliedKeys.includes(condition.key) ? ' (+1 nível)' : ''}
          </option>
        ))}
      </Select>
      {key ? (
        <>
          <Select
            size="sm"
            aria-label={`Duração da condição em ${targetName}`}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="w-52"
          >
            {system.conditionDurations.map((preset) => (
              <option
                key={preset.label}
                value={preset.rounds === null ? '' : String(preset.rounds)}
              >
                {preset.label}
              </option>
            ))}
            <option value={CUSTOM_DURATION}>Outra (em rodadas)</option>
          </Select>
          {duration === CUSTOM_DURATION ? (
            <input
              aria-label="Rodadas"
              inputMode="numeric"
              placeholder="Rodadas"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              aria-invalid={invalid && custom !== '' ? true : undefined}
              className={controlClasses(
                invalid && custom !== '',
                'tabular h-8 w-20 px-2 text-center text-xs',
              )}
            />
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            disabled={invalid}
            onClick={() => void submit()}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Aplicar
          </Button>
        </>
      ) : null}
    </div>
  );
}
