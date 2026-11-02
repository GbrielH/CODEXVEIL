import { createCharacterAbility, type Json } from '@codexveil/database';
import {
  applyDnd5eChoice,
  dnd5eChoiceEntries,
  dnd5eChoiceKindLabels,
  dnd5eChoiceOptions,
  listDnd5ePendingChoices,
  type Dnd5ePendingChoice,
} from '@codexveil/rpg-systems/dnd5e';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { AppText, Card } from '@/components/ui/primitives';
import { getSupabase } from '@/lib/supabase';
import { spacing } from '@/lib/theme';
import { useSheet } from './context';

/** Escolhas que ficaram no texto de talentos, espécies e antecedentes (como no site). */
export function PendingChoicesCard() {
  const { sheet, abilities, canEditSheet } = useSheet();
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
  if (!canEditSheet || choices.length === 0) return null;
  return (
    <Card ornate>
      <AppText variant="heading">Escolhas pendentes</AppText>
      <AppText variant="small">Habilidades que pedem uma escolha ainda não feita.</AppText>
      {choices.map((choice) => (
        <ChoiceRow key={choice.key} choice={choice} />
      ))}
    </Card>
  );
}

function ChoiceRow({ choice }: { choice: Dnd5ePendingChoice }) {
  const { sheet, abilities, updateSheet, setAbilities, characterId, run } = useSheet();
  const [picks, setPicks] = useState<string[]>([]);
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
  // Listas longas (magias, talentos) mostram as primeiras 40; o site tem a lista completa.
  const shown = options.slice(0, 40);
  const toggle = (value: string) =>
    setPicks((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : current.length < choice.count
          ? [...current, value]
          : [...current.slice(1), value],
    );

  const confirm = async () => {
    setBusy(true);
    const entries = dnd5eChoiceEntries(choice, picks);
    if (entries.length) {
      const client = getSupabase();
      const created = await run(
        () =>
          Promise.all(
            entries.map((entry) =>
              createCharacterAbility(client, characterId, {
                kind: entry.kind,
                name: entry.name,
                source: entry.source,
                description: entry.description,
                data: entry.data as Json,
                resourceId: null,
              }),
            ),
          ),
        'Não foi possível acrescentar à ficha.',
      );
      if (!created) {
        setBusy(false);
        return;
      }
      setAbilities((current) => [...current, ...created]);
    }
    updateSheet((current) => applyDnd5eChoice(current, choice, picks));
    setBusy(false);
  };

  return (
    <View style={{ gap: spacing[2], paddingTop: spacing[2] }}>
      <AppText>
        {choice.source} · {dnd5eChoiceKindLabels[choice.kind]}
        {choice.count > 1 ? ` (${choice.count})` : ''}
      </AppText>
      <AppText variant="small">“{choice.text}”</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {shown.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            role="checkbox"
            selected={picks.includes(option.value)}
            onPress={() => toggle(option.value)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Button
          label="Aplicar"
          compact
          loading={busy}
          disabled={picks.length !== choice.count}
          onPress={() => void confirm()}
        />
        <Button
          label="Já resolvi"
          variant="ghost"
          compact
          disabled={busy}
          onPress={() =>
            updateSheet((current) => ({
              ...current,
              choices: { ...current.choices, [choice.key]: ['—'] },
            }))
          }
        />
      </View>
    </View>
  );
}
