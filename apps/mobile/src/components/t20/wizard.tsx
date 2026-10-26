import { characterImagePrompt } from '@codexveil/domain';
import { createCharacter } from '@codexveil/database';
import {
  T20_ATTRIBUTES,
  T20_POINT_BUY_BUDGET,
  T20_POINT_BUY_MAX,
  T20_POINT_BUY_MIN,
  T20_SKILLS,
  T20_SPELL_SCHOOLS,
  T20_STEPS,
  buildT20Character,
  buildT20Content,
  createT20Draft,
  findT20Class,
  findT20Deity,
  findT20Origin,
  findT20Race,
  formatT20Bonus,
  plainT20,
  t20RollTotal,
  t20AttributeFromRoll,
  t20AttributeLabels,
  t20AvailableSpells,
  t20DraftIssues,
  t20DraftPowerNames,
  t20EligibleDeities,
  t20EquipmentOptions,
  t20FinalAttributes,
  isT20AttributeIncrease,
  t20CreationFeatureChoices,
  t20ExpertiseRule,
  t20OriginBenefitOptions,
  t20PowerSkillPick,
  T20_SKILL_IDS,
  t20GenericPowerGroups,
  t20GenericPowerOptions,
  t20GrantedPowers,
  t20GrantedSkills,
  t20Lineages,
  t20PointsSpent,
  t20PowerLevels,
  t20PowerOptions,
  t20PrerequisiteProblems,
  t20SpellCount,
  t20StepLabels,
  t20TrainedSkills,
  type T20Attribute,
  type T20CampaignRules,
  type T20ContentSource,
  type T20Draft,
  type T20Skill,
  type T20Step,
} from '@codexveil/rpg-systems/tormenta20';
import { characterCreateSchema } from '@codexveil/validation';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { OptionCard } from '@/components/creation/choice-fields';
import { Button } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { CreationAnswersCard, answersComplete, answersFor } from '@/components/characters/creation-answers';
import { Field } from '@/components/ui/field';
import { PickerField } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Notice } from '@/components/ui/states';
import { CharacterIcon } from '@/components/creation/character-icon';
import { ImagePromptCard } from '@/components/creation/image-prompt-card';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

export interface T20MobileCampaign {
  id: string;
  name: string;
  rules: T20CampaignRules;
  /** Perguntas do mestre (todas obrigatórias). */
  questions: string[];
}

const clip = (text: string, max = 200) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

