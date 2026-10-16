import {
  ABILITIES,
  ABILITY_SCORE_MAX,
  ABILITY_SCORE_MIN,
  SKILLS,
  abilityLabels,
  formatModifier,
  proficiencyLevelLabels,
  skillDefinitions,
  type Ability,
  type ProficiencyLevel,
} from '@codexveil/rpg-systems/dnd5e';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from '@/components/ui/button';
import { AppText, Card } from '@/components/ui/primitives';
import { colors, radii, spacing } from '@/lib/theme';
import { useSheet } from './context';

/** Ordem do ciclo ao tocar na proficiência de uma perícia. */
const proficiencyCycle: ProficiencyLevel[] = ['none', 'proficient', 'expertise', 'half'];
const marks: Record<ProficiencyLevel, string> = { none: '○', half: '◐', proficient: '●', expertise: '◆' };

export function AttributesSection() {
  const { sheet, derived, updateSheet, canEditSheet } = useSheet();

  const setScore = (ability: Ability, delta: number) =>
    updateSheet((current) => ({
      ...current,
      abilities: {
        ...current.abilities,
        [ability]: Math.min(ABILITY_SCORE_MAX, Math.max(ABILITY_SCORE_MIN, current.abilities[ability] + delta)),
      },
    }));

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={styles.grid}>
        {ABILITIES.map((ability) => (
          <View key={ability} style={styles.ability} accessible={!canEditSheet} accessibilityLabel={`${abilityLabels[ability].name} ${sheet.abilities[ability]}, modificador ${formatModifier(derived.abilityModifiers[ability])}`}>
            <AppText variant="eyebrow">{abilityLabels[ability].abbreviation}</AppText>
            <AppText variant="display" style={{ fontSize: 28, lineHeight: 32 }}>
              {formatModifier(derived.abilityModifiers[ability])}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {canEditSheet ? <IconButton icon={<Minus size={14} color={colors.fgSecondary} />} accessibilityLabel={`Diminuir ${abilityLabels[ability].name}`} onPress={() => setScore(ability, -1)} /> : null}
              <AppText style={{ minWidth: 24, textAlign: 'center' }}>{sheet.abilities[ability]}</AppText>
              {canEditSheet ? <IconButton icon={<Plus size={14} color={colors.fgSecondary} />} accessibilityLabel={`Aumentar ${abilityLabels[ability].name}`} onPress={() => setScore(ability, 1)} /> : null}
            </View>
          </View>
        ))}
      </View>

      <Card>
        <AppText variant="heading">Testes de resistência</AppText>
        {ABILITIES.map((ability) => {
          const proficient = sheet.savingThrows[ability].proficient;
          return (
            <Pressable
              key={ability}
              disabled={!canEditSheet}
              onPress={() =>
                updateSheet((current) => ({
                  ...current,
                  savingThrows: { ...current.savingThrows, [ability]: { ...current.savingThrows[ability], proficient: !proficient } },
                }))
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: proficient, disabled: !canEditSheet }}
              accessibilityLabel={`Proficiência em resistência de ${abilityLabels[ability].name}, total ${formatModifier(derived.savingThrows[ability])}`}
              style={styles.row}
            >
              <AppText style={{ width: 22, color: proficient ? colors.fgBrand : colors.fgSubtle }}>{proficient ? '●' : '○'}</AppText>
              <AppText style={{ flex: 1 }}>{abilityLabels[ability].name}</AppText>
              <AppText variant="number" style={{ fontSize: 18 }}>
                {formatModifier(derived.savingThrows[ability])}
              </AppText>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <AppText variant="heading">Perícias</AppText>
        <AppText variant="muted">
          Percepção passiva {derived.passivePerception}. {canEditSheet ? 'Toque para alternar a proficiência.' : ''}
        </AppText>
        {SKILLS.map((skill) => {
          const entry = sheet.skills[skill];
          const definition = skillDefinitions[skill];
          const next = proficiencyCycle[(proficiencyCycle.indexOf(entry.proficiency) + 1) % proficiencyCycle.length] ?? 'none';
          return (
            <Pressable
              key={skill}
              disabled={!canEditSheet}
              onPress={() =>
                updateSheet((current) => ({
                  ...current,
                  skills: { ...current.skills, [skill]: { ...current.skills[skill], proficiency: next } },
                }))
              }
              accessibilityRole="button"
              accessibilityLabel={`${definition.label}: ${proficiencyLevelLabels[entry.proficiency]}, total ${formatModifier(derived.skills[skill].bonus)}`}
              accessibilityHint={canEditSheet ? `Muda para ${proficiencyLevelLabels[next]}` : undefined}
              style={styles.row}
            >
              <AppText style={{ width: 22, color: entry.proficiency === 'none' ? colors.fgSubtle : colors.fgBrand }}>{marks[entry.proficiency]}</AppText>
              <AppText style={{ flex: 1 }}>
                {definition.label} <AppText variant="small">({abilityLabels[definition.ability].abbreviation})</AppText>
              </AppText>
              <AppText variant="number" style={{ fontSize: 18 }}>
                {formatModifier(derived.skills[skill].bonus)}
              </AppText>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  ability: { width: '31.5%', alignItems: 'center', paddingVertical: spacing[2], borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.line },
});
