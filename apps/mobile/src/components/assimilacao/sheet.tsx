import {
  adjustCharacterResource,
  saveCharacterSheet,
  type CharacterResource,
} from '@codexveil/database';
import type { TrackOperation } from '@codexveil/domain';
import {
  ASSIMILACAO_RESOURCE_KEYS,
  ASSIMILATION_KINDS,
  HEALTH_LEVEL_TITLES,
  INSTINCTS,
  KNOWLEDGES,
  PRACTICES,
  aptitudeLabels,
  assimilationKindLabels,
  diceFromGroups,
  healthPerLevel,
  healthState,
  loseDetermination,
  planTest,
  poolExpression,
  safeAssimilacaoBookEntryData,
  suggestKeep,
  sumFaces,
  tugOfWar,
  type AssimilacaoSheet,
  type Instinct,
  type Knowledge,
  type Practice,
  type RolledDie,
} from '@codexveil/rpg-systems/assimilacao';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AssimSymbol, withAssimSymbols } from '@/components/assimilacao/symbols';
import { DiceProvider, useDice } from '@/components/dice/dice';
import { Button } from '@/components/ui/button';
import { CheckRow, Chip } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';
import type { AssimilacaoMobileSource } from './wizard';

interface Props {
  character: { id: string; name: string; version: number };
  campaignId: string | null;
  sheet: AssimilacaoSheet;
  resources: CharacterResource[];
  canEditSheet: boolean;
  canEditPlay: boolean;
  sources: readonly AssimilacaoMobileSource[];
}

export function AssimilacaoMobileSheet(props: Props) {
  return (
    <DiceProvider
      campaignId={props.campaignId}
      characterId={props.character.id}
      enabled={props.canEditPlay}
    >
      <Body {...props} />
    </DiceProvider>
  );
}

type Tab = 'jogo' | 'infectado' | 'historia';
const SECOND = [...KNOWLEDGES, ...PRACTICES] as const;

function Symbols({ result }: { result: { sucesso: number; adaptacao: number; pressao: number } }) {
  const total = result.sucesso + result.adaptacao + result.pressao;
  if (!total) return <AppText variant="small">—</AppText>;
  return (
    <AppText>
      {Array.from({ length: result.sucesso }, (_, i) => (
        <AssimSymbol key={`a${i}`} code="A" />
      ))}
      {Array.from({ length: result.adaptacao }, (_, i) => (
        <AssimSymbol key={`b${i}`} code="B" />
      ))}
      {Array.from({ length: result.pressao }, (_, i) => (
        <AssimSymbol key={`c${i}`} code="C" />
      ))}
    </AppText>
  );
}

