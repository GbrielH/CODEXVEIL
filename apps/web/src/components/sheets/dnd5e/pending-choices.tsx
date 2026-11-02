'use client';

import { createCharacterAbility, type Json } from '@codexveil/database';
import {
  applyDnd5eChoice,
  dnd5eChoiceEntries,
  dnd5eChoiceKindLabels,
  dnd5eChoiceOptions,
  listDnd5ePendingChoices,
  type Dnd5ePendingChoice,
} from '@codexveil/rpg-systems/dnd5e';
import { ListChecks } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

/**
 * Escolhas que ficaram só no texto de talentos, espécies e antecedentes ("uma perícia à sua
 * escolha", "um talento de origem à escolha"…): o jogador escolhe aqui e a ficha recebe a
 * proficiência, o idioma, o atributo, o talento ou a magia.
 */
export function PendingChoicesCard() {
  const { sheet, abilities, permissions } = useSheet();
  const choices = useMemo(
    () =>
      listDnd5ePendingChoices(
        sheet,
        abilities.map((entry) => ({
          name: entry.name,
          kind: entry.kind,
          description: entry.description,
        })),
      ),
    [sheet, abilities],
  );
  if (!permissions.canEditSheet || choices.length === 0) return null;
  return (
    <Card ornate>
      <CardHeader
        icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
        title="Escolhas pendentes"
        description="Habilidades da ficha que pedem uma escolha que ainda não foi feita."
      />
      <ul className="flex flex-col gap-3">
        {choices.map((choice) => (
          <ChoiceRow key={choice.key} choice={choice} />
        ))}
      </ul>
    </Card>
  );
}

function ChoiceRow({ choice }: { choice: Dnd5ePendingChoice }) {
  const { sheet, abilities, updateSheet, setAbilities, character, run } = useSheet();
  const [picks, setPicks] = useState<string[]>(() =>
    Array.from({ length: choice.count }, () => ''),
  );
  const [busy, setBusy] = useState(false);
  const options = useMemo(
    () =>
      dnd5eChoiceOptions(
        choice,
        sheet,
        abilities.map((entry) => entry.name),
      ),
    [choice, sheet, abilities],
  );
  const chosen = picks.filter(Boolean);
  const complete = chosen.length === choice.count && new Set(chosen).size === chosen.length;

  const confirm = async () => {
    setBusy(true);
    const entries = dnd5eChoiceEntries(choice, chosen);
    if (entries.length) {
      const client = getSupabaseBrowserClient();
      const created = await run(
        () =>
          Promise.all(
            entries.map((entry) =>
              createCharacterAbility(client, character.id, {
                kind: entry.kind,
                name: entry.name,
                source: entry.source,
                description: entry.description,
                data: entry.data as Json,
                resourceId: null,
              }),
            ),
          ),
        { failure: 'Não foi possível acrescentar à ficha.' },
      );
      if (!created) {
        setBusy(false);
        return;
      }
      setAbilities((current) => [...current, ...created]);
    }
    updateSheet((current) => applyDnd5eChoice(current, choice, chosen));
    setBusy(false);
  };

  return (
    <li className="rounded-lg border border-line p-3">
      <p className="text-sm text-fg">
        <strong>{choice.source}</strong> · {dnd5eChoiceKindLabels[choice.kind]}
        {choice.count > 1 ? ` (${choice.count})` : ''}
      </p>
      <p className="text-xs text-fg-muted">“{choice.text}”</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {picks.map((value, index) => (
          <select
            key={index}
            value={value}
            aria-label={`${dnd5eChoiceKindLabels[choice.kind]} ${index + 1}`}
            onChange={(event) =>
              setPicks(
                picks.map((pick, position) => (position === index ? event.target.value : pick)),
              )
            }
            className="h-9 min-w-48 rounded-md border border-line bg-sunken px-2 text-sm text-fg"
          >
            <option value="">Escolha…</option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={picks.includes(option.value) && value !== option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        ))}
        <Button
          size="sm"
          disabled={!complete || busy}
          loading={busy}
          onClick={() => void confirm()}
        >
          Aplicar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            updateSheet((current) => ({
              ...current,
              choices: { ...current.choices, [choice.key]: ['—'] },
            }))
          }
        >
          Já resolvi
        </Button>
      </div>
    </li>
  );
}
