import { createCharacter, listMyCampaigns } from '@codexveil/database';
import {
  ABILITIES,
  HIT_DICE,
  abilityLabels,
  abilityModifier,
  buildDnd5eCharacter,
  dnd5eCreationSchema,
  formatModifier,
  suggestHitPointMax,
  type HitDie,
} from '@codexveil/rpg-systems/dnd5e';
import { characterCreateSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { LoadingState, Notice } from '@/components/ui/states';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii } from '@/lib/theme';

type Scores = Record<(typeof ABILITIES)[number], string>;

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small" style={{ color: colors.fg, fontFamily: fonts.sansMedium, fontSize: 14 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.choice, selected && styles.choiceSelected]}
            >
              <AppText style={{ color: selected ? colors.fgAccent : colors.fgSecondary, fontSize: 14 }}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function NewCharacterScreen() {
  const params = useLocalSearchParams<{ campanha?: string }>();
  const userId = useUserId();
  const router = useRouter();
  const campaigns = useAsyncData(() => listMyCampaigns(getSupabase(), userId), userId);

  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState(params.campanha ?? '');
  const [species, setSpecies] = useState('');
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState('1');
  const [hitDie, setHitDie] = useState<HitDie>('d8');
  const [scores, setScores] = useState<Scores>({ str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10' });
  const [hitPoints, setHitPoints] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const creationInput = {
    species,
    className,
    level: Number(level),
    hitDie,
    abilities: Object.fromEntries(ABILITIES.map((ability) => [ability, Number(scores[ability])])),
    hitPointMax: hitPoints.trim() ? Number(hitPoints) : null,
  };
  const suggested = useMemo(() => {
    const parsed = dnd5eCreationSchema.safeParse({ ...creationInput, hitPointMax: null });
    return parsed.success ? suggestHitPointMax(buildDnd5eCharacter(parsed.data).sheet) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, hitDie, scores]);

  if (campaigns.loading) return <LoadingState />;
  const active = (campaigns.data ?? []).filter((campaign) => campaign.status === 'active' && campaign.systemId === 'dnd5e');

  const submit = async () => {
    setMessage(null);
    const base = characterCreateSchema.safeParse({ name, systemId: 'dnd5e', campaignId: campaignId || null });
    const creation = dnd5eCreationSchema.safeParse(creationInput);
    if (!base.success || !creation.success) {
      setErrors({ ...(base.success ? {} : fieldErrorsFrom(base.error)), ...(creation.success ? {} : fieldErrorsFrom(creation.error)) });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const built = buildDnd5eCharacter(creation.data);
      const id = await createCharacter(getSupabase(), {
        name: base.data.name,
        systemId: base.data.systemId,
        campaignId: base.data.campaignId,
        sheet: built.sheet,
        resources: built.resources,
      });
      router.replace({ pathname: '/personagem/[id]', params: { id } });
    } catch (error) {
      setMessage(failureMessage(error));
      setBusy(false);
    }
  };

  return (
    <Screen subtitle="Comece pelo essencial; o restante se preenche na ficha.">
      {message ? <Notice tone="danger" message={message} /> : null}
      <Card ornate>
        <Field label="Nome do personagem" value={name} onChangeText={setName} maxLength={80} error={errors.name} />
        <Choice
          label="Campanha"
          value={campaignId}
          onChange={setCampaignId}
          options={[{ value: '', label: 'Sem campanha' }, ...active.map((campaign) => ({ value: campaign.id, label: campaign.name }))]}
        />
        {errors.campaignId ? <AppText style={{ color: '#EC9384' }}>{errors.campaignId}</AppText> : null}
        <Field label="Espécie" value={species} onChangeText={setSpecies} maxLength={60} placeholder="Ex.: Elfo, Anão, Humano" error={errors.species} />
        <Field label="Classe" value={className} onChangeText={setClassName} maxLength={40} placeholder="Ex.: Guerreiro, Maga" error={errors.className} />
        <Field label="Nível" value={level} onChangeText={setLevel} keyboardType="number-pad" maxLength={2} error={errors.level} />
        <Choice label="Dado de vida" value={hitDie} onChange={setHitDie} options={HIT_DICE.map((die) => ({ value: die, label: die }))} />
      </Card>
      <Card>
        <AppText variant="heading">Atributos</AppText>
        <View style={styles.grid}>
          {ABILITIES.map((ability) => {
            const numeric = Number(scores[ability]);
            return (
              <View key={ability} style={styles.ability}>
                <AppText variant="eyebrow">{abilityLabels[ability].abbreviation}</AppText>
                <TextInput
                  value={scores[ability]}
                  onChangeText={(text) => setScores((current) => ({ ...current, [ability]: text }))}
                  keyboardType="number-pad"
                  maxLength={2}
                  accessibilityLabel={abilityLabels[ability].name}
                  style={styles.abilityInput}
                />
                <AppText variant="number" style={{ fontSize: 16 }}>
                  {Number.isInteger(numeric) ? formatModifier(abilityModifier(numeric)) : '—'}
                </AppText>
                {errors[`abilities.${ability}`] ? <AppText style={{ color: '#EC9384', fontSize: 11 }}>{errors[`abilities.${ability}`]}</AppText> : null}
              </View>
            );
          })}
        </View>
        <Field
          label="Pontos de vida máximos"
          value={hitPoints}
          onChangeText={setHitPoints}
          keyboardType="number-pad"
          placeholder={suggested ? String(suggested) : undefined}
          hint={suggested ? `Em branco = ${suggested} (sugestão das regras).` : undefined}
          error={errors.hitPointMax}
        />
      </Card>
      <Button label="Criar personagem" onPress={() => void submit()} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  choice: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radii.full, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.sunken },
  choiceSelected: { borderColor: colors.parchmentEdge, backgroundColor: '#3D1520' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ability: { width: '31%', alignItems: 'center', gap: 4, padding: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised },
  abilityInput: { width: '100%', height: 44, textAlign: 'center', color: colors.fg, fontSize: 20, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.md, backgroundColor: colors.sunken },
});
