import { createCharacter } from '@codexveil/database';
import {
  TRIANGLE_ANOMALIES,
  TRIANGLE_COMPETENCIES,
  TRIANGLE_QUALITIES,
  TRIANGLE_REALITIES,
  creationIssues,
  createDefaultTriangleAgencySheet,
  triangleAgencyDefaultResources,
  triangleQualityLabels,
  type TriangleAgencySheet,
} from '@codexveil/rpg-systems/triangle-agency';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  CreationAnswersCard,
  answersComplete,
  answersFor,
} from '@/components/characters/creation-answers';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

export function TriangleAgencyMobileWizard({
  campaign,
}: {
  campaign: { id: string; name: string; questions: readonly string[] } | null;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<TriangleAgencySheet>(() => {
    const base = createDefaultTriangleAgencySheet();
    return {
      ...base,
      anomalousAbilities: TRIANGLE_QUALITIES.slice(0, 3).map((quality) => ({
        name: '',
        quality,
        notes: '',
      })),
      relationships: [1, 2, 3].map(() => ({ name: '', description: '', connection: 0, bonus: '' })),
    };
  });
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const questions = campaign?.questions ?? [];
  const issues = creationIssues(sheet);
  const submit = async () => {
    setBusy(true);
    try {
      const id = await createCharacter(getSupabase(), {
        name: name.trim(),
        systemId: 'triangle-agency',
        campaignId: campaign?.id ?? null,
        sheet,
        resources: triangleAgencyDefaultResources(sheet),
        ...(campaign ? { answers: answersFor(questions, answers) } : {}),
      });
      toast({ tone: 'success', title: 'Agente integrado' });
      router.replace(`/personagem/${id}`);
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível integrar',
        description: failureMessage(error),
      });
    } finally {
      setBusy(false);
    }
  };
  const choose = (field: 'anomaly' | 'reality' | 'competency', value: string) =>
    setSheet({
      ...sheet,
      arc: {
        ...sheet.arc,
        [field]: value,
        ...(field === 'competency' ? { competencyTitle: value } : {}),
      },
    });
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
    >
      <AppText variant="eyebrow">
        {campaign ? `Campanha: ${campaign.name}` : 'Ficha pessoal · Triangle Agency'}
      </AppText>
      <AppText variant="title">Integração do Agente</AppText>
      <Card>
        <Field label="Nome do Agente" value={name} onChangeText={setName} maxLength={80} />
        <Field
          label="Pronomes"
          value={sheet.identity.pronouns}
          onChangeText={(pronouns) =>
            setSheet({ ...sheet, identity: { ...sheet.identity, pronouns } })
          }
        />
      </Card>
      {(
        [
          ['Anomalia', 'anomaly', TRIANGLE_ANOMALIES],
          ['Realidade', 'reality', TRIANGLE_REALITIES],
          ['Competência', 'competency', TRIANGLE_COMPETENCIES],
        ] as const
      ).map(([label, field, values]) => (
        <Card key={field}>
          <AppText variant="heading">{label}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {values.map((value) => (
              <Chip
                key={value}
                label={value}
                selected={sheet.arc[field] === value}
                onPress={() => choose(field, value)}
              />
            ))}
          </View>
        </Card>
      ))}
      <Card>
        <AppText variant="heading">3 Habilidades Anômalas</AppText>
        {sheet.anomalousAbilities.map((ability, index) => (
          <View key={index} style={{ gap: spacing[2] }}>
            <Field
              label={`Habilidade ${index + 1}`}
              value={ability.name}
              onChangeText={(value) =>
                setSheet({
                  ...sheet,
                  anomalousAbilities: sheet.anomalousAbilities.map((item, position) =>
                    position === index ? { ...item, name: value } : item,
                  ),
                })
              }
            />
            <AppText variant="small">Qualidade</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TRIANGLE_QUALITIES.map((quality) => (
                <Chip
                  key={quality}
                  label={triangleQualityLabels[quality]}
                  selected={ability.quality === quality}
                  onPress={() =>
                    setSheet({
                      ...sheet,
                      anomalousAbilities: sheet.anomalousAbilities.map((item, position) =>
                        position === index ? { ...item, quality } : item,
                      ),
                    })
                  }
                />
              ))}
            </View>
          </View>
        ))}
      </Card>
      <Card>
        <AppText variant="heading">Garantias de Qualidade · 9 em 3 Qualidades</AppText>
        {TRIANGLE_QUALITIES.map((quality) => {
          const value = sheet.qualityAssurances.maximum[quality];
          return (
            <View
              key={quality}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <AppText>{triangleQualityLabels[quality]}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Button
                  label="−"
                  compact
                  variant="ghost"
                  disabled={value <= 0}
                  onPress={() =>
                    setSheet({
                      ...sheet,
                      qualityAssurances: {
                        maximum: { ...sheet.qualityAssurances.maximum, [quality]: value - 1 },
                        current: { ...sheet.qualityAssurances.current, [quality]: value - 1 },
                      },
                    })
                  }
                />
                <AppText variant="number">{value}</AppText>
                <Button
                  label="+"
                  compact
                  variant="ghost"
                  disabled={value >= 9}
                  onPress={() =>
                    setSheet({
                      ...sheet,
                      qualityAssurances: {
                        maximum: { ...sheet.qualityAssurances.maximum, [quality]: value + 1 },
                        current: { ...sheet.qualityAssurances.current, [quality]: value + 1 },
                      },
                    })
                  }
                />
              </View>
            </View>
          );
        })}
      </Card>
      <Card>
        <AppText variant="heading">3 Relacionamentos</AppText>
        {sheet.relationships.map((relationship, index) => (
          <Field
            key={index}
            label={`Relacionamento ${index + 1}`}
            value={relationship.name}
            onChangeText={(value) =>
              setSheet({
                ...sheet,
                relationships: sheet.relationships.map((item, position) =>
                  position === index ? { ...item, name: value } : item,
                ),
              })
            }
          />
        ))}
      </Card>
      <Card>
        <Field
          label="Como entrou em contato com a Anomalia?"
          multiline
          value={sheet.identity.anomalyContact}
          onChangeText={(anomalyContact) =>
            setSheet({ ...sheet, identity: { ...sheet.identity, anomalyContact } })
          }
        />
        <Field
          label="Como a Agência encontrou o Agente?"
          multiline
          value={sheet.identity.agencyContact}
          onChangeText={(agencyContact) =>
            setSheet({ ...sheet, identity: { ...sheet.identity, agencyContact } })
          }
        />
      </Card>
      <CreationAnswersCard questions={questions} values={answers} onChange={setAnswers} />
      {issues.map((issue) => (
        <AppText key={issue} style={{ color: colors.danger }}>
          • {issue}
        </AppText>
      ))}
      <Button
        label="Concluir integração"
        loading={busy}
        disabled={!name.trim() || issues.length > 0 || !answersComplete(questions, answers)}
        onPress={() => void submit()}
      />
    </ScrollView>
  );
}
