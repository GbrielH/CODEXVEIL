'use client';

import { applyCharacterCondition, removeCharacterCondition } from '@codexveil/database';
import { conditionLabel as sharedConditionLabel } from '@codexveil/rpg-systems';
import { dnd5eConditions } from '@codexveil/rpg-systems/dnd5e';
import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

const definitions = new Map<string, (typeof dnd5eConditions)[number]>(
  dnd5eConditions.map((condition) => [condition.key, condition]),
);

function conditionLabel(key: string, level: number | null): string {
  return sharedConditionLabel('dnd5e', key, level);
}

/** Condições ativas com resumo de regras para consulta rápida durante a sessão. */
export function ConditionsPanel() {
  const { conditions, permissions, character, run, reloadConditions } = useSheet();
  const id = useId();
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [level, setLevel] = useState('1');
  const [busy, setBusy] = useState(false);

  const definition = definitions.get(selected);
  const key = selected === '__custom' ? custom.trim() : selected;

  const add = async () => {
    if (!key) return;
    setBusy(true);
    const levelValue = definition && 'maxLevel' in definition ? Math.min(Math.max(Number(level) || 1, 1), definition.maxLevel) : null;
    const ok = await run(
      () => applyCharacterCondition(getSupabaseBrowserClient(), character.id, key, levelValue),
      { failure: 'A condição não foi aplicada' },
    );
    setBusy(false);
    if (ok === undefined) return;
    setSelected('');
    setCustom('');
    await reloadConditions();
  };

  const remove = async (conditionId: string) => {
    const ok = await run(() => removeCharacterCondition(getSupabaseBrowserClient(), conditionId), {
      failure: 'A condição não foi removida',
    });
    if (ok !== undefined) await reloadConditions();
  };

  return (
    <Card>
      <CardHeader title="Condições" />
      {conditions.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhuma condição ativa.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {conditions.map((condition) => {
            const info = definitions.get(condition.key);
            return (
              <li key={condition.id} className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-warning-bg/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-300">{conditionLabel(condition.key, condition.level)}</p>
                  {info ? <p className="text-xs text-fg-secondary">{info.summary}</p> : null}
                </div>
                {permissions.canEditPlay ? (
                  <Button size="icon" variant="ghost" onClick={() => void remove(condition.id)} aria-label={`Remover ${conditionLabel(condition.key, condition.level)}`}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {permissions.canEditPlay ? (
        <form
          className="mt-4 flex flex-col gap-2 border-t border-line pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <label htmlFor={`${id}-condition`} className="text-sm font-medium">
            Aplicar condição
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              id={`${id}-condition`}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-sunken px-3 text-sm text-fg"
            >
              <option value="">Escolha…</option>
              {dnd5eConditions.map((condition) => (
                <option key={condition.key} value={condition.key}>
                  {condition.label}
                </option>
              ))}
              <option value="__custom">Outra (personalizada)</option>
            </select>
            {definition && 'maxLevel' in definition ? (
              <input
                aria-label="Nível da condição"
                inputMode="numeric"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className="tabular h-11 w-16 rounded-md border border-line-strong bg-sunken text-center text-fg"
              />
            ) : null}
            {selected === '__custom' ? (
              <input
                aria-label="Nome da condição personalizada"
                value={custom}
                maxLength={40}
                onChange={(event) => setCustom(event.target.value)}
                placeholder="Ex.: Abençoado"
                className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-sunken px-3 text-sm text-fg"
              />
            ) : null}
            <Button type="submit" variant="secondary" loading={busy} disabled={!key} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Aplicar
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
