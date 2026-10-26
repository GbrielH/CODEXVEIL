import { characterImagePrompt } from '@codexveil/domain';
import {
  createCharacter,
  listBookEntries,
  listCampaignBookPacks,
  listMyBookPacks,
  listMyCampaigns,
  type BookPackSummary,
} from '@codexveil/database';
import {
  campaignSourcebooks,
  ABILITIES,
  ALIGNMENTS,
  CHARACTER_BOOK_KINDS,
  DND5E_STEPS,
  PERSONAL_SHEET_CONTEXT,
  SKILLS,
  abilityLabels,
  buildDnd5eBookContent,
  buildDnd5eCharacterFromDraft,
  createDnd5eDraft,
  describeDnd5eCampaignRules,
  dnd5eStepLabels,
  draftClass,
  draftSubclass,
  draftSubclassOptions,
  englishName,
  matchesNameSearch,
  findFeat,
  formatDistance,
  formatModifier,
  listBackgrounds,
  listClasses,
  listDnd5eChoices,
  listSpecies,
  parseDnd5eCampaignRules,
  previewDnd5eCharacter,
  setActiveDnd5eBookContent,
  skillDefinitions,
  startingEquipment,
  validateDnd5eDraft,
  type BookContentSource,
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
import {
  AbilityScoresField,
  EMPTY_ROLLS,
  type RollState,
} from '@/components/creation/ability-scores';
import { SourcebookChips } from '@/components/campaign-rules-editor';
import { CharacterIcon } from '@/components/creation/character-icon';
import { ImagePromptCard } from '@/components/creation/image-prompt-card';
import { ChoiceField, OptionCard } from '@/components/creation/choice-fields';
import { T20MobileWizard } from '@/components/t20/wizard';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { loadT20Sources } from '@/lib/books';
import { parseT20CampaignRules, type T20ContentSource } from '@codexveil/rpg-systems/tormenta20';
import { CreationAnswersCard, answersComplete, answersFor } from '@/components/characters/creation-answers';
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
  /** Livros do mestre liberados nesta campanha (ids dos pacotes). */
  packIds: string[];
  /** Perguntas do mestre (todas obrigatórias). */
  questions: string[];
}

interface CreationData {
  campaigns: PlayableCampaign[];
  /** Conteúdo de cada livro, pelo id do pacote. */
  books: Record<string, BookContentSource>;
  /** Livros prontos do próprio usuário (fichas pessoais). */
  personalPackIds: string[];
}

/** Campanhas jogáveis e o conteúdo dos livros: os liberados em cada campanha e, na ficha pessoal, os do usuário. */
async function loadCreationData(userId: string): Promise<CreationData> {
  const client = getSupabase();
  const list = (await listMyCampaigns(client, userId)).filter(
    // Personagens de campanha são dos jogadores; o mestre usa NPCs e monstros.
    (campaign) =>
      campaign.status === 'active' && campaign.role === 'player' && campaign.systemId === 'dnd5e',
  );
  // Só livros de D&D aqui (o Tormenta20 tem o próprio assistente).
  const isDnd = (pack: BookPackSummary) => (pack.systemId ?? 'dnd5e') === 'dnd5e';
  const [own, ...perCampaign] = await Promise.all([
    listMyBookPacks(client, userId).then((packs) =>
      packs.filter((pack) => pack.isReady && isDnd(pack)),
    ),
    ...list.map((campaign) =>
      listCampaignBookPacks(
        client,
        campaign.ownerId,
        campaignSourcebooks(campaign.characterRules),
      ).then((found) => found.filter(isDnd)),
    ),
  ]);
  const packs: BookPackSummary[] = [
    ...new Map([...own, ...perCampaign.flat()].map((pack) => [pack.id, pack])).values(),
  ];
  const entries =
    packs.length > 0
      ? await listBookEntries(
          client,
          packs.map((pack) => pack.id),
          CHARACTER_BOOK_KINDS,
        )
      : [];
  const books = Object.fromEntries(
    packs.map((pack) => [
      pack.id,
      {
        book: { id: pack.bookKey, name: pack.name },
        entries: entries
          .filter((entry) => entry.packId === pack.id)
          .map(({ kind, key, name, data }) => ({ kind, key, name, data })),
      },
    ]),
  );
  return {
    campaigns: list.map((campaign, index) => ({
      id: campaign.id,
      name: campaign.name,
      rules: parseDnd5eCampaignRules(campaign.characterRules),
      packIds: (perCampaign[index] ?? []).map((pack) => pack.id),
      questions: campaign.creationQuestions,
    })),
    books,
    personalPackIds: own.map((pack) => pack.id),
  };
}

