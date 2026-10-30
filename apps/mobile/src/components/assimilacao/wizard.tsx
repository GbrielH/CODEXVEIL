import { createCharacter } from '@codexveil/database';
import {
  CREATION,
  GENERATIONS,
  INSTINCTS,
  KNOWLEDGES,
  PRACTICES,
  aptitudeLabels,
  assimilacaoDefaultResources,
  creationIssues,
  createDefaultAssimilacaoSheet,
  generationLabels,
  healthPerLevel,
  learnedXp,
  requirementMet,
  safeAssimilacaoBookEntryData,
  type AssimilacaoCampaignRules,
  type AssimilacaoSheet,
} from '@codexveil/rpg-systems/assimilacao';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { withAssimSymbols } from '@/components/assimilacao/symbols';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

export interface AssimilacaoMobileSource {
  book: { id: string; name: string };
  entries: readonly { kind: string; key: string; name: string; data: unknown }[];
}

type Step = 'conceito' | 'origens' | 'aptidoes' | 'caracteristicas' | 'revisao';
const STEPS: { value: Step; label: string }[] = [
  { value: 'conceito', label: '1. Concepção' },
  { value: 'origens', label: '2. Origens' },
  { value: 'aptidoes', label: '3. Aptidões' },
  { value: 'caracteristicas', label: '4. Características' },
  { value: 'revisao', label: '5. Revisão' },
];

