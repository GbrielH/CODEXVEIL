'use client';

import {
  SaveDraftButton,
  discardDraftAfterCreate,
} from '@/components/characters/save-draft-button';
import {
  T20_ATTRIBUTES,
  T20_POINT_BUY_BUDGET,
  T20_POINT_BUY_COST,
  T20_POINT_BUY_MAX,
  T20_POINT_BUY_MIN,
  T20_SKILLS,
  T20_SPELL_SCHOOLS,
  T20_STEPS,
  parseT20Draft,
  buildT20Content,
  createT20Draft,
  describeT20CampaignRules,
  findT20Class,
  findT20Deity,
  findT20Origin,
  findT20Race,
  formatT20Bonus,
  plainT20,
  t20PointBuyCost,
  t20RollTotal,
  t20AttributeFromRoll,
  t20AttributeLabels,
  t20AttributeMethodLabels,
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
  t20OriginItemSlots,
  t20PowerSkillPick,
  T20_SKILL_IDS,
  t20GenericPowerGroups,
  t20GenericPowerOptions,
  t20GrantedPowers,
  t20GrantedSkills,
  t20Lineages,
  t20MustBeDevoted,
  t20PointsSpent,
  t20PowerLevels,
  t20PowerOptions,
  t20PrerequisiteProblems,
  t20SizeLabels,
  t20SpellCount,
  t20StepLabels,
  t20TrainedSkills,
  type T20ArcanistPath,
  type T20Attribute,
  type T20CampaignRules,
  type T20ContentSource,
  type T20Draft,
  type T20Skill,
  type T20Step,
} from '@codexveil/rpg-systems/tormenta20';
import { characterImagePrompt } from '@codexveil/domain';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Dices,
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Dice3DOverlay } from '@/components/dice/dice-3d-overlay';
import { useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { CreationAnswersFields, answersComplete, answersFor } from '@/components/characters/creation-answers';
import { createT20CharacterAction, rollT20AttributesAction } from '@/app/(app)/personagens/actions-t20';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckboxField, SelectField, TextField, TextareaField } from '@/components/ui/field';
import { OriginItemsPicker } from './origin-items';
import { CharacterIcon } from '@/components/characters/character-icon';
import { ImagePromptCard } from '@/components/characters/image-prompt-card';
import { cx } from '@/lib/cx';
import { characterPath } from '@/lib/routes';

export interface T20WizardCampaign {
  id: string;
  name: string;
  rules: T20CampaignRules;
  /** Perguntas do mestre (todas obrigatórias). */
  questions: string[];
}

interface T20WizardProps {
  /** Campanha escolhida no primeiro passo; `null` = ficha pessoal. */
  campaign: T20WizardCampaign | null;
  /** Conteúdo dos livros T20 disponíveis (da campanha ou do próprio usuário). */
  sources: T20ContentSource[];
  /** Rascunho salvo na conta ("Salvar rascunho"), para continuar de onde parou. */
  remoteDraft?: { id: string; payload: unknown } | null;
}

/** Estado salvo num rascunho da conta: rascunho do T20 e passo. */
function readRemote(
  remoteDraft: T20WizardProps['remoteDraft'],
): { draft: T20Draft; step: string } | null {
  const payload = remoteDraft?.payload as { draft?: unknown; step?: string } | undefined;
  if (!payload?.draft) return null;
  try {
    return { draft: parseT20Draft(payload.draft), step: payload.step ?? 'inicio' };
  } catch {
    return null;
  }
}

const SKIPPABLE: T20Step[] = ['magias', 'poderes', 'divindade'];