const CLEAR_ON_CLASS = ['class.', 'subclass.', 'spells.', 'asi.', 'epic.', 'equipment.class'];
const CLEAR_ON_BACKGROUND = ['background.', 'equipment.background'];
const CLEAR_ON_SPECIES = ['species.'];

/** Resumo curto no cartão (os livros importados trazem textos longos). */
function clip(text: string, max = 220): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function without(
  selections: Dnd5eDraft['selections'],
  prefixes: string[],
): Dnd5eDraft['selections'] {
  return Object.fromEntries(
    Object.entries(selections).filter(
      ([key]) => !prefixes.some((prefix) => key.startsWith(prefix)),
    ),
  );
}

function contextFor(campaign: PlayableCampaign | undefined): Dnd5eCreationContext {
  return campaign
    ? {
        lockedLevel: campaign.rules.startingLevel,
        abilityScoreMethods: campaign.rules.abilityScoreMethods,
        allowEvilAlignments: campaign.rules.allowEvilAlignments,
      }
    : PERSONAL_SHEET_CONTEXT;
}

/** Campanhas de Tormenta20 em que o usuário é jogador e o conteúdo dos livros (dela ou do usuário). */
async function loadT20Data(userId: string) {
  const client = getSupabase();
  const campaigns = (await listMyCampaigns(client, userId)).filter(
    (campaign) =>
      campaign.status === 'active' &&
      campaign.role === 'player' &&
      campaign.systemId === 'tormenta20',
  );
  const own = (await listMyBookPacks(client, userId)).filter((pack) => pack.isReady);
  return { campaigns, own: await loadT20Sources(client, own) };
}

