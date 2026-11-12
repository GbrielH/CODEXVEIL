import { createCharacter } from '@codexveil/database';
import {
  ORDEM2_ATTRIBUTES,
  ORDEM2_PROFILES,
  createDefaultOrdem2Sheet,
  ordem2AttributeLabels,
  ordem2CreationIssues,
  ordem2DefaultResources,
  ordem2ProfileDescriptions,
  ordem2ProfileLabels,
  ordem2SkillsFor,
  type Ordem2Die,
  type Ordem2Setting,
  type Ordem2Sheet,
} from '@codexveil/rpg-systems/ordem2';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  CreationAnswersCard,
  answersComplete,
  answersFor,
} from '@/components/characters/creation-answers';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

const DICE: Ordem2Die[] = [4, 6, 8, 10, 12];

/**
 * Criação de agente do Ordem Paranormal 2 no app. O playtest só traz personagens prontos: o
 * jogador copia a ficha escolhida (habilidades e equipamento depois, na própria ficha).
 */
export function Ordem2MobileWizard({
  campaign,
}: {
  campaign: {
    id: string;
    name: string;
    setting: Ordem2Setting;
    questions: readonly string[];
  } | null;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<Ordem2Sheet>(() =>
    createDefaultOrdem2Sheet(campaign?.setting ?? 'moderno'),
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const questions = campaign?.questions ?? [];
  const issues = ordem2CreationIssues(sheet);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createCharacter(getSupabase(), {
        name: name.trim(),
        systemId: 'ordem2',
        campaignId: campaign?.id ?? null,
        sheet,
        resources: ordem2DefaultResources(sheet),
        ...(campaign ? { answers: answersFor(questions, answers) } : {}),
      });
      toast({ tone: 'success', title: 'Agente criado' });
      router.replace(`/personagem/${id}`);
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível criar',
        description: failureMessage(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
    >
      <AppText variant="eyebrow">
        {campaign ? `Campanha: ${campaign.name}` : 'Ficha pessoal · Ordem Paranormal 2'}
      </AppText>
      <AppText variant="title">Ficha do agente</AppText>
      <AppText variant="muted">
        Copie a ficha pronta que você escolheu. Habilidades, equipamento e relações você completa na
        própria ficha depois.
      </AppText>
      <Card>
        <Field label="Nome" value={name} onChangeText={setName} maxLength={80} />
        <AppText variant="small">Perfil</AppText>
        <ChipRow>
          {ORDEM2_PROFILES.map((profile) => (
            <Chip
              key={profile}
              label={ordem2ProfileLabels[profile]}
              selected={sheet.profile === profile}
              onPress={() => setSheet({ ...sheet, profile })}
            />
          ))}
        </ChipRow>
        {sheet.profile ? (
          <AppText variant="small">{ordem2ProfileDescriptions[sheet.profile]}</AppText>
        ) : null}
        <Field
          label="Vocação"
          value={sheet.vocation}
          maxLength={120}
          onChangeText={(vocation) => setSheet({ ...sheet, vocation })}
        />
        <AppText variant="small">Nível</AppText>
        <ChipRow>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
            <Chip
              key={level}
              label={String(level)}
              selected={sheet.level === level}
              onPress={() => setSheet({ ...sheet, level })}
            />
          ))}
        </ChipRow>
        <Field
          label="PV máximos"
          keyboardType="number-pad"
          value={String(sheet.maxHitPoints)}
          onChangeText={(text) =>
            setSheet({ ...sheet, maxHitPoints: Math.max(1, Number(text) || 1) })
          }
        />
        <Field
          label="PD máximos"
          keyboardType="number-pad"
          value={String(sheet.maxDetermination)}
          onChangeText={(text) =>
            setSheet({ ...sheet, maxDetermination: Math.max(1, Number(text) || 1) })
          }
        />
      </Card>
      <Card>
        {ORDEM2_ATTRIBUTES.map((attribute) => (
          <View key={attribute} style={{ gap: spacing[1] }}>
            <AppText variant="heading">{ordem2AttributeLabels[attribute]}</AppText>
            <ChipRow>
              {DICE.map((die) => (
                <Chip
                  key={die}
                  label={`d${die}`}
                  selected={sheet.attributes[attribute] === die}
                  onPress={() =>
                    setSheet({ ...sheet, attributes: { ...sheet.attributes, [attribute]: die } })
                  }
                />
              ))}
            </ChipRow>
          </View>
        ))}
      </Card>
      <Card>
        <AppText variant="heading">Perícias</AppText>
        <AppText variant="small">
          d4 destreinado · d6 treinado · d8 especialista · d10 mestre · d12 grão-mestre
        </AppText>
        {ordem2SkillsFor(sheet.setting).map((skill) => (
          <View key={skill.key} style={{ gap: spacing[1] }}>
            <AppText>{skill.labels[sheet.setting]}</AppText>
            <ChipRow>
              {DICE.map((die) => (
                <Chip
                  key={die}
                  label={`d${die}`}
                  selected={(sheet.skills[skill.key]?.die ?? 4) === die}
                  onPress={() =>
                    setSheet({
                      ...sheet,
                      skills: { ...sheet.skills, [skill.key]: { die, modifier: 0 } },
                    })
                  }
                />
              ))}
            </ChipRow>
          </View>
        ))}
      </Card>
      {questions.length ? (
        <CreationAnswersCard questions={questions} values={answers} onChange={setAnswers} />
      ) : null}
      {issues.length || !name.trim() ? (
        <Card>
          {!name.trim() ? <AppText variant="small">• Dê um nome ao agente.</AppText> : null}
          {issues.map((issue) => (
            <AppText key={issue} variant="small">
              • {issue}
            </AppText>
          ))}
        </Card>
      ) : null}
      <Button
        label="Criar agente"
        loading={busy}
        disabled={!name.trim() || issues.length > 0 || !answersComplete(questions, answers)}
        onPress={() => void submit()}
      />
    </ScrollView>
  );
}
