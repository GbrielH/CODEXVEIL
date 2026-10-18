import { createCharacter, listMyCampaigns } from '@codexveil/database';
import {
  ABILITIES,
  ALIGNMENTS,
  DND5E_STEPS,
  PERSONAL_SHEET_CONTEXT,
  SKILLS,
  SRD_BACKGROUNDS,
  SRD_SPECIES,
  abilityLabels,
  buildDnd5eCharacterFromDraft,
  createDnd5eDraft,
  describeDnd5eCampaignRules,
  dnd5eStepLabels,
  draftClass,
  findFeat,
  formatDistance,
  formatModifier,
  listClasses,
  listDnd5eChoices,
  parseDnd5eCampaignRules,
  previewDnd5eCharacter,
  skillDefinitions,
  startingEquipment,
  validateDnd5eDraft,
  type Dnd5eCampaignRules,
  type Dnd5eCreationContext,
  type Dnd5eDraft,
  type Dnd5eStep,
  type Selection,
} from '@codexveil/rpg-systems/dnd5e';
import { characterCreateSchema } from '@codexveil/validation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AbilityScoresField, EMPTY_ROLLS, type RollState } from '@/components/creation/ability-scores';
import { SourcebookChips } from '@/components/campaign-rules-editor';
import { CharacterIcon } from '@/components/creation/character-icon';
import { ChoiceField, OptionCard } from '@/components/creation/choice-fields';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { LoadingState, Notice } from '@/components/ui/states';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

interface PlayableCampaign {
  id: string;
  name: string;
  rules: Dnd5eCampaignRules;
}

const CLEAR_ON_CLASS = ['class.', 'subclass.', 'spells.', 'asi.', 'epic.', 'equipment.class'];
const CLEAR_ON_BACKGROUND = ['background.', 'equipment.background'];
const CLEAR_ON_SPECIES = ['species.'];

function without(selections: Dnd5eDraft['selections'], prefixes: string[]): Dnd5eDraft['selections'] {
  return Object.fromEntries(Object.entries(selections).filter(([key]) => !prefixes.some((prefix) => key.startsWith(prefix))));
}

function contextFor(campaign: PlayableCampaign | undefined): Dnd5eCreationContext {
  return campaign
    ? { lockedLevel: campaign.rules.startingLevel, abilityScoreMethods: campaign.rules.abilityScoreMethods, allowEvilAlignments: campaign.rules.allowEvilAlignments }
    : PERSONAL_SHEET_CONTEXT;
}

export default function NewCharacterScreen() {
  const params = useLocalSearchParams<{ campanha?: string }>();
  const userId = useUserId();
  const campaigns = useAsyncData(async () => {
    const list = await listMyCampaigns(getSupabase(), userId);
    // Personagens de campanha são dos jogadores; o mestre usa NPCs e monstros.
    return list
      .filter((campaign) => campaign.status === 'active' && campaign.role === 'player' && campaign.systemId === 'dnd5e')
      .map((campaign) => ({ id: campaign.id, name: campaign.name, rules: parseDnd5eCampaignRules(campaign.characterRules) }));
  }, userId);

  if (campaigns.loading) return <LoadingState label="Carregando suas campanhas…" />;
  const list = campaigns.data ?? [];
  const preselected = list.some((campaign) => campaign.id === params.campanha) ? (params.campanha ?? '') : '';
  return <Wizard campaigns={list} defaultCampaignId={preselected} loadError={campaigns.error ? failureMessage(campaigns.error) : null} />;
}

