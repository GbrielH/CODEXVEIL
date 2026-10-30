'use client';

import {
  adjustCharacterResource,
  saveCharacterSheet,
  type CharacterResource,
} from '@codexveil/database';
import { characterImagePrompt, characterTokenPrompt, type TrackOperation } from '@codexveil/domain';
import {
  ASSIMILACAO_RESOURCE_KEYS,
  ASSIMILATION_KINDS,
  GENERATIONS,
  HEALTH_LEVEL_TITLES,
  INSTINCTS,
  KNOWLEDGES,
  PRACTICES,
  aptitudeLabels,
  assimilacaoCampaignIssues,
  assimilationKindLabels,
  diceFromGroups,
  generationLabels,
  healthPerLevel,
  healthState,
  loseDetermination,
  parseAssimilacaoCampaignRules,
  planTest,
  poolExpression,
  safeAssimilacaoBookEntryData,
  suggestKeep,
  sumFaces,
  tugOfWar,
  type AssimilacaoSheet,
  type AssimilationKind,
  type Generation,
  type Instinct,
  type Knowledge,
  type Practice,
  type RolledDie,
} from '@codexveil/rpg-systems/assimilacao';
import { Dices, Minus, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { AssimSymbol, withAssimSymbols } from '@/components/assimilacao/symbols';
import {
  CampaignLinkCard,
  type LinkCampaignOption,
} from '@/components/characters/campaign-link-card';
import { DeleteCharacterCard } from '@/components/characters/delete-character';
import { ImagePromptCard } from '@/components/characters/image-prompt-card';
import { PortraitCard } from '@/components/characters/portrait-card';
import { TokenImageCard } from '@/components/characters/token-image-card';
import { DiceProvider, useDice } from '@/components/dice/dice-roller';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ArcaneScene } from '@/components/brand/arcane-scene';
import { ZoomableImage } from '@/components/ui/zoomable-image';

export interface AssimilacaoBookSource {
  book: { id: string; name: string };
  entries: readonly { kind: string; key: string; name: string; data: unknown }[];
}

interface AssimilacaoSheetScreenProps {
  character: {
    id: string;
    name: string;
    ownerName?: string;
    version: number;
    portraitUrl: string | null;
    portraitPath: string | null;
    campaign: { id: string; name: string } | null;
  };
  sheet: AssimilacaoSheet;
  resources: CharacterResource[];
  permissions: { canEditSheet: boolean; canEditPlay: boolean; isGm: boolean; isOwner: boolean };
  sources?: readonly AssimilacaoBookSource[];
  shareCard?: ReactNode;
  campaigns?: LinkCampaignOption[];
  /** Na campanha, as rolagens vão para o mural e só valem com a sessão em andamento. */
  variant?: 'full' | 'campaign';
}

export function AssimilacaoSheetScreen(props: AssimilacaoSheetScreenProps) {
  return (
    <DiceProvider
      campaignId={props.variant === 'campaign' ? (props.character.campaign?.id ?? null) : null}
      characterId={props.character.id}
      enabled={props.permissions.canEditPlay}
      sessionGate={props.variant === 'campaign'}
    >
      <SheetBody {...props} />
    </DiceProvider>
  );
}

const SECOND_APTITUDES = [...KNOWLEDGES, ...PRACTICES] as const;

