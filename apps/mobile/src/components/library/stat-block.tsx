import {
  ABILITIES,
  CHALLENGE_RATINGS,
  CREATURE_SIZES,
  abilityLabels,
  abilityModifier,
  creatureSizeLabels,
  experienceForChallenge,
  formatModifier,
  proficiencyBonusForChallenge,
  type Dnd5eStatBlock,
  type StatBlockEntry,
} from '@codexveil/rpg-systems/dnd5e';
import { Plus, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, ChipRow, NumberField } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { PickerField } from '@/components/ui/picker';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

const SECTIONS = [
  ['traits', 'Características'],
  ['actions', 'Ações'],
  ['bonusActions', 'Ações bônus'],
  ['reactions', 'Reações'],
  ['legendaryActions', 'Ações lendárias'],
] as const;

type TextKey =
  | 'creatureType'
  | 'alignment'
  | 'armorNote'
  | 'hitPointFormula'
  | 'speed'
  | 'savingThrows'
  | 'skills'
  | 'damageResistances'
  | 'damageImmunities'
  | 'conditionImmunities'
  | 'senses'
  | 'languages';

/** Bloco de estatísticas de D&D para consulta (somente mestres o recebem). */
export function StatBlockView({ name, statBlock }: { name: string; statBlock: Dnd5eStatBlock }) {
  const proficiency = proficiencyBonusForChallenge(statBlock.challengeRating);
  const xp = experienceForChallenge(statBlock.challengeRating);
  const lines: [string, string][] = [
    ['Testes de resistência', statBlock.savingThrows],
    ['Perícias', statBlock.skills],
    ['Resistências', statBlock.damageResistances],
    ['Imunidades a dano', statBlock.damageImmunities],
    ['Imunidades a condições', statBlock.conditionImmunities],
    ['Sentidos', statBlock.senses],
    ['Idiomas', statBlock.languages],
  ];
  return (
    <View style={styles.parchment} accessibilityLabel={`Estatísticas de ${name}`}>
      <AppText style={styles.title}>{name}</AppText>
      <AppText style={styles.subtitle}>
        {creatureSizeLabels[statBlock.size]}
        {statBlock.creatureType ? ` ${statBlock.creatureType.toLowerCase()}` : ''}
        {statBlock.alignment ? `, ${statBlock.alignment}` : ''}
      </AppText>
      <View style={styles.rule} />
      <AppText style={styles.ink}>
        <AppText style={styles.label}>CA </AppText>
        {statBlock.armorClass}
        {statBlock.armorNote ? ` (${statBlock.armorNote})` : ''}
      </AppText>
      <AppText style={styles.ink}>
        <AppText style={styles.label}>PV </AppText>
        {statBlock.hitPoints}
        {statBlock.hitPointFormula ? ` (${statBlock.hitPointFormula})` : ''}
      </AppText>
      {statBlock.speed ? (
        <AppText style={styles.ink}>
          <AppText style={styles.label}>Deslocamento </AppText>
          {statBlock.speed}
        </AppText>
      ) : null}
      <View style={styles.rule} />
      <View style={styles.abilities}>
        {ABILITIES.map((ability) => (
          <View key={ability} style={{ alignItems: 'center', minWidth: 44 }}>
            <AppText style={styles.label}>{abilityLabels[ability].abbreviation}</AppText>
            <AppText style={styles.ink}>
              {statBlock.abilities[ability]} (
              {formatModifier(abilityModifier(statBlock.abilities[ability]))})
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.rule} />
      {lines
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <AppText key={label} style={styles.ink}>
            <AppText style={styles.label}>{label} </AppText>
            {value}
          </AppText>
        ))}
      <AppText style={styles.ink}>
        <AppText style={styles.label}>ND </AppText>
        {statBlock.challengeRating}
        {xp !== null ? ` (${xp.toLocaleString('pt-BR')} XP` : ''}
        {proficiency !== null ? `; BP ${formatModifier(proficiency)})` : xp !== null ? ')' : ''}
      </AppText>
      {SECTIONS.map(([key, label]) =>
        statBlock[key].length > 0 ? (
          <View key={key} style={{ gap: 4 }}>
            <AppText style={styles.section}>{label}</AppText>
            {statBlock[key].map((entry, index) => (
              <AppText key={`${entry.name}-${index}`} style={styles.ink}>
                <AppText style={[styles.label, { fontStyle: 'italic' }]}>{entry.name}. </AppText>
                {entry.description}
              </AppText>
            ))}
          </View>
        ) : null,
      )}
    </View>
  );
}

