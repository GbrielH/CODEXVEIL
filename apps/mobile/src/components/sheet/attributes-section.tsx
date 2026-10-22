import {
  ABILITIES,
  ABILITY_SCORE_MAX,
  ABILITY_SCORE_MIN,
  SKILLS,
  abilityLabels,
  formatModifier,
  netRollMode,
  passiveWithConditions,
  proficiencyLevelLabels,
  rollModeShortLabels,
  skillDefinitions,
  type Ability,
  type ConditionRollSource,
  type ProficiencyLevel,
} from '@codexveil/rpg-systems/dnd5e';
import { d20Expression, type DiceRollMode } from '@codexveil/domain';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { RollButton } from '@/components/dice/dice';
import { IconButton } from '@/components/ui/button';
import { AppText, Card } from '@/components/ui/primitives';
import { colors, radii, spacing } from '@/lib/theme';
import { useSheet } from './context';

/** Ordem do ciclo ao tocar na proficiência de uma perícia. */
const proficiencyCycle: ProficiencyLevel[] = ['none', 'proficient', 'expertise', 'half'];
const marks: Record<ProficiencyLevel, string> = {
  none: '○',
  half: '◐',
  proficient: '●',
  expertise: '◆',
};

/** Selo do efeito das condições: "Falha", "Vant." ou "Desv."; `null` se não houver efeito direto. */
function effectMark(
  sources: readonly ConditionRollSource[],
  autoFail: readonly string[] = [],
): string | null {
  if (autoFail.length > 0) return 'Falha';
  const mode = netRollMode(sources);
  return mode === 'advantage' || mode === 'disadvantage' ? rollModeShortLabels[mode] : null;
}

/** Vantagem ou desvantagem que as condições impõem à rolagem. */
function rollModeOf(sources: readonly ConditionRollSource[]): DiceRollMode {
  const mode = netRollMode(sources);
  return mode === 'advantage' || mode === 'disadvantage' ? mode : 'normal';
}

function EffectMark({ label }: { label: string | null }) {
  if (!label) return null;
  const tone =
    label === 'Vant.'
      ? { color: '#8CC7A3', borderColor: 'rgba(111, 179, 138, 0.5)' }
      : label === 'Falha'
        ? { color: '#EC9384', borderColor: 'rgba(226, 109, 90, 0.5)' }
        : { color: '#E6BE74', borderColor: 'rgba(217, 165, 74, 0.5)' };
  return (
    <AppText style={[styles.mark, tone]} accessibilityElementsHidden importantForAccessibility="no">
      {label.toUpperCase()}
    </AppText>
  );
}