/** Criação de Infectados no app, com os mesmos limites do site (Capítulo 2 do livro). */
export function AssimilacaoMobileWizard({
  campaign,
  sources,
}: {
  campaign: {
    id: string;
    name: string;
    rules: AssimilacaoCampaignRules;
    questions: readonly string[];
  } | null;
  sources: readonly AssimilacaoMobileSource[];
}) {
  const toast = useToast();
  const startingDetermination = campaign?.rules.startingDetermination ?? 9;
  const experience = campaign?.rules.startingExperience ?? CREATION.experience;
  const [step, setStep] = useState<Step>('conceito');
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<AssimilacaoSheet>(() => {
    const base = createDefaultAssimilacaoSheet();
    return { ...base, tugOfWar: { ...base.tugOfWar, determinationLevel: startingDetermination } };
  });
  const [answers, setAnswers] = useState<string[]>(() => (campaign?.questions ?? []).map(() => ''));
  const [busy, setBusy] = useState(false);
  const catalog = useMemo(
    () =>
      sources.flatMap((source) =>
        source.entries.flatMap((entry) => {
          if (entry.kind !== 'characteristic') return [];
          const data = safeAssimilacaoBookEntryData('characteristic', entry.data);
          return data ? [{ key: `${source.book.id}:${entry.key}`, name: entry.name, ...data }] : [];
        }),
      ),
    [sources],
  );

  const advanced = sheet.characteristics.some((entry) =>
    /est[aá]gio avan[cç]ado/i.test(entry.name),
  );
  const finalSheet: AssimilacaoSheet = {
    ...sheet,
    tugOfWar: { ...sheet.tugOfWar, determinationLevel: startingDetermination - (advanced ? 1 : 0) },
    experience: {
      total: experience,
      spent: sheet.characteristics.reduce((sum, entry) => sum + entry.cost, 0) + learnedXp(sheet),
    },
  };
  const issues = creationIssues(finalSheet, experience);
  const freeInstincts =
    CREATION.instinctFreePoints - INSTINCTS.reduce((sum, key) => sum + sheet.instincts[key] - 1, 0);
  const learnedUsed = [
    ...KNOWLEDGES.map((key) => sheet.knowledges[key]),
    ...PRACTICES.map((key) => sheet.practices[key]),
  ].reduce((sum, value) => sum + Math.min(value, CREATION.learnedMax), 0);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createCharacter(getSupabase(), {
        name: name.trim(),
        systemId: 'assimilacao',
        campaignId: campaign?.id ?? null,
        sheet: finalSheet,
        resources: assimilacaoDefaultResources(finalSheet),
        ...(campaign
          ? {
              answers: campaign.questions.map((question, index) => ({
                question,
                answer: (answers[index] ?? '').trim(),
              })),
            }
          : {}),
      });
      toast({ tone: 'success', title: 'Infectado criado' });
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

  const counter = (
    group: 'instincts' | 'knowledges' | 'practices',
    key: string,
    min: number,
    max: number,
  ) => {
    const value = (sheet[group] as Record<string, number>)[key] ?? min;
    const set = (next: number) =>
      setSheet({ ...sheet, [group]: { ...(sheet[group] as Record<string, number>), [key]: next } });
    return (
      <View
        key={key}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 4,
        }}
      >
        <AppText>{aptitudeLabels[key as keyof typeof aptitudeLabels]}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Button
            label="−"
            variant="ghost"
            compact
            disabled={value <= min}
            onPress={() => set(value - 1)}
            accessibilityLabel={`Diminuir ${key}`}
          />
          <AppText variant="number">{value}</AppText>
          <Button
            label="+"
            variant="ghost"
            compact
            disabled={value >= max}
            onPress={() => set(value + 1)}
            accessibilityLabel={`Aumentar ${key}`}
          />
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
    >
      <AppText variant="eyebrow">
        {campaign ? `Campanha: ${campaign.name}` : 'Ficha pessoal · Assimilação RPG'}
      </AppText>
      <Segmented value={step} onChange={setStep} options={STEPS} accessibilityLabel="Passos" />

      {step === 'conceito' ? (
        <Card>
          <Field label="Nome do Infectado" value={name} onChangeText={setName} maxLength={80} />
          <AppText variant="small">Geração</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {GENERATIONS.map((generation) => (
              <Chip
                key={generation}
                label={generationLabels[generation]}
                selected={sheet.identity.generation === generation}
                onPress={() => setSheet({ ...sheet, identity: { ...sheet.identity, generation } })}
              />
            ))}
          </View>
          <Field
            label="Idade"
            value={sheet.identity.age}
            maxLength={40}
            onChangeText={(age) => setSheet({ ...sheet, identity: { ...sheet.identity, age } })}
          />
          <Field
            label="Aparência"
            multiline
            value={sheet.identity.appearance}
            onChangeText={(appearance) =>
              setSheet({ ...sheet, identity: { ...sheet.identity, appearance } })
            }
          />
          <Field
            label="Personalidade"
            multiline
            value={sheet.identity.personality}
            onChangeText={(personality) =>
              setSheet({ ...sheet, identity: { ...sheet.identity, personality } })
            }
          />
          <Field
            label="História"
            multiline
            value={sheet.identity.backstory}
            onChangeText={(backstory) =>
              setSheet({ ...sheet, identity: { ...sheet.identity, backstory } })
            }
          />
        </Card>
      ) : null}

      {step === 'origens' ? (
        <Card>
          <AppText variant="heading">Origens</AppText>
          <Field
            label="Evento Marcante"
            hint="Ex.: Abandonado pelos companheiros"
            value={sheet.origins.event}
            maxLength={200}
            onChangeText={(event) => setSheet({ ...sheet, origins: { ...sheet.origins, event } })}
          />
          <Field
            label="Ocupação"
            hint="Ex.: Mercador honrado"
            value={sheet.origins.occupation}
            maxLength={200}
            onChangeText={(occupation) =>
              setSheet({ ...sheet, origins: { ...sheet.origins, occupation } })
            }
          />
          <AppText variant="heading">Propósitos</AppText>
          {(['personal', 'collective'] as const).flatMap((group) =>
            [0, 1].map((index) => (
              <Field
                key={`${group}-${index}`}
                label={`${group === 'personal' ? 'Pessoal' : 'Coletivo'} ${index + 1}`}
                maxLength={200}
                value={sheet.purposes[group][index]?.text ?? ''}
                onChangeText={(text) => {
                  const list = [...sheet.purposes[group]];
                  list[index] = { text, inert: list[index]?.inert ?? false };
                  setSheet({ ...sheet, purposes: { ...sheet.purposes, [group]: list } });
                }}
              />
            )),
          )}
        </Card>
      ) : null}

      {step === 'aptidoes' ? (
        <>
          <Card>
            <AppText variant="heading">Instintos (d6)</AppText>
            <AppText
              variant="small"
              style={{ color: freeInstincts < 0 ? colors.danger : colors.fgMuted }}
            >
              Pontos livres: {freeInstincts} de {CREATION.instinctFreePoints} (máximo{' '}
              {CREATION.instinctMax})
            </AppText>
            {INSTINCTS.map((key) => counter('instincts', key, 1, CREATION.instinctMax))}
          </Card>
          <Card>
            <AppText variant="heading">Conhecimentos e Práticas (d10)</AppText>
            <AppText
              variant="small"
              style={{
                color: learnedUsed > CREATION.learnedPoints ? colors.danger : colors.fgMuted,
              }}
            >
              {learnedUsed} de {CREATION.learnedPoints} pontos (máximo {CREATION.learnedMax}; acima
              custa Experiência)
            </AppText>
            {KNOWLEDGES.map((key) => counter('knowledges', key, 0, 5))}
            {PRACTICES.map((key) => counter('practices', key, 0, 5))}
            <AppText variant="small">Saúde por Nível: {healthPerLevel(sheet)}</AppText>
          </Card>
        </>
      ) : null}

      {step === 'caracteristicas' ? (
        <Card>
          <AppText variant="heading">Características</AppText>
          <AppText variant="small">
            Experiência: {experience - finalSheet.experience.spent} de {experience} restantes
          </AppText>
          {sheet.characteristics.map((entry, index) => (
            <Pressable
              key={`${entry.name}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Tirar ${entry.name}`}
              onPress={() =>
                setSheet({
                  ...sheet,
                  characteristics: sheet.characteristics.filter(
                    (_, position) => position !== index,
                  ),
                })
              }
            >
              <AppText style={{ color: colors.fgAccent }}>
                ✓ {entry.name} · {entry.cost} XP (tocar para tirar)
              </AppText>
            </Pressable>
          ))}
          {catalog.length === 0 ? (
            <AppText variant="small">
              Sem livro do Assimilação liberado: adicione as Características pela ficha depois.
            </AppText>
          ) : (
            catalog.map((entry) => {
              const met = requirementMet(sheet, entry.requirement);
              const taken = sheet.characteristics.some((item) => item.name === entry.name);
              return (
                <View
                  key={entry.key}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: radii.md,
                    padding: spacing[3],
                    gap: 4,
                    opacity: met ? 1 : 0.6,
                  }}
                >
                  <AppText style={{ fontWeight: '600' }}>
                    {entry.name} · {entry.cost} XP
                  </AppText>
                  {entry.requirement ? (
                    <AppText variant="small">Requisito: {entry.requirement}</AppText>
                  ) : null}
                  <AppText variant="small" numberOfLines={3}>
                    {withAssimSymbols(entry.text)}
                  </AppText>
                  <Button
                    label={taken ? 'Escolhida' : met ? 'Escolher' : 'Requisito não atendido'}
                    variant="secondary"
                    compact
                    disabled={taken || !met}
                    onPress={() =>
                      setSheet({
                        ...sheet,
                        characteristics: [
                          ...sheet.characteristics,
                          { name: entry.name, cost: entry.cost, notes: entry.text.slice(0, 2000) },
                        ],
                      })
                    }
                  />
                </View>
              );
            })
          )}
        </Card>
      ) : null}

      {step === 'revisao' ? (
        <Card>
          <AppText>
            Cabo de Guerra: Determinação {finalSheet.tugOfWar.determinationLevel} · Assimilação{' '}
            {10 - finalSheet.tugOfWar.determinationLevel}
          </AppText>
          <AppText>Saúde: 6 Níveis de {healthPerLevel(sheet)} pontos</AppText>
          {(campaign?.questions ?? []).map((question, index) => (
            <Field
              key={question}
              label={question}
              multiline
              value={answers[index] ?? ''}
              onChangeText={(answer) =>
                setAnswers(answers.map((value, position) => (position === index ? answer : value)))
              }
            />
          ))}
          {[...issues, ...(name.trim() ? [] : ['Dê um nome ao Infectado.'])].map((issue) => (
            <AppText key={issue} variant="small" style={{ color: colors.danger }}>
              • {issue}
            </AppText>
          ))}
          <Button
            label="Criar Infectado"
            loading={busy}
            disabled={issues.length > 0 || !name.trim() || answers.some((answer) => !answer.trim())}
            onPress={() => void submit()}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}
