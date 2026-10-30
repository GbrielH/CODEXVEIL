'use client';

import {
  CREATION,
  GENERATIONS,
  INSTINCTS,
  KNOWLEDGES,
  PRACTICES,
  aptitudeLabels,
  creationIssues,
  createDefaultAssimilacaoSheet,
  generationLabels,
  healthPerLevel,
  learnedXp,
  requirementMet,
  safeAssimilacaoBookEntryData,
  type AssimilacaoCampaignRules,
  type AssimilacaoSheet,
  type Generation,
} from '@codexveil/rpg-systems/assimilacao';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { createAssimilacaoCharacterAction } from '@/app/(app)/personagens/actions-assimilacao';
import { withAssimSymbols } from '@/components/assimilacao/symbols';
import {
  CreationAnswersFields,
  answersComplete,
  answersFor,
} from '@/components/characters/creation-answers';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { cx } from '@/lib/cx';
import { characterPath } from '@/lib/routes';

export interface AssimilacaoSource {
  book: { id: string; name: string };
  entries: readonly { kind: string; key: string; name: string; data: unknown }[];
}

interface CampaignInfo {
  id: string;
  name: string;
  rules: AssimilacaoCampaignRules;
  questions: readonly string[];
}

const STEPS = [
  'Concepção',
  'Origens e Propósitos',
  'Aptidões',
  'Características',
  'Revisão',
] as const;

/** Características do livro com custo e requisito (para escolher na criação). */
function bookCharacteristics(sources: readonly AssimilacaoSource[]) {
  return sources.flatMap((source) =>
    source.entries.flatMap((entry) => {
      if (entry.kind !== 'characteristic') return [];
      const data = safeAssimilacaoBookEntryData('characteristic', entry.data);
      return data ? [{ key: `${source.book.id}:${entry.key}`, name: entry.name, ...data }] : [];
    }),
  );
}