export default function NewCharacterScreen() {
  const params = useLocalSearchParams<{ campanha?: string }>();
  const userId = useUserId();
  const data = useAsyncData(() => loadCreationData(userId), userId);
  const t20 = useAsyncData(() => loadT20Data(userId), `t20:${userId}`);
  const [system, setSystem] = useState<'dnd5e' | 'tormenta20'>('dnd5e');
  const [t20Campaign, setT20Campaign] = useState<string>('');
  const [t20Sources, setT20Sources] = useState<T20ContentSource[] | null>(null);
  const preT20 = t20.data?.campaigns.find((campaign) => campaign.id === params.campanha);
  const activeSystem = preT20 ? 'tormenta20' : system;

  if (data.loading || t20.loading)
    return <LoadingState label="Carregando suas campanhas e livros…" />;
  const hasT20 = (t20.data?.campaigns.length ?? 0) > 0 || (t20.data?.own.length ?? 0) > 0;
  if (activeSystem === 'tormenta20' && t20.data) {
    const chosenId = preT20?.id ?? t20Campaign;
    const chosen = t20.data.campaigns.find((campaign) => campaign.id === chosenId);
    if (chosenId && !t20Sources) {
      void (async () => {
        const client = getSupabase();
        const packs = chosen
          ? await listCampaignBookPacks(
              client,
              chosen.ownerId,
              campaignSourcebooks(chosen.characterRules),
            )
          : [];
        setT20Sources(await loadT20Sources(client, packs));
      })();
      return <LoadingState label="Carregando os livros da campanha…" />;
    }
    if (!chosenId && t20Campaign === '') {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.canvas }}
          contentContainerStyle={styles.content}
        >
          <Segmented
            value="tormenta20"
            onChange={(value) => setSystem(value)}
            accessibilityLabel="Sistema"
            options={[
              { value: 'dnd5e', label: 'D&D 5e' },
              { value: 'tormenta20', label: 'Tormenta20' },
            ]}
          />
          <AppText variant="title">Onde o personagem vai jogar?</AppText>
          {t20.data.campaigns.map((campaign) => (
            <OptionCard
              key={campaign.id}
              selected={false}
              title={campaign.name}
              description="Campanha de Tormenta20"
              onPress={() => {
                setT20Sources(null);
                setT20Campaign(campaign.id);
              }}
            />
          ))}
          <OptionCard
            selected={false}
            title="Ficha pessoal"
            description="Com os seus livros do Tormenta20."
            onPress={() => {
              setT20Sources(t20.data!.own);
              setT20Campaign('pessoal');
            }}
          />
        </ScrollView>
      );
    }
    return (
      <T20MobileWizard
        campaign={
          chosen
            ? {
                id: chosen.id,
                name: chosen.name,
                rules: parseT20CampaignRules(chosen.characterRules),
                questions: chosen.creationQuestions,
              }
            : null
        }
        sources={chosen ? (t20Sources ?? []) : t20.data.own}
      />
    );
  }
  const loaded = data.data ?? { campaigns: [], books: {}, personalPackIds: [] };
  const preselected = loaded.campaigns.some((campaign) => campaign.id === params.campanha)
    ? (params.campanha ?? '')
    : '';
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {hasT20 ? (
        <View style={{ padding: spacing[4], paddingBottom: 0 }}>
          <Segmented
            value="dnd5e"
            onChange={(value) => setSystem(value)}
            accessibilityLabel="Sistema"
            options={[
              { value: 'dnd5e', label: 'D&D 5e' },
              { value: 'tormenta20', label: 'Tormenta20' },
            ]}
          />
        </View>
      ) : null}
      <Wizard
        {...loaded}
        defaultCampaignId={preselected}
        loadError={data.error ? failureMessage(data.error) : null}
      />
    </View>
  );
}