function Body({
  character,
  sheet: initial,
  resources: initialResources,
  canEditSheet,
  canEditPlay,
  sources,
}: Props) {
  const toast = useToast();
  const dice = useDice();
  const [tab, setTab] = useState<Tab>('jogo');
  const [sheet, setSheet] = useState(initial);
  const [version, setVersion] = useState(character.version);
  const [resources, setResources] = useState(initialResources);
  const track = (key: string) => resources.find((entry) => entry.key === key) ?? null;
  const health = track(ASSIMILACAO_RESOURCE_KEYS.health);
  const determination = track(ASSIMILACAO_RESOURCE_KEYS.determination);
  const assimilation = track(ASSIMILACAO_RESOURCE_KEYS.assimilation);
  const tug = tugOfWar(sheet);
  const state = healthState(sheet, health?.current ?? healthPerLevel(sheet) * 6);

  const save = async (next: AssimilacaoSheet) => {
    const previous = sheet;
    setSheet(next);
    try {
      const saved = await saveCharacterSheet(getSupabase(), character.id, version, { sheet: next });
      setVersion(saved.version);
      return true;
    } catch (error) {
      setSheet(previous);
      toast({ tone: 'danger', title: 'A ficha não foi salva', description: failureMessage(error) });
      return false;
    }
  };
  const adjust = async (
    entry: CharacterResource | null,
    operation: TrackOperation,
    amount: number,
  ) => {
    if (!entry || !canEditPlay || amount < 0) return;
    try {
      const saved = await adjustCharacterResource(getSupabase(), entry.id, operation, amount);
      setResources((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível atualizar',
        description: failureMessage(error),
      });
    }
  };
  const loseDet = async (amount: number) => {
    if (!determination) return;
    const result = loseDetermination(
      sheet.tugOfWar.determinationLevel,
      determination.current,
      amount,
    );
    if (result.levelsLost > 0) {
      if (
        !(await save({
          ...sheet,
          tugOfWar: { determinationLevel: result.determinationLevel, locked: true, rested: false },
        }))
      )
        return;
      await adjust(determination, 'set_max', result.determinationLevel);
      await adjust(determination, 'set_current', 0);
      await adjust(assimilation, 'set_max', 10 - result.determinationLevel);
      await adjust(
        assimilation,
        'set_current',
        Math.min(10 - result.determinationLevel, (assimilation?.current ?? 0) + result.levelsLost),
      );
      toast({
        tone: 'warning',
        title: 'A Assimilação avançou',
        description: `Determinação ${result.determinationLevel} · Assimilação ${10 - result.determinationLevel}.`,
      });
    } else {
      await adjust(determination, 'set_current', result.determinationPoints);
    }
  };
  const clarity = async () => {
    const level = Math.min(10, sheet.tugOfWar.determinationLevel + 1);
    if (
      !(await save({
        ...sheet,
        tugOfWar: { determinationLevel: level, locked: false, rested: false },
      }))
    )
      return;
    await adjust(determination, 'set_max', level);
    await adjust(determination, 'set_current', level);
    await adjust(assimilation, 'set_max', 10 - level);
    await adjust(assimilation, 'set_current', Math.min(assimilation?.current ?? 0, 10 - level));
  };

  const [instinct, setInstinct] = useState<Instinct>('percepcao');
  const [second, setSecond] = useState<Knowledge | Practice | Instinct>('sobrevivencia');
  const [assimilated, setAssimilated] = useState(false);
  const [effort, setEffort] = useState(false);
  const [useEvent, setUseEvent] = useState(false);
  const [useOccupation, setUseOccupation] = useState(false);
  const [rolled, setRolled] = useState<{ dice: RolledDie[]; keep: number; kept: number[] } | null>(
    null,
  );
  const aptitude = assimilated
    ? INSTINCTS.includes(second as Instinct)
      ? second
      : instinct
    : second;
  const plan = planTest(sheet, {
    instinct,
    aptitude,
    assimilated,
    effort,
    origins: (useEvent ? 1 : 0) + (useOccupation ? 1 : 0),
  });

  const rollTest = async () => {
    if (!dice) return;
    const label = `${aptitudeLabels[instinct]} + ${aptitudeLabels[aptitude]}${assimilated ? ' (Assimilada)' : ''}`;
    const shown = await dice.roll({
      expression: poolExpression(plan.pool),
      label: `Assimilação · ${label} · mantém ${plan.keep}`,
    });
    if (!shown) return;
    const result = diceFromGroups(shown.dice);
    setRolled({ dice: result, keep: plan.keep, kept: suggestKeep(result, plan.keep) });
    if (effort) await loseDet(1);
    if (assimilated) {
      if (assimilation && assimilation.current > 0) await adjust(assimilation, 'spend', 1);
      else await loseDet(2);
    }
    if (useEvent || useOccupation)
      void save({
        ...sheet,
        origins: {
          ...sheet.origins,
          eventUsed: sheet.origins.eventUsed || useEvent,
          occupationUsed: sheet.origins.occupationUsed || useOccupation,
        },
      });
    setEffort(false);
    setUseEvent(false);
    setUseOccupation(false);
  };
  const kept = rolled ? sumFaces(rolled.kept.map((index) => rolled.dice[index]!.result)) : null;

  const cards = useMemo(
    () =>
      sources.flatMap((source) =>
        source.entries.flatMap((entry) => {
          if (entry.kind !== 'assimilation') return [];
          const data = safeAssimilacaoBookEntryData('assimilation', entry.data);
          return data ? [{ name: entry.name, ...data }] : [];
        }),
      ),
    [sources],
  );
  const [newAssim, setNewAssim] = useState('');
  const [newChar, setNewChar] = useState('');

  const counter = (
    value: number,
    min: number,
    max: number,
    onChange: (next: number) => void,
    label: string,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
      <Button
        label="−"
        variant="ghost"
        compact
        disabled={!canEditSheet || value <= min}
        onPress={() => onChange(value - 1)}
        accessibilityLabel={`Diminuir ${label}`}
      />
      <AppText variant="number">{value}</AppText>
      <Button
        label="+"
        variant="ghost"
        compact
        disabled={!canEditSheet || value >= max}
        onPress={() => onChange(value + 1)}
        accessibilityLabel={`Aumentar ${label}`}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
      >
        <Segmented
          value={tab}
          onChange={setTab}
          accessibilityLabel="Partes da ficha"
          options={[
            { value: 'jogo', label: 'Jogo' },
            { value: 'infectado', label: 'Infectado' },
            { value: 'historia', label: 'História' },
          ]}
        />

        {tab === 'jogo' ? (
          <>
            <Card ornate>
              <AppText variant="heading">Cabo de Guerra</AppText>
              <AppText>
                Determinação {tug.determinationLevel} · Assimilação {tug.assimilationLevel}
              </AppText>
              <View
                style={{
                  flexDirection: 'row',
                  height: 10,
                  borderRadius: radii.full,
                  overflow: 'hidden',
                  backgroundColor: colors.sunken,
                }}
              >
                <View style={{ flex: tug.determinationLevel, backgroundColor: '#f59e0b' }} />
                <View style={{ flex: tug.assimilationLevel, backgroundColor: '#8b5cf6' }} />
              </View>
              <AppText>
                <AssimSymbol code="d" /> Determinação: {determination?.current ?? 0}/
                {tug.determinationLevel} · <AssimSymbol code="e" /> Assimilação:{' '}
                {assimilation?.current ?? 0}/{tug.assimilationLevel}
              </AppText>
              {sheet.tugOfWar.locked ? (
                <AppText variant="small" style={{ color: colors.danger }}>
                  Suscetível: Determinação bloqueada até a Assimilação se completar.{' '}
                  {sheet.tugOfWar.rested
                    ? 'Repouso feito: escolha a Assimilação na ficha e conclua.'
                    : 'A escolha é liberada depois do próximo repouso completo.'}
                </AppText>
              ) : null}
              {canEditPlay ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  <Button
                    label="Perder 1 d"
                    variant="secondary"
                    compact
                    onPress={() => void loseDet(1)}
                  />
                  <Button
                    label="Recuperar 1 d"
                    variant="ghost"
                    compact
                    onPress={() => void adjust(determination, 'heal', 1)}
                  />
                  <Button
                    label="Gastar 1 e"
                    variant="secondary"
                    compact
                    onPress={() => void adjust(assimilation, 'spend', 1)}
                  />
                  <Button
                    label="Fim de cena"
                    variant="ghost"
                    compact
                    onPress={() => void adjust(assimilation, 'set_current', tug.assimilationLevel)}
                  />
                  <Button
                    label="Clareza de Propósito"
                    variant="ghost"
                    compact
                    onPress={() => void clarity()}
                  />
                  <Button
                    label={`Repouso completo (+${1 + sheet.instincts.resolucao} d)`}
                    variant="ghost"
                    compact
                    onPress={() => {
                      // Suscetível: o repouso libera a escolha da Assimilação.
                      void (async () => {
                        if (sheet.tugOfWar.locked && !sheet.tugOfWar.rested)
                          await save({ ...sheet, tugOfWar: { ...sheet.tugOfWar, rested: true } });
                        void adjust(determination, 'heal', 1 + sheet.instincts.resolucao);
                      })();
                    }}
                  />
                  {sheet.tugOfWar.locked && canEditSheet ? (
                    <Button
                      label="Assimilação concluída"
                      variant="ghost"
                      compact
                      disabled={!sheet.tugOfWar.rested}
                      onPress={() =>
                        void save({
                          ...sheet,
                          tugOfWar: { ...sheet.tugOfWar, locked: false, rested: false },
                        })
                      }
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>

            <Card>
              <AppText variant="heading">Saúde</AppText>
              {state.level === 0 ? (
                <>
                  <View
                    accessibilityRole="alert"
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: 'rgba(120, 20, 28, 0.75)',
                      borderWidth: 1,
                      borderColor: 'rgba(226, 109, 90, 0.6)',
                    }}
                  >
                    <AppText variant="title" style={{ color: '#EC9384' }}>
                      Você morreu
                    </AppText>
                    <AppText variant="small">
                      A Saúde chegou a zero. Converse com o mestre sobre o destino do personagem.
                    </AppText>
                  </View>
                </>
              ) : null}
              {HEALTH_LEVEL_TITLES.map((title, index) => {
                const level = 6 - index;
                const filled =
                  level < state.level
                    ? state.perLevel
                    : level === state.level
                      ? state.pointsInLevel
                      : 0;
                return (
                  <AppText key={title} variant={level === state.level ? 'body' : 'small'}>
                    {level} · {title}: {'■'.repeat(filled)}
                    {'□'.repeat(state.perLevel - filled)}
                  </AppText>
                );
              })}
              <AppText variant="small">
                {state.penalty ? `Penalidade: −${state.penalty} Sucesso por teste. ` : ''}
                {state.actionCostsDetermination ? 'Agir custa 1 Ponto de Determinação.' : ''}
              </AppText>
              {canEditPlay ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  <Button
                    label="Dano 1"
                    variant="secondary"
                    compact
                    onPress={() => void adjust(health, 'damage', 1)}
                  />
                  <Button
                    label="Dano 3"
                    variant="secondary"
                    compact
                    onPress={() => void adjust(health, 'damage', 3)}
                  />
                  <Button
                    label={`Recuperação +${sheet.instincts.potencia + 1}`}
                    variant="ghost"
                    compact
                    onPress={() => void adjust(health, 'heal', sheet.instincts.potencia + 1)}
                  />
                </View>
              ) : null}
            </Card>

            {canEditPlay ? (
              <Card>
                <AppText variant="heading">Teste</AppText>
                <AppText variant="small">Instinto</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  {INSTINCTS.map((key) => (
                    <Chip
                      key={key}
                      label={`${aptitudeLabels[key]} ${sheet.instincts[key]}`}
                      selected={instinct === key}
                      onPress={() => setInstinct(key)}
                    />
                  ))}
                </View>
                <AppText variant="small">
                  {assimilated ? 'Segundo Instinto' : 'Conhecimento ou Prática'}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  {(assimilated ? INSTINCTS : SECOND).map((key) => (
                    <Chip
                      key={key}
                      label={`${aptitudeLabels[key]} ${(sheet.instincts as Record<string, number>)[key] ?? (sheet.knowledges as Record<string, number>)[key] ?? (sheet.practices as Record<string, number>)[key] ?? 0}`}
                      selected={second === key}
                      onPress={() => setSecond(key)}
                    />
                  ))}
                </View>
                <CheckRow
                  label="Agir por Instinto (Rolagem Assimilada)"
                  description="Tudo vira d12, mantém +1 dado, custa 1 ponto de Assimilação."
                  checked={assimilated}
                  onChange={(value) => {
                    setAssimilated(value);
                    setSecond(value ? instinct : 'sobrevivencia');
                  }}
                />
                <CheckRow
                  label="Empenho (+1 dado mantido, 1 d)"
                  checked={effort}
                  disabled={sheet.tugOfWar.locked}
                  onChange={setEffort}
                />
                <CheckRow
                  label={`Evento Marcante${sheet.origins.eventUsed ? ' (usado)' : ''}`}
                  checked={useEvent}
                  disabled={sheet.origins.eventUsed || !sheet.origins.event}
                  onChange={setUseEvent}
                />
                <CheckRow
                  label={`Ocupação${sheet.origins.occupationUsed ? ' (usada)' : ''}`}
                  checked={useOccupation}
                  disabled={sheet.origins.occupationUsed || !sheet.origins.occupation}
                  onChange={setUseOccupation}
                />
                <Button
                  label={`Rolar ${poolExpression(plan.pool)} · mantém ${plan.keep}`}
                  onPress={() => void rollTest()}
                  disabled={!dice}
                />
                {rolled ? (
                  <View style={{ gap: spacing[2] }}>
                    <AppText variant="small">
                      Toque para escolher {rolled.keep} {rolled.keep === 1 ? 'dado' : 'dados'}:
                    </AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                      {rolled.dice.map((die, index) => {
                        const selected = rolled.kept.includes(index);
                        return (
                          <Pressable
                            key={index}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            onPress={() =>
                              setRolled({
                                ...rolled,
                                kept: selected
                                  ? rolled.kept.filter((entry) => entry !== index)
                                  : rolled.kept.length < rolled.keep
                                    ? [...rolled.kept, index]
                                    : [...rolled.kept.slice(1), index],
                              })
                            }
                            style={{
                              minWidth: 52,
                              alignItems: 'center',
                              padding: spacing[2],
                              borderRadius: radii.md,
                              borderWidth: 1,
                              borderColor: selected ? colors.fgAccent : colors.line,
                              backgroundColor: selected ? colors.hover : colors.card,
                            }}
                          >
                            <AppText variant="small">{die.die}</AppText>
                            <Symbols result={die.result} />
                          </Pressable>
                        );
                      })}
                    </View>
                    {kept ? (
                      <AppText>
                        Mantido:{' '}
                        <Symbols
                          result={{ ...kept, sucesso: Math.max(0, kept.sucesso - state.penalty) }}
                        />
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            ) : null}

            <Card>
              <AppText variant="heading">Origens</AppText>
              <AppText>Evento Marcante: {sheet.origins.event || '—'}</AppText>
              <AppText>Ocupação: {sheet.origins.occupation || '—'}</AppText>
              {canEditPlay && (sheet.origins.eventUsed || sheet.origins.occupationUsed) ? (
                <Button
                  label="Nova sessão: liberar Origens"
                  variant="ghost"
                  compact
                  onPress={() =>
                    void save({
                      ...sheet,
                      origins: { ...sheet.origins, eventUsed: false, occupationUsed: false },
                    })
                  }
                />
              ) : null}
              <AppText variant="heading">Propósitos</AppText>
              {[...sheet.purposes.personal, ...sheet.purposes.collective].map((purpose, index) =>
                purpose.text ? (
                  <AppText key={index}>
                    • {purpose.text}
                    {purpose.inert ? ' (Inerte)' : ''}
                  </AppText>
                ) : null,
              )}
            </Card>
          </>
        ) : null}

        {tab === 'infectado' ? (
          <>
            <Card>
              <AppText variant="heading">Aptidões</AppText>
              {(
                [
                  ['Instintos (d6)', 'instincts', INSTINCTS, 1],
                  ['Conhecimentos (d10)', 'knowledges', KNOWLEDGES, 0],
                  ['Práticas (d10)', 'practices', PRACTICES, 0],
                ] as const
              ).map(([title, group, keys, min]) => (
                <View key={group} style={{ gap: 2 }}>
                  <AppText variant="eyebrow">{title}</AppText>
                  {keys.map((key) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <AppText>{aptitudeLabels[key]}</AppText>
                      {counter(
                        (sheet[group] as Record<string, number>)[key] ?? min,
                        min,
                        5,
                        (next) =>
                          void save({
                            ...sheet,
                            [group]: { ...(sheet[group] as Record<string, number>), [key]: next },
                          }),
                        aptitudeLabels[key],
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </Card>
            <Card>
              <AppText variant="heading">Características</AppText>
              {sheet.characteristics.map((entry, index) => (
                <View key={`${entry.name}-${index}`} style={{ gap: 2 }}>
                  <AppText style={{ fontWeight: '600' }}>
                    {entry.name} · {entry.cost} XP
                  </AppText>
                  {entry.notes ? (
                    <AppText variant="small">{withAssimSymbols(entry.notes)}</AppText>
                  ) : null}
                  {canEditSheet ? (
                    <Button
                      label="Tirar"
                      variant="ghost"
                      compact
                      onPress={() =>
                        void save({
                          ...sheet,
                          characteristics: sheet.characteristics.filter(
                            (_, position) => position !== index,
                          ),
                        })
                      }
                    />
                  ) : null}
                </View>
              ))}
              {canEditSheet ? (
                <>
                  <Field
                    label="Nova Característica"
                    value={newChar}
                    onChangeText={setNewChar}
                    maxLength={120}
                  />
                  <Button
                    label="Adicionar"
                    variant="secondary"
                    compact
                    disabled={!newChar.trim()}
                    onPress={() => {
                      void save({
                        ...sheet,
                        characteristics: [
                          ...sheet.characteristics,
                          { name: newChar.trim(), cost: 1, notes: '' },
                        ],
                      });
                      setNewChar('');
                    }}
                  />
                </>
              ) : null}
            </Card>
            <Card>
              <AppText variant="heading">Assimilações</AppText>
              {sheet.assimilations.map((entry, index) => {
                const card = cards.find((item) => item.name === entry.name);
                return (
                  <View
                    key={`${entry.name}-${index}`}
                    style={{
                      gap: 4,
                      borderTopWidth: 1,
                      borderColor: colors.line,
                      paddingTop: spacing[2],
                    }}
                  >
                    <AppText style={{ fontWeight: '600' }}>
                      {entry.name} · {assimilationKindLabels[entry.kind]}
                    </AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                      <AppText>
                        <AssimSymbol code="C" /> Pressões
                      </AppText>
                      {counter(
                        entry.pressures,
                        0,
                        10,
                        (next) =>
                          void save({
                            ...sheet,
                            assimilations: sheet.assimilations.map((item, position) =>
                              position === index ? { ...item, pressures: next } : item,
                            ),
                          }),
                        'Pressões',
                      )}
                    </View>
                    {card?.levels.map((level) => (
                      <AppText key={level.name} variant="small">
                        {(['A', 'B', 'C'] as const).flatMap((code) =>
                          Array.from({ length: level.cost[code] }, (_, i) => (
                            <AssimSymbol key={`${code}${i}`} code={code} />
                          )),
                        )}{' '}
                        {level.name}: {withAssimSymbols(level.text)}
                      </AppText>
                    ))}
                    {canEditSheet ? (
                      <Button
                        label="Tirar"
                        variant="ghost"
                        compact
                        onPress={() =>
                          void save({
                            ...sheet,
                            assimilations: sheet.assimilations.filter(
                              (_, position) => position !== index,
                            ),
                          })
                        }
                      />
                    ) : null}
                  </View>
                );
              })}
              {canEditSheet ? (
                cards.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                    {ASSIMILATION_KINDS.flatMap((kind) =>
                      cards.filter((card) => card.kind === kind),
                    ).map((card) => (
                      <Chip
                        key={card.name}
                        label={`${card.rank} ${card.name.replace('Assimilação ', '')}`}
                        selected={false}
                        role="button"
                        onPress={() =>
                          void save({
                            ...sheet,
                            assimilations: [
                              ...sheet.assimilations,
                              { name: card.name, kind: card.kind, pressures: 0, notes: '' },
                            ],
                          })
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <>
                    <Field
                      label="Nova Assimilação"
                      value={newAssim}
                      onChangeText={setNewAssim}
                      maxLength={120}
                    />
                    <Button
                      label="Adicionar"
                      variant="secondary"
                      compact
                      disabled={!newAssim.trim()}
                      onPress={() => {
                        void save({
                          ...sheet,
                          assimilations: [
                            ...sheet.assimilations,
                            { name: newAssim.trim(), kind: 'evolutiva', pressures: 0, notes: '' },
                          ],
                        });
                        setNewAssim('');
                      }}
                    />
                  </>
                )
              ) : null}
            </Card>
          </>
        ) : null}

        {tab === 'historia' ? (
          <Card>
            {(['appearance', 'personality', 'backstory'] as const).map((field) => (
              <Field
                key={field}
                label={
                  { appearance: 'Aparência', personality: 'Personalidade', backstory: 'História' }[
                    field
                  ]
                }
                multiline
                editable={canEditSheet}
                value={sheet.identity[field]}
                onChangeText={(value) =>
                  setSheet({ ...sheet, identity: { ...sheet.identity, [field]: value } })
                }
                onBlur={() => void save(sheet)}
              />
            ))}
            <Field
              label="Anotações"
              multiline
              editable={canEditSheet}
              value={sheet.notes}
              onChangeText={(notes) => setSheet({ ...sheet, notes })}
              onBlur={() => void save(sheet)}
            />
          </Card>
        ) : null}
      </ScrollView>
      {state.level === 0 ? <DeathVignette /> : null}
    </View>
  );
}

/** Bordas da tela avermelhadas enquanto a Saúde está zerada (por cima de tudo, sem tocar). */
function DeathVignette() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="morte" cx="50%" cy="50%" r="75%">
            <Stop offset="55%" stopColor="#a0141e" stopOpacity={0} />
            <Stop offset="100%" stopColor="#a0141e" stopOpacity={0.7} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#morte)" />
      </Svg>
    </View>
  );
}
