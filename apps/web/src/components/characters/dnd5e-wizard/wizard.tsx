'use client';

import {
  DND5E_STEPS,
  PERSONAL_SHEET_CONTEXT,
  buildDnd5eBookContent,
  combatSummary,
  createDnd5eDraft,
  describeDnd5eCampaignRules,
  dnd5eDraftSchema,
  dnd5eStepLabels,
  draftClass,
  draftSubclass,
  finalAbilityScores,
  listDnd5eChoices,
  setActiveDnd5eBookContent,
  validateDnd5eDraft,
  type AbilityScoreMethod,
  type BookContentSource,
  type Dnd5eCampaignRules,
  type Dnd5eCreationContext,
  type Dnd5eDraft,
  type Dnd5eStep,
  type DraftIssue,
  type Selection,
} from '@codexveil/rpg-systems/dnd5e';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { createDnd5eCharacterAction } from '@/app/(app)/personagens/actions';
import { SourcebookLinks, SourcebookPicker } from '@/components/campaigns/sourcebook-picker';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { cx } from '@/lib/cx';
import { characterPath } from '@/lib/routes';
import { AbilityScores, EMPTY_ROLLS, type RollState } from './ability-scores';
import { ChoiceField } from './choice-fields';
import { CharacterReview } from './review';
import {
  AlignmentPicker,
  BackgroundPicker,
  ClassDetails,
  ClassPicker,
  DetailsFields,
  EquipmentPreview,
  ProficiencySummary,
  SpeciesDetails,
  SpeciesPicker,
} from './steps';

export interface WizardCampaign {
  id: string;
  name: string;
  rules: Dnd5eCampaignRules;
  /** Livros liberados pelo mestre (ids em `books`). */
  packIds: string[];
}

interface WizardProps {
  campaigns: WizardCampaign[];
  /** Conteúdo dos livros usados pelas campanhas e pelas fichas pessoais, por id do livro importado. */
  books: Record<string, BookContentSource>;
  /** Livros do próprio usuário, usados nas fichas pessoais. */
  personalPackIds: string[];
  defaultCampaignId: string;
  /** Chave do rascunho salvo neste navegador (por usuário). */
  storageKey: string;
  /** A campanha (ou a ficha pessoal) já foi escolhida no passo anterior: o assistente não a troca. */
  lockCampaign?: boolean;
}

interface StoredDraft {
  campaignId: string;
  draft: unknown;
  rolls: RollState;
  step: Dnd5eStep;
}

/** Prefixos de escolhas que deixam de valer quando a classe, o antecedente ou a espécie mudam. */
const CLEAR_ON_CLASS = ['class.', 'subclass.', 'spells.', 'asi.', 'epic.', 'equipment.class'];
const CLEAR_ON_BACKGROUND = ['background.', 'equipment.background'];
const CLEAR_ON_SPECIES = ['species.'];

function without(selections: Dnd5eDraft['selections'], prefixes: string[]): Dnd5eDraft['selections'] {
  return Object.fromEntries(Object.entries(selections).filter(([key]) => !prefixes.some((prefix) => key.startsWith(prefix))));
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível (modo privado, cota): o rascunho só vive nesta página.
  }
}

function contextFor(campaign: WizardCampaign | undefined): Dnd5eCreationContext {
  return campaign
    ? {
        lockedLevel: campaign.rules.startingLevel,
        abilityScoreMethods: campaign.rules.abilityScoreMethods,
        allowEvilAlignments: campaign.rules.allowEvilAlignments,
      }
    : PERSONAL_SHEET_CONTEXT;
}

