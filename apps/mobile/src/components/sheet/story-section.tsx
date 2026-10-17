import { HIT_DICE, type Dnd5eClass } from '@codexveil/rpg-systems/dnd5e';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { colors, spacing } from '@/lib/theme';
import { useSheet } from './context';

const detailFields = [
  { key: 'appearance', label: 'Descrição física', max: 4000 },
  { key: 'personality', label: 'Personalidade', max: 4000 },
  { key: 'goals', label: 'Objetivos', max: 4000 },
  { key: 'backstory', label: 'História', max: 20000 },
  { key: 'notes', label: 'Anotações', max: 20000 },
] as const;

/** Identidade e crônica do personagem (salvas automaticamente). */
export function StorySection() {
  const { sheet, derived, updateSheet, canEditSheet } = useSheet();
  const classes = sheet.identity.classes;
  const setClasses = (next: Dnd5eClass[]) => updateSheet((current) => ({ ...current, identity: { ...current.identity, classes: next } }));
  const patchClass = (index: number, patch: Partial<Dnd5eClass>) => setClasses(classes.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));
  return (
    <View style={{ gap: spacing[4] }}>
      <Card>
        <AppText variant="heading">Identidade</AppText>
        <Field
          label="Espécie"
          value={sheet.identity.species}
          editable={canEditSheet}
          maxLength={60}
          onChangeText={(species) => updateSheet((current) => ({ ...current, identity: { ...current.identity, species } }))}
        />
        <Field
          label="Antecedente"
          value={sheet.identity.background}
          editable={canEditSheet}
          maxLength={60}
          onChangeText={(background) => updateSheet((current) => ({ ...current, identity: { ...current.identity, background } }))}
        />
        <Field
          label="Alinhamento"
          value={sheet.identity.alignment}
          editable={canEditSheet}
          maxLength={40}
          onChangeText={(alignment) => updateSheet((current) => ({ ...current, identity: { ...current.identity, alignment } }))}
        />
      </Card>
      <Card>
        <AppText variant="heading">Classes e níveis</AppText>
        <AppText variant="muted">Nível total {derived.level}. Multiclasse: até 4 classes.</AppText>
        {classes.map((entry, index) => (
          <View key={index} style={{ gap: spacing[2], padding: spacing[3], borderRadius: 10, borderWidth: 1, borderColor: colors.line }}>
            <Field label="Classe" value={entry.name} editable={canEditSheet} maxLength={40} onChangeText={(name) => patchClass(index, { name })} />
            <Field label="Subclasse" value={entry.subclass} editable={canEditSheet} maxLength={60} onChangeText={(subclass) => patchClass(index, { subclass })} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <AppText style={{ flex: 1 }}>Nível {entry.level}</AppText>
              {canEditSheet ? (
                <>
                  <IconButton icon={<Minus size={16} color={colors.fg} />} accessibilityLabel={`Diminuir o nível de ${entry.name || 'classe'}`} disabled={entry.level <= 1} onPress={() => patchClass(index, { level: entry.level - 1 })} />
                  <IconButton icon={<Plus size={16} color={colors.fg} />} accessibilityLabel={`Aumentar o nível de ${entry.name || 'classe'}`} disabled={derived.level >= 20} onPress={() => patchClass(index, { level: entry.level + 1 })} />
                </>
              ) : null}
            </View>
            <ChipRow>
              {HIT_DICE.map((die) => (
                <Chip key={die} label={die} selected={entry.hitDie === die} disabled={!canEditSheet} onPress={() => patchClass(index, { hitDie: die })} />
              ))}
            </ChipRow>
            {canEditSheet && classes.length > 1 ? (
              <Button label="Remover classe" compact variant="ghost" icon={<Trash2 size={14} color={colors.fgSecondary} />} onPress={() => setClasses(classes.filter((_, position) => position !== index))} />
            ) : null}
          </View>
        ))}
        {canEditSheet && classes.length < 4 && derived.level < 20 ? (
          <Button label="Adicionar classe (multiclasse)" compact variant="secondary" icon={<Plus size={14} color={colors.fg} />} onPress={() => setClasses([...classes, { name: '', subclass: '', level: 1, hitDie: 'd8' }])} />
        ) : null}
        <AppText variant="small">Ao subir de nível, ajuste também os pontos de vida máximos na aba Jogo.</AppText>
      </Card>
      <Card>
        <AppText variant="heading">Crônica</AppText>
        {detailFields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            value={sheet.details[field.key]}
            editable={canEditSheet}
            maxLength={field.max}
            multiline
            onChangeText={(text) => updateSheet((current) => ({ ...current, details: { ...current.details, [field.key]: text } }))}
          />
        ))}
      </Card>
    </View>
  );
}