function EntryList({
  label,
  entries,
  onChange,
}: {
  label: string;
  entries: StatBlockEntry[];
  onChange: (entries: StatBlockEntry[]) => void;
}) {
  return (
    <View style={{ gap: spacing[2] }}>
      <AppText style={{ fontFamily: fonts.sansMedium }}>{label}</AppText>
      {entries.map((entry, index) => (
        <View key={index} style={styles.entry}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Nome"
                value={entry.name}
                maxLength={80}
                onChangeText={(name) =>
                  onChange(
                    entries.map((item, position) =>
                      position === index ? { ...item, name } : item,
                    ),
                  )
                }
              />
            </View>
            <IconButton
              icon={<Trash2 size={18} color={colors.fgSecondary} />}
              accessibilityLabel={`Remover ${entry.name || 'entrada'}`}
              onPress={() => onChange(entries.filter((_, position) => position !== index))}
            />
          </View>
          <Field
            label="Descrição"
            value={entry.description}
            multiline
            maxLength={4000}
            onChangeText={(description) =>
              onChange(
                entries.map((item, position) =>
                  position === index ? { ...item, description } : item,
                ),
              )
            }
          />
        </View>
      ))}
      {entries.length < 40 ? (
        <Button
          label={`Adicionar em ${label.toLowerCase()}`}
          compact
          variant="ghost"
          icon={<Plus size={14} color={colors.fgSecondary} />}
          onPress={() => onChange([...entries, { name: 'Nova entrada', description: '' }])}
        />
      ) : null}
    </View>
  );
}

/** Edição completa do bloco de estatísticas (o mesmo formato do site). */
export function StatBlockEditor({
  value,
  onChange,
}: {
  value: Dnd5eStatBlock;
  onChange: (value: Dnd5eStatBlock) => void;
}) {
  const set = (patch: Partial<Dnd5eStatBlock>) => onChange({ ...value, ...patch });
  const text = (label: string, key: TextKey, max: number) => (
    <Field
      label={label}
      value={value[key]}
      maxLength={max}
      onChangeText={(next) => set({ [key]: next })}
    />
  );
  return (
    <View style={{ gap: spacing[3] }}>
      <AppText style={{ fontFamily: fonts.sansMedium }}>Tamanho</AppText>
      <ChipRow>
        {CREATURE_SIZES.map((size) => (
          <Chip
            key={size}
            label={creatureSizeLabels[size]}
            selected={value.size === size}
            onPress={() => set({ size })}
          />
        ))}
      </ChipRow>
      {text('Tipo', 'creatureType', 60)}
      {text('Alinhamento', 'alignment', 40)}
      <View style={styles.row}>
        <NumberField
          label="CA"
          value={value.armorClass}
          onChange={(armorClass) => set({ armorClass: Math.min(50, Math.max(0, armorClass ?? 0)) })}
          width={80}
        />
        <View style={{ flex: 1 }}>{text('Nota da CA', 'armorNote', 80)}</View>
      </View>
      <View style={styles.row}>
        <NumberField
          label="PV"
          value={value.hitPoints}
          onChange={(hitPoints) => set({ hitPoints: Math.min(9999, Math.max(1, hitPoints ?? 1)) })}
          width={80}
        />
        <View style={{ flex: 1 }}>{text('Fórmula dos PV', 'hitPointFormula', 40)}</View>
      </View>
      {text('Deslocamento', 'speed', 120)}
      <AppText style={{ fontFamily: fonts.sansMedium }}>Atributos</AppText>
      <View style={styles.grid}>
        {ABILITIES.map((ability) => (
          <NumberField
            key={ability}
            label={abilityLabels[ability].abbreviation}
            value={value.abilities[ability]}
            width={72}
            onChange={(score) =>
              set({
                abilities: {
                  ...value.abilities,
                  [ability]: Math.min(30, Math.max(1, score ?? 10)),
                },
              })
            }
          />
        ))}
      </View>
      {text('Testes de resistência', 'savingThrows', 200)}
      {text('Perícias', 'skills', 300)}
      {text('Resistências a dano', 'damageResistances', 300)}
      {text('Imunidades a dano', 'damageImmunities', 300)}
      {text('Imunidades a condições', 'conditionImmunities', 300)}
      {text('Sentidos', 'senses', 200)}
      {text('Idiomas', 'languages', 200)}
      <PickerField
        label="Nível de desafio"
        value={value.challengeRating}
        options={CHALLENGE_RATINGS.map((rating) => ({ value: rating, label: `ND ${rating}` }))}
        onChange={(challengeRating) => set({ challengeRating })}
      />
      {SECTIONS.map(([key, label]) => (
        <EntryList
          key={key}
          label={label}
          entries={value[key]}
          onChange={(entries) => set({ [key]: entries })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  parchment: {
    gap: 6,
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.parchmentEdge,
  },
  title: { fontFamily: fonts.display, fontSize: 20, color: palette.wine[800] },
  subtitle: { fontStyle: 'italic', color: colors.inkMuted, fontSize: 14 },
  rule: { height: 1, backgroundColor: 'rgba(110, 30, 48, 0.35)', marginVertical: 4 },
  ink: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  label: { color: colors.ink, fontFamily: fonts.sansSemiBold, fontSize: 14 },
  section: { fontFamily: fonts.display, fontSize: 16, color: palette.wine[800], marginTop: 6 },
  abilities: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  entry: {
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