function Wizard({
  campaigns,
  books,
  personalPackIds,
  defaultCampaignId,
  loadError,
}: CreationData & { defaultCampaignId: string; loadError: string | null }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [campaignId, setCampaignId] = useState(defaultCampaignId);
  const campaign = campaigns.find((entry) => entry.id === campaignId);
  const context = useMemo(() => contextFor(campaign), [campaign]);
  const questions = campaign?.questions ?? [];
  const [answerValues, setAnswerValues] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState<Dnd5eDraft>(() =>
    createDnd5eDraft({
      level: campaign?.rules.startingLevel ?? 1,
      abilityMethod: contextFor(campaign).abilityScoreMethods[0] ?? 'standard_array',
    }),
  );
  // Livros: na campanha, os do mestre; na ficha pessoal, só os importados que estão marcados.
  const packIds = useMemo(
    () =>
      campaign
        ? campaign.packIds
        : personalPackIds.filter((id) => draft.sourcebooks.includes(books[id]?.book.id ?? '')),
    [campaign, personalPackIds, books, draft.sourcebooks],
  );
  const bookSources = useMemo(
    () =>
      packIds
        .map((id) => books[id])
        .filter((source): source is BookContentSource => Boolean(source)),
    [packIds, books],
  );
  const bookContent = useMemo(() => buildDnd5eBookContent(bookSources), [bookSources]);
  const bookNames = useMemo(
    () => Object.fromEntries(bookSources.map((source) => [source.book.id, source.book.name])),
    [bookSources],
  );
  // As regras de criação consultam o SRD e os livros da campanha escolhida (como no site).
  setActiveDnd5eBookContent(bookContent);
  const [rolls, setRolls] = useState<RollState>(EMPTY_ROLLS);
  const [step, setStep] = useState<Dnd5eStep>('start');
  const [attempted, setAttempted] = useState<Set<Dnd5eStep>>(new Set());
  const [busy, setBusy] = useState(false);
  // Busca de classe e espécie pelo nome em português ou em inglês.
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(loadError);

  const specs = useMemo(() => listDnd5eChoices(draft), [draft, bookContent]); // eslint-disable-line react-hooks/exhaustive-deps
  const issues = useMemo(() => validateDnd5eDraft(draft, context), [draft, context, bookContent]); // eslint-disable-line react-hooks/exhaustive-deps
  const issueMap = useMemo(
    () => new Map(issues.map((issue) => [issue.path, issue.message])),
    [issues],
  );
  const steps = useMemo(
    () =>
      DND5E_STEPS.filter(
        (entry) => entry !== 'spells' || specs.some((spec) => spec.step === 'spells'),
      ),
    [specs],
  );
  const index = steps.indexOf(step);
  const showErrors = attempted.has(step) || step === 'review';
  const errorFor = (path: string) => (showErrors ? issueMap.get(path) : undefined);
  const stepIssues = (target: Dnd5eStep) => issues.filter((issue) => issue.step === target);
  const classDef = draftClass(draft);
  const subclass = draftSubclass(draft);
  const subclassCount = draftSubclassOptions(draft).length;

  const update = (patch: Partial<Dnd5eDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const setSelection = (id: string, value: Selection) =>
    setDraft((current) => ({ ...current, selections: { ...current.selections, [id]: value } }));
  const goTo = (target: Dnd5eStep) => {
    setStep(target);
    setQuery('');
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
        : {
            abilityMethod: nextContext.abilityScoreMethods[0] ?? 'standard_array',
            baseScores: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
          }),
    }));
  };

  const submit = async () => {
    setMessage(null);
    if (issues.length > 0) {
      setAttempted(new Set(DND5E_STEPS));
      setMessage('Ainda há escolhas pendentes. Revise os passos indicados.');
      return;
    }
    const base = characterCreateSchema.safeParse({
      name: draft.name,
      systemId: 'dnd5e',
      campaignId: campaignId || null,
    });
    if (!base.success) {
      setMessage(base.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setBusy(true);
    try {
      const built = buildDnd5eCharacterFromDraft({
        ...draft,
        sourcebooks: campaign ? campaign.rules.sourcebooks : draft.sourcebooks,
      });
      const id = await createCharacter(getSupabase(), {
        name: base.data.name,
        systemId: base.data.systemId,
        campaignId: base.data.campaignId,
        sheet: built.sheet,
        resources: built.resources,
        items: built.items,
        abilities: built.abilities,
        ...(campaign ? { answers: answersFor(questions, answerValues) } : {}),
      });
      router.replace({ pathname: '/personagem/[id]', params: { id } });
    } catch (error) {
      setMessage(failureMessage(error));
      setBusy(false);
    }
  };

  const stepSpecs = specs.filter((spec) => spec.step === step);
  // Treino em armaduras e escudos (fixo pela classe): logo depois da Maestria em Armas.
  const armorTraining =
    step === 'class' && classDef ? (
      <Card key="treino-armaduras">
        <AppText variant="heading">Armaduras e escudos</AppText>
        <AppText variant="small">Treino: {classDef.armorLabel || 'nenhum'}.</AppText>
        <AppText variant="muted">
          Fixo pela classe, sem escolha. Usar armadura sem treino dá desvantagem em testes de Força e Destreza e impede conjurar magias; escudo sem treino não soma na CA.
        </AppText>
      </Card>
    ) : null;
  const renderSpecs = () => {
    const fields = stepSpecs.flatMap((spec) => {
      const field = (
        <ChoiceField
          key={spec.id}
          spec={spec}
          value={draft.selections[spec.id]}
          error={errorFor(spec.id)}
          onChange={(value) => setSelection(spec.id, value)}
        />
      );
      return spec.id === 'class.weapon_mastery' && armorTraining ? [field, armorTraining] : [field];
    });
    return stepSpecs.some((spec) => spec.id === 'class.weapon_mastery') || !armorTraining ? fields : [...fields, armorTraining];
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
              <AppText
                style={{
                  fontSize: 13,
                  color: current ? colors.fgAccent : warn ? '#E6BE74' : colors.fgSecondary,
                }}
              >
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
          <Field
            label="Nome do personagem"
            value={draft.name}
            onChangeText={(name) => update({ name })}
            maxLength={80}
            error={errorFor('name')}
          />
          <AppText style={{ fontFamily: fonts.sansMedium }}>Campanha</AppText>
          <OptionCard
            selected={campaignId === ''}
            title="Sem campanha (ficha pessoal)"
            description="Você escolhe o nível."
            onPress={() => chooseCampaign('')}
          />
          {campaigns.map((entry) => (
            <OptionCard
              key={entry.id}
              selected={entry.id === campaignId}
              title={entry.name}
              description={describeDnd5eCampaignRules(entry.rules, bookNames).join(' ')}
              onPress={() => chooseCampaign(entry.id)}
            />
          ))}
          <AppText variant="small">
            Campanhas em que você é mestre não aparecem: o mestre usa NPCs e monstros.
          </AppText>
          {campaign ? (
            <Badge
              label={`Nível definido pelo mestre: ${campaign.rules.startingLevel}º`}
              tone="parchment"
            />
          ) : (
            <View style={styles.levelRow}>
              <AppText style={{ flex: 1 }}>Nível</AppText>
              <Button
                label="−"
                variant="secondary"
                compact
                onPress={() => update({ level: Math.max(1, draft.level - 1) })}
                disabled={draft.level <= 1}
                accessibilityLabel="Diminuir nível"
              />
              <AppText variant="number">{draft.level}º</AppText>
              <Button
                label="+"
                variant="secondary"
                compact
                onPress={() => update({ level: Math.min(20, draft.level + 1) })}
                disabled={draft.level >= 20}
                accessibilityLabel="Aumentar nível"
              />
            </View>
          )}
          {errorFor('level') ? <Notice tone="danger" message={errorFor('level')!} /> : null}
          {/* Ficha pessoal: o jogador escolhe os livros; numa campanha, valem os do mestre (na descrição acima). */}
          {campaign ? null : (
            <SourcebookChips
              audience="character"
              selected={draft.sourcebooks}
              onChange={(sourcebooks) => update({ sourcebooks })}
            />
          )}
          <AppText variant="muted">
            O passo a passo segue a criação do SRD 5.2.1: classe, origem (antecedente, espécie e
            idiomas), atributos, alinhamento e detalhes
            {bookSources.length > 0
              ? `, com o conteúdo dos livros ${campaign ? 'liberados pelo mestre' : 'que você importou'}: ${bookSources.map((source) => source.book.name).join(', ')}`
              : ''}
            .
          </AppText>
        </View>
      ) : null}

      {step === 'class' ? (
        <View style={{ gap: spacing[3] }}>
          <Field
            label="Buscar classe"
            value={query}
            onChangeText={setQuery}
            placeholder="Nome em português ou em inglês"
          />
          {listClasses()
            .filter((entry) => matchesNameSearch(entry.name, query))
            .map((entry) => (
              <OptionCard
                key={entry.id}
                titleEn={englishName(entry.name)}
                selected={entry.id === draft.classId}
                title={entry.name}
                icon={(color) => <CharacterIcon kind="class" id={entry.id} color={color} />}
                description={`${entry.primaryAbilityLabel} · ${entry.hitDie}${entry.book ? ` · ${entry.book}` : ''} · ${clip(entry.summary)}`}
                onPress={() =>
                  setDraft((current) =>
                    current.classId === entry.id
                      ? current
                      : {
                          ...current,
                          classId: entry.id,
                          selections: without(current.selections, CLEAR_ON_CLASS),
                        },
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
              {draft.level >= 3 && subclass ? (
                <>
                  <AppText variant="eyebrow">
                    Subclasse: {subclass.name}
                    {subclass.book ? ` (${subclass.book})` : ' (SRD)'}
                  </AppText>
                  {subclass.features
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
                <AppText variant="small">
                  {draft.level >= 3
                    ? `Escolha a subclasse abaixo (${subclassCount} opções).`
                    : `A subclasse é escolhida no 3º nível${subclassCount > 1 ? ` (${subclassCount} opções)` : ''}.`}
                </AppText>
              )}
            </Card>
          ) : null}
          {renderSpecs()}
        </View>
      ) : null}

      {step === 'background' ? (
        <View style={{ gap: spacing[3] }}>
          {listBackgrounds().map((background) => (
            <OptionCard
              key={background.id}
              selected={background.id === draft.backgroundId}
              title={background.name}
              icon={(color) => (
                <CharacterIcon kind="background" id={background.name} color={color} />
              )}
              description={
                background.book
                  ? `${background.book} · Atributos à escolha · Talento de origem à escolha. ${clip(background.summary)}`
                  : `${background.summary} Atributos: ${background.abilities.map((ability) => abilityLabels[ability].abbreviation).join(', ')}. Talento: ${findFeat(background.feat)?.name ?? background.feat}. Perícias: ${background.skills.map((skill) => skillDefinitions[skill].label).join(' e ')}.`
              }
              onPress={() =>
                setDraft((current) =>
                  current.backgroundId === background.id
                    ? current
                    : {
                        ...current,
                        backgroundId: background.id,
                        selections: without(current.selections, CLEAR_ON_BACKGROUND),
                      },
                )
              }
            />
          ))}
          {errorFor('backgroundId') ? (
            <Notice tone="danger" message={errorFor('backgroundId')!} />
          ) : null}
          {renderSpecs()}
        </View>
      ) : null}

      {step === 'species' ? (
        <View style={{ gap: spacing[3] }}>
          <Field
            label="Buscar espécie"
            value={query}
            onChangeText={setQuery}
            placeholder="Nome em português ou em inglês"
          />
          {listSpecies()
            .filter((species) => matchesNameSearch(species.name, query))
            .map((species) => (
              <OptionCard
                key={species.id}
                titleEn={englishName(species.name)}
                selected={species.id === draft.speciesId}
                title={species.name}
                icon={(color) => <CharacterIcon kind="species" id={species.id} color={color} />}
                description={`${species.sizeLabel} · ${formatDistance(species.speed, 'm')}${species.book ? ` · ${species.book}` : ''}. ${clip(species.summary)}`}
                onPress={() =>
                  setDraft((current) =>
                    current.speciesId === species.id
                      ? current
                      : {
                          ...current,
                          speciesId: species.id,
                          selections: without(current.selections, CLEAR_ON_SPECIES),
                        },
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
                  style={[
                    styles.stepChip,
                    selected && styles.stepChipCurrent,
                    disabled && { opacity: 0.4 },
                  ]}
                >
                  <AppText
                    style={{ fontSize: 14, color: selected ? colors.fgAccent : colors.fgSecondary }}
                  >
                    {alignment.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {errorFor('alignment') ? (
            <AppText style={{ color: '#EC9384' }}>{errorFor('alignment')}</AppText>
          ) : null}
          <Field
            label="Altura (ex.: 1,75 m)"
            value={draft.details.height}
            onChangeText={(text) => update({ details: { ...draft.details, height: text } })}
            maxLength={40}
          />
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

      {step === 'review' ? (
        <CreationAnswersCard questions={questions} values={answerValues} onChange={setAnswerValues} />
      ) : null}
      {step === 'review' ? <Review draft={draft} issues={issues} onGo={goTo} /> : null}

      {showErrors && step !== 'review' && stepIssues(step).length > 0 ? (
        <Notice
          tone="warning"
          message={`Há ${stepIssues(step).length} pendência(s) neste passo.`}
        />
      ) : null}

      <View style={styles.footer}>
        <Button
          label="Voltar"
          variant="ghost"
          onPress={() => goTo(steps[index - 1] ?? 'start')}
          disabled={index <= 0}
          style={{ flex: 1 }}
        />
        {step === 'review' ? (
          <Button
            label="Criar personagem"
            onPress={() => void submit()}
            loading={busy}
            disabled={issues.length > 0 || !answersComplete(questions, answerValues)}
            style={{ flex: 2 }}
          />
        ) : (
          <Button label="Próximo" onPress={next} style={{ flex: 2 }} />
        )}
      </View>
    </ScrollView>
  );
}

function Review({
  draft,
  issues,
  onGo,
}: {
  draft: Dnd5eDraft;
  issues: ReturnType<typeof validateDnd5eDraft>;
  onGo: (step: Dnd5eStep) => void;
}) {
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
            <Pressable
              key={issue.path}
              onPress={() => onGo(issue.step)}
              accessibilityRole="button"
              style={{ gap: 2, paddingVertical: 4 }}
            >
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
          {[
            sheet.identity.species,
            klass
              ? `${klass.name} ${klass.level}${klass.subclass ? ` · ${klass.subclass}` : ''}`
              : '',
            sheet.identity.background,
            sheet.identity.alignment,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={`PV ${hp?.max ?? '—'}`} tone="parchment" />
          <Badge label={`CA ${sheet.combat.armorClass}`} tone="parchment" />
          <Badge label={`Iniciativa ${formatModifier(derived.initiative)}`} tone="parchment" />
          <Badge label={`${String(sheet.combat.speed).replace('.', ',')} m`} tone="parchment" />
          <Badge
            label={`Proficiência ${formatModifier(derived.proficiencyBonus)}`}
            tone="parchment"
          />
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
          {SKILLS.filter(
            (skill) =>
              sheet.skills[skill].proficiency === 'proficient' ||
              sheet.skills[skill].proficiency === 'expertise',
          )
            .map(
              (skill) =>
                `${skillDefinitions[skill].label} ${formatModifier(derived.skills[skill].bonus)}`,
            )
            .join(' · ') || '—'}
        </AppText>
        <AppText variant="eyebrow">Idiomas e ferramentas</AppText>
        <AppText variant="small">
          {[sheet.proficiencies.languages, sheet.proficiencies.tools].filter(Boolean).join(' · ') ||
            '—'}
        </AppText>
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
        <AppText variant="small">
          {items
            .map((item) => (item.quantity > 1 ? `${item.quantity} × ${item.name}` : item.name))
            .join(' · ') || '—'}
        </AppText>
        <AppText variant="small">
          {resources.find((resource) => resource.key === 'currency_gp')?.current ?? 0} PO
        </AppText>
      </Card>
      <ImagePromptCard
        prompt={characterImagePrompt({
          system: 'D&D 5e',
          name: draft.name,
          species: sheet.identity.species,
          className: klass ? `${klass.name}${klass.subclass ? ` (${klass.subclass})` : ''}` : '',
          level: klass?.level ?? null,
          background: sheet.identity.background,
          alignment: sheet.identity.alignment,
          strengths: [...ABILITIES]
            .sort((a, b) => sheet.abilities[b] - sheet.abilities[a])
            .map((ability) => abilityLabels[ability].name),
          equipment: items.filter((item) => item.isEquipped).map((item) => item.name),
          appearance: draft.details.appearance,
          personality: [draft.details.personality, draft.details.ideals].filter(Boolean).join(' '),
          backstory: draft.details.backstory,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[4] },
  stepChip: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
  },
  stepChipCurrent: {
    borderColor: 'rgba(206, 191, 157, 0.7)',
    backgroundColor: 'rgba(245, 237, 231, 0.08)',
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  footer: {
    flexDirection: 'row',
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing[3],
  },
  ability: {
    minWidth: 52,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingVertical: 4,
  },
});