export function AttributesSection() {
  const { sheet, derived, updateSheet, canEditSheet, conditionEffects: effects } = useSheet();
  const penalty = effects.d20Penalty;
  const valueStyle = penalty > 0 ? { fontSize: 18, color: '#E6BE74' } : { fontSize: 18 };
  const checkMark = effectMark(effects.abilityChecks);

  const setScore = (ability: Ability, delta: number) =>
    updateSheet((current) => ({
      ...current,
      abilities: {
        ...current.abilities,
        [ability]: Math.min(
          ABILITY_SCORE_MAX,
          Math.max(ABILITY_SCORE_MIN, current.abilities[ability] + delta),
        ),
      },
    }));

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={styles.grid}>
        {ABILITIES.map((ability) => (
          <View
            key={ability}
            style={styles.ability}
            accessible={!canEditSheet}
            accessibilityLabel={`${abilityLabels[ability].name} ${sheet.abilities[ability]}, modificador ${formatModifier(derived.abilityModifiers[ability])}`}
          >
            <AppText variant="eyebrow">{abilityLabels[ability].abbreviation}</AppText>
            {/* Tocar no modificador rola o teste do atributo (d20 + modificador). */}
            <RollButton
              expression={d20Expression(derived.abilityModifiers[ability] - penalty)}
              label={`Teste de ${abilityLabels[ability].name}`}
              mode={rollModeOf(effects.abilityChecks)}
            >
              <AppText variant="display" style={{ fontSize: 28, lineHeight: 32, color: penalty > 0 ? '#E6BE74' : undefined }}>
                {formatModifier(derived.abilityModifiers[ability] - penalty)}
              </AppText>
            </RollButton>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {canEditSheet ? (
                <IconButton
                  icon={<Minus size={14} color={colors.fgSecondary} />}
                  accessibilityLabel={`Diminuir ${abilityLabels[ability].name}`}
                  onPress={() => setScore(ability, -1)}
                />
              ) : null}
              <AppText style={{ minWidth: 24, textAlign: 'center' }}>
                {sheet.abilities[ability]}
              </AppText>
              {canEditSheet ? (
                <IconButton
                  icon={<Plus size={14} color={colors.fgSecondary} />}
                  accessibilityLabel={`Aumentar ${abilityLabels[ability].name}`}
                  onPress={() => setScore(ability, 1)}
                />
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <Card>
        <AppText variant="heading">Testes de resistência</AppText>
        {ABILITIES.map((ability) => {
          const proficient = sheet.savingThrows[ability].proficient;
          const total = derived.savingThrows[ability] - penalty;
          const mark = effectMark(
            effects.savingThrows[ability].rolls,
            effects.savingThrows[ability].autoFail,
          );
          return (
            <Pressable
              key={ability}
              disabled={!canEditSheet}
              onPress={() =>
                updateSheet((current) => ({
                  ...current,
                  savingThrows: {
                    ...current.savingThrows,
                    [ability]: { ...current.savingThrows[ability], proficient: !proficient },
                  },
                }))
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: proficient, disabled: !canEditSheet }}
              accessibilityLabel={`Proficiência em resistência de ${abilityLabels[ability].name}, total ${formatModifier(total)}${mark ? `, ${mark === 'Falha' ? 'falha automática' : mark}` : ''}`}
              style={styles.row}
            >
              <AppText style={{ width: 22, color: proficient ? colors.fgBrand : colors.fgSubtle }}>
                {proficient ? '●' : '○'}
              </AppText>
              <AppText style={{ flex: 1 }}>{abilityLabels[ability].name}</AppText>
              <EffectMark label={mark} />
              <RollButton
                expression={d20Expression(total)}
                label={`Resistência de ${abilityLabels[ability].name}`}
                mode={rollModeOf(effects.savingThrows[ability].rolls)}
                style={{ paddingHorizontal: 6 }}
              >
                <AppText variant="number" style={valueStyle}>
                  {formatModifier(total)}
                </AppText>
              </RollButton>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <AppText variant="heading">Perícias</AppText>
        <AppText variant="muted">
          Percepção passiva {passiveWithConditions(derived.passivePerception, effects)}.
          {penalty > 0 ? ` Já inclui −${penalty} da Exaustão.` : ''}{' '}
          {canEditSheet ? 'Toque para alternar a proficiência.' : ''}
        </AppText>
        {SKILLS.map((skill) => {
          const entry = sheet.skills[skill];
          const definition = skillDefinitions[skill];
          const next =
            proficiencyCycle[
              (proficiencyCycle.indexOf(entry.proficiency) + 1) % proficiencyCycle.length
            ] ?? 'none';
          return (
            <Pressable
              key={skill}
              disabled={!canEditSheet}
              onPress={() =>
                updateSheet((current) => ({
                  ...current,
                  skills: {
                    ...current.skills,
                    [skill]: { ...current.skills[skill], proficiency: next },
                  },
                }))
              }
              accessibilityRole="button"
              accessibilityLabel={`${definition.label}: ${proficiencyLevelLabels[entry.proficiency]}, total ${formatModifier(derived.skills[skill].bonus - penalty)}${checkMark ? `, ${checkMark}` : ''}`}
              accessibilityHint={
                canEditSheet ? `Muda para ${proficiencyLevelLabels[next]}` : undefined
              }
              style={styles.row}
            >
              <AppText
                style={{
                  width: 22,
                  color: entry.proficiency === 'none' ? colors.fgSubtle : colors.fgBrand,
                }}
              >
                {marks[entry.proficiency]}
              </AppText>
              <AppText style={{ flex: 1 }}>
                {definition.label}{' '}
                <AppText variant="small">
                  ({abilityLabels[definition.ability].abbreviation})
                </AppText>
              </AppText>
              <EffectMark label={checkMark} />
              <RollButton
                expression={d20Expression(derived.skills[skill].bonus - penalty)}
                label={definition.label}
                mode={rollModeOf(effects.abilityChecks)}
                style={{ paddingHorizontal: 6 }}
              >
                <AppText variant="number" style={valueStyle}>
                  {formatModifier(derived.skills[skill].bonus - penalty)}
                </AppText>
              </RollButton>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  ability: {
    width: '31.5%',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  mark: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