function d6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** Assistente de criação de personagem do Tormenta20, com as regras de `@codexveil/rpg-systems/tormenta20`. */
export function T20CreationWizard({ campaign, sources, remoteDraft = null }: T20WizardProps) {
  const router = useRouter();
  const questions = campaign?.questions ?? [];
  const [answerValues, setAnswerValues] = useState<Record<number, string>>({});
  const answersOk = answersComplete(questions, answerValues);
  const rules = campaign?.rules;
  const allowedMethods = useMemo(
    () => rules?.attributeMethods ?? (['pontos', 'rolagem'] as const),
    [rules],
  );
  // Ficha pessoal: começa com todos os livros importados marcados (antes começava sem nenhum e
  // o aviso "Sem livros" escondia a lista para marcá-los).
  const [draftId, setDraftId] = useState<string | null>(remoteDraft?.id ?? null);
  const [draft, setDraft] = useState<T20Draft>(() => {
    const saved = readRemote(remoteDraft);
    if (saved) return saved.draft;
    const initial = createT20Draft(rules?.startingLevel ?? 1, allowedMethods[0] ?? 'pontos');
    return campaign
      ? initial
      : { ...initial, sourcebooks: sources.map((source) => source.book.id) };
  });
  // Na campanha, os livros do mestre; na ficha pessoal, só os livros marcados abaixo.
  const selectedSources = useMemo(
    () =>
      campaign ? sources : sources.filter((source) => draft.sourcebooks.includes(source.book.id)),
    [campaign, sources, draft.sourcebooks],
  );
  const content = useMemo(() => buildT20Content(selectedSources), [selectedSources]);
  const [step, setStep] = useState<T20Step>(() => {
    const saved = readRemote(remoteDraft)?.step;
    return saved && (T20_STEPS as readonly string[]).includes(saved)
      ? (saved as T20Step)
      : 'inicio';
  });
  const [attempted, setAttempted] = useState<Set<T20Step>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<T20Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const issues = useMemo(
    () => t20DraftIssues(content, draft, { allowedMethods }),
    [content, draft, allowedMethods],
  );
  const klass = findT20Class(content, draft.classId);
  const race = findT20Race(content, draft.raceId);
  const origin = findT20Origin(content, draft.originId);
  const finalAttributes = t20FinalAttributes(content, draft);
  const powerLevels = klass ? t20PowerLevels(klass, draft.level) : [];

  const steps = T20_STEPS.filter((entry) => {
    if (entry === 'magias') return Boolean(klass?.spellcasting);
    if (entry === 'poderes')
      return (
        powerLevels.length > 0 || t20CreationFeatureChoices(content, draft).length > 0 || !klass
      );
    return true;
  });
  const index = steps.indexOf(step);
  const stepIssues = (target: T20Step) => issues.filter((issue) => issue.step === target);
  const showErrors = attempted.has(step) || step === 'revisao';
  const errorFor = (path: string) =>
    showErrors ? issues.find((issue) => issue.path === path)?.message : undefined;

  const goTo = (target: T20Step) => {
    setStep(target);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const next = () => {
    setAttempted((current) => new Set(current).add(step));
    if (stepIssues(step).length > 0 && !SKIPPABLE.includes(step)) return;
    const following = steps[index + 1];
    if (following) goTo(following);
  };

  const submit = () => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createT20CharacterAction({ campaignId: campaign?.id ?? null, draft, answers: answersFor(questions, answerValues) });
      if (result.ok) {
        await discardDraftAfterCreate(draftId);
        router.push(`${characterPath(result.characterId)}?aviso=personagem-criado` as Route);
        return;
      }
      setSubmitError(result.message);
      setAttempted(new Set(T20_STEPS));
    });
  };

  const available = useMemo(() => buildT20Content(sources), [sources]);
  if (available.races.length === 0 || available.classes.length === 0) {
    return (
      <Alert tone="warning" title="Sem livros do Tormenta20">
        {campaign
          ? 'O mestre ainda não liberou um livro do Tormenta20 com raças e classes nesta campanha.'
          : 'Importe o livro básico do Tormenta20 em "Meus livros" e marque-o na ficha para criar um personagem.'}
      </Alert>
    );
  }

  return (
    <div ref={topRef} className="flex scroll-mt-20 flex-col gap-6">
      <nav aria-label="Passos da criação">
        <ol className="flex gap-1 overflow-x-auto pb-1">
          {steps.map((entry, position) => {
            const current = entry === step;
            const done = position < index && stepIssues(entry).length === 0;
            const warn = attempted.has(entry) && stepIssues(entry).length > 0 && !current;
            return (
              <li key={entry} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(entry)}
                  aria-current={current ? 'step' : undefined}
                  className={cx(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap',
                    current
                      ? 'border-parchment-300/70 bg-parchment-200/10 text-fg'
                      : 'border-line text-fg-secondary hover:bg-hover',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : null}
                  {warn ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                  ) : null}
                  <span className="tabular text-fg-subtle">{position + 1}</span>
                  {t20StepLabels[entry]}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
        <section aria-labelledby="passo-t20" className="flex min-w-0 flex-col gap-5">
          <h2 id="passo-t20" className="text-xl">
            {t20StepLabels[step]}
          </h2>

          {step === 'inicio' ? (
            <div className="flex flex-col gap-5">
              <TextField
                id="t20-name"
                label="Nome do personagem"
                maxLength={80}
                required
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                error={errorFor('name')}
              />
              {campaign ? (
                <div className="rounded-md border border-line bg-card/60 p-4 text-sm">
                  <h3 className="eyebrow mb-2">Regras do mestre ({campaign.name})</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-fg-secondary">
                    {describeT20CampaignRules(
                      campaign.rules,
                      Object.fromEntries(content.books.map((book) => [book.id, book.name])),
                    ).map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <SelectField
                  id="t20-level"
                  label="Nível"
                  value={String(draft.level)}
                  onChange={(event) => update({ level: Number(event.target.value) })}
                  fieldClassName="sm:max-w-xs"
                >
                  {Array.from({ length: 20 }, (_, position) => position + 1).map((level) => (
                    <option key={level} value={level}>
                      {level}º nível
                    </option>
                  ))}
                </SelectField>
              )}
              {campaign ? (
                <p className="text-sm text-fg-muted">
                  Livros liberados pelo mestre:{' '}
                  {content.books.map((book) => book.name).join(', ') || 'nenhum'}.
                </p>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border border-line bg-card/60 p-4">
                  <p className="text-sm font-medium text-fg">Livros desta ficha</p>
                  <p className="text-xs text-fg-muted">
                    Só o conteúdo dos livros marcados aparece na criação.
                  </p>
                  {sources.length === 0 ? (
                    <p className="text-sm text-fg-muted">
                      Nenhum livro de Tormenta20 importado em Meus livros.
                    </p>
                  ) : (
                    sources.map((source) => (
                      <CheckboxField
                        key={source.book.id}
                        id={`t20-book-${source.book.id}`}
                        label={source.book.name}
                        checked={draft.sourcebooks.includes(source.book.id)}
                        onChange={(event) =>
                          update({
                            sourcebooks: event.target.checked
                              ? [...new Set([...draft.sourcebooks, source.book.id])]
                              : draft.sourcebooks.filter((id) => id !== source.book.id),
                          })
                        }
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          ) : null}

          {step === 'atributos' ? (
            <AttributesStep
              draft={draft}
              update={update}
              methods={allowedMethods}
              error={
                errorFor('points') ??
                errorFor('rolls') ??
                errorFor('rollAssignment') ??
                errorFor('attributeMethod')
              }
            />
          ) : null}

          {step === 'raca' ? (
            <div className="flex flex-col gap-5">
              <PickerGrid
                label="Raça"
                value={draft.raceId}
                items={content.races.map((entry) => ({
                  id: entry.id,
                  title: entry.name,
                  icon: (
                    <CharacterIcon
                      kind="species"
                      id={entry.id}
                      className="h-7 w-7 text-fg-accent"
                    />
                  ),
                  subtitle: [
                    attributeText(entry.attributes),
                    entry.attributeChoice
                      ? `+${entry.attributeChoice.value} em ${entry.attributeChoice.count} à escolha`
                      : '',
                    t20SizeLabels[entry.size],
                    `${entry.speed} m`,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  text: entry.summary,
                }))}
                onSelect={(raceId) =>
                  update({
                    raceId,
                    raceAttributeChoices: [],
                    raceVariant: '',
                    raceSkills: [],
                    raceSkillPower: '',
                  })
                }
              />
              {errorFor('raceId') ? <Alert tone="danger">{errorFor('raceId')}</Alert> : null}
              {race?.attributeChoice ? (
                <MultiPick
                  label={`Atributos com +${race.attributeChoice.value} (escolha ${race.attributeChoice.count})`}
                  count={race.attributeChoice.count}
                  options={T20_ATTRIBUTES.filter(
                    (key) => !race.attributeChoice!.exclude.includes(key),
                  ).map((key) => ({ id: key, name: t20AttributeLabels[key].name }))}
                  value={draft.raceAttributeChoices}
                  onChange={(raceAttributeChoices) =>
                    update({ raceAttributeChoices: raceAttributeChoices as T20Attribute[] })
                  }
                  error={errorFor('raceAttributeChoices')}
                />
              ) : null}
              {race && race.variants.length > 0 ? (
                <SelectField
                  id="t20-variant"
                  label="Variante"
                  value={draft.raceVariant}
                  onChange={(event) => update({ raceVariant: event.target.value })}
                  error={errorFor('raceVariant')}
                >
                  <option value="">Escolha</option>
                  {race.variants.map((variant) => (
                    <option key={variant.name} value={variant.name}>
                      {variant.name} ({attributeText(variant.attributes)})
                    </option>
                  ))}
                </SelectField>
              ) : null}
              {race ? (
                <FeatureList
                  title={`Habilidades de ${race.name}`}
                  items={race.abilities.map((ability) => ({
                    name: ability.name,
                    text: ability.text,
                  }))}
                />
              ) : null}
            </div>
          ) : null}

          {step === 'classe' ? (
            <div className="flex flex-col gap-5">
              <PickerGrid
                label="Classe"
                value={draft.classId}
                items={content.classes.map((entry) => ({
                  id: entry.id,
                  title: entry.name,
                  subtitle: `PV ${entry.pvInitial} + Con (+${entry.pvPerLevel}/nível) · PM ${entry.pmPerLevel}/nível${entry.spellcasting ? ` · magias ${entry.spellcasting.type}s` : ''}`,
                  text: entry.summary,
                }))}
                onSelect={(classId) =>
                  update({
                    classId,
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
              {errorFor('classId') ? <Alert tone="danger">{errorFor('classId')}</Alert> : null}
              {klass && plainT20(klass.name) === 'arcanista' ? (
                <SelectField
                  id="t20-path"
                  label="Caminho do arcanista"
                  value={draft.arcanistPath}
                  onChange={(event) =>
                    update({
                      arcanistPath: event.target.value as T20ArcanistPath | '',
                      lineage: '',
                      spellIds: [],
                    })
                  }
                  error={errorFor('arcanistPath')}
                >
                  <option value="">Escolha</option>
                  <option value="bruxo">Bruxo</option>
                  <option value="feiticeiro">Feiticeiro</option>
                  <option value="mago">Mago</option>
                </SelectField>
              ) : null}
              {klass && draft.arcanistPath === 'feiticeiro' && t20Lineages(klass).length > 0 ? (
                <SelectField
                  id="t20-lineage"
                  label="Linhagem"
                  value={draft.lineage}
                  onChange={(event) => update({ lineage: event.target.value })}
                  error={errorFor('lineage')}
                >
                  <option value="">Escolha</option>
                  {t20Lineages(klass).map((lineage) => (
                    <option key={lineage} value={lineage}>
                      {lineage}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              {klass ? (
                <FeatureList
                  title={`${klass.name} até o ${draft.level}º nível`}
                  items={klass.abilities
                    .filter((ability) => ability.level <= draft.level)
                    .map((ability) => ({
                      name: `${ability.level}º · ${ability.name}`,
                      text: ability.text,
                    }))}
                />
              ) : null}
            </div>
          ) : null}

          {step === 'origem' ? (
            <div className="flex flex-col gap-5">
              <PickerGrid
                label="Origem"
                value={draft.originId}
                items={content.origins.map((entry) => ({
                  id: entry.id,
                  title: entry.name,
                  subtitle: entry.benefitsText,
                  text: entry.summary,
                }))}
                onSelect={(originId) =>
                  update({ originId, originBenefits: [], originPowerChoices: {}, originItems: {} })
                }
              />
              {errorFor('originId') ? <Alert tone="danger">{errorFor('originId')}</Alert> : null}
              {origin ? (
                <>
                  <OriginItemsPicker
                    slots={t20OriginItemSlots(content, origin)}
                    value={draft.originItems}
                    onChange={(originItems) => update({ originItems })}
                    error={errorFor('originItems')}
                  />
                  <MultiPick
                    label="Benefícios da origem (escolha 2)"
                    count={2}
                    options={t20OriginBenefitOptions(content, origin)}
                    value={draft.originBenefits}
                    onChange={(originBenefits) => update({ originBenefits })}
                    error={errorFor('originBenefits')}
                  />
                  <FeatureList
                    title="Poderes únicos"
                    items={origin.uniquePowers.map((power) => ({
                      name: power.name,
                      text: power.text,
                    }))}
                  />
                  {draft.originBenefits
                    .filter(
                      (benefit) =>
                        benefit.startsWith('power:') && t20GenericPowerGroups(benefit.slice(6)),
                    )
                    .map((benefit) => {
                      const name = benefit.slice(6);
                      const chosen = content.powers.find(
                        (power) => power.id === draft.originPowerChoices[name],
                      );
                      return (
                        <div key={benefit} className="flex flex-col gap-2">
                          <SelectField
                            id={`t20-origem-${name}`}
                            label={`Poder escolhido (${name})`}
                            value={draft.originPowerChoices[name] ?? ''}
                            onChange={(event) =>
                              update({
                                originPowerChoices: {
                                  ...draft.originPowerChoices,
                                  [name]: event.target.value,
                                },
                              })
                            }
                            error={errorFor('originPowerChoices')}
                          >
                            <option value="">Escolha o poder…</option>
                            {t20GenericPowerOptions(content, name).map((power) => (
                              <option key={power.id} value={power.id}>
                                {power.name}
                                {power.prerequisite ? ` (requer: ${power.prerequisite})` : ''}
                              </option>
                            ))}
                          </SelectField>
                          {chosen ? (
                            <p className="text-sm text-fg-secondary">{chosen.text}</p>
                          ) : null}
                        </div>
                      );
                    })}
                </>
              ) : null}
            </div>
          ) : null}

          {step === 'divindade' ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-fg-muted">
                {t20MustBeDevoted(content, draft)
                  ? 'Sua classe exige ser devoto de uma divindade.'
                  : 'Opcional: ser devoto dá um poder concedido e exige seguir as Obrigações & Restrições.'}
              </p>
              <SelectField
                id="t20-deity"
                label="Divindade"
                value={draft.deityId}
                onChange={(event) => update({ deityId: event.target.value, grantedPowerId: '' })}
                error={errorFor('deityId')}
              >
                <option value="">Nenhuma</option>
                {t20EligibleDeities(content, draft).map((deity) => (
                  <option key={deity.id} value={deity.id}>
                    {deity.name}
                  </option>
                ))}
              </SelectField>
              {draft.deityId ? (
                <>
                  <p className="text-sm whitespace-pre-line text-fg-secondary">
                    {findT20Deity(content, draft.deityId)?.summary}
                  </p>
                  <SelectField
                    id="t20-granted"
                    label="Poder concedido"
                    value={draft.grantedPowerId}
                    onChange={(event) => update({ grantedPowerId: event.target.value })}
                    error={errorFor('grantedPowerId')}
                  >
                    <option value="">Escolha</option>
                    {t20GrantedPowers(
                      content,
                      findT20Deity(content, draft.deityId)?.name ?? '',
                    ).map((power) => (
                      <option key={power.id} value={power.id}>
                        {power.name}
                      </option>
                    ))}
                  </SelectField>
                  {draft.grantedPowerId ? (
                    <p className="text-xs text-fg-muted">
                      {content.powers.find((power) => power.id === draft.grantedPowerId)?.text}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {step === 'pericias' ? (
            <SkillsStep
              content={content}
              draft={draft}
              update={update}
              errorFor={errorFor}
              finalInt={finalAttributes.int}
            />
          ) : null}

          {step === 'poderes' ? (
            <div className="flex flex-col gap-4">
              {powerLevels.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  Nenhum poder de classe para escolher até este nível.
                </p>
              ) : null}
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
                  <div key={level} className="flex flex-col gap-1">
                    <SelectField
                      id={`t20-power-${level}`}
                      label={`Poder do ${level}º nível`}
                      value={draft.levelPowers[String(level)] ?? ''}
                      onChange={(event) =>
                        update({
                          levelPowers: {
                            ...draft.levelPowers,
                            [String(level)]: event.target.value,
                          },
                        })
                      }
                      error={errorFor(`levelPowers.${level}`)}
                    >
                      <option value="">Escolha</option>
                      {t20PowerOptions(content, draft).map((power) => {
                        const problems = t20PrerequisiteProblems(power.prerequisite, {
                          attributes: finalAttributes,
                          skills: t20TrainedSkills(content, draft),
                          level,
                          powers: others,
                          content,
                        });
                        const taken =
                          !isT20AttributeIncrease(power.name) &&
                          others.some((name) => plainT20(name) === plainT20(power.name));
                        return (
                          <option
                            key={power.id}
                            value={power.id}
                            disabled={taken || problems.length > 0}
                          >
                            {power.name}
                            {power.owners.length ? '' : ` (${power.group})`}
                            {problems.length ? ` — falta ${problems.join(', ')}` : ''}
                          </option>
                        );
                      })}
                    </SelectField>
                    {chosen ? (
                      <p className="text-xs whitespace-pre-line text-fg-muted">{chosen.text}</p>
                    ) : null}
                    {chosen && t20PowerSkillPick(chosen) ? (
                      <MultiPick
                        label={`Perícias de ${chosen.name} (escolha ${t20PowerSkillPick(chosen)!.count})`}
                        count={t20PowerSkillPick(chosen)!.count}
                        options={T20_SKILL_IDS.map((skill) => {
                          const trained = t20TrainedSkills(content, {
                            ...draft,
                            levelPowerSkills: { ...draft.levelPowerSkills, [String(level)]: [] },
                          }).includes(skill);
                          return {
                            id: skill,
                            name: `${T20_SKILLS[skill].label}${trained && t20PowerSkillPick(chosen)!.trains ? ' (já treinada)' : ''}`,
                            disabled: trained && t20PowerSkillPick(chosen)!.trains,
                          };
                        })}
                        value={draft.levelPowerSkills[String(level)] ?? []}
                        onChange={(value) =>
                          update({
                            levelPowerSkills: {
                              ...draft.levelPowerSkills,
                              [String(level)]: value as T20Skill[],
                            },
                          })
                        }
                      />
                    ) : null}
                    {chosen && isT20AttributeIncrease(chosen.name) ? (
                      <SelectField
                        id={`t20-power-attr-${level}`}
                        label={`Atributo que aumenta no ${level}º nível (+1)`}
                        value={draft.levelPowerAttributes[String(level)] ?? ''}
                        onChange={(event) =>
                          update({
                            levelPowerAttributes: {
                              ...draft.levelPowerAttributes,
                              [String(level)]: event.target.value as T20Attribute,
                            },
                          })
                        }
                      >
                        <option value="">Escolha</option>
                        {T20_ATTRIBUTES.map((key) => (
                          <option key={key} value={key}>
                            {t20AttributeLabels[key].name}
                          </option>
                        ))}
                      </SelectField>
                    ) : null}
                  </div>
                );
              })}
              {t20CreationFeatureChoices(content, draft).map((choice) => (
                <div key={choice.key} className="flex flex-col gap-1">
                  <SelectField
                    id={`t20-feature-${choice.key}`}
                    label={`${choice.ability} (${choice.level}º nível): escolha`}
                    value={draft.featureChoices[choice.key] ?? ''}
                    onChange={(event) =>
                      update({
                        featureChoices: {
                          ...draft.featureChoices,
                          [choice.key]: event.target.value,
                        },
                      })
                    }
                    error={errorFor(`featureChoices.${choice.key}`)}
                  >
                    <option value="">Escolha</option>
                    {choice.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ))}
            </div>
          ) : null}

          {step === 'magias' && klass?.spellcasting ? (
            <div className="flex flex-col gap-4">
              {klass.spellcasting.schoolsChoice > 0 ? (
                <MultiPick
                  label={`Escolas de magia (escolha ${klass.spellcasting.schoolsChoice})`}
                  count={klass.spellcasting.schoolsChoice}
                  options={T20_SPELL_SCHOOLS.map((school) => ({ id: school, name: school }))}
                  value={draft.spellSchools}
                  onChange={(spellSchools) => update({ spellSchools, spellIds: [] })}
                  error={errorFor('spellSchools')}
                />
              ) : null}
              <MultiPick
                label={`Magias conhecidas (${draft.spellIds.length}/${t20SpellCount(content, draft)})`}
                count={t20SpellCount(content, draft)}
                options={t20AvailableSpells(content, draft).map((spell) => ({
                  id: spell.id,
                  name: `${spell.name} · ${spell.circle}º círculo · ${spell.school}`,
                  description: spell.text.slice(0, 220),
                }))}
                value={draft.spellIds}
                onChange={(spellIds) => update({ spellIds })}
                error={errorFor('spellIds')}
                searchable
              />
            </div>
          ) : null}

          {step === 'equipamento' ? (
            <EquipmentStep content={content} draft={draft} update={update} errorFor={errorFor} />
          ) : null}

          {step === 'detalhes' ? (
            <div className="flex flex-col gap-4">
              <TextField
                id="t20-height"
                label="Altura"
                hint="Obrigatória. Ex.: 1,75 m."
                maxLength={40}
                value={draft.height}
                error={errorFor('height')}
                onChange={(event) => update({ height: event.target.value })}
              />
              <TextField
                id="t20-age"
                label="Idade"
                hint="Obrigatória. Ex.: 27 anos."
                maxLength={40}
                value={draft.age}
                error={errorFor('age')}
                onChange={(event) => update({ age: event.target.value })}
              />
              <TextareaField
                id="t20-appearance"
                label="Aparência"
                rows={3}
                maxLength={4000}
                value={draft.appearance}
                onChange={(event) => update({ appearance: event.target.value })}
              />
              <TextareaField
                id="t20-personality"
                label="Personalidade"
                rows={3}
                maxLength={4000}
                value={draft.personality}
                onChange={(event) => update({ personality: event.target.value })}
              />
              <TextareaField
                id="t20-history"
                label="História"
                rows={6}
                maxLength={20000}
                value={draft.history}
                onChange={(event) => update({ history: event.target.value })}
              />
            </div>
          ) : null}

          {step === 'revisao' ? (
            <div className="flex flex-col gap-3">
              <CreationAnswersFields questions={questions} values={answerValues} onChange={setAnswerValues} showErrors />
              {issues.length === 0 ? (
                <Alert tone="success">Tudo certo! Crie o personagem.</Alert>
              ) : (
                <div className="rounded-md border border-amber-400/40 bg-warning-bg p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" /> Pendências
                    ({issues.length})
                  </h3>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {issues.map((issue, position) => (
                      <li
                        key={`${issue.path}-${position}`}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-fg-secondary">{issue.message}</span>
                        <Button size="sm" variant="ghost" onClick={() => goTo(issue.step)}>
                          Ir para {t20StepLabels[issue.step]}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ImagePromptCard
                prompt={characterImagePrompt({
                  system: 'Tormenta20',
                  name: draft.name,
                  species: race?.name,
                  className: klass?.name,
                  level: draft.level,
                  background: [
                    origin?.name,
                    content.deities.find((deity) => deity.id === draft.deityId)?.name
                      ? `devoto de ${content.deities.find((deity) => deity.id === draft.deityId)?.name}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(', '),
                  appearance: draft.appearance,
                  personality: draft.personality,
                  backstory: draft.history,
                })}
              />
            </div>
          ) : null}

          {showErrors && step !== 'revisao' && stepIssues(step).length > 0 ? (
            <Alert tone="warning">
              {stepIssues(step)
                .map((issue) => issue.message)
                .join(' ')}
            </Alert>
          ) : null}
          {submitError ? <Alert tone="danger">{submitError}</Alert> : null}

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
              onClick={() => steps[index - 1] && goTo(steps[index - 1]!)}
              disabled={index <= 0}
            >
              Voltar
            </Button>
            <SaveDraftButton
              systemId="tormenta20"
              campaignId={campaign?.id ?? null}
              name={draft.name}
              draftId={draftId}
              onSaved={setDraftId}
              getPayload={() => ({ draft, step })}
            />
            {step === 'revisao' ? (
              <Button
                icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                onClick={submit}
                loading={pending}
                disabled={issues.length > 0 || !answersOk}
              >
                Criar personagem
              </Button>
            ) : (
              <Button onClick={next}>
                Próximo <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </section>

        <aside className="hidden lg:block" aria-label="Resumo do personagem">
          <div className="sticky top-6 flex flex-col gap-3 rounded-lg border border-line bg-card p-4 text-sm shadow-card">
            <p className="font-display text-lg text-fg">{draft.name || 'Novo personagem'}</p>
            <p className="text-fg-secondary">
              {[
                race?.name,
                klass ? `${klass.name} ${draft.level}` : `Nível ${draft.level}`,
                origin?.name,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="text-xs text-fg-muted">
              {campaign ? `Campanha: ${campaign.name}` : 'Ficha pessoal'} · Tormenta20
            </p>
            <dl className="grid grid-cols-3 gap-1 text-center">
              {T20_ATTRIBUTES.map((key) => (
                <div key={key} className="rounded border border-line py-1">
                  <dt className="text-[10px] tracking-wider text-fg-subtle uppercase">
                    {t20AttributeLabels[key].abbreviation}
                  </dt>
                  <dd className="tabular text-fg">{formatT20Bonus(finalAttributes[key])}</dd>
                </div>
              ))}
            </dl>
            {t20TrainedSkills(content, draft).length ? (
              <p className="text-xs text-fg-muted">
                Treinado:{' '}
                {t20TrainedSkills(content, draft)
                  .map((skill) => T20_SKILLS[skill].label)
                  .join(', ')}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function attributeText(attributes: Partial<Record<T20Attribute, number>>): string {
  return Object.entries(attributes)
    .map(
      ([key, value]) =>
        `${t20AttributeLabels[key as T20Attribute].abbreviation} ${formatT20Bonus(value)}`,
    )
    .join(', ');
}

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------

function PickerGrid({
  label,
  value,
  items,
  onSelect,
}: {
  label: string;
  value: string;
  items: { id: string; title: string; subtitle?: string; text?: string; icon?: ReactNode }[];
  onSelect: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={item.id === value}
          onClick={() => onSelect(item.id)}
          className={cx(
            'flex h-full flex-col gap-1.5 rounded-md border p-3 text-left transition-colors',
            item.id === value
              ? 'border-parchment-300/70 bg-parchment-200/10'
              : 'border-line hover:border-line-strong hover:bg-hover',
          )}
        >
          <span className="flex items-center gap-2 font-display text-base text-fg">
            {item.icon}
            {item.title}
          </span>
          {item.subtitle ? <span className="text-xs text-fg-accent">{item.subtitle}</span> : null}
          {item.text ? (
            <span className="line-clamp-4 text-xs leading-relaxed text-fg-muted">{item.text}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function FeatureList({ title, items }: { title: string; items: { name: string; text: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-card/60 p-4">
      <h3 className="eyebrow mb-1">{title}</h3>
      {items.map((item) => (
        <details
          key={item.name}
          className="rounded-md border border-line px-3 py-2 text-sm open:bg-raised/40"
        >
          <summary className="cursor-pointer text-fg">{item.name}</summary>
          <p className="mt-2 leading-relaxed whitespace-pre-line text-fg-secondary">{item.text}</p>
        </details>
      ))}
    </div>
  );
}

function MultiPick({
  label,
  count,
  options,
  value,
  onChange,
  error,
  searchable = false,
}: {
  label: string;
  count: number;
  options: { id: string; name: string; description?: string; disabled?: boolean; note?: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string | undefined;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const term = plainT20(query.trim());
  const shown = term ? options.filter((option) => plainT20(option.name).includes(term)) : options;
  const toggle = (id: string) =>
    onChange(
      value.includes(id)
        ? value.filter((entry) => entry !== id)
        : value.length < count
          ? [...value, id]
          : value,
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-fg">
        {label}{' '}
        <span className="text-xs text-fg-muted">
          ({value.length}/{count})
        </span>
      </legend>
      {searchable ? (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar…"
          aria-label={`Buscar em ${label}`}
          className="h-9 rounded-md border border-line bg-sunken px-3 text-sm text-fg placeholder:text-fg-muted"
        />
      ) : null}
      <div
        className={cx('grid gap-1.5 sm:grid-cols-2', searchable && 'max-h-96 overflow-y-auto pr-1')}
      >
        {shown.map((option) => (
          <CheckboxField
            key={option.id}
            id={`pick-${label}-${option.id}`}
            label={option.note ? `✓ ${option.name} · ${option.note}` : option.name}
            className={
              option.note ? 'rounded-md bg-verdigris-900/40 px-1.5 text-verdigris-300' : undefined
            }
            description={option.description}
            checked={value.includes(option.id)}
            disabled={option.disabled || (!value.includes(option.id) && value.length >= count)}
            onChange={() => toggle(option.id)}
          />
        ))}
      </div>
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function AttributesStep({
  draft,
  update,
  methods,
}: {
  draft: T20Draft;
  update: (patch: Partial<T20Draft>) => void;
  methods: readonly ('pontos' | 'rolagem')[];
  error?: string | undefined;
}) {
  const spent = t20PointsSpent(draft.points);
  const [throwing, setThrowing] = useState<number[][] | null>(null);
  const [rollError, setRollError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      {methods.length > 1 ? (
        <SelectField
          id="t20-method"
          label="Método"
          value={draft.attributeMethod}
          onChange={(event) =>
            update({ attributeMethod: event.target.value as T20Draft['attributeMethod'] })
          }
          fieldClassName="sm:max-w-sm"
        >
          {methods.map((method) => (
            <option key={method} value={method}>
              {t20AttributeMethodLabels[method]}
            </option>
          ))}
        </SelectField>
      ) : (
        <p className="text-sm text-fg-muted">
          Método definido pelo mestre: {t20AttributeMethodLabels[methods[0] ?? 'pontos']}.
        </p>
      )}
      {draft.attributeMethod === 'pontos' ? (
        <>
          <p className="text-sm text-fg-secondary">
            Pontos gastos:{' '}
            <strong className={cx(spent > T20_POINT_BUY_BUDGET ? 'text-danger' : 'text-fg')}>
              {spent}
            </strong>{' '}
            de {T20_POINT_BUY_BUDGET}. Valores de –1 (devolve 1 ponto) a 4.{' '}
            <PointCostHelp />
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {T20_ATTRIBUTES.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2"
              >
                <span className="text-sm text-fg">{t20AttributeLabels[key].name}</span>
                <span className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Diminuir ${t20AttributeLabels[key].name}`}
                    disabled={draft.points[key] <= T20_POINT_BUY_MIN}
                    onClick={() =>
                      update({ points: { ...draft.points, [key]: draft.points[key] - 1 } })
                    }
                    icon={<Minus className="h-4 w-4" aria-hidden="true" />}
                  />
                  <span className="tabular w-8 text-center text-fg">
                    {formatT20Bonus(draft.points[key])}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Aumentar ${t20AttributeLabels[key].name}`}
                    disabled={
                      draft.points[key] >= T20_POINT_BUY_MAX ||
                      spent -
                        t20PointBuyCost(draft.points[key]) +
                        t20PointBuyCost(draft.points[key] + 1) >
                        T20_POINT_BUY_BUDGET
                    }
                    onClick={() =>
                      update({ points: { ...draft.points, [key]: draft.points[key] + 1 } })
                    }
                    icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                  />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {draft.rolls.length === 0 ? (
              <Button
                variant="secondary"
                icon={<Dices className="h-4 w-4" aria-hidden="true" />}
                disabled={throwing !== null}
                onClick={() => {
                  // Sorteio no servidor, guardado por pessoa: recarregar a página não rola de novo.
                  void rollT20AttributesAction().then((result) => {
                    if (result.ok) setThrowing(result.dice);
                    else setRollError(result.message);
                  });
                }}
              >
                Rolar 4d6 seis vezes (uma vez só)
              </Button>
            ) : null}
            {rollError ? <p className="text-sm text-danger">{rollError}</p> : null}
            {throwing ? (
              <Dice3DOverlay
                notation={`${throwing.map(() => '4d6').join('+')}@${throwing.flat().join(',')}`}
                onDone={() => {
                  update({
                    rolls: throwing.map(t20RollTotal),
                    rollAssignment: Object.fromEntries(
                      T20_ATTRIBUTES.map((key) => [key, null]),
                    ) as T20Draft['rollAssignment'],
                  });
                  setThrowing(null);
                }}
              />
            ) : null}
            {draft.rolls.length ? (
              <span className="text-sm text-fg-secondary">
                Resultados:{' '}
                {draft.rolls
                  .map((roll) => `${roll} (${formatT20Bonus(t20AttributeFromRoll(roll))})`)
                  .join(', ')}
              </span>
            ) : null}
          </div>
          {draft.rolls.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {T20_ATTRIBUTES.map((key) => (
                <SelectField
                  key={key}
                  id={`t20-roll-${key}`}
                  label={t20AttributeLabels[key].name}
                  value={
                    draft.rollAssignment[key] === null ? '' : String(draft.rollAssignment[key])
                  }
                  onChange={(event) =>
                    update({
                      rollAssignment: {
                        ...draft.rollAssignment,
                        [key]: event.target.value === '' ? null : Number(event.target.value),
                      },
                    })
                  }
                >
                  <option value="">Escolha</option>
                  {draft.rolls.map((roll, position) => {
                    const usedBy = T20_ATTRIBUTES.find(
                      (other) => other !== key && draft.rollAssignment[other] === position,
                    );
                    return (
                      <option key={position} value={position} disabled={Boolean(usedBy)}>
                        {roll} → {formatT20Bonus(t20AttributeFromRoll(roll))}
                        {usedBy ? ` (em ${t20AttributeLabels[usedBy].abbreviation})` : ''}
                      </option>
                    );
                  })}
                </SelectField>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SkillsStep({
  content,
  draft,
  update,
  errorFor,
  finalInt,
}: {
  content: ReturnType<typeof buildT20Content>;
  draft: T20Draft;
  update: (patch: Partial<T20Draft>) => void;
  errorFor: (path: string) => string | undefined;
  finalInt: number;
}) {
  const klass = findT20Class(content, draft.classId);
  const race = findT20Race(content, draft.raceId);
  const granted = t20GrantedSkills(content, draft);
  const all = Object.keys(T20_SKILLS) as T20Skill[];
  const taken = (except: T20Skill[]) =>
    new Set(
      [...granted, ...draft.classSkills, ...draft.intSkills, ...draft.raceSkills].filter(
        (skill) => !except.includes(skill),
      ),
    );
  const versatile = race?.abilities.some((ability) => plainT20(ability.name) === 'versatil');
  const expertise = t20ExpertiseRule(content, draft);
  const optionsFor = (list: T20Skill[], own: T20Skill[]) => {
    const used = taken(own);
    return list.map((skill) => {
      const already = used.has(skill) && !own.includes(skill);
      return {
        id: skill,
        name: T20_SKILLS[skill].label,
        disabled: already,
        ...(already ? { note: 'já treinada' } : {}),
      };
    });
  };
  return (
    <div className="flex flex-col gap-6">
      {granted.length ? (
        <p className="text-sm text-fg-secondary">
          Já treinado: {granted.map((skill) => T20_SKILLS[skill].label).join(', ')}.
        </p>
      ) : null}
      {klass?.skillsFixedChoices.map((group, position) => (
        <SelectField
          key={group.join('-')}
          id={`t20-fixed-${position}`}
          label={`Perícia da classe: ${group.map((skill) => T20_SKILLS[skill].label).join(' ou ')}`}
          value={draft.classFixedChoices[position] ?? ''}
          onChange={(event) => {
            const choices = [...draft.classFixedChoices];
            choices[position] = event.target.value as T20Skill;
            update({ classFixedChoices: choices.filter(Boolean) });
          }}
          error={position === 0 ? errorFor('classFixedChoices') : undefined}
        >
          <option value="">Escolha</option>
          {group.map((skill) => (
            <option key={skill} value={skill}>
              {T20_SKILLS[skill].label}
            </option>
          ))}
        </SelectField>
      ))}
      {klass ? (
        <MultiPick
          label={`Perícias da classe (escolha ${klass.skillsChoice.count})`}
          count={klass.skillsChoice.count}
          options={optionsFor(klass.skillsChoice.options, draft.classSkills)}
          value={draft.classSkills}
          onChange={(classSkills) => update({ classSkills: classSkills as T20Skill[] })}
          error={errorFor('classSkills')}
        />
      ) : null}
      {expertise ? (
        <MultiPick
          label={`${expertise.ability}: perícias treinadas (escolha ${expertise.count})`}
          count={expertise.count}
          options={t20TrainedSkills(content, draft).map((skill) => ({
            id: skill,
            name: T20_SKILLS[skill].label,
          }))}
          value={draft.expertSkills.filter((skill) =>
            t20TrainedSkills(content, draft).includes(skill),
          )}
          onChange={(expertSkills) => update({ expertSkills: expertSkills as T20Skill[] })}
          error={errorFor('expertSkills')}
        />
      ) : null}
      {finalInt > 0 ? (
        <MultiPick
          label={`Perícias pela Inteligência (escolha ${finalInt})`}
          count={finalInt}
          options={optionsFor(all, draft.intSkills)}
          value={draft.intSkills}
          onChange={(intSkills) => update({ intSkills: intSkills as T20Skill[] })}
          error={errorFor('intSkills')}
        />
      ) : null}
      {versatile ? (
        <div className="flex flex-col gap-3 rounded-md border border-line p-3">
          <p className="text-sm text-fg">
            Versátil ({race?.name}): duas perícias, ou uma perícia e um poder geral.
          </p>
          <SelectField
            id="t20-versatile-power"
            label="Trocar uma perícia por um poder geral (opcional)"
            value={draft.raceSkillPower}
            onChange={(event) =>
              update({
                raceSkillPower: event.target.value,
                raceSkills: draft.raceSkills.slice(0, event.target.value ? 1 : 2),
              })
            }
          >
            <option value="">Não, duas perícias</option>
            {content.powers
              .filter((power) => ['combate', 'destino', 'magia', 'tormenta'].includes(power.group))
              .map((power) => (
                <option key={power.id} value={power.id}>
                  {power.name} ({power.group})
                </option>
              ))}
          </SelectField>
          <MultiPick
            label="Perícias de Versátil"
            count={draft.raceSkillPower ? 1 : 2}
            options={optionsFor(all, draft.raceSkills)}
            value={draft.raceSkills}
            onChange={(raceSkills) => update({ raceSkills: raceSkills as T20Skill[] })}
            error={errorFor('raceSkills')}
          />
        </div>
      ) : null}
      {errorFor('skills') ? <Alert tone="danger">{errorFor('skills')}</Alert> : null}
    </div>
  );
}

function EquipmentStep({
  content,
  draft,
  update,
  errorFor,
}: {
  content: ReturnType<typeof buildT20Content>;
  draft: T20Draft;
  update: (patch: Partial<T20Draft>) => void;
  errorFor: (path: string) => string | undefined;
}) {
  const options = t20EquipmentOptions(content, draft);
  const setEquipment = (patch: Partial<T20Draft['equipment']>) =>
    update({ equipment: { ...draft.equipment, ...patch } });
  const weaponLabel = (item: (typeof options.simple)[number]) =>
    `${item.name} (${[item.damage, item.critical, item.damageType].filter(Boolean).join(', ')})`;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        Todo aventureiro começa com mochila, saco de dormir e traje de viajante, mais as armas e a
        armadura abaixo e os itens da origem.
      </p>
      {options.simple.length ? (
        <SelectField
          id="t20-simple"
          label="Arma simples"
          value={draft.equipment.simple}
          onChange={(event) => setEquipment({ simple: event.target.value })}
          error={errorFor('equipment.simple')}
        >
          <option value="">Escolha</option>
          {options.simple.map((item) => (
            <option key={item.id} value={item.id}>
              {weaponLabel(item)}
            </option>
          ))}
        </SelectField>
      ) : null}
      {options.martial.length ? (
        <SelectField
          id="t20-martial"
          label="Arma marcial"
          value={draft.equipment.martial}
          onChange={(event) => setEquipment({ martial: event.target.value })}
          error={errorFor('equipment.martial')}
        >
          <option value="">Escolha</option>
          {options.martial.map((item) => (
            <option key={item.id} value={item.id}>
              {weaponLabel(item)}
            </option>
          ))}
        </SelectField>
      ) : null}
      {options.armors.length ? (
        <SelectField
          id="t20-armor"
          label="Armadura"
          value={draft.equipment.armor}
          onChange={(event) => setEquipment({ armor: event.target.value })}
          error={errorFor('equipment.armor')}
        >
          <option value="">Escolha</option>
          {options.armors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} (Defesa +{item.defense ?? 0}, penalidade {item.penalty ?? 0})
            </option>
          ))}
        </SelectField>
      ) : null}
      {options.shield ? (
        <CheckboxField
          id="t20-shield"
          label={`${options.shield.name} (Defesa +${options.shield.defense ?? 0})`}
          checked={draft.equipment.shield}
          onChange={(event) => setEquipment({ shield: event.target.checked })}
        />
      ) : null}
      {draft.level === 1 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            icon={<Dices className="h-4 w-4" aria-hidden="true" />}
            onClick={() => update({ money: d6() + d6() + d6() + d6() })}
          >
            {draft.money === null ? 'Rolar dinheiro inicial (4d6 T$)' : 'Rolar de novo'}
          </Button>
          {draft.money !== null ? <Badge tone="parchment">T$ {draft.money}</Badge> : null}
          {errorFor('money') ? (
            <span className="text-xs text-danger">{errorFor('money')}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Tabela de custo da compra por pontos, aberta pelo “?” ao lado do total gasto. */
function PointCostHelp() {
  const values = [-1, 0, 1, 2, 3, 4];
  return (
    <details className="relative inline-block align-middle">
      <summary
        aria-label="Como funciona o custo dos pontos"
        title="Como funciona o custo dos pontos"
        className="inline-flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-line text-xs font-semibold text-fg-secondary hover:border-fg-brand hover:text-fg [&::-webkit-details-marker]:hidden"
      >
        ?
      </summary>
      <div className="absolute top-7 left-0 z-30 w-72 rounded-lg border border-line bg-raised p-3 text-xs text-fg-secondary shadow-card">
        <p className="mb-2">
          O custo sobe com o valor (regra do Tormenta20): subir de +2 para +3 custa 2 pontos, e de +3 para +4
          custa 3.
        </p>
        <table className="w-full text-left tabular-nums">
          <thead>
            <tr className="text-fg-muted">
              <th className="py-0.5 font-medium">Valor</th>
              <th className="py-0.5 font-medium">Custo total</th>
              <th className="py-0.5 font-medium">Para subir até ele</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value) => {
              const total = T20_POINT_BUY_COST[value] ?? 0;
              const step = value > 0 ? total - (T20_POINT_BUY_COST[value - 1] ?? 0) : null;
              return (
                <tr key={value} className="border-t border-line">
                  <td className="py-0.5 text-fg">{value > 0 ? `+${value}` : value === 0 ? '0' : '–1'}</td>
                  <td className="py-0.5">{total < 0 ? 'devolve 1' : total}</td>
                  <td className="py-0.5">{step ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