export function Dnd5eCreationWizard({ campaigns, books, personalPackIds, defaultCampaignId, storageKey, lockCampaign = false }: WizardProps) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(defaultCampaignId);
  const campaign = campaigns.find((entry) => entry.id === campaignId);
  const context = useMemo(() => contextFor(campaign), [campaign]);
  const packIds = campaign ? campaign.packIds : personalPackIds;
  const bookSources = useMemo(() => packIds.map((id) => books[id]).filter((source): source is BookContentSource => Boolean(source)), [packIds, books]);
  const bookContent = useMemo(() => buildDnd5eBookContent(bookSources), [bookSources]);
  const bookNames = useMemo(() => Object.fromEntries(bookSources.map((source) => [source.book.id, source.book.name])), [bookSources]);
  // As regras de criação consultam o SRD e os livros da campanha escolhida.
  setActiveDnd5eBookContent(bookContent);
  const [draft, setDraft] = useState<Dnd5eDraft>(() =>
    createDnd5eDraft({ level: campaign?.rules.startingLevel ?? 1, abilityMethod: contextFor(campaign).abilityScoreMethods[0] ?? 'standard_array' }),
  );
  const [rolls, setRolls] = useState<RollState>(EMPTY_ROLLS);
  const [step, setStep] = useState<Dnd5eStep>('start');
  const [attempted, setAttempted] = useState<Set<Dnd5eStep>>(new Set());
  /** O rascunho só é gravado no navegador depois de a pessoa mexer em algo (ou continuar o salvo). */
  const [dirty, setDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  const saved = useSyncExternalStore(subscribeStorage, () => readStorage(storageKey), () => null);

  useEffect(() => {
    if (!dirty) return;
    const stored: StoredDraft = { campaignId, draft, rolls, step };
    writeStorage(storageKey, JSON.stringify(stored));
  }, [dirty, campaignId, draft, rolls, step, storageKey]);

  const continueSaved = () => {
    try {
      const stored = JSON.parse(saved ?? 'null') as StoredDraft | null;
      const parsed = dnd5eDraftSchema.safeParse(stored?.draft);
      if (!stored || !parsed.success) {
        writeStorage(storageKey, null);
        return;
      }
      const storedCampaign = campaigns.find((entry) => entry.id === stored.campaignId);
      setCampaignId(storedCampaign ? stored.campaignId : '');
      setDraft(storedCampaign ? { ...parsed.data, level: storedCampaign.rules.startingLevel } : parsed.data);
      setRolls(stored.rolls ?? EMPTY_ROLLS);
      if ((DND5E_STEPS as readonly string[]).includes(stored.step)) setStep(stored.step);
      setDirty(true);
    } catch {
      writeStorage(storageKey, null);
    }
  };

  const specs = useMemo(() => listDnd5eChoices(draft), [draft, bookContent]); // eslint-disable-line react-hooks/exhaustive-deps
  const issues = useMemo(() => validateDnd5eDraft(draft, context), [draft, context, bookContent]); // eslint-disable-line react-hooks/exhaustive-deps
  const issueMap = useMemo(() => new Map(issues.map((issue) => [issue.path, issue.message])), [issues]);
  const steps = useMemo(
    () => DND5E_STEPS.filter((entry) => entry !== 'spells' || specs.some((spec) => spec.step === 'spells')),
    [specs],
  );
  const stepIssues = (target: Dnd5eStep) => issues.filter((issue) => issue.step === target);
  const showErrors = attempted.has(step) || step === 'review';
  const errorFor = (path: string) => (showErrors ? issueMap.get(path) : undefined);
  const classDef = draftClass(draft);

  const edit = (change: (current: Dnd5eDraft) => Dnd5eDraft) => {
    setDirty(true);
    setDraft(change);
  };
  const update = (patch: Partial<Dnd5eDraft>) => edit((current) => ({ ...current, ...patch }));
  const setSelection = (id: string, value: Selection) =>
    edit((current) => ({ ...current, selections: { ...current.selections, [id]: value } }));

  const chooseCampaign = (id: string) => {
    setCampaignId(id);
    const next = campaigns.find((entry) => entry.id === id);
    const nextContext = contextFor(next);
    edit((current) => {
      const methodAllowed = nextContext.abilityScoreMethods.includes(current.abilityMethod);
      return {
        ...current,
        level: next ? next.rules.startingLevel : current.level,
        ...(methodAllowed
          ? {}
          : {
              abilityMethod: nextContext.abilityScoreMethods[0] ?? 'standard_array',
              baseScores: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
            }),
      };
    });
  };

  const goTo = (target: Dnd5eStep) => {
    setStep(target);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const index = steps.indexOf(step);
  const next = () => {
    setAttempted((current) => new Set(current).add(step));
    if (stepIssues(step).length > 0) return;
    const following = steps[index + 1];
    if (following) goTo(following);
  };
  const back = () => {
    const previous = steps[index - 1];
    if (previous) goTo(previous);
  };

  const discardSaved = () => {
    writeStorage(storageKey, null);
    setDirty(false);
  };

  const submit = () => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createDnd5eCharacterAction({ campaignId: campaignId || null, draft });
      if (result.ok) {
        setDirty(false);
        writeStorage(storageKey, null);
        router.push(`${characterPath(result.characterId)}?aviso=personagem-criado` as Route);
        return;
      }
      setSubmitError(result.message);
      if (result.issues?.length) setAttempted(new Set(DND5E_STEPS));
    });
  };

  const stepSpecs = specs.filter((spec) => spec.step === step);
  const renderSpecs = () =>
    stepSpecs.map((spec) => (
      <ChoiceField key={spec.id} spec={spec} value={draft.selections[spec.id]} error={errorFor(spec.id)} onChange={(value) => setSelection(spec.id, value)} />
    ));

  return (
    <div ref={topRef} className="flex scroll-mt-20 flex-col gap-6">
      {saved && !dirty ? (
        <Alert
          tone="info"
          action={
            <span className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />} onClick={continueSaved}>
                Continuar rascunho
              </Button>
              <Button size="sm" variant="ghost" onClick={discardSaved}>
                Descartar
              </Button>
            </span>
          }
        >
          Há um personagem em criação salvo neste navegador.
        </Alert>
      ) : null}

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
                    current ? 'border-parchment-300/70 bg-parchment-200/10 text-fg' : 'border-line text-fg-secondary hover:bg-hover',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : null}
                  {warn ? <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" /> : null}
                  <span className="tabular text-fg-subtle">{position + 1}</span>
                  {dnd5eStepLabels[entry]}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
        <section aria-labelledby="passo-atual" className="flex min-w-0 flex-col gap-5">
          <h2 id="passo-atual" className="text-xl">
            {dnd5eStepLabels[step]}
          </h2>

          {step === 'start' ? (
            <div className="flex flex-col gap-5">
              <TextField
                id="character-name"
                label="Nome do personagem"
                maxLength={80}
                required
                autoComplete="off"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                error={errorFor('name')}
              />
              {lockCampaign ? null : (
                <SelectField
                  id="character-campaign"
                  label="Campanha"
                  hint="Aparecem só as campanhas em que você é jogador: o mestre usa NPCs e monstros."
                  value={campaignId}
                  onChange={(event) => chooseCampaign(event.target.value)}
                >
                  <option value="">Sem campanha (ficha pessoal)</option>
                  {campaigns.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </SelectField>
              )}
              {campaign ? (
                <div className="rounded-md border border-line bg-card/60 p-4 text-sm">
                  <h3 className="eyebrow mb-2">Regras do mestre</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-fg-secondary">
                    {describeDnd5eCampaignRules(campaign.rules, bookNames).map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-line pt-3">
                    <SourcebookLinks ids={campaign.rules.sourcebooks} label="Livros escolhidos pelo mestre:" />
                  </div>
                </div>
              ) : (
                <SelectField
                  id="character-level"
                  label="Nível"
                  hint="Personagens normalmente começam no 1º nível. Numa campanha, o nível é definido pelo mestre."
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
              {errorFor('level') ? <Alert tone="danger">{errorFor('level')}</Alert> : null}
              {/* Ficha pessoal: o jogador escolhe os livros; numa campanha, valem os do mestre. */}
              {campaign ? null : (
                <div className="rounded-md border border-line bg-card/60 p-4">
                  <SourcebookPicker audience="character" selected={draft.sourcebooks} onChange={(sourcebooks) => update({ sourcebooks })} />
                </div>
              )}
              <p className="text-sm text-fg-muted">
                O passo a passo segue a criação de personagem do SRD 5.2: classe, origem (antecedente, espécie e idiomas), atributos,
                alinhamento e detalhes. Aparecem as opções do SRD
                {bookSources.length > 0 ? ` e dos livros ${campaign ? 'liberados pelo mestre' : 'que você importou'}: ${bookSources.map((source) => source.book.name).join(', ')}` : ''}.
              </p>
            </div>
          ) : null}

          {step === 'class' ? (
            <div className="flex flex-col gap-5">
              <ClassPicker
                value={draft.classId}
                onSelect={(id) =>
                  edit((current) =>
                    current.classId === id ? current : { ...current, classId: id, selections: without(current.selections, CLEAR_ON_CLASS) },
                  )
                }
              />
              {errorFor('classId') ? <Alert tone="danger">{errorFor('classId')}</Alert> : null}
              {classDef ? <ClassDetails classDef={classDef} level={draft.level} subclass={draftSubclass(draft)} /> : null}
              {renderSpecs()}
            </div>
          ) : null}

          {step === 'background' ? (
            <div className="flex flex-col gap-5">
              <BackgroundPicker
                value={draft.backgroundId}
                onSelect={(id) =>
                  edit((current) =>
                    current.backgroundId === id ? current : { ...current, backgroundId: id, selections: without(current.selections, CLEAR_ON_BACKGROUND) },
                  )
                }
              />
              {errorFor('backgroundId') ? <Alert tone="danger">{errorFor('backgroundId')}</Alert> : null}
              {renderSpecs()}
            </div>
          ) : null}

          {step === 'species' ? (
            <div className="flex flex-col gap-5">
              <SpeciesPicker
                value={draft.speciesId}
                onSelect={(id) =>
                  edit((current) =>
                    current.speciesId === id ? current : { ...current, speciesId: id, selections: without(current.selections, CLEAR_ON_SPECIES) },
                  )
                }
              />
              {errorFor('speciesId') ? <Alert tone="danger">{errorFor('speciesId')}</Alert> : null}
              {draft.speciesId ? <SpeciesDetails speciesId={draft.speciesId} level={draft.level} /> : null}
              {renderSpecs()}
            </div>
          ) : null}

          {step === 'proficiencies' ? (
            <div className="flex flex-col gap-5">
              {renderSpecs()}
              <ProficiencySummary draft={draft} />
            </div>
          ) : null}

          {step === 'abilities' ? (
            <div className="flex flex-col gap-5">
              <AbilityScores
                draft={draft}
                methods={context.abilityScoreMethods}
                classDef={classDef}
                rolls={rolls}
                error={errorFor('baseScores') ?? errorFor('abilityMethod')}
                onMethod={(method: AbilityScoreMethod, scores) => update({ abilityMethod: method, baseScores: scores })}
                onScores={(scores) => update({ baseScores: scores })}
                onRolls={(next) => {
                  setDirty(true);
                  setRolls(next);
                }}
              />
              {renderSpecs()}
            </div>
          ) : null}

          {step === 'spells' ? <div className="flex flex-col gap-5">{renderSpecs()}</div> : null}

          {step === 'equipment' ? (
            <div className="flex flex-col gap-5">
              {renderSpecs()}
              <EquipmentPreview draft={draft} />
            </div>
          ) : null}

          {step === 'details' ? (
            <div className="flex flex-col gap-6">
              <AlignmentPicker value={draft.alignment} allowEvil={context.allowEvilAlignments} error={errorFor('alignment')} onChange={(alignment) => update({ alignment })} />
              <DetailsFields draft={draft} onChange={(details) => update({ details })} />
            </div>
          ) : null}

          {step === 'review' ? (
            <div className="flex flex-col gap-5">
              <IssueList issues={issues} onGo={goTo} />
              <CharacterReview draft={draft} />
            </div>
          ) : null}

          {showErrors && step !== 'review' && stepIssues(step).length > 0 ? (
            <Alert tone="warning">Há {stepIssues(step).length} pendência(s) neste passo. Confira as mensagens acima.</Alert>
          ) : null}
          {submitError ? <Alert tone="danger">{submitError}</Alert> : null}

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
            <Button variant="ghost" icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />} onClick={back} disabled={index <= 0}>
              Voltar
            </Button>
            {step === 'review' ? (
              <Button icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={submit} loading={pending} disabled={issues.length > 0}>
                Criar personagem
              </Button>
            ) : (
              <Button onClick={next}>
                Próximo <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </section>

        <SummaryPanel draft={draft} campaignName={campaign?.name ?? null} />
      </div>
    </div>
  );
}

function IssueList({ issues, onGo }: { issues: DraftIssue[]; onGo: (step: Dnd5eStep) => void }) {
  if (issues.length === 0) {
    return <Alert tone="success">Tudo certo! Confira a ficha abaixo e crie o personagem.</Alert>;
  }
  return (
    <div className="rounded-md border border-amber-400/40 bg-warning-bg p-4">
      <h3 className="mb-2 flex items-center gap-2 text-base">
        <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" /> Pendências ({issues.length})
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {issues.map((issue) => (
          <li key={issue.path} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-fg-secondary">{issue.message}</span>
            <Button size="sm" variant="ghost" onClick={() => onGo(issue.step)}>
              Ir para {dnd5eStepLabels[issue.step]}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryPanel({ draft, campaignName }: { draft: Dnd5eDraft; campaignName: string | null }) {
  const classDef = draftClass(draft);
  const scores = finalAbilityScores(draft);
  const combat = classDef ? combatSummary(draft) : null;
  return (
    <aside className="hidden lg:block" aria-label="Resumo do personagem">
      <div className="sticky top-6 flex flex-col gap-3 rounded-lg border border-line bg-card p-4 text-sm shadow-card">
        <p className="font-display text-lg text-fg">{draft.name || 'Novo personagem'}</p>
        <p className="text-fg-secondary">
          {classDef ? `${classDef.name} ${draft.level}` : `Nível ${draft.level}`}
          {draftSubclass(draft) ? ` · ${draftSubclass(draft)?.name}` : ''}
        </p>
        <p className="text-xs text-fg-muted">{campaignName ? `Campanha: ${campaignName}` : 'Ficha pessoal'}</p>
        {combat ? (
          <div className="flex flex-wrap gap-2">
            <Badge tone="parchment">PV {combat.hitPointMax}</Badge>
            <Badge tone="parchment">CA {combat.armorClass}</Badge>
            <Badge tone="parchment">{String(Math.round(combat.speedFeet * 0.3 * 10) / 10).replace('.', ',')} m</Badge>
          </div>
        ) : null}
        {scores ? (
          <dl className="grid grid-cols-3 gap-1 text-center">
            {Object.entries<number>(scores).map(([ability, value]) => (
              <div key={ability} className="rounded border border-line py-1">
                <dt className="text-[10px] tracking-wider text-fg-subtle uppercase">{ability}</dt>
                <dd className="tabular text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-fg-subtle">Atributos ainda não definidos.</p>
        )}
      </div>
    </aside>
  );
}