function Wizard({ campaigns, defaultCampaignId, loadError }: { campaigns: PlayableCampaign[]; defaultCampaignId: string; loadError: string | null }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [campaignId, setCampaignId] = useState(defaultCampaignId);
  const campaign = campaigns.find((entry) => entry.id === campaignId);
  const context = useMemo(() => contextFor(campaign), [campaign]);
  const [draft, setDraft] = useState<Dnd5eDraft>(() =>
    createDnd5eDraft({ level: campaign?.rules.startingLevel ?? 1, abilityMethod: contextFor(campaign).abilityScoreMethods[0] ?? 'standard_array' }),
  );
  const [rolls, setRolls] = useState<RollState>(EMPTY_ROLLS);
  const [step, setStep] = useState<Dnd5eStep>('start');
  const [attempted, setAttempted] = useState<Set<Dnd5eStep>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(loadError);

  const specs = useMemo(() => listDnd5eChoices(draft), [draft]);
  const issues = useMemo(() => validateDnd5eDraft(draft, context), [draft, context]);
  const issueMap = useMemo(() => new Map(issues.map((issue) => [issue.path, issue.message])), [issues]);
  const steps = useMemo(() => DND5E_STEPS.filter((entry) => entry !== 'spells' || specs.some((spec) => spec.step === 'spells')), [specs]);
  const index = steps.indexOf(step);
  const showErrors = attempted.has(step) || step === 'review';
  const errorFor = (path: string) => (showErrors ? issueMap.get(path) : undefined);
  const stepIssues = (target: Dnd5eStep) => issues.filter((issue) => issue.step === target);
  const classDef = draftClass(draft);

  const update = (patch: Partial<Dnd5eDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const setSelection = (id: string, value: Selection) => setDraft((current) => ({ ...current, selections: { ...current.selections, [id]: value } }));
  const goTo = (target: Dnd5eStep) => {
    setStep(target);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const next = () => {
    setAttempted((current) => new Set(current).add(step));
    if (stepIssues(step).length > 0) return;
    const following = steps[index + 1];
    if (following) goTo(following);
  };

  const chooseCampaign = (id: string) => {
    setCampaignId(id);
    const nextCampaign = campaigns.find((entry) => entry.id === id);
    const nextContext = contextFor(nextCampaign);
    setDraft((current) => ({
      ...current,
      level: nextCampaign ? nextCampaign.rules.startingLevel : current.level,
      ...(nextContext.abilityScoreMethods.includes(current.abilityMethod)
        ? {}
        : { abilityMethod: nextContext.abilityScoreMethods[0] ?? 'standard_array', baseScores: { str: null, dex: null, con: null, int: null, wis: null, cha: null } }),
    }));
  };

  const submit = async () => {
    setMessage(null);
    if (issues.length > 0) {
      setAttempted(new Set(DND5E_STEPS));
      setMessage('Ainda há escolhas pendentes. Revise os passos indicados.');
      return;
    }
    const base = characterCreateSchema.safeParse({ name: draft.name, systemId: 'dnd5e', campaignId: campaignId || null });
    if (!base.success) {
      setMessage(base.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setBusy(true);
    try {
      const built = buildDnd5eCharacterFromDraft({ ...draft, sourcebooks: campaign ? campaign.rules.sourcebooks : draft.sourcebooks });
      const id = await createCharacter(getSupabase(), {
        name: base.data.name,
        systemId: base.data.systemId,
        campaignId: base.data.campaignId,
        sheet: built.sheet,
        resources: built.resources,
        items: built.items,
        abilities: built.abilities,
      });
      router.replace({ pathname: '/personagem/[id]', params: { id } });
    } catch (error) {
      setMessage(failureMessage(error));
      setBusy(false);
    }
  };

  const stepSpecs = specs.filter((spec) => spec.step === step);
  const renderSpecs = () =>
    stepSpecs.map((spec) => <ChoiceField key={spec.id} spec={spec} value={draft.selections[spec.id]} error={errorFor(spec.id)} onChange={(value) => setSelection(spec.id, value)} />);

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {steps.map((entry, position) => {
          const current = entry === step;
          const warn = attempted.has(entry) && stepIssues(entry).length > 0 && !current;
          return (
            <Pressable
              key={entry}
              onPress={() => goTo(entry)}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
              style={[styles.stepChip, current && styles.stepChipCurrent]}
            >
              <AppText style={{ fontSize: 13, color: current ? colors.fgAccent : warn ? '#E6BE74' : colors.fgSecondary }}>
                {position + 1}. {dnd5eStepLabels[entry]}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <AppText variant="title" accessibilityRole="header">
        {dnd5eStepLabels[step]}
      </AppText>
      {message ? <Notice tone="danger" message={message} /> : null}

      {step === 'start' ? (
        <View style={{ gap: spacing[3] }}>
          <Field label="Nome do personagem" value={draft.name} onChangeText={(name) => update({ name })} maxLength={80} error={errorFor('name')} />
          <AppText style={{ fontFamily: fonts.sansMedium }}>Campanha</AppText>
          <OptionCard selected={campaignId === ''} title="Sem campanha (ficha pessoal)" description="Você escolhe o nível." onPress={() => chooseCampaign('')} />
          {campaigns.map((entry) => (
            <OptionCard
              key={entry.id}
              selected={entry.id === campaignId}
              title={entry.name}
              description={describeDnd5eCampaignRules(entry.rules).join(' ')}
              onPress={() => chooseCampaign(entry.id)}
            />
          ))}
          <AppText variant="small">Campanhas em que você é mestre não aparecem: o mestre usa NPCs e monstros.</AppText>
          {campaign ? (
            <Badge label={`Nível definido pelo mestre: ${campaign.rules.startingLevel}º`} tone="parchment" />
          ) : (
            <View style={styles.levelRow}>
              <AppText style={{ flex: 1 }}>Nível</AppText>
              <Button label="−" variant="secondary" compact onPress={() => update({ level: Math.max(1, draft.level - 1) })} disabled={draft.level <= 1} accessibilityLabel="Diminuir nível" />
              <AppText variant="number">{draft.level}º</AppText>
              <Button label="+" variant="secondary" compact onPress={() => update({ level: Math.min(20, draft.level + 1) })} disabled={draft.level >= 20} accessibilityLabel="Aumentar nível" />
            </View>
          )}
          {errorFor('level') ? <Notice tone="danger" message={errorFor('level')!} /> : null}
          {/* Ficha pessoal: o jogador escolhe os livros; numa campanha, valem os do mestre (na descrição acima). */}
          {campaign ? null : <SourcebookChips audience="character" selected={draft.sourcebooks} onChange={(sourcebooks) => update({ sourcebooks })} />}
          <AppText variant="muted">
            O passo a passo segue a criação do SRD 5.2.1: classe, origem (antecedente, espécie e idiomas), atributos, alinhamento e detalhes.
          </AppText>
        </View>
      ) : null}

      {step === 'class' ? (
        <View style={{ gap: spacing[3] }}>
          {listClasses().map((entry) => (
            <OptionCard
              key={entry.id}
              selected={entry.id === draft.classId}
              title={entry.name}
              icon={(color) => <CharacterIcon kind="class" id={entry.id} color={color} />}
              description={`${entry.primaryAbilityLabel} · ${entry.hitDie} · ${entry.summary}`}
              onPress={() =>
                setDraft((current) =>
                  current.classId === entry.id ? current : { ...current, classId: entry.id, selections: without(current.selections, CLEAR_ON_CLASS) },
                )
              }
            />
          ))}
          {errorFor('classId') ? <Notice tone="danger" message={errorFor('classId')!} /> : null}
          {classDef ? (
            <Card>
              <AppText variant="eyebrow">Habilidades até o {draft.level}º nível</AppText>
              {classDef.features
                .filter((feature) => feature.level <= draft.level)
                .map((feature) => (
                  <View key={`${feature.level}-${feature.name}`} style={{ gap: 2 }}>
                    <AppText style={{ fontFamily: fonts.sansMedium }}>
                      {feature.level}º · {feature.name}
                    </AppText>
                    <AppText variant="small">{feature.description}</AppText>
                  </View>
                ))}
              {draft.level >= 3 ? (
                <>
                  <AppText variant="eyebrow">Subclasse do SRD: {classDef.subclass.name}</AppText>
                  {classDef.subclass.features
                    .filter((feature) => feature.level <= draft.level)
                    .map((feature) => (
                      <View key={`${feature.level}-${feature.name}`} style={{ gap: 2 }}>
                        <AppText style={{ fontFamily: fonts.sansMedium }}>
                          {feature.level}º · {feature.name}
                        </AppText>
                        <AppText variant="small">{feature.description}</AppText>
                      </View>
                    ))}
                </>
              ) : (
                <AppText variant="small">A subclasse ({classDef.subclass.name}) chega no 3º nível.</AppText>
              )}
            </Card>
          ) : null}
          {renderSpecs()}
        </View>
      ) : null}

      {step === 'background' ? (
        <View style={{ gap: spacing[3] }}>
          {SRD_BACKGROUNDS.map((background) => (
            <OptionCard
              key={background.id}
              selected={background.id === draft.backgroundId}
              title={background.name}
              description={`${background.summary} Atributos: ${background.abilities.map((ability) => abilityLabels[ability].abbreviation).join(', ')}. Talento: ${findFeat(background.feat)?.name ?? background.feat}. Perícias: ${background.skills.map((skill) => skillDefinitions[skill].label).join(' e ')}.`}
              onPress={() =>
                setDraft((current) =>
                  current.backgroundId === background.id ? current : { ...current, backgroundId: background.id, selections: without(current.selections, CLEAR_ON_BACKGROUND) },
                )
              }
            />
          ))}
          {errorFor('backgroundId') ? <Notice tone="danger" message={errorFor('backgroundId')!} /> : null}
          {renderSpecs()}
        </View>
      ) : null}

      {step === 'species' ? (
        <View style={{ gap: spacing[3] }}>
          {SRD_SPECIES.map((species) => (
            <OptionCard
              key={species.id}
              selected={species.id === draft.speciesId}
              title={species.name}
              icon={(color) => <CharacterIcon kind="species" id={species.id} color={color} />}
              description={`${species.sizeLabel} · ${formatDistance(species.speed, 'm')}. ${species.summary}`}
              onPress={() =>
                setDraft((current) =>
                  current.speciesId === species.id ? current : { ...current, speciesId: species.id, selections: without(current.selections, CLEAR_ON_SPECIES) },
                )
              }
            />
          ))}
          {errorFor('speciesId') ? <Notice tone="danger" message={errorFor('speciesId')!} /> : null}
          {renderSpecs()}
        </View>
      ) : null}

      {step === 'proficiencies' ? <View style={{ gap: spacing[3] }}>{renderSpecs()}</View> : null}

      {step === 'abilities' ? (
        <View style={{ gap: spacing[3] }}>
          <AbilityScoresField
            draft={draft}
            methods={context.abilityScoreMethods}
            classDef={classDef}
            rolls={rolls}
            error={errorFor('baseScores') ?? errorFor('abilityMethod')}
            onMethod={(method, scores) => update({ abilityMethod: method, baseScores: scores })}
            onScores={(scores) => update({ baseScores: scores })}
            onRolls={setRolls}
          />
          {renderSpecs()}
        </View>
      ) : null}

      {step === 'spells' ? <View style={{ gap: spacing[3] }}>{renderSpecs()}</View> : null}

      {step === 'equipment' ? (
        <View style={{ gap: spacing[3] }}>
          {renderSpecs()}
          <Card>
            <AppText variant="eyebrow">Você começa com</AppText>
            {startingEquipment(draft).items.map((item) => (
              <AppText key={`${item.catalogId}-${item.name}`} variant="small">
                {item.quantity > 1 ? `${item.quantity} × ` : ''}
                {item.name}
              </AppText>
            ))}
            <AppText variant="muted">{startingEquipment(draft).gold} PO</AppText>
          </Card>
        </View>
      ) : null}

      {step === 'details' ? (
        <View style={{ gap: spacing[3] }}>
          <AppText style={{ fontFamily: fonts.sansMedium }}>Alinhamento</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {ALIGNMENTS.map((alignment) => {
              const disabled = alignment.evil && !context.allowEvilAlignments;
              const selected = draft.alignment === alignment.id;
              return (
                <Pressable
                  key={alignment.id}
                  onPress={() => update({ alignment: alignment.id })}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                  style={[styles.stepChip, selected && styles.stepChipCurrent, disabled && { opacity: 0.4 }]}
                >
                  <AppText style={{ fontSize: 14, color: selected ? colors.fgAccent : colors.fgSecondary }}>{alignment.name}</AppText>
                </Pressable>
              );
            })}
          </View>
          {errorFor('alignment') ? <AppText style={{ color: '#EC9384' }}>{errorFor('alignment')}</AppText> : null}
          {(
            [
              ['appearance', 'Aparência', 4000],
              ['personality', 'Personalidade', 4000],
              ['ideals', 'Ideais', 2000],
              ['bonds', 'Vínculos', 2000],
              ['flaws', 'Defeitos', 2000],
              ['backstory', 'História', 20000],
            ] as const
          ).map(([key, label, max]) => (
            <Field
              key={key}
              label={`${label} (opcional)`}
              value={draft.details[key]}
              onChangeText={(text) => update({ details: { ...draft.details, [key]: text } })}
              maxLength={max}
              multiline
            />
          ))}
        </View>
      ) : null}

      {step === 'review' ? <Review draft={draft} issues={issues} onGo={goTo} /> : null}

      {showErrors && step !== 'review' && stepIssues(step).length > 0 ? (
        <Notice tone="warning" message={`Há ${stepIssues(step).length} pendência(s) neste passo.`} />
      ) : null}

      <View style={styles.footer}>
        <Button label="Voltar" variant="ghost" onPress={() => goTo(steps[index - 1] ?? 'start')} disabled={index <= 0} style={{ flex: 1 }} />
        {step === 'review' ? (
          <Button label="Criar personagem" onPress={() => void submit()} loading={busy} disabled={issues.length > 0} style={{ flex: 2 }} />
        ) : (
          <Button label="Próximo" onPress={next} style={{ flex: 2 }} />
        )}
      </View>
    </ScrollView>
  );
}

function Review({ draft, issues, onGo }: { draft: Dnd5eDraft; issues: ReturnType<typeof validateDnd5eDraft>; onGo: (step: Dnd5eStep) => void }) {
  const preview = useMemo(() => previewDnd5eCharacter(draft), [draft]);
  const { sheet, derived, resources, abilities, items } = preview;
  const hp = resources.find((resource) => resource.key === 'hp');
  const klass = sheet.identity.classes[0];
  return (
    <View style={{ gap: spacing[3] }}>
      {issues.length > 0 ? (
        <Card>
          <AppText variant="heading">Pendências ({issues.length})</AppText>
          {issues.map((issue) => (
            <Pressable key={issue.path} onPress={() => onGo(issue.step)} accessibilityRole="button" style={{ gap: 2, paddingVertical: 4 }}>
              <AppText variant="small" style={{ color: '#E6BE74' }}>
                {dnd5eStepLabels[issue.step]}
              </AppText>
              <AppText>{issue.message}</AppText>
            </Pressable>
          ))}
        </Card>
      ) : (
        <Notice tone="success" message="Tudo certo! Confira e crie o personagem." />
      )}
      <Card ornate>
        <AppText variant="title">{draft.name || 'Sem nome'}</AppText>
        <AppText variant="muted">
          {[sheet.identity.species, klass ? `${klass.name} ${klass.level}${klass.subclass ? ` · ${klass.subclass}` : ''}` : '', sheet.identity.background, sheet.identity.alignment]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={`PV ${hp?.max ?? '—'}`} tone="parchment" />
          <Badge label={`CA ${sheet.combat.armorClass}`} tone="parchment" />
          <Badge label={`Iniciativa ${formatModifier(derived.initiative)}`} tone="parchment" />
          <Badge label={`${String(sheet.combat.speed).replace('.', ',')} m`} tone="parchment" />
          <Badge label={`Proficiência ${formatModifier(derived.proficiencyBonus)}`} tone="parchment" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ABILITIES.map((ability) => (
            <View key={ability} style={styles.ability}>
              <AppText variant="small">{abilityLabels[ability].abbreviation}</AppText>
              <AppText variant="number" style={{ fontSize: 18 }}>
                {sheet.abilities[ability]}
              </AppText>
              <AppText variant="small">{formatModifier(derived.abilityModifiers[ability])}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="eyebrow">Perícias</AppText>
        <AppText variant="small">
          {SKILLS.filter((skill) => sheet.skills[skill].proficiency === 'proficient' || sheet.skills[skill].proficiency === 'expertise')
            .map((skill) => `${skillDefinitions[skill].label} ${formatModifier(derived.skills[skill].bonus)}`)
            .join(' · ') || '—'}
        </AppText>
        <AppText variant="eyebrow">Idiomas e ferramentas</AppText>
        <AppText variant="small">{[sheet.proficiencies.languages, sheet.proficiencies.tools].filter(Boolean).join(' · ') || '—'}</AppText>
        <AppText variant="eyebrow">Habilidades</AppText>
        <AppText variant="small">
          {abilities
            .filter((entry) => entry.kind !== 'spell' && entry.kind !== 'attack')
            .map((entry) => entry.name)
            .join(' · ')}
        </AppText>
        {abilities.some((entry) => entry.kind === 'spell') ? (
          <>
            <AppText variant="eyebrow">Magias</AppText>
            <AppText variant="small">
              {abilities
                .filter((entry) => entry.kind === 'spell')
                .map((entry) => entry.name)
                .join(' · ')}
            </AppText>
          </>
        ) : null}
        <AppText variant="eyebrow">Inventário</AppText>
        <AppText variant="small">{items.map((item) => (item.quantity > 1 ? `${item.quantity} × ${item.name}` : item.name)).join(' · ') || '—'}</AppText>
        <AppText variant="small">{resources.find((resource) => resource.key === 'currency_gp')?.current ?? 0} PO</AppText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[4] },
  stepChip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.full, paddingHorizontal: spacing[3] },
  stepChipCurrent: { borderColor: 'rgba(206, 191, 157, 0.7)', backgroundColor: 'rgba(228, 216, 189, 0.08)' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  footer: { flexDirection: 'row', gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing[3] },
  ability: { minWidth: 52, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingVertical: 4 },
});