/** Criação de Infectados em cinco passos, com os limites do Capítulo 2 conferidos a cada mudança. */
export function AssimilacaoCreationWizard({
  campaign,
  sources,
}: {
  campaign: CampaignInfo | null;
  sources: readonly AssimilacaoSource[];
}) {
  const router = useRouter();
  const startingDetermination = campaign?.rules.startingDetermination ?? 9;
  const experience = campaign?.rules.startingExperience ?? CREATION.experience;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<AssimilacaoSheet>(() => {
    const base = createDefaultAssimilacaoSheet();
    return { ...base, tugOfWar: { ...base.tugOfWar, determinationLevel: startingDetermination } };
  });
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({ name: '', cost: 1 });
  const catalog = useMemo(() => bookCharacteristics(sources), [sources]);
  const questions = campaign?.questions ?? [];

  const update = (patch: (current: AssimilacaoSheet) => AssimilacaoSheet) =>
    setSheet((current) => patch(current));
  // Estágio Avançado: começa com 1 Nível a mais de Assimilação (o mestre conduz a rolagem).
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
  const xpLeft = experience - finalSheet.experience.spent;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await createAssimilacaoCharacterAction({
      campaignId: campaign?.id ?? null,
      name,
      sheet: finalSheet,
      answers: answersFor(questions, answers),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(`${characterPath(result.characterId)}?aviso=personagem-criado` as Route);
  };

  const stepper = (
    <ol className="flex flex-wrap gap-2" aria-label="Passos">
      {STEPS.map((label, index) => (
        <li key={label}>
          <button
            type="button"
            onClick={() => setStep(index)}
            aria-current={index === step ? 'step' : undefined}
            className={cx(
              'rounded-full border px-3 py-1 text-sm',
              index === step
                ? 'border-wine-400 bg-wine-900/60 text-fg'
                : 'border-line text-fg-muted hover:text-fg',
            )}
          >
            {index + 1}. {label}
          </button>
        </li>
      ))}
    </ol>
  );

  let body: ReactNode;
  if (step === 0) {
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="asrpg-name"
          label="Nome do Infectado"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <SelectField
          id="asrpg-generation"
          label="Geração"
          hint="Em relação ao Colapso: muda lembranças, hábitos e a relação com a tecnologia."
          value={sheet.identity.generation ?? ''}
          onChange={(event) =>
            update((current) => ({
              ...current,
              identity: {
                ...current.identity,
                generation: (event.target.value || null) as Generation | null,
              },
            }))
          }
        >
          <option value="">Escolha…</option>
          {GENERATIONS.map((generation) => (
            <option key={generation} value={generation}>
              {generationLabels[generation]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="asrpg-age"
          label="Idade"
          value={sheet.identity.age}
          maxLength={40}
          onChange={(event) =>
            update((current) => ({
              ...current,
              identity: { ...current.identity, age: event.target.value },
            }))
          }
        />
        <div className="sm:col-span-2 grid gap-4">
          {(['appearance', 'personality', 'backstory'] as const).map((field) => (
            <TextareaField
              key={field}
              id={`asrpg-${field}`}
              label={
                { appearance: 'Aparência', personality: 'Personalidade', backstory: 'História' }[
                  field
                ]
              }
              rows={field === 'backstory' ? 5 : 3}
              value={sheet.identity[field]}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  identity: { ...current.identity, [field]: event.target.value },
                }))
              }
            />
          ))}
        </div>
      </div>
    );
  } else if (step === 1) {
    const purpose = (group: 'personal' | 'collective', index: number, label: string) => (
      <TextField
        key={`${group}-${index}`}
        id={`asrpg-${group}-${index}`}
        label={label}
        maxLength={200}
        value={sheet.purposes[group][index]?.text ?? ''}
        onChange={(event) =>
          update((current) => {
            const list = [...current.purposes[group]];
            list[index] = { text: event.target.value, inert: list[index]?.inert ?? false };
            return { ...current, purposes: { ...current.purposes, [group]: list } };
          })
        }
      />
    );
    body = (
      <div className="flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="eyebrow sm:col-span-2">
            Origens (cada uma mantém +1 dado, uma vez por sessão)
          </h3>
          <TextField
            id="asrpg-event"
            label="Evento Marcante"
            hint="Algo do passado que moldou o Infectado. Ex.: “Abandonado pelos companheiros”."
            maxLength={200}
            value={sheet.origins.event}
            onChange={(event) =>
              update((current) => ({
                ...current,
                origins: { ...current.origins, event: event.target.value },
              }))
            }
          />
          <TextField
            id="asrpg-occupation"
            label="Ocupação"
            hint="Duas palavras: identidade e especificidade. Ex.: “Mercador honrado”."
            maxLength={200}
            value={sheet.origins.occupation}
            onChange={(event) =>
              update((current) => ({
                ...current,
                origins: { ...current.origins, occupation: event.target.value },
              }))
            }
          />
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="eyebrow sm:col-span-2">Propósitos</h3>
          {purpose('personal', 0, '1º Propósito Pessoal')}
          {purpose('personal', 1, '2º Propósito Pessoal')}
          {purpose('collective', 0, '1º Propósito Coletivo')}
          {purpose('collective', 1, '2º Propósito Coletivo')}
          <p className="text-xs text-fg-muted sm:col-span-2">
            Os Coletivos são escolhidos em grupo: cada jogador propõe um e fica com dois entre os
            sugeridos. Proposta sem adesão vira Propósito Inerte (marque na ficha depois).
          </p>
        </section>
      </div>
    );
  } else if (step === 2) {
    const row = (
      group: 'instincts' | 'knowledges' | 'practices',
      key: string,
      min: number,
      max: number,
    ) => {
      const value = (sheet[group] as Record<string, number>)[key] ?? min;
      const set = (next: number) =>
        update((current) => ({
          ...current,
          [group]: { ...(current[group] as Record<string, number>), [key]: next },
        }));
      return (
        <li
          key={key}
          className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-1.5"
        >
          <span className="text-sm text-fg">
            {aptitudeLabels[key as keyof typeof aptitudeLabels]}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Diminuir"
              disabled={value <= min}
              onClick={() => set(value - 1)}
              className="rounded p-1 hover:bg-hover disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="w-5 text-center font-display text-lg text-fg">{value}</span>
            <button
              type="button"
              aria-label="Aumentar"
              disabled={value >= max}
              onClick={() => set(value + 1)}
              className="rounded p-1 hover:bg-hover disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        </li>
      );
    };
    body = (
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="flex flex-col gap-2">
          <h3 className="eyebrow">Instintos {withAssimSymbols('{6}')}</h3>
          <p className="text-xs text-fg-muted">
            Todos começam em 1. Pontos livres:{' '}
            <strong className={cx(freeInstincts < 0 ? 'text-danger' : 'text-fg')}>
              {freeInstincts}
            </strong>{' '}
            de {CREATION.instinctFreePoints} (máximo {CREATION.instinctMax} na criação).
          </p>
          <ul className="flex flex-col gap-1.5">
            {INSTINCTS.map((key) => row('instincts', key, 1, CREATION.instinctMax))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="eyebrow">Conhecimentos {withAssimSymbols('{1}')}</h3>
          <p className="text-xs text-fg-muted">
            Com as Práticas:{' '}
            <strong
              className={cx(learnedUsed > CREATION.learnedPoints ? 'text-danger' : 'text-fg')}
            >
              {learnedUsed}
            </strong>{' '}
            de {CREATION.learnedPoints} pontos (máximo {CREATION.learnedMax}; acima disso custa
            Experiência: o dobro do nível).
          </p>
          <ul className="flex flex-col gap-1.5">
            {KNOWLEDGES.map((key) => row('knowledges', key, 0, 5))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="eyebrow">Práticas {withAssimSymbols('{1}')}</h3>
          <p className="text-xs text-fg-muted">
            Saúde por Nível: 1 + Potência + Resolução = {healthPerLevel(sheet)}.
          </p>
          <ul className="flex flex-col gap-1.5">
            {PRACTICES.map((key) => row('practices', key, 0, 5))}
          </ul>
        </section>
      </div>
    );
  } else if (step === 3) {
    const chosen = new Set(sheet.characteristics.map((entry) => entry.name.toLowerCase()));
    body = (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-fg-secondary">
          Experiência:{' '}
          <strong className={cx(xpLeft < 0 ? 'text-danger' : 'text-fg')}>{xpLeft}</strong> de{' '}
          {experience} pontos restantes
          {learnedXp(sheet)
            ? ` (${learnedXp(sheet)} já usados em Conhecimentos/Práticas acima de 2)`
            : ''}
          .
        </p>
        {sheet.characteristics.length ? (
          <ul className="flex flex-wrap gap-2">
            {sheet.characteristics.map((entry, index) => (
              <li
                key={`${entry.name}-${index}`}
                className="flex items-center gap-2 rounded-full border border-wine-400/60 bg-wine-900/40 px-3 py-1 text-sm"
              >
                {entry.name} · {entry.cost}
                <button
                  type="button"
                  aria-label={`Tirar ${entry.name}`}
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      characteristics: current.characteristics.filter(
                        (_, position) => position !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-fg-muted hover:text-fg" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {catalog.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {catalog.map((entry) => {
              const met = requirementMet(sheet, entry.requirement);
              const taken = chosen.has(entry.name.toLowerCase());
              return (
                <li
                  key={entry.key}
                  className={cx(
                    'rounded-lg border p-3',
                    taken ? 'border-wine-400/60 bg-wine-900/30' : 'border-line',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-fg">
                        {entry.name}{' '}
                        <span className="text-xs text-fg-muted">· {entry.cost} XP</span>
                      </p>
                      {entry.requirement ? (
                        <p className={cx('text-xs', met ? 'text-fg-muted' : 'text-danger')}>
                          Requisito: {entry.requirement}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant={taken ? 'ghost' : 'secondary'}
                      disabled={taken || !met}
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          characteristics: [
                            ...current.characteristics,
                            {
                              name: entry.name,
                              cost: entry.cost,
                              notes: entry.text.slice(0, 2000),
                            },
                          ],
                        }))
                      }
                    >
                      {taken ? 'Escolhida' : 'Escolher'}
                    </Button>
                  </div>
                  <p className="mt-1 line-clamp-3 text-xs text-fg-secondary">
                    {withAssimSymbols(entry.text)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Alert tone="info">
            Nenhum livro do Assimilação liberado aqui: anote as Características pelo nome e custo.
            Com o livro importado em Meus livros (e liberado na campanha), a lista aparece com
            requisitos e texto.
          </Alert>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            id="asrpg-custom"
            label="Outra Característica"
            value={custom.name}
            maxLength={120}
            onChange={(event) => setCustom({ ...custom, name: event.target.value })}
          />
          <SelectField
            id="asrpg-custom-cost"
            label="Custo"
            value={String(custom.cost)}
            onChange={(event) => setCustom({ ...custom, cost: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((cost) => (
              <option key={cost} value={cost}>
                {cost} XP
              </option>
            ))}
          </SelectField>
          <Button
            variant="secondary"
            disabled={!custom.name.trim()}
            onClick={() => {
              update((current) => ({
                ...current,
                characteristics: [
                  ...current.characteristics,
                  { name: custom.name.trim(), cost: custom.cost, notes: '' },
                ],
              }));
              setCustom({ name: '', cost: 1 });
            }}
          >
            Adicionar
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-fg-muted">Cabo de Guerra</dt>
          <dd className="text-fg">
            Determinação {finalSheet.tugOfWar.determinationLevel} · Assimilação{' '}
            {10 - finalSheet.tugOfWar.determinationLevel}
            {advanced
              ? ' (Estágio Avançado: o mestre conduz a rolagem das Assimilações iniciais)'
              : ''}
          </dd>
          <dt className="text-fg-muted">Saúde</dt>
          <dd className="text-fg">
            6 Níveis de {healthPerLevel(sheet)} pontos ({healthPerLevel(sheet) * 6} no total)
          </dd>
          <dt className="text-fg-muted">Origens</dt>
          <dd className="text-fg">
            {[sheet.origins.event, sheet.origins.occupation].filter(Boolean).join(' · ') || '—'}
          </dd>
          <dt className="text-fg-muted">Experiência</dt>
          <dd className="text-fg">
            {finalSheet.experience.spent} de {experience} usados
          </dd>
        </dl>
        {questions.length ? (
          <CreationAnswersFields
            questions={questions}
            values={answers}
            onChange={setAnswers}
            showErrors
          />
        ) : null}
        {issues.length ? (
          <Alert tone="warning">
            <ul className="list-disc pl-4">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {!name.trim() ? <Alert tone="warning">Dê um nome ao Infectado (passo 1).</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {stepper}
      {body}
      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>Próximo</Button>
        ) : (
          <Button
            loading={busy}
            disabled={issues.length > 0 || !name.trim() || !answersComplete(questions, answers)}
            onClick={() => void submit()}
          >
            Criar Infectado
          </Button>
        )}
      </div>
    </div>
  );
}
