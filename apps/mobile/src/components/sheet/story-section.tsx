import {
  ALIGNMENTS,
  findClassByName,
  listBackgrounds,
  listClasses,
  speciesOptionNames,
  withCurrentOption,
  type Dnd5eClass,
} from '@codexveil/rpg-systems/dnd5e';
import { View } from 'react-native';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { PickerField } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { colors, fonts, spacing } from '@/lib/theme';
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
  const patchClass = (index: number, patch: Partial<Dnd5eClass>) =>
    updateSheet((current) => ({
      ...current,
      identity: {
        ...current.identity,
        classes: current.identity.classes.map((entry, position) =>
          position === index ? { ...entry, ...patch } : entry,
        ),
      },
    }));
  return (
    <View style={{ gap: spacing[4] }}>
      <Card>
        <AppText variant="heading">Identidade</AppText>
        <IdentityPick
          label="Espécie"
          options={speciesOptionNames()}
          value={sheet.identity.species}
          editable={canEditSheet}
          onChange={(species) => updateSheet((current) => ({ ...current, identity: { ...current.identity, species } }))}
        />
        <IdentityPick
          label="Antecedente"
          options={listBackgrounds().map((background) => background.name)}
          value={sheet.identity.background}
          editable={canEditSheet}
          onChange={(background) => updateSheet((current) => ({ ...current, identity: { ...current.identity, background } }))}
        />
        <IdentityPick
          label="Alinhamento"
          options={ALIGNMENTS.map((alignment) => alignment.name)}
          value={sheet.identity.alignment}
          editable={canEditSheet}
          onChange={(alignment) => updateSheet((current) => ({ ...current, identity: { ...current.identity, alignment } }))}
        />
      </Card>
      <Card>
        <AppText variant="heading">Classes e níveis</AppText>
        <AppText variant="muted">Nível total {derived.level}. Multiclasse: até 4 classes.</AppText>
        {/* Sem digitação: classe, nível, subclasse e dado de vida vêm das regras. */}
        {classes.map((entry, index) => {
          const classDef = findClassByName(entry.name);
          return (
            <View
              key={index}
              style={{
                gap: spacing[2],
                padding: spacing[3],
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontFamily: fonts.sansSemiBold, color: colors.fg }}>
                    {classDef?.name ?? (entry.name || 'Classe não definida')} · {entry.level}º nível
                  </AppText>
                  <AppText variant="small">
                    {entry.subclass
                      ? `Subclasse: ${entry.subclass}`
                      : entry.level < 3
                        ? 'Subclasse no 3º nível'
                        : 'Sem subclasse'}
                  </AppText>
                </View>
                <Badge
                  label={`Dado de vida ${classDef?.hitDie ?? entry.hitDie}`}
                  tone="parchment"
                />
              </View>
              {/* Fichas antigas, com a classe escrita à mão: escolhe-se a classe do SRD. */}
              {canEditSheet && !classDef ? (
                <>
                  <AppText variant="small">
                    Esta classe não é do SRD 5.2.1. Escolha a correspondente:
                  </AppText>
                  <ChipRow>
                    {listClasses()
                      .filter(
                        (option) =>
                          !classes.some((other) => findClassByName(other.name)?.id === option.id),
                      )
                      .map((option) => (
                        <Chip
                          key={option.id}
                          label={option.name}
                          selected={false}
                          onPress={() =>
                            patchClass(index, { name: option.name, hitDie: option.hitDie })
                          }
                        />
                      ))}
                  </ChipRow>
                </>
              ) : null}
              {canEditSheet &&
              classDef &&
              entry.level >= 3 &&
              entry.subclass !== classDef.subclass.name ? (
                <ChipRow>
                  <Chip
                    label={`Subclasse: ${classDef.subclass.name}`}
                    selected={false}
                    onPress={() => patchClass(index, { subclass: classDef.subclass.name })}
                  />
                </ChipRow>
              ) : null}
            </View>
          );
        })}
        <AppText variant="small">
          Classe, nível e subclasse mudam pela subida de nível, na aba Evolução (que também abre
          classes novas na multiclasse).
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
            onChangeText={(text) =>
              updateSheet((current) => ({
                ...current,
                details: { ...current.details, [field.key]: text },
              }))
            }
          />
        ))}
      </Card>
    </View>
  );
}

/** Campo de identidade como lista de seleção (a escolha atual entra se não estiver na lista). */
function IdentityPick({
  label,
  options,
  value,
  editable,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  if (!editable) return <Field label={label} value={value} editable={false} />;
  return (
    <PickerField
      label={label}
      title={label}
      value={value}
      options={withCurrentOption(options, value).map((option) => ({ value: option, label: option }))}
      onChange={onChange}
    />
  );
}
