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
import { ChevronDown, ChevronUp, Hourglass, Minus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { PickerSheet, type PickerOption } from '@/components/ui/picker';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';
import { useSheet } from './context';

const CUSTOM_CONDITION = '__custom';
const MAX_ROUNDS = 10000;

type Duration = number | null | 'custom';

function parseRounds(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 1 && value <= MAX_ROUNDS ? value : null;
}

const labelOf = (key: string) => findDnd5eCondition(key)?.label ?? key;

/** Regras completas da condição, recolhidas por padrão. */
function Rules({ condition }: { condition: Dnd5eActiveCondition }) {
  const [open, setOpen] = useState(false);
  const rules = condition.definition?.rules ?? [];
  if (rules.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          Regras da condição
        </AppText>
        {open ? <ChevronUp size={14} color={colors.fgMuted} /> : <ChevronDown size={14} color={colors.fgMuted} />}
      </Pressable>
      {open ? (
        <View style={styles.rules}>
          {rules.map((rule) => (
            <AppText key={rule.title} variant="small">
              <AppText variant="small" style={{ fontFamily: fonts.sansSemiBold, color: colors.fg }}>
                {rule.title}.{' '}
              </AppText>
              {rule.text}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Condições do personagem com as regras do SRD 5.2.1: duração em rodadas, condições impostas
 * por outras e os efeitos que a ficha aplica sozinha.
 */
export function ConditionsSection() {
  const { conditions, conditionEffects, canEditPlay, characterId, run, reloadPlayState } = useSheet();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [level, setLevel] = useState(1);
  const [duration, setDuration] = useState<Duration>(null);
  const [customRounds, setCustomRounds] = useState('');
  const [busy, setBusy] = useState(false);

  const byKey = new Map(conditions.map((condition) => [condition.key, condition]));
  const timed = conditions.some((condition) => condition.roundsRemaining !== null);
  const effectLines = describeDnd5eConditionEffects(conditionEffects);
  const implied = conditionEffects.conditions.filter((condition) => condition.impliedBy && !byKey.has(condition.key));
  const definition = chosen ? findDnd5eCondition(chosen) : undefined;
  const key = chosen === CUSTOM_CONDITION ? customName.trim() : (chosen ?? '');
  const rounds = duration === 'custom' ? parseRounds(customRounds) : duration;
  const roundsInvalid = duration === 'custom' && rounds === null;

  const options: PickerOption[] = [
    ...dnd5eConditions.map((condition) => ({
      value: condition.key,
      label: byKey.has(condition.key) ? `${condition.label} (já aplicada)` : condition.label,
      description: condition.summary,
    })),
    { value: CUSTOM_CONDITION, label: 'Outra (personalizada)', description: 'Sem efeitos automáticos.' },
  ];

  const resetForm = () => {
    setChosen(null);
    setCustomName('');
    setLevel(1);
    setDuration(null);
    setCustomRounds('');
  };

  /** Aplica as condições que continuam depois que outras terminam (Inconsciente → Caído). */
  const applyLeftovers = async (endedKeys: string[], remainingKeys: string[]) => {
    const left = dnd5eConditionsLeftAfter(endedKeys, remainingKeys);
    for (const next of left) await applyCharacterCondition(getSupabase(), characterId, next);
    return left;
  };

  const apply = async () => {
    if (!key || roundsInvalid) return;
    setBusy(true);
    const ok = await run(() => applyCharacterCondition(getSupabase(), characterId, key, definition?.maxLevel ? level : null, rounds), 'A condição não foi aplicada');
    setBusy(false);
    if (ok === undefined) return;
    resetForm();
    await reloadPlayState();
  };

  const remove = async (condition: CharacterCondition) => {
    const left = await run(async () => {
      await removeCharacterCondition(getSupabase(), condition.id);
      const remaining = conditions.filter((entry) => entry.id !== condition.id).map((entry) => entry.key);
      return applyLeftovers([condition.key], remaining);
    }, 'A condição não foi removida');
    if (left === undefined) return;
    await reloadPlayState();
    if (left.length > 0) toast({ tone: 'info', title: `Continua ${left.map(labelOf).join(' e ')}.` });
  };

  const changeLevel = async (condition: CharacterCondition, next: number) => {
    const ok = await run(
      () => (next <= 0 ? removeCharacterCondition(getSupabase(), condition.id) : setCharacterConditionLevel(getSupabase(), condition.id, next)),
      'O nível não foi alterado',
    );
    if (ok !== undefined) await reloadPlayState();
  };

  const passRound = async () => {
    setBusy(true);
    const result = await run(async () => {
      const ended = await tickCharacterConditions(getSupabase(), characterId);
      const remaining = conditions.filter((condition) => !ended.includes(condition.key)).map((condition) => condition.key);
      const left = await applyLeftovers(ended, remaining);
      return { ended, left };
    }, 'A rodada não foi registrada');
    setBusy(false);
    if (result === undefined) return;
    await reloadPlayState();
    toast({
      tone: 'info',
      title: result.ended.length > 0 ? `Terminou: ${result.ended.map(labelOf).join(', ')}.` : 'Rodada registrada.',
      ...(result.left.length > 0 ? { description: `Continua ${result.left.map(labelOf).join(' e ')}.` } : {}),
    });
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <AppText variant="heading" style={{ flex: 1 }}>
          Condições
        </AppText>
        {canEditPlay && timed ? (
          <Button label="Passar rodada" compact variant="secondary" loading={busy} icon={<Hourglass size={14} color={colors.fg} />} onPress={() => void passRound()} />
        ) : null}
      </View>
      <AppText variant="small" style={{ color: colors.fgMuted }}>
        Regras do SRD 5.2.1. A duração diminui no fim de cada turno do personagem; no combate, acompanha os turnos do mestre.
      </AppText>

      {conditions.length === 0 ? <AppText variant="muted">Nenhuma condição ativa.</AppText> : null}
      {conditions.map((condition) => {
        const view = conditionEffects.conditions.find((entry) => entry.key === condition.key);
        const info = findDnd5eCondition(condition.key);
        const label = view?.label ?? condition.key;
        return (
          <View key={condition.id} style={styles.condition}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText style={{ color: '#E6BE74', fontFamily: fonts.sansSemiBold }}>{label}</AppText>
                <View style={styles.duration}>
                  <Hourglass size={12} color={colors.fgSecondary} />
                  <AppText variant="small">
                    {condition.roundsRemaining === null ? 'até ser removida' : `${formatDnd5eConditionRounds(condition.roundsRemaining)} restantes`}
                  </AppText>
                </View>
                {view?.suppressedBy ? (
                  <AppText variant="small" style={{ color: colors.fgMuted }}>
                    Sem efeito: imunidade ({view.suppressedBy}).
                  </AppText>
                ) : (
                  <AppText variant="small">{info?.summary ?? 'Condição personalizada, sem efeitos automáticos.'}</AppText>
                )}
                {info?.includes?.length ? (
                  <AppText variant="small" style={{ color: colors.fgMuted }}>
                    Impõe também: {info.includes.map(labelOf).join(', ')}.
                  </AppText>
                ) : null}
                {view ? <Rules condition={view} /> : null}
              </View>
              {canEditPlay ? (
                <IconButton icon={<X size={16} color={colors.fgSecondary} />} accessibilityLabel={`Remover ${label}`} onPress={() => void remove(condition)} />
              ) : null}
            </View>
            {canEditPlay && info?.maxLevel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <AppText variant="small" style={{ flex: 1 }}>
                  Nível {condition.level ?? 1} de {info.maxLevel}
                </AppText>
                <IconButton icon={<Minus size={16} color={colors.fg} />} accessibilityLabel={`Diminuir ${info.label}`} onPress={() => void changeLevel(condition, (condition.level ?? 1) - 1)} />
                <IconButton
                  icon={<Plus size={16} color={colors.fg} />}
                  accessibilityLabel={`Aumentar ${info.label}`}
                  disabled={(condition.level ?? 1) >= info.maxLevel}
                  onPress={() => void changeLevel(condition, (condition.level ?? 1) + 1)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {implied.map((condition) => (
        <View key={`imposta-${condition.key}`} style={styles.implied}>
          <AppText style={{ color: colors.fgSecondary, fontFamily: fonts.sansSemiBold }}>
            {condition.label}{' '}
            <AppText variant="small" style={{ color: colors.fgMuted }}>
              · imposta por {condition.impliedBy}
            </AppText>
          </AppText>
          {condition.definition ? <AppText variant="small">{condition.definition.summary}</AppText> : null}
          <Rules condition={condition} />
        </View>
      ))}

      {effectLines.length > 0 ? (
        <View style={styles.effects}>
          <AppText variant="eyebrow">Efeitos em vigor</AppText>
          {effectLines.map((line) => (
            <AppText key={`${line.label}-${line.detail}`} variant="small">
              <AppText variant="small" style={{ fontFamily: fonts.sansSemiBold, color: line.severe ? '#EC9384' : colors.fg }}>
                {line.label}:{' '}
              </AppText>
              {line.detail}
            </AppText>
          ))}
          <AppText variant="small" style={{ color: colors.fgMuted }}>
            Os números da ficha já mostram esses efeitos.
          </AppText>
        </View>
      ) : null}

      {canEditPlay ? (
        chosen === null ? (
          <Button label="Aplicar condição" compact variant="secondary" icon={<Plus size={14} color={colors.fg} />} onPress={() => setPicking(true)} />
        ) : (
          <View style={styles.form}>
            <AppText style={{ fontFamily: fonts.sansSemiBold }}>{chosen === CUSTOM_CONDITION ? 'Condição personalizada' : (definition?.label ?? chosen)}</AppText>
            {definition ? <AppText variant="small">{definition.summary}</AppText> : null}
            {chosen === CUSTOM_CONDITION ? (
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                maxLength={40}
                placeholder="Ex.: Abençoado"
                placeholderTextColor={colors.fgSubtle}
                accessibilityLabel="Nome da condição personalizada"
                style={styles.input}
              />
            ) : null}
            {definition?.maxLevel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <AppText style={{ flex: 1 }}>Nível</AppText>
                <IconButton icon={<Minus size={16} color={colors.fg} />} accessibilityLabel="Diminuir nível" disabled={level <= 1} onPress={() => setLevel((current) => Math.max(1, current - 1))} />
                <AppText variant="number">{level}</AppText>
                <IconButton
                  icon={<Plus size={16} color={colors.fg} />}
                  accessibilityLabel="Aumentar nível"
                  disabled={level >= definition.maxLevel}
                  onPress={() => setLevel((current) => Math.min(definition.maxLevel ?? 1, current + 1))}
                />
              </View>
            ) : null}
            <AppText style={{ fontFamily: fonts.sansMedium, fontSize: 14 }}>Duração</AppText>
            <View style={styles.chips}>
              {dnd5eConditionDurations.map((preset) => (
                <Chip key={preset.label} label={preset.label} selected={duration === preset.rounds} onPress={() => setDuration(preset.rounds)} />
              ))}
              <Chip label="Outra (em rodadas)" selected={duration === 'custom'} onPress={() => setDuration('custom')} />
            </View>
            {duration === 'custom' ? (
              <TextInput
                value={customRounds}
                onChangeText={setCustomRounds}
                keyboardType="number-pad"
                placeholder="Rodadas"
                placeholderTextColor={colors.fgSubtle}
                accessibilityLabel="Quantidade de rodadas"
                style={[styles.input, { width: 120 }, roundsInvalid && customRounds !== '' && { borderColor: '#E26D5A' }]}
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button label="Cancelar" compact variant="ghost" onPress={resetForm} style={{ flex: 1 }} />
              <Button label="Aplicar" compact loading={busy} disabled={!key || roundsInvalid} onPress={() => void apply()} style={{ flex: 1 }} />
            </View>
          </View>
        )
      ) : null}

      <PickerSheet
        visible={picking}
        title="Aplicar condição"
        options={options}
        onClose={() => setPicking(false)}
        onSelect={(value) => {
          setPicking(false);
          setChosen(value);
          // Cada vez que recebe Exaustão, o personagem ganha 1 nível.
          const max = findDnd5eCondition(value)?.maxLevel;
          setLevel(max ? Math.min((byKey.get(value)?.level ?? 0) + 1, max) : 1);
        }}
      />
    </Card>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { backgroundColor: colors.hover }]}
    >
      <AppText style={{ fontSize: 13, color: selected ? colors.fgAccent : colors.fgSecondary }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  condition: { gap: spacing[2], padding: 10, borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(217, 165, 74, 0.3)', backgroundColor: colors.warningBg },
  implied: { gap: 4, padding: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full, borderWidth: 1, borderColor: 'rgba(217, 165, 74, 0.3)' },
  rules: { gap: 4, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: 'rgba(217, 165, 74, 0.3)' },
  effects: { gap: 6, padding: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.sunken },
  form: { gap: spacing[2], padding: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.lineStrong },
  input: { height: 44, paddingHorizontal: spacing[3], color: colors.fg, fontFamily: fonts.sans, fontSize: 16, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.md, backgroundColor: colors.sunken },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, borderWidth: 1, borderColor: colors.lineStrong },
  chipSelected: { borderColor: 'rgba(206, 191, 157, 0.7)', backgroundColor: 'rgba(228, 216, 189, 0.08)' },
});
