import { View } from 'react-native';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { spacing } from '@/lib/theme';
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
  const { sheet, updateSheet, canEditSheet } = useSheet();
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
        <AppText variant="muted">
          Classes: {sheet.identity.classes.map((entry) => `${entry.name || 'Sem nome'} ${entry.level} (${entry.hitDie})`).join(' / ')}. Multiclasse e níveis são ajustados pelo site.
        </AppText>
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
