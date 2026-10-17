import {
  ABILITIES,
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
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
import { Dices, Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, radii, spacing } from '@/lib/theme';
import { OptionCard } from './choice-fields';

export interface RollState {
  pool: (number | null)[];
  assignment: Partial<Record<Ability, number>>;
}

export const EMPTY_ROLLS: RollState = { pool: [null, null, null, null, null, null], assignment: {} };

type Scores = Dnd5eDraft['baseScores'];
const emptyScores = (): Scores => ({ str: null, dex: null, con: null, int: null, wis: null, cha: null });

interface Props {
  draft: Dnd5eDraft;
  methods: readonly AbilityScoreMethod[];
  classDef: ClassDefinition | undefined;
  rolls: RollState;
  error?: string | undefined;
  onMethod: (method: AbilityScoreMethod, scores: Scores) => void;
  onScores: (scores: Scores) => void;
  onRolls: (rolls: RollState) => void;
}

function ValueChip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.value, selected && styles.valueSelected, pressed && { backgroundColor: colors.hover }, disabled && { opacity: 0.35 }]}
    >
      <AppText style={{ fontFamily: fonts.sansMedium, color: selected ? colors.fgAccent : colors.fgSecondary }}>{label}</AppText>
    </Pressable>
  );
}

export function AbilityScoresField({ draft, methods, classDef, rolls, error, onMethod, onScores, onRolls }: Props) {
  const scores = draft.baseScores;
  const final = finalAbilityScores(draft);
  const method = draft.abilityMethod;

  const choose = (next: AbilityScoreMethod) => {
    if (next === method) return;
    onMethod(next, next === 'point_buy' ? (Object.fromEntries(ABILITIES.map((ability) => [ability, POINT_BUY_MIN])) as Scores) : emptyScores());
  };

  const applyRolls = (next: RollState) => {
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

  const cost = pointBuyCost(scores) ?? 0;

  return (
    <View style={{ gap: spacing[3] }}>
      {methods.map((entry) => (
        <OptionCard key={entry} selected={entry === method} title={abilityScoreMethodLabels[entry].name} description={abilityScoreMethodLabels[entry].description} onPress={() => choose(entry)} />
      ))}

      {method === 'standard_array' && classDef ? (
        <Button label={`Usar a sugestão para ${classDef.name}`} variant="secondary" compact onPress={() => onScores({ ...classDef.standardArray })} />
      ) : null}
      {method === 'point_buy' ? (
        <AppText variant="muted">
          Pontos restantes: {POINT_BUY_BUDGET - cost} de {POINT_BUY_BUDGET}
        </AppText>
      ) : null}
      {method === 'random' ? (
        <View style={{ gap: spacing[2] }}>
          <Button
            label="Rolar 4d6 seis vezes"
            variant="secondary"
            icon={<Dices size={16} color={colors.fg} />}
            onPress={() => applyRolls({ pool: Array.from({ length: 6 }, () => rollAbilityScore()), assignment: {} })}
          />
          <AppText variant="small">Ou digite os totais rolados na mesa (3 a 18).</AppText>
          <View style={styles.pool}>
            {rolls.pool.map((value, index) => (
              <TextInput
                key={index}
                value={value === null ? '' : String(value)}
                onChangeText={(text) => {
                  const number = text.trim() === '' ? null : Math.trunc(Number(text));
                  applyRolls({ ...rolls, pool: rolls.pool.map((entry, position) => (position === index ? (Number.isFinite(number) ? number : null) : entry)) });
                }}
                keyboardType="number-pad"
                accessibilityLabel={`Rolagem ${index + 1}`}
                style={styles.poolInput}
              />
            ))}
          </View>
        </View>
      ) : null}

      {ABILITIES.map((ability) => {
        const base = scores[ability];
        const total = final?.[ability] ?? base;
        return (
          <View key={ability} style={styles.row}>
            <View style={styles.rowHeader}>
              <AppText style={{ flex: 1, fontFamily: fonts.sansMedium }}>{abilityLabels[ability].name}</AppText>
              <AppText variant="number" style={{ fontSize: 18 }}>
                {total ?? '—'}
              </AppText>
              <AppText variant="muted">{total === null ? '' : formatModifier(abilityModifier(total))}</AppText>
            </View>
            {method === 'standard_array' ? (
              <View style={styles.values}>
                {STANDARD_ARRAY.map((value) => {
                  const taken = ABILITIES.some((other) => other !== ability && scores[other] === value);
                  return <ValueChip key={value} label={String(value)} selected={base === value} disabled={taken} onPress={() => onScores({ ...scores, [ability]: base === value ? null : value })} />;
                })}
              </View>
            ) : null}
            {method === 'point_buy' ? (
              <View style={styles.stepper}>
                <IconButton
                  icon={<Minus size={18} color={colors.fg} />}
                  accessibilityLabel={`Diminuir ${abilityLabels[ability].name}`}
                  disabled={(base ?? POINT_BUY_MIN) <= POINT_BUY_MIN}
                  onPress={() => onScores({ ...scores, [ability]: Math.max(POINT_BUY_MIN, (base ?? POINT_BUY_MIN) - 1) })}
                />
                <AppText variant="number">{base ?? POINT_BUY_MIN}</AppText>
                <IconButton
                  icon={<Plus size={18} color={colors.fg} />}
                  accessibilityLabel={`Aumentar ${abilityLabels[ability].name}`}
                  disabled={
                    (base ?? POINT_BUY_MIN) >= POINT_BUY_MAX ||
                    (POINT_BUY_COSTS[(base ?? POINT_BUY_MIN) + 1] ?? Infinity) - (POINT_BUY_COSTS[base ?? POINT_BUY_MIN] ?? 0) > POINT_BUY_BUDGET - cost
                  }
                  onPress={() => onScores({ ...scores, [ability]: Math.min(POINT_BUY_MAX, (base ?? POINT_BUY_MIN) + 1) })}
                />
              </View>
            ) : null}
            {method === 'random' ? (
              <View style={styles.values}>
                {rolls.pool.map((value, index) =>
                  value === null ? null : (
                    <ValueChip
                      key={index}
                      label={String(value)}
                      selected={rolls.assignment[ability] === index}
                      disabled={Object.entries(rolls.assignment).some(([other, position]) => other !== ability && position === index)}
                      onPress={() => {
                        const assignment = { ...rolls.assignment };
                        if (assignment[ability] === index) delete assignment[ability];
                        else assignment[ability] = index;
                        applyRolls({ ...rolls, assignment });
                      }}
                    />
                  ),
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      <AppText variant="small" style={{ color: colors.fgSubtle }}>
        O número grande já inclui os aumentos do antecedente e dos talentos.
      </AppText>
      {error ? <AppText style={{ color: '#EC9384', fontFamily: fonts.sansMedium }}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing[2] },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  value: { minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  valueSelected: { borderColor: 'rgba(206, 191, 157, 0.7)', backgroundColor: 'rgba(228, 216, 189, 0.08)' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  poolInput: {
    width: 52,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
    color: colors.fg,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 18,
  },
});