function SheetBody({
  character,
  sheet: initialSheet,
  resources: initialResources,
  permissions,
  sources = [],
  shareCard,
  campaigns,
  variant = 'full',
}: AssimilacaoSheetScreenProps) {
  const { toast } = useToast();
  const dice = useDice();
  const [sheet, setSheet] = useState(initialSheet);
  const [version, setVersion] = useState(character.version);
  const [resources, setResources] = useState(initialResources);
  const [tab, setTab] = useState('jogo');
  const editable = permissions.canEditSheet;
  const resource = (key: string) => resources.find((entry) => entry.key === key) ?? null;
  const health = resource(ASSIMILACAO_RESOURCE_KEYS.health);
  const determination = resource(ASSIMILACAO_RESOURCE_KEYS.determination);
  const assimilation = resource(ASSIMILACAO_RESOURCE_KEYS.assimilation);
  const tug = tugOfWar(sheet);
  const state = healthState(sheet, health?.current ?? healthPerLevel(sheet) * 6);

  /** Grava a ficha (controle de versão: se outra aba salvou antes, avisa). */
  const save = async (next: AssimilacaoSheet) => {
    const previous = sheet;
    setSheet(next);
    try {
      const saved = await saveCharacterSheet(getSupabaseBrowserClient(), character.id, version, {
        sheet: next,
      });
      setVersion(saved.version);
      return true;
    } catch (error) {
      setSheet(previous);
      toast({
        tone: 'danger',
        title: 'A ficha não foi salva',
        description: failureMessage(error, 'Recarregue a página e tente de novo.'),
      });
      return false;
    }
  };
  const patch = (change: (current: AssimilacaoSheet) => AssimilacaoSheet) =>
    void save(change(sheet));

  const adjust = async (
    track: CharacterResource | null,
    operation: TrackOperation,
    amount: number,
  ) => {
    if (!track || !permissions.canEditPlay || amount < 0) return null;
    try {
      const saved = await adjustCharacterResource(
        getSupabaseBrowserClient(),
        track.id,
        operation,
        amount,
      );
      setResources((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
      return saved;
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível atualizar',
        description: failureMessage(error, 'Tente de novo.'),
      });
      return null;
    }
  };

  /** Perda de Determinação com o Cabo de Guerra: zerada a reserva, cai um Nível e a Assimilação sobe. */
  const loseDeterminationPoints = async (amount: number) => {
    if (!determination) return;
    const result = loseDetermination(
      sheet.tugOfWar.determinationLevel,
      determination.current,
      amount,
    );
    if (result.levelsLost > 0) {
      const ok = await save({
        ...sheet,
        tugOfWar: { determinationLevel: result.determinationLevel, locked: true },
      });
      if (!ok) return;
      await adjust(determination, 'set_max', result.determinationLevel);
      await adjust(determination, 'set_current', 0);
      if (assimilation) {
        await adjust(assimilation, 'set_max', 10 - result.determinationLevel);
        await adjust(
          assimilation,
          'set_current',
          Math.min(10 - result.determinationLevel, assimilation.current + result.levelsLost),
        );
      }
      toast({
        tone: 'warning',
        title: 'A Assimilação avançou',
        description: `Determinação ${result.determinationLevel} · Assimilação ${10 - result.determinationLevel}. Faça o Teste de Assimilação no próximo repouso; a Determinação fica bloqueada até lá.`,
      });
    } else {
      await adjust(determination, 'set_current', result.determinationPoints);
    }
  };

  /** Clareza de Propósito: recupera um Nível de Determinação inteiro. */
  const clarity = async () => {
    if (sheet.tugOfWar.determinationLevel >= 10) return;
    const level = sheet.tugOfWar.determinationLevel + 1;
    if (!(await save({ ...sheet, tugOfWar: { determinationLevel: level, locked: false } }))) return;
    await adjust(determination, 'set_max', level);
    await adjust(determination, 'set_current', level);
    if (assimilation) {
      await adjust(assimilation, 'set_max', 10 - level);
      await adjust(assimilation, 'set_current', Math.min(assimilation.current, 10 - level));
    }
  };

  // Teste: Instinto + Conhecimento/Prática (ou segundo Instinto na Rolagem Assimilada).
  const [instinct, setInstinct] = useState<Instinct>('percepcao');
  const [second, setSecond] = useState<Knowledge | Practice | Instinct>('sobrevivencia');
  const [assimilated, setAssimilated] = useState(false);
  const [useEvent, setUseEvent] = useState(false);
  const [useOccupation, setUseOccupation] = useState(false);
  const [effort, setEffort] = useState(false);
  const [rolled, setRolled] = useState<{
    dice: RolledDie[];
    keep: number;
    kept: number[];
    label: string;
  } | null>(null);
  const plan = planTest(sheet, {
    instinct,
    aptitude: assimilated ? (INSTINCTS.includes(second as Instinct) ? second : instinct) : second,
    assimilated,
    origins: (useEvent ? 1 : 0) + (useOccupation ? 1 : 0),
    effort,
  });

  const rollTest = async () => {
    if (!dice) return;
    if (sheet.tugOfWar.locked && effort) {
      toast({
        tone: 'warning',
        title: 'Determinação bloqueada',
        description: 'Conclua a Assimilação antes de gastar Determinação.',
      });
      return;
    }
    const secondName =
      aptitudeLabels[assimilated && !INSTINCTS.includes(second as Instinct) ? instinct : second];
    const label = `${aptitudeLabels[instinct]} + ${secondName}${assimilated ? ' (Assimilada)' : ''}`;
    const expression = poolExpression(plan.pool);
    if (!expression) return;
    if (dice.physical) {
      toast({
        tone: 'info',
        title: 'Role na mesa',
        description: `${label}: ${expression}, mantenha ${plan.keep}.`,
      });
      return;
    }
    const shown = await dice.roll({
      expression,
      label: `Assimilação · ${label} · mantém ${plan.keep}`,
    });
    if (!shown) return;
    const result = diceFromGroups(shown.dice);
    setRolled({ dice: result, keep: plan.keep, kept: suggestKeep(result, plan.keep), label });
    // Custos: Empenho (1 d), Rolagem Assimilada (1 e, ou 2 d sem e), Origens (uso por sessão).
    if (effort) await loseDeterminationPoints(1);
    if (assimilated) {
      if (assimilation && assimilation.current > 0) await adjust(assimilation, 'spend', 1);
      else await loseDeterminationPoints(2);
    }
    if (useEvent || useOccupation)
      patch((current) => ({
        ...current,
        origins: {
          ...current.origins,
          eventUsed: current.origins.eventUsed || useEvent,
          occupationUsed: current.origins.occupationUsed || useOccupation,
        },
      }));
    setEffort(false);
    setUseEvent(false);
    setUseOccupation(false);
  };

  const keptTotal = rolled
    ? sumFaces(rolled.kept.map((index) => rolled.dice[index]!.result))
    : null;

  const bookCards = useMemo(
    () =>
      sources.flatMap((source) =>
        source.entries.flatMap((entry) => {
          if (entry.kind !== 'assimilation') return [];
          const data = safeAssimilacaoBookEntryData('assimilation', entry.data);
          return data
            ? [
                {
                  name: entry.name,
                  kind: data.kind,
                  rank: data.rank,
                  suit: data.suit,
                  levels: data.levels,
                },
              ]
            : [];
        }),
      ),
    [sources],
  );
  const [newAssim, setNewAssim] = useState('');
  const [newCharacteristic, setNewCharacteristic] = useState({ name: '', cost: 1 });

  const stepper = (
    value: number,
    onChange: (next: number) => void,
    min: number,
    max: number,
    label: string,
  ) => (
    <span className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Diminuir ${label}`}
        disabled={!editable || value <= min}
        onClick={() => onChange(value - 1)}
        className="rounded p-1 hover:bg-hover disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="w-5 text-center font-display text-lg text-fg">{value}</span>
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        disabled={!editable || value >= max}
        onClick={() => onChange(value + 1)}
        className="rounded p-1 hover:bg-hover disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );

  const tugCard = (
    <Card ornate>
      <CardHeader
        title="Cabo de Guerra"
        description="Determinação + Assimilação somam sempre 10."
      />
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="font-display text-2xl text-amber-200">{tug.determinationLevel}</span>
        <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-sunken">
          <div
            className="bg-gradient-to-r from-amber-600 to-amber-400"
            style={{ width: `${tug.determinationLevel * 10}%` }}
          />
          <div
            className="bg-gradient-to-r from-violet-500 to-violet-700"
            style={{ width: `${tug.assimilationLevel * 10}%` }}
          />
        </div>
        <span className="font-display text-2xl text-violet-200">{tug.assimilationLevel}</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          {
            track: determination,
            label: 'Pontos de Determinação',
            code: 'd',
            max: tug.determinationLevel,
          },
          {
            track: assimilation,
            label: 'Pontos de Assimilação',
            code: 'e',
            max: tug.assimilationLevel,
          },
        ].map(({ track, label, code, max }) => (
          <div key={code} className="flex flex-col gap-2">
            <p className="flex items-center gap-1 text-sm text-fg">
              <AssimSymbol code={code} /> {label}: <strong>{track?.current ?? 0}</strong> / {max}
            </p>
            <div className="flex flex-wrap gap-1" aria-hidden="true">
              {Array.from({ length: max }, (_, index) => (
                <span
                  key={index}
                  className={cx(
                    'h-3 w-3 rounded-full ring-1 ring-line',
                    index < (track?.current ?? 0) &&
                      (code === 'd' ? 'bg-amber-400' : 'bg-violet-400'),
                  )}
                />
              ))}
            </div>
            {permissions.canEditPlay ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void (code === 'd' ? loseDeterminationPoints(1) : adjust(track, 'spend', 1))
                  }
                >
                  {code === 'd' ? 'Perder 1' : 'Gastar 1'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void adjust(track, 'heal', 1)}>
                  Recuperar 1
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {sheet.tugOfWar.locked ? (
        <Alert tone="warning" className="mt-3">
          Suscetível: a Determinação está bloqueada até a Assimilação se completar (escolha as
          mutações no próximo repouso).
          {editable ? (
            <Button
              size="sm"
              variant="secondary"
              className="ml-2"
              onClick={() =>
                patch((current) => ({
                  ...current,
                  tugOfWar: { ...current.tugOfWar, locked: false },
                }))
              }
            >
              Assimilação concluída
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {permissions.canEditPlay ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <Button size="sm" variant="secondary" onClick={() => void clarity()}>
            Clareza de Propósito (+1 Nível)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void adjust(assimilation, 'set_current', tug.assimilationLevel)}
          >
            Fim de cena: recupera Assimilação
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void adjust(determination, 'heal', 1 + sheet.instincts.resolucao)}
          >
            Repouso completo (+{1 + sheet.instincts.resolucao} d)
          </Button>
        </div>
      ) : null}
    </Card>
  );

  const healthCard = (
    <Card>
      <CardHeader
        title="Saúde"
        description={`${state.perLevel} pontos por Nível (1 + Potência + Resolução). ${state.penalty ? `Penalidade: −${state.penalty} Sucesso por teste.` : 'Sem penalidade.'}`}
      />
      <ol className="flex flex-col gap-1.5">
        {HEALTH_LEVEL_TITLES.map((title, index) => {
          const level = 6 - index;
          const filled =
            level < state.level ? state.perLevel : level === state.level ? state.pointsInLevel : 0;
          return (
            <li
              key={title}
              className={cx(
                'flex items-center gap-2 text-sm',
                level === state.level ? 'text-fg' : 'text-fg-muted',
              )}
            >
              <span className="w-6 font-display">{level}</span>
              <span className="w-28">{title}</span>
              <span
                className="flex flex-wrap gap-0.5"
                aria-label={`${filled} de ${state.perLevel}`}
              >
                {Array.from({ length: state.perLevel }, (_, point) => (
                  <span
                    key={point}
                    className={cx(
                      'h-3 w-3 rounded-sm ring-1 ring-line',
                      point < filled && 'bg-rose-500',
                    )}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-fg-muted">
        Recuperação:{' '}
        {
          {
            repouso: 'a cada repouso completo',
            semanal: 'a cada semana',
            tratamento: 'só com tratamento médico',
            nenhuma: '—',
          }[state.recovery]
        }{' '}
        · regenera Potência + 1 = {sheet.instincts.potencia + 1} pontos.
        {state.actionCostsDetermination ? ' Agir custa 1 Ponto de Determinação.' : ''}
      </p>
      {permissions.canEditPlay ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 3].map((amount) => (
            <Button
              key={amount}
              size="sm"
              variant="secondary"
              onClick={() => void adjust(health, 'damage', amount)}
            >
              Dano {amount}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void adjust(health, 'heal', sheet.instincts.potencia + 1)}
          >
            Recuperação (+{sheet.instincts.potencia + 1})
          </Button>
        </div>
      ) : null}
    </Card>
  );

  const testCard = permissions.canEditPlay ? (
    <Card>
      <CardHeader
        title="Teste"
        description="Instinto (d6) + Conhecimento ou Prática (d10). Mantém o melhor dado."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="asrpg-instinct"
          label="Instinto"
          value={instinct}
          onChange={(event) => setInstinct(event.target.value as Instinct)}
        >
          {INSTINCTS.map((key) => (
            <option key={key} value={key}>
              {aptitudeLabels[key]} ({sheet.instincts[key]})
            </option>
          ))}
        </SelectField>
        <SelectField
          id="asrpg-second"
          label={assimilated ? 'Segundo Instinto' : 'Conhecimento ou Prática'}
          value={second}
          onChange={(event) => setSecond(event.target.value as Knowledge | Practice)}
        >
          {(assimilated ? INSTINCTS : SECOND_APTITUDES).map((key) => (
            <option key={key} value={key}>
              {aptitudeLabels[key]} (
              {(sheet.instincts as Record<string, number>)[key] ??
                (sheet.knowledges as Record<string, number>)[key] ??
                (sheet.practices as Record<string, number>)[key] ??
                0}
              )
            </option>
          ))}
        </SelectField>
      </div>
      <div className="mt-3 flex flex-col gap-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={assimilated}
            onChange={(event) => {
              setAssimilated(event.target.checked);
              setSecond(event.target.checked ? instinct : 'sobrevivencia');
            }}
          />
          Agir por Instinto (Rolagem Assimilada: tudo vira {withAssimSymbols('{2}')}, +1 dado
          mantido, custa {withAssimSymbols('{e}')})
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={effort}
            disabled={sheet.tugOfWar.locked}
            onChange={(event) => setEffort(event.target.checked)}
          />
          Empenho: gastar {withAssimSymbols('{d}')} para manter +1 dado
        </label>
        <label className={cx('flex items-center gap-2', sheet.origins.eventUsed && 'opacity-50')}>
          <input
            type="checkbox"
            checked={useEvent}
            disabled={sheet.origins.eventUsed || !sheet.origins.event}
            onChange={(event) => setUseEvent(event.target.checked)}
          />
          Evento Marcante{sheet.origins.event ? `: ${sheet.origins.event}` : ''}{' '}
          {sheet.origins.eventUsed ? '(já usado nesta sessão)' : ''}
        </label>
        <label
          className={cx('flex items-center gap-2', sheet.origins.occupationUsed && 'opacity-50')}
        >
          <input
            type="checkbox"
            checked={useOccupation}
            disabled={sheet.origins.occupationUsed || !sheet.origins.occupation}
            onChange={(event) => setUseOccupation(event.target.checked)}
          />
          Ocupação{sheet.origins.occupation ? `: ${sheet.origins.occupation}` : ''}{' '}
          {sheet.origins.occupationUsed ? '(já usada nesta sessão)' : ''}
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void rollTest()} disabled={!dice}>
          <Dices className="h-4 w-4" aria-hidden="true" /> Rolar {poolExpression(plan.pool)} ·
          mantém {plan.keep}
        </Button>
        {state.penalty ? (
          <span className="text-xs text-danger">
            Saúde: −{state.penalty} {withAssimSymbols('{A}')} no resultado
          </span>
        ) : null}
      </div>
      {rolled ? (
        <div
          className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-sunken/50 p-3"
          aria-live="polite"
        >
          <p className="text-sm text-fg">
            {rolled.label}: escolha {rolled.keep} {rolled.keep === 1 ? 'dado' : 'dados'} para
            manter.
          </p>
          <ul className="flex flex-wrap gap-2">
            {rolled.dice.map((die, index) => {
              const kept = rolled.kept.includes(index);
              return (
                <li key={index}>
                  <button
                    type="button"
                    aria-pressed={kept}
                    onClick={() =>
                      setRolled({
                        ...rolled,
                        kept: kept
                          ? rolled.kept.filter((entry) => entry !== index)
                          : rolled.kept.length < rolled.keep
                            ? [...rolled.kept, index]
                            : [...rolled.kept.slice(1), index],
                      })
                    }
                    className={cx(
                      'flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-1',
                      kept ? 'border-wine-400 bg-wine-900/60' : 'border-line bg-card',
                    )}
                  >
                    <span className="text-[0.65rem] text-fg-muted">{die.die}</span>
                    <span className="flex gap-0.5">
                      {die.result.sucesso + die.result.adaptacao + die.result.pressao === 0 ? (
                        <span className="text-fg-muted">—</span>
                      ) : (
                        <>
                          {Array.from({ length: die.result.sucesso }, (_, i) => (
                            <AssimSymbol key={`a${i}`} code="A" />
                          ))}
                          {Array.from({ length: die.result.adaptacao }, (_, i) => (
                            <AssimSymbol key={`b${i}`} code="B" />
                          ))}
                          {Array.from({ length: die.result.pressao }, (_, i) => (
                            <AssimSymbol key={`c${i}`} code="C" />
                          ))}
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {keptTotal ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
              Resultado mantido:
              <span className="flex items-center gap-1">
                <AssimSymbol code="A" /> {Math.max(0, keptTotal.sucesso - state.penalty)} Sucesso(s)
              </span>
              <span className="flex items-center gap-1">
                <AssimSymbol code="B" /> {keptTotal.adaptacao} Adaptação(ões)
              </span>
              <span className="flex items-center gap-1">
                <AssimSymbol code="C" /> {keptTotal.pressao} Pressão(ões)
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  ) : null;

  const originsCard = (
    <Card>
      <CardHeader title="Origens e Propósitos" />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="asrpg-o-event"
          label="Evento Marcante"
          value={sheet.origins.event}
          disabled={!editable}
          maxLength={200}
          onChange={(event) =>
            setSheet({ ...sheet, origins: { ...sheet.origins, event: event.target.value } })
          }
          onBlur={() => void save(sheet)}
        />
        <TextField
          id="asrpg-o-occupation"
          label="Ocupação"
          value={sheet.origins.occupation}
          disabled={!editable}
          maxLength={200}
          onChange={(event) =>
            setSheet({ ...sheet, origins: { ...sheet.origins, occupation: event.target.value } })
          }
          onBlur={() => void save(sheet)}
        />
      </div>
      {permissions.canEditPlay && (sheet.origins.eventUsed || sheet.origins.occupationUsed) ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() =>
            patch((current) => ({
              ...current,
              origins: { ...current.origins, eventUsed: false, occupationUsed: false },
            }))
          }
        >
          Nova sessão: liberar as Origens
        </Button>
      ) : null}
      <ul className="mt-4 flex flex-col gap-2">
        {(['personal', 'collective'] as const).flatMap((group) =>
          sheet.purposes[group].map((purpose, index) => (
            <li key={`${group}-${index}`} className="flex flex-wrap items-end gap-2">
              <TextField
                id={`asrpg-p-${group}-${index}`}
                className="min-w-0 flex-1"
                label={`${group === 'personal' ? 'Propósito Pessoal' : 'Propósito Coletivo'} ${index + 1}`}
                value={purpose.text}
                disabled={!editable}
                maxLength={200}
                onChange={(event) => {
                  const list = [...sheet.purposes[group]];
                  list[index] = { ...purpose, text: event.target.value };
                  setSheet({ ...sheet, purposes: { ...sheet.purposes, [group]: list } });
                }}
                onBlur={() => void save(sheet)}
              />
              {group === 'collective' ? (
                <label className="flex items-center gap-1 pb-2 text-xs text-fg-muted">
                  <input
                    type="checkbox"
                    checked={purpose.inert}
                    disabled={!editable}
                    onChange={(event) => {
                      const list = [...sheet.purposes[group]];
                      list[index] = { ...purpose, inert: event.target.checked };
                      void save({ ...sheet, purposes: { ...sheet.purposes, [group]: list } });
                    }}
                  />
                  Inerte
                </label>
              ) : null}
            </li>
          )),
        )}
      </ul>
    </Card>
  );

  const aptitudeColumn = (
    title: string,
    group: 'instincts' | 'knowledges' | 'practices',
    keys: readonly string[],
    min: number,
    code: string,
  ) => (
    <section className="flex flex-col gap-1.5">
      <h3 className="eyebrow flex items-center gap-1">
        {title} <AssimSymbol code={code} />
      </h3>
      <ul className="flex flex-col gap-1">
        {keys.map((key) => {
          const value = (sheet[group] as Record<string, number>)[key] ?? min;
          return (
            <li
              key={key}
              className="flex items-center justify-between rounded-md border border-line px-2.5 py-1"
            >
              <span className="text-sm text-fg">
                {aptitudeLabels[key as keyof typeof aptitudeLabels]}
              </span>
              {stepper(
                value,
                (next) =>
                  patch((current) => ({
                    ...current,
                    [group]: { ...(current[group] as Record<string, number>), [key]: next },
                  })),
                min,
                5,
                aptitudeLabels[key as keyof typeof aptitudeLabels],
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const characteristicsCard = (
    <Card>
      <CardHeader
        title="Características"
        description={`Experiência: ${sheet.experience.spent} usados de ${sheet.experience.total}.`}
      />
      <ul className="flex flex-col gap-2">
        {sheet.characteristics.map((entry, index) => (
          <li key={`${entry.name}-${index}`} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-fg">
                {entry.name} <span className="text-xs text-fg-muted">· {entry.cost} XP</span>
              </p>
              {editable ? (
                <button
                  type="button"
                  aria-label={`Tirar ${entry.name}`}
                  onClick={() =>
                    patch((current) => ({
                      ...current,
                      characteristics: current.characteristics.filter(
                        (_, position) => position !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4 text-fg-muted hover:text-fg" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {entry.notes ? (
              <p className="mt-1 text-sm text-fg-secondary">{withAssimSymbols(entry.notes)}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <TextField
            id="asrpg-new-char"
            label="Nova Característica"
            value={newCharacteristic.name}
            maxLength={120}
            onChange={(event) =>
              setNewCharacteristic({ ...newCharacteristic, name: event.target.value })
            }
          />
          <SelectField
            id="asrpg-new-char-cost"
            label="Custo"
            value={String(newCharacteristic.cost)}
            onChange={(event) =>
              setNewCharacteristic({ ...newCharacteristic, cost: Number(event.target.value) })
            }
          >
            {[1, 2, 3, 4, 5].map((cost) => (
              <option key={cost} value={cost}>
                {cost} XP
              </option>
            ))}
          </SelectField>
          <Button
            variant="secondary"
            disabled={!newCharacteristic.name.trim()}
            onClick={() => {
              patch((current) => ({
                ...current,
                characteristics: [
                  ...current.characteristics,
                  { name: newCharacteristic.name.trim(), cost: newCharacteristic.cost, notes: '' },
                ],
                experience: {
                  ...current.experience,
                  spent: current.experience.spent + newCharacteristic.cost,
                },
              }));
              setNewCharacteristic({ name: '', cost: 1 });
            }}
          >
            Adicionar
          </Button>
        </div>
      ) : null}
    </Card>
  );

  const assimilationsCard = (
    <Card>
      <CardHeader
        title="Assimilações"
        description="Mutações adquiridas. As Pressões das Inoportunas contam para a perda de consciência."
      />
      <ul className="flex flex-col gap-2">
        {sheet.assimilations.map((entry, index) => {
          const card = bookCards.find((item) => item.name === entry.name);
          return (
            <li key={`${entry.name}-${index}`} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-display text-fg">
                  {card ? (
                    <span className="text-xs text-fg-muted">
                      {card.rank}
                      <AssimSymbol code={card.suit} />
                    </span>
                  ) : null}
                  {entry.name}
                  <span className="text-xs text-fg-muted">
                    · {assimilationKindLabels[entry.kind]}
                  </span>
                </p>
                <span className="flex items-center gap-2 text-sm">
                  <AssimSymbol code="C" />
                  {stepper(
                    entry.pressures,
                    (next) =>
                      patch((current) => ({
                        ...current,
                        assimilations: current.assimilations.map((item, position) =>
                          position === index ? { ...item, pressures: next } : item,
                        ),
                      })),
                    0,
                    10,
                    'Pressões',
                  )}
                  {editable ? (
                    <button
                      type="button"
                      aria-label={`Tirar ${entry.name}`}
                      onClick={() =>
                        patch((current) => ({
                          ...current,
                          assimilations: current.assimilations.filter(
                            (_, position) => position !== index,
                          ),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-fg-muted hover:text-fg" aria-hidden="true" />
                    </button>
                  ) : null}
                </span>
              </div>
              {card ? (
                <details className="mt-1 text-sm text-fg-secondary">
                  <summary className="cursor-pointer text-xs text-fg-muted">
                    Níveis da carta
                  </summary>
                  <ul className="mt-1 flex flex-col gap-1">
                    {card.levels.map((level) => (
                      <li key={level.name}>
                        {(['A', 'B', 'C'] as const).flatMap((code) =>
                          Array.from({ length: level.cost[code] }, (_, i) => (
                            <AssimSymbol key={`${code}${i}`} code={code} />
                          )),
                        )}{' '}
                        <strong className="text-fg">{level.name}</strong>
                        {level.requirement ? (
                          <> ({withAssimSymbols(level.requirement)})</>
                        ) : null}: {withAssimSymbols(level.text)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {editable ? (
                <TextareaField
                  id={`asrpg-assim-notes-${index}`}
                  label="Níveis adquiridos e anotações"
                  rows={2}
                  value={entry.notes}
                  onChange={(event) =>
                    setSheet({
                      ...sheet,
                      assimilations: sheet.assimilations.map((item, position) =>
                        position === index ? { ...item, notes: event.target.value } : item,
                      ),
                    })
                  }
                  onBlur={() => void save(sheet)}
                />
              ) : entry.notes ? (
                <p className="mt-1 text-sm text-fg-secondary">{withAssimSymbols(entry.notes)}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {bookCards.length ? (
            <SelectField
              id="asrpg-new-assim"
              label="Carta de Assimilação"
              value={newAssim}
              onChange={(event) => setNewAssim(event.target.value)}
            >
              <option value="">Escolha…</option>
              {ASSIMILATION_KINDS.map((kind) => (
                <optgroup key={kind} label={assimilationKindLabels[kind]}>
                  {bookCards
                    .filter((card) => card.kind === kind)
                    .map((card) => (
                      <option key={card.name} value={card.name}>
                        {card.rank} · {card.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </SelectField>
          ) : (
            <TextField
              id="asrpg-new-assim"
              label="Nova Assimilação"
              value={newAssim}
              maxLength={120}
              onChange={(event) => setNewAssim(event.target.value)}
            />
          )}
          <Button
            variant="secondary"
            disabled={!newAssim.trim()}
            onClick={() => {
              const card = bookCards.find((item) => item.name === newAssim);
              const kind: AssimilationKind = card?.kind ?? 'evolutiva';
              patch((current) => ({
                ...current,
                assimilations: [
                  ...current.assimilations,
                  { name: newAssim.trim(), kind, pressures: 0, notes: '' },
                ],
              }));
              setNewAssim('');
            }}
          >
            Adicionar
          </Button>
        </div>
      ) : null}
    </Card>
  );

  const identityCard = (
    <Card>
      <CardHeader title="História" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="asrpg-gen"
          label="Geração"
          value={sheet.identity.generation ?? ''}
          disabled={!editable}
          onChange={(event) =>
            void save({
              ...sheet,
              identity: {
                ...sheet.identity,
                generation: (event.target.value || null) as Generation | null,
              },
            })
          }
        >
          <option value="">—</option>
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
          disabled={!editable}
          maxLength={40}
          onChange={(event) =>
            setSheet({ ...sheet, identity: { ...sheet.identity, age: event.target.value } })
          }
          onBlur={() => void save(sheet)}
        />
      </div>
      {(['appearance', 'personality', 'backstory'] as const).map((field) => (
        <TextareaField
          key={field}
          id={`asrpg-${field}`}
          className="mt-3"
          label={
            { appearance: 'Aparência', personality: 'Personalidade', backstory: 'História' }[field]
          }
          rows={field === 'backstory' ? 6 : 3}
          value={sheet.identity[field]}
          disabled={!editable}
          onChange={(event) =>
            setSheet({ ...sheet, identity: { ...sheet.identity, [field]: event.target.value } })
          }
          onBlur={() => void save(sheet)}
        />
      ))}
      <TextareaField
        id="asrpg-notes"
        className="mt-3"
        label="Anotações"
        rows={5}
        value={sheet.notes}
        disabled={!editable}
        onChange={(event) => setSheet({ ...sheet, notes: event.target.value })}
        onBlur={() => void save(sheet)}
      />
    </Card>
  );

  const imageInput = {
    name: character.name,
    system: 'Assimilação RPG (pós-apocalipse com mutações)',
    species: 'Humano Infectado',
    className: sheet.origins.occupation,
    age: sheet.identity.age,
    appearance: sheet.identity.appearance,
    personality: sheet.identity.personality,
    backstory: sheet.identity.backstory,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho (como o do Tormenta20): retrato, nome, origens e os números do jogo. */}
      <header className="relative isolate overflow-hidden rounded-2xl border border-line p-5 sm:p-6">
        <ArcaneScene
          seed={character.name || character.id}
          className="absolute inset-0 -z-10 opacity-60"
          options={{ noMoon: true }}
        />
        <span
          className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal-950 via-charcoal-950/85 to-charcoal-950/60"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {character.portraitUrl ? (
            <ZoomableImage
              src={character.portraitUrl}
              alt={`Retrato de ${character.name}`}
              wrapperClassName="inline-block shrink-0 self-start"
              className="h-28 w-28 rounded-t-[999px] rounded-b-md object-cover ring-2 ring-wine-400/60 ring-offset-2 ring-offset-charcoal-950"
            />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="eyebrow text-wine-300">
              Assimilação RPG
              {sheet.identity.generation ? ` · ${generationLabels[sheet.identity.generation]}` : ''}
            </p>
            <h1 className="text-3xl leading-tight [text-shadow:0_2px_16px_rgb(0_0_0/0.8)] sm:text-4xl">
              {character.name}
            </h1>
            <p className="text-fg-secondary">
              {[sheet.origins.occupation, sheet.origins.event].filter(Boolean).join(' · ') ||
                'Infectado(a)'}
            </p>
            <p className="text-xs text-fg-muted">
              {character.ownerName ? `Jogador: ${character.ownerName} · ` : ''}
              {character.campaign ? `Campanha: ${character.campaign.name}` : 'Ficha pessoal'}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: 'Determinação',
              value: `${determination?.current ?? 0} / ${tug.determinationLevel}`,
              hint: `Nível ${tug.determinationLevel}`,
            },
            {
              label: 'Assimilação',
              value: `${assimilation?.current ?? 0} / ${tug.assimilationLevel}`,
              hint: `Nível ${tug.assimilationLevel}`,
            },
            {
              label: 'Saúde',
              value: HEALTH_LEVEL_TITLES[6 - state.level] ?? 'Morte',
              hint: `${state.remaining} / ${state.total} pontos`,
            },
            {
              label: 'Experiência',
              value: `${sheet.experience.total - sheet.experience.spent}`,
              hint: `de ${sheet.experience.total}`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-md border border-line bg-charcoal-950/60 px-3 py-2 text-center"
            >
              <dt className="text-[11px] tracking-wider text-fg-muted uppercase">{stat.label}</dt>
              <dd className="font-display text-xl text-fg">{stat.value}</dd>
              <dd className="text-[11px] text-fg-subtle">{stat.hint}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {INSTINCTS.map((instinct) => (
            <div
              key={instinct}
              className="rounded-md border border-wine-400/30 bg-wine-950/60 px-2 py-2 text-center"
            >
              <dt className="text-[11px] tracking-wider text-fg-muted uppercase">
                {aptitudeLabels[instinct]}
              </dt>
              <dd className="font-display text-xl text-fg">{sheet.instincts[instinct]}</dd>
            </div>
          ))}
        </dl>
      </header>
      <Tabs
        label="Ficha do Infectado"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: 'jogo',
            label: 'Jogo',
            content: (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="flex flex-col gap-5">
                  {tugCard}
                  {healthCard}
                </div>
                <div className="flex flex-col gap-5">
                  {testCard}
                  {originsCard}
                </div>
              </div>
            ),
          },
          {
            value: 'infectado',
            label: 'Infectado',
            content: (
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader
                    title="Aptidões"
                    description="Instintos rolam d6; Conhecimentos e Práticas, d10."
                  />
                  <div className="grid gap-5 md:grid-cols-3">
                    {aptitudeColumn('Instintos', 'instincts', INSTINCTS, 1, '6')}
                    {aptitudeColumn('Conhecimentos', 'knowledges', KNOWLEDGES, 0, '1')}
                    {aptitudeColumn('Práticas', 'practices', PRACTICES, 0, '1')}
                  </div>
                </Card>
                <div className="grid gap-5 lg:grid-cols-2">
                  {characteristicsCard}
                  {assimilationsCard}
                </div>
              </div>
            ),
          },
          { value: 'historia', label: 'História', content: identityCard },
          {
            value: 'personagem',
            label: 'Personagem',
            content: (
              <div className="flex flex-col gap-5">
                {editable && variant === 'full' ? (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      <PortraitCard
                        characterId={character.id}
                        name={character.name}
                        portraitPath={character.portraitPath}
                        portraitUrl={character.portraitUrl}
                        onVersion={setVersion}
                      />
                      <ImagePromptCard prompt={characterImagePrompt(imageInput)} />
                    </div>
                    <div className="flex flex-col gap-3">
                      <TokenImageCard
                        characterId={character.id}
                        portraitUrl={character.portraitUrl}
                      />
                      <ImagePromptCard variant="token" prompt={characterTokenPrompt(imageInput)} />
                    </div>
                  </div>
                ) : null}
                {shareCard}
                {permissions.isOwner && campaigns ? (
                  <CampaignLinkCard
                    characterId={character.id}
                    currentCampaign={character.campaign}
                    campaigns={campaigns}
                    issuesFor={(campaign) =>
                      assimilacaoCampaignIssues(
                        { name: character.name, sheet },
                        parseAssimilacaoCampaignRules(campaign.characterRules),
                      )
                    }
                  />
                ) : null}
                {permissions.isOwner && variant === 'full' ? (
                  <DeleteCharacterCard
                    characterId={character.id}
                    name={character.name}
                    portraitPath={character.portraitPath}
                  />
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