/** Assistente de criação do Tormenta20 no app (as mesmas regras do site). */
export function T20MobileWizard({
  campaign,
  sources,
}: {
  campaign: T20MobileCampaign | null;
  sources: T20ContentSource[];
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const questions = campaign?.questions ?? [];
  const [answerValues, setAnswerValues] = useState<Record<number, string>>({});
  const methods = useMemo(
    () => campaign?.rules.attributeMethods ?? (['pontos', 'rolagem'] as const),
    [campaign],
  );
  // Ficha pessoal: começa com todos os livros importados marcados (sem isso, o aviso "Sem
  // livros" escondia a lista para marcá-los).
  const [draft, setDraft] = useState<T20Draft>(() => {
    const initial = createT20Draft(campaign?.rules.startingLevel ?? 1, methods[0] ?? 'pontos');
    return campaign
      ? initial
      : { ...initial, sourcebooks: sources.map((source) => source.book.id) };
  });
  const available = useMemo(() => buildT20Content(sources), [sources]);
  // Na campanha, os livros do mestre; na ficha pessoal, só os livros marcados no início.
  const selectedSources = useMemo(
    () =>
      campaign ? sources : sources.filter((source) => draft.sourcebooks.includes(source.book.id)),
    [campaign, sources, draft.sourcebooks],
  );
  const content = useMemo(() => buildT20Content(selectedSources), [selectedSources]);
  const [step, setStep] = useState<T20Step>('inicio');
  const [attempted, setAttempted] = useState<Set<T20Step>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const update = (patch: Partial<T20Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const issues = useMemo(
    () => t20DraftIssues(content, draft, { allowedMethods: methods }),
    [content, draft, methods],
  );
  const klass = findT20Class(content, draft.classId);
  const race = findT20Race(content, draft.raceId);
  const origin = findT20Origin(content, draft.originId);
  const attrs = t20FinalAttributes(content, draft);
  const powerLevels = klass ? t20PowerLevels(klass, draft.level) : [];
  const steps = T20_STEPS.filter((entry) =>
    entry === 'magias'
      ? Boolean(klass?.spellcasting)
      : entry === 'poderes'
        ? powerLevels.length > 0 || t20CreationFeatureChoices(content, draft).length > 0 || !klass
        : true,
  );
  const index = steps.indexOf(step);
  const stepIssues = (target: T20Step) => issues.filter((issue) => issue.step === target);
  const showErrors = attempted.has(step) || step === 'revisao';

  const goTo = (target: T20Step) => {
    setStep(target);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const next = () => {
    setAttempted((current) => new Set(current).add(step));
    if (stepIssues(step).length > 0 && !['divindade'].includes(step)) return;
    const following = steps[index + 1];
    if (following) goTo(following);
  };

  const submit = async () => {
    setMessage(null);
    if (issues.length) {
      setAttempted(new Set(T20_STEPS));
      setMessage(`Ainda há pendências: ${issues[0]!.message}`);
      return;
    }
    const base = characterCreateSchema.safeParse({
      name: draft.name,
      systemId: 'tormenta20',
      campaignId: campaign?.id ?? null,
    });
    if (!base.success) {
      setMessage(base.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setBusy(true);
    try {
      const built = buildT20Character(
        content,
        draft,
        content.books.map((book) => book.id),
      );
      const id = await createCharacter(getSupabase(), {
        name: base.data.name,
        systemId: 'tormenta20',
        campaignId: base.data.campaignId,
        sheet: built.sheet,
        resources: built.resources,
        items: built.items,
        abilities: built.abilities,
        ...(campaign ? { answers: answersFor(questions, answerValues) } : {}),
      });
      // A rolagem foi usada: a próxima criação sorteia de novo.
      if (draft.attributeMethod === 'rolagem') await getSupabase().rpc('consume_t20_attribute_dice');
      router.replace({ pathname: '/personagem/[id]', params: { id } });
    } catch (error) {
      setMessage(failureMessage(error));
      setBusy(false);
    }
  };

  if (available.races.length === 0 || available.classes.length === 0) {
    return (
      <Notice
        tone="warning"
        title="Sem livros do Tormenta20"
        message={
          campaign
            ? 'O mestre ainda não liberou um livro do Tormenta20 nesta campanha.'
            : 'Importe o livro do Tormenta20 em Meus livros (no site) para criar um personagem.'
        }
      />
    );
  }

  const multi = (
    label: string,
    count: number,
    options: { id: string; name: string; disabled?: boolean; description?: string }[],
    value: string[],
    onChange: (value: string[]) => void,
  ) => (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontFamily: fonts.sansMedium }}>
        {label} ({value.length}/{count})
      </AppText>
      {options.map((option) => (
        <CheckRow
          key={option.id}
          label={option.name}
          {...(option.description ? { description: option.description } : {})}
          checked={value.includes(option.id)}
          disabled={option.disabled || (!value.includes(option.id) && value.length >= count)}
          onChange={(checked) =>
            onChange(checked ? [...value, option.id] : value.filter((entry) => entry !== option.id))
          }
        />
      ))}
    </View>
  );
  const expertise = t20ExpertiseRule(content, draft);
  const taken = (own: string[]) =>
    new Set(
      [
        ...t20GrantedSkills(content, draft),
        ...draft.classSkills,
        ...draft.intSkills,
        ...draft.raceSkills,
      ].filter((skill) => !own.includes(skill)),
    );
  const skillOptions = (list: T20Skill[], own: T20Skill[]) => {
    const used = taken(own);
    return list.map((skill) => ({
      id: skill,
      name: used.has(skill)
        ? `✓ ${T20_SKILLS[skill].label} · já treinada`
        : T20_SKILLS[skill].label,
      disabled: used.has(skill),
    }));
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {steps.map((entry, position) => (
          <Pressable
            key={entry}
            onPress={() => goTo(entry)}
            accessibilityRole="button"
            accessibilityState={{ selected: entry === step }}
            style={[styles.stepChip, entry === step && styles.stepChipCurrent]}
          >
            <AppText
              style={{
                fontSize: 13,
                color:
                  entry === step
                    ? colors.fgAccent
                    : attempted.has(entry) && stepIssues(entry).length
                      ? '#E6BE74'
                      : colors.fgSecondary,
              }}
            >
              {position + 1}. {t20StepLabels[entry]}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
      <AppText variant="title" accessibilityRole="header">
        {t20StepLabels[step]}
      </AppText>
      {message ? <Notice tone="danger" message={message} /> : null}

      {step === 'inicio' ? (
        <View style={{ gap: spacing[3] }}>
          <Field
            label="Nome do personagem"
            value={draft.name}
            onChangeText={(name) => update({ name })}
            maxLength={80}
          />
          {campaign ? (
            <Badge
              label={`${campaign.name} · nível ${campaign.rules.startingLevel}`}
              tone="parchment"
            />
          ) : (
            <PickerField
              label="Nível"
              value={String(draft.level)}
              onChange={(value) => update({ level: Number(value) })}
              options={Array.from({ length: 20 }, (_, position) => ({
                value: String(position + 1),
                label: `${position + 1}º nível`,
              }))}
            />
          )}
          {campaign ? (
            <AppText variant="small">
              Livros liberados pelo mestre:{' '}
              {content.books.map((book) => book.name).join(', ') || 'nenhum'}.
            </AppText>
          ) : (
            <View style={{ gap: spacing[2] }}>
              <AppText style={{ fontFamily: fonts.sansMedium }}>Livros desta ficha</AppText>
              <AppText variant="small">
                Só o conteúdo dos livros marcados aparece na criação.
              </AppText>
              {sources.length === 0 ? (
                <AppText variant="small">Nenhum livro de Tormenta20 importado.</AppText>
              ) : null}
              {sources.map((source) => (
                <CheckRow
                  key={source.book.id}
                  label={source.book.name}
                  checked={draft.sourcebooks.includes(source.book.id)}
                  onChange={(checked) =>
                    update({
                      sourcebooks: checked
                        ? [...new Set([...draft.sourcebooks, source.book.id])]
                        : draft.sourcebooks.filter((id) => id !== source.book.id),
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {step === 'atributos' ? (
        <View style={{ gap: spacing[3] }}>
          {methods.length > 1 ? (
            <ChipRow>
              <Chip
                label="Pontos"
                selected={draft.attributeMethod === 'pontos'}
                onPress={() => update({ attributeMethod: 'pontos' })}
              />
              <Chip
                label="Rolagem"
                selected={draft.attributeMethod === 'rolagem'}
                onPress={() => update({ attributeMethod: 'rolagem' })}
              />
            </ChipRow>
          ) : null}
          {draft.attributeMethod === 'pontos' ? (
            <>
              <AppText>
                Pontos: {t20PointsSpent(draft.points)} de {T20_POINT_BUY_BUDGET}
              </AppText>
              {T20_ATTRIBUTES.map((key) => (
                <View key={key} style={styles.row}>
                  <AppText style={{ flex: 1 }}>{t20AttributeLabels[key].name}</AppText>
                  <Button
                    label="−"
                    variant="secondary"
                    compact
                    disabled={draft.points[key] <= T20_POINT_BUY_MIN}
                    onPress={() =>
                      update({ points: { ...draft.points, [key]: draft.points[key] - 1 } })
                    }
                    accessibilityLabel={`Diminuir ${t20AttributeLabels[key].name}`}
                  />
                  <AppText variant="number">{formatT20Bonus(draft.points[key])}</AppText>
                  <Button
                    label="+"
                    variant="secondary"
                    compact
                    disabled={draft.points[key] >= T20_POINT_BUY_MAX}
                    onPress={() =>
                      update({ points: { ...draft.points, [key]: draft.points[key] + 1 } })
                    }
                    accessibilityLabel={`Aumentar ${t20AttributeLabels[key].name}`}
                  />
                </View>
              ))}
            </>
          ) : (
            <>
              {/* Sorteio no servidor, uma vez só (o mesmo resultado volta até o personagem ser criado). */}
              {draft.rolls.length === 0 ? (
                <Button
                  label="Rolar 4d6 seis vezes (uma vez só)"
                  variant="secondary"
                  onPress={() => {
                    void getSupabase()
                      .rpc('t20_attribute_dice')
                      .then(({ data, error }) => {
                        if (error || !data) return;
                        update({
                          rolls: (data as unknown as number[][]).map(t20RollTotal),
                          rollAssignment: Object.fromEntries(
                            T20_ATTRIBUTES.map((key) => [key, null]),
                          ) as T20Draft['rollAssignment'],
                        });
                      });
                  }}
                />
              ) : null}
              {draft.rolls.length
                ? T20_ATTRIBUTES.map((key) => (
                    <PickerField
                      key={key}
                      label={t20AttributeLabels[key].name}
                      value={
                        draft.rollAssignment[key] === null ? '' : String(draft.rollAssignment[key])
                      }
                      onChange={(value) =>
                        update({
                          rollAssignment: { ...draft.rollAssignment, [key]: Number(value) },
                        })
                      }
                      options={draft.rolls.map((roll, position) => ({
                        value: String(position),
                        label: `${roll} → ${formatT20Bonus(t20AttributeFromRoll(roll))}`,
                        disabled: T20_ATTRIBUTES.some(
                          (other) => other !== key && draft.rollAssignment[other] === position,
                        ),
                      }))}
                    />
                  ))
                : null}
            </>
          )}
        </View>
      ) : null}

      {step === 'raca' ? (
        <View style={{ gap: spacing[2] }}>
          {content.races.map((entry) => (
            <OptionCard
              key={entry.id}
              selected={entry.id === draft.raceId}
              title={entry.name}
              description={clip(entry.summary)}
              icon={(color) => <CharacterIcon kind="species" id={entry.id} color={color} />}
              onPress={() =>
                update({
                  raceId: entry.id,
                  raceAttributeChoices: [],
                  raceVariant: '',
                  raceSkills: [],
                  raceSkillPower: '',
                })
              }
            />
          ))}
          {race?.attributeChoice
            ? multi(
                `Atributos com +${race.attributeChoice.value}`,
                race.attributeChoice.count,
                T20_ATTRIBUTES.filter((key) => !race.attributeChoice!.exclude.includes(key)).map(
                  (key) => ({ id: key, name: t20AttributeLabels[key].name }),
                ),
                draft.raceAttributeChoices,
                (value) => update({ raceAttributeChoices: value as T20Attribute[] }),
              )
            : null}
          {race && race.variants.length ? (
            <PickerField
              label="Variante"
              value={draft.raceVariant}
              onChange={(raceVariant) => update({ raceVariant })}
              options={race.variants.map((variant) => ({
                value: variant.name,
                label: variant.name,
              }))}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'classe' ? (
        <View style={{ gap: spacing[2] }}>
          {content.classes.map((entry) => (
            <OptionCard
              key={entry.id}
              selected={entry.id === draft.classId}
              title={entry.name}
              description={`PV ${entry.pvInitial} + Con · PM ${entry.pmPerLevel}/nível`}
              onPress={() =>
                update({
                  classId: entry.id,
                  classFixedChoices: [],
                  classSkills: [],
                  arcanistPath: '',
                  lineage: '',
                  spellSchools: [],
                  spellIds: [],
                  levelPowers: {},
                  equipment: { simple: '', martial: '', armor: '', shield: false },
                })
              }
            />
          ))}
          {klass && plainT20(klass.name) === 'arcanista' ? (
            <PickerField
              label="Caminho do arcanista"
              value={draft.arcanistPath}
              onChange={(value) =>
                update({
                  arcanistPath: value as T20Draft['arcanistPath'],
                  lineage: '',
                  spellIds: [],
                })
              }
              options={[
                { value: 'bruxo', label: 'Bruxo' },
                { value: 'feiticeiro', label: 'Feiticeiro' },
                { value: 'mago', label: 'Mago' },
              ]}
            />
          ) : null}
          {klass && draft.arcanistPath === 'feiticeiro' && t20Lineages(klass).length ? (
            <PickerField
              label="Linhagem"
              value={draft.lineage}
              onChange={(lineage) => update({ lineage })}
              options={t20Lineages(klass).map((lineage) => ({ value: lineage, label: lineage }))}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'origem' ? (
        <View style={{ gap: spacing[2] }}>
          {content.origins.map((entry) => (
            <OptionCard
              key={entry.id}
              selected={entry.id === draft.originId}
              title={entry.name}
              description={clip(entry.benefitsText || entry.summary)}
              onPress={() =>
                update({ originId: entry.id, originBenefits: [], originPowerChoices: {} })
              }
            />
          ))}
          {origin
            ? multi(
                'Benefícios da origem',
                2,
                t20OriginBenefitOptions(content, origin),
                draft.originBenefits,
                (originBenefits) => update({ originBenefits }),
              )
            : null}
          {draft.originBenefits
            .filter(
              (benefit) => benefit.startsWith('power:') && t20GenericPowerGroups(benefit.slice(6)),
            )
            .map((benefit) => {
              const name = benefit.slice(6);
              return (
                <PickerField
                  key={benefit}
                  label={`Poder escolhido (${name})`}
                  value={draft.originPowerChoices[name] ?? ''}
                  onChange={(id) =>
                    update({ originPowerChoices: { ...draft.originPowerChoices, [name]: id } })
                  }
                  options={t20GenericPowerOptions(content, name).map((power) => ({
                    value: power.id,
                    label: power.prerequisite
                      ? `${power.name} (requer: ${power.prerequisite})`
                      : power.name,
                  }))}
                />
              );
            })}
        </View>
      ) : null}

      {step === 'divindade' ? (
        <View style={{ gap: spacing[3] }}>
          <PickerField
            label="Divindade (opcional, salvo para clérigos, druidas e paladinos)"
            value={draft.deityId}
            onChange={(deityId) => update({ deityId, grantedPowerId: '' })}
            options={[
              { value: '', label: 'Nenhuma' },
              ...t20EligibleDeities(content, draft).map((deity) => ({
                value: deity.id,
                label: deity.name,
              })),
            ]}
          />
          {draft.deityId ? (
            <PickerField
              label="Poder concedido"
              value={draft.grantedPowerId}
              onChange={(grantedPowerId) => update({ grantedPowerId })}
              options={t20GrantedPowers(
                content,
                findT20Deity(content, draft.deityId)?.name ?? '',
              ).map((power) => ({
                value: power.id,
                label: power.name,
                description: clip(power.text, 160),
              }))}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'pericias' ? (
        <View style={{ gap: spacing[3] }}>
          {klass?.skillsFixedChoices.map((group, position) => (
            <PickerField
              key={group.join('-')}
              label={`Perícia: ${group.map((skill) => T20_SKILLS[skill].label).join(' ou ')}`}
              value={draft.classFixedChoices[position] ?? ''}
              onChange={(value) => {
                const choices = [...draft.classFixedChoices];
                choices[position] = value as T20Skill;
                update({ classFixedChoices: choices.filter(Boolean) });
              }}
              options={group.map((skill) => ({ value: skill, label: T20_SKILLS[skill].label }))}
            />
          ))}
          {klass
            ? multi(
                'Perícias da classe',
                klass.skillsChoice.count,
                skillOptions(klass.skillsChoice.options, draft.classSkills),
                draft.classSkills,
                (value) => update({ classSkills: value as T20Skill[] }),
              )
            : null}
          {expertise
            ? multi(
                `${expertise.ability}: perícias treinadas`,
                expertise.count,
                t20TrainedSkills(content, draft).map((skill) => ({
                  id: skill,
                  name: T20_SKILLS[skill].label,
                })),
                draft.expertSkills.filter((skill) =>
                  t20TrainedSkills(content, draft).includes(skill),
                ),
                (value) => update({ expertSkills: value as T20Skill[] }),
              )
            : null}
          {attrs.int > 0
            ? multi(
                'Perícias pela Inteligência',
                attrs.int,
                skillOptions(Object.keys(T20_SKILLS) as T20Skill[], draft.intSkills),
                draft.intSkills,
                (value) => update({ intSkills: value as T20Skill[] }),
              )
            : null}
          {race?.abilities.some((ability) => plainT20(ability.name) === 'versatil')
            ? multi(
                'Versátil: perícias',
                2,
                skillOptions(Object.keys(T20_SKILLS) as T20Skill[], draft.raceSkills),
                draft.raceSkills,
                (value) => update({ raceSkills: value as T20Skill[] }),
              )
            : null}
        </View>
      ) : null}

      {step === 'poderes' ? (
        <View style={{ gap: spacing[3] }}>
          {powerLevels.map((level) => {
            const others = t20DraftPowerNames(content, {
              ...draft,
              levelPowers: Object.fromEntries(
                Object.entries(draft.levelPowers).filter(([key]) => key !== String(level)),
              ),
            });
            const chosen = content.powers.find(
              (power) => power.id === draft.levelPowers[String(level)],
            );
            return (
              <View key={level} style={{ gap: spacing[2] }}>
                <PickerField
                  label={`Poder do ${level}º nível`}
                  value={draft.levelPowers[String(level)] ?? ''}
                  onChange={(value) =>
                    update({ levelPowers: { ...draft.levelPowers, [String(level)]: value } })
                  }
                  options={t20PowerOptions(content, draft).map((power) => {
                    const problems = t20PrerequisiteProblems(power.prerequisite, {
                      attributes: attrs,
                      skills: t20TrainedSkills(content, draft),
                      level,
                      powers: others,
                      content,
                    });
                    return {
                      value: power.id,
                      label: power.name,
                      description: problems.length
                        ? `Falta ${problems.join(', ')}`
                        : clip(power.text, 140),
                      disabled:
                        problems.length > 0 ||
                        (!isT20AttributeIncrease(power.name) && others.includes(power.name)),
                    };
                  })}
                />
                {chosen && t20PowerSkillPick(chosen)
                  ? multi(
                      `Perícias de ${chosen.name}`,
                      t20PowerSkillPick(chosen)!.count,
                      T20_SKILL_IDS.filter(
                        (skill) =>
                          !t20PowerSkillPick(chosen)!.trains ||
                          !t20TrainedSkills(content, {
                            ...draft,
                            levelPowerSkills: { ...draft.levelPowerSkills, [String(level)]: [] },
                          }).includes(skill),
                      ).map((skill) => ({ id: skill, name: T20_SKILLS[skill].label })),
                      draft.levelPowerSkills[String(level)] ?? [],
                      (value) =>
                        update({
                          levelPowerSkills: {
                            ...draft.levelPowerSkills,
                            [String(level)]: value as T20Skill[],
                          },
                        }),
                    )
                  : null}
                {chosen && isT20AttributeIncrease(chosen.name) ? (
                  <PickerField
                    label={`Atributo que aumenta no ${level}º nível (+1)`}
                    value={draft.levelPowerAttributes[String(level)] ?? ''}
                    onChange={(value) =>
                      update({
                        levelPowerAttributes: {
                          ...draft.levelPowerAttributes,
                          [String(level)]: value as T20Attribute,
                        },
                      })
                    }
                    options={T20_ATTRIBUTES.map((key) => ({
                      value: key,
                      label: t20AttributeLabels[key].name,
                    }))}
                  />
                ) : null}
              </View>
            );
          })}
          {t20CreationFeatureChoices(content, draft).map((choice) => (
            <PickerField
              key={choice.key}
              label={`${choice.ability} (${choice.level}º nível): escolha`}
              value={draft.featureChoices[choice.key] ?? ''}
              onChange={(value) =>
                update({ featureChoices: { ...draft.featureChoices, [choice.key]: value } })
              }
              options={choice.options.map((option) => ({
                value: option.id,
                label: option.name,
                description: clip(option.text, 140),
              }))}
            />
          ))}
        </View>
      ) : null}

      {step === 'magias' && klass?.spellcasting ? (
        <View style={{ gap: spacing[3] }}>
          {klass.spellcasting.schoolsChoice > 0
            ? multi(
                'Escolas de magia',
                klass.spellcasting.schoolsChoice,
                T20_SPELL_SCHOOLS.map((school) => ({ id: school, name: school })),
                draft.spellSchools,
                (spellSchools) => update({ spellSchools, spellIds: [] }),
              )
            : null}
          {multi(
            'Magias',
            t20SpellCount(content, draft),
            t20AvailableSpells(content, draft).map((spell) => ({
              id: spell.id,
              name: `${spell.name} (${spell.circle}º)`,
            })),
            draft.spellIds,
            (spellIds) => update({ spellIds }),
          )}
        </View>
      ) : null}

      {step === 'equipamento' ? (
        <View style={{ gap: spacing[3] }}>
          {(() => {
            const options = t20EquipmentOptions(content, draft);
            const set = (patch: Partial<T20Draft['equipment']>) =>
              update({ equipment: { ...draft.equipment, ...patch } });
            return (
              <>
                {options.simple.length ? (
                  <PickerField
                    label="Arma simples"
                    value={draft.equipment.simple}
                    onChange={(simple) => set({ simple })}
                    options={options.simple.map((item) => ({
                      value: item.id,
                      label: `${item.name} (${item.damage})`,
                    }))}
                  />
                ) : null}
                {options.martial.length ? (
                  <PickerField
                    label="Arma marcial"
                    value={draft.equipment.martial}
                    onChange={(martial) => set({ martial })}
                    options={options.martial.map((item) => ({
                      value: item.id,
                      label: `${item.name} (${item.damage})`,
                    }))}
                  />
                ) : null}
                {options.armors.length ? (
                  <PickerField
                    label="Armadura"
                    value={draft.equipment.armor}
                    onChange={(armor) => set({ armor })}
                    options={options.armors.map((item) => ({
                      value: item.id,
                      label: `${item.name} (+${item.defense ?? 0})`,
                    }))}
                  />
                ) : null}
                {options.shield ? (
                  <CheckRow
                    label={options.shield.name}
                    checked={draft.equipment.shield}
                    onChange={(shield) => set({ shield })}
                  />
                ) : null}
                {draft.level === 1 ? (
                  <Button
                    label={
                      draft.money === null
                        ? 'Rolar dinheiro (4d6 T$)'
                        : `T$ ${draft.money} · rolar de novo`
                    }
                    variant="secondary"
                    onPress={() =>
                      update({
                        money: Array.from(
                          { length: 4 },
                          () => 1 + Math.floor(Math.random() * 6),
                        ).reduce((a, b) => a + b, 0),
                      })
                    }
                  />
                ) : null}
              </>
            );
          })()}
        </View>
      ) : null}

      {step === 'detalhes' ? (
        <View style={{ gap: spacing[3] }}>
          <Field
            label="Altura (ex.: 1,75 m)"
            value={draft.height}
            onChangeText={(height) => update({ height })}
            maxLength={40}
          />
          <Field
            label="Aparência"
            multiline
            value={draft.appearance}
            onChangeText={(appearance) => update({ appearance })}
            maxLength={4000}
          />
          <Field
            label="Personalidade"
            multiline
            value={draft.personality}
            onChangeText={(personality) => update({ personality })}
            maxLength={4000}
          />
          <Field
            label="História"
            multiline
            value={draft.history}
            onChangeText={(history) => update({ history })}
            maxLength={20000}
          />
        </View>
      ) : null}

      {step === 'revisao' ? (
        <Card>
          <AppText style={{ fontFamily: fonts.sansMedium }}>
            {draft.name || 'Novo personagem'}
          </AppText>
          <AppText variant="small">
            {[race?.name, klass ? `${klass.name} ${draft.level}` : '', origin?.name]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <AppText variant="small">
            {T20_ATTRIBUTES.map(
              (key) => `${t20AttributeLabels[key].abbreviation} ${formatT20Bonus(attrs[key])}`,
            ).join('  ')}
          </AppText>
          {issues.length ? (
            <Notice
              tone="warning"
              title={`Pendências (${issues.length})`}
              message={issues.map((issue) => issue.message).join('\n')}
            />
          ) : (
            <Notice tone="success" message="Tudo certo! Crie o personagem." />
          )}
        </Card>
      ) : null}
      {step === 'revisao' ? (
        <CreationAnswersCard questions={questions} values={answerValues} onChange={setAnswerValues} />
      ) : null}
      {step === 'revisao' ? (
        <ImagePromptCard
          prompt={characterImagePrompt({
            system: 'Tormenta20',
            name: draft.name,
            species: race?.name,
            className: klass?.name,
            level: draft.level,
            background: origin?.name,
            appearance: draft.appearance,
            personality: draft.personality,
            backstory: draft.history,
          })}
        />
      ) : null}

      {showErrors && step !== 'revisao' && stepIssues(step).length ? (
        <Notice
          tone="warning"
          message={stepIssues(step)
            .map((issue) => issue.message)
            .join(' ')}
        />
      ) : null}

      <View style={styles.row}>
        <Button
          label="Voltar"
          variant="ghost"
          onPress={() => steps[index - 1] && goTo(steps[index - 1]!)}
          disabled={index <= 0}
        />
        <View style={{ flex: 1 }} />
        {step === 'revisao' ? (
          <Button
            label="Criar personagem"
            loading={busy}
            disabled={!answersComplete(questions, answerValues)}
            onPress={() => void submit()}
          />
        ) : (
          <Button label="Próximo" onPress={next} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  stepChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepChipCurrent: { borderColor: colors.fgAccent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
