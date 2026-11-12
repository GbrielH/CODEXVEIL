'use client';

import {
  adjustCharacterResource,
  saveCharacterSheet,
  type CharacterResource,
} from '@codexveil/database';
import type { TrackOperation } from '@codexveil/domain';
import {
  ORDEM2_ARMOR_REDUCTION,
  ORDEM2_ATTRIBUTES,
  ORDEM2_CONTROL_FEAR_COST,
  ORDEM2_EMBRACE_FEAR_COST,
  ORDEM2_FUMBLE_TABLE,
  ORDEM2_INJURY_TABLE,
  ORDEM2_RELATION_BENEFITS,
  ORDEM2_TRAUMA_TABLE,
  ordem2AttributeLabels,
  ordem2ControlFear,
  ordem2Damage,
  ordem2Expression,
  ordem2GainFear,
  ordem2InjuryRow,
  ordem2InjuryTestOutcome,
  ordem2ProfileLabels,
  ordem2RelationDie,
  ordem2RelationGradeLabels,
  ordem2RepeatedDc,
  ordem2SheetTest,
  ordem2SkillAttribute,
  ordem2SkillLabel,
  ordem2SkillPenalty,
  ordem2SkillsFor,
  ordem2TableRow,
  ordem2TestDice,
  ordem2TierLabels,
  ordem2TraumaRow,
  resolveOrdem2Test,
  type Ordem2Attribute,
  type Ordem2Die,
  type Ordem2Sheet,
  type Ordem2TableRow,
  type Ordem2TestResult,
} from '@codexveil/rpg-systems/ordem2';
import { Dices, Minus, Plus, Shield, Skull } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DiceProvider, useDice } from '@/components/dice/dice-roller';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  Ordem2GearEditor,
  Ordem2IdentityEditor,
  Ordem2RelationsEditor,
  Ordem2StatsEditor,
} from './editor';

interface Props {
  character: {
    id: string;
    name: string;
    version: number;
    campaign: { id: string; name: string } | null;
  };
  sheet: Ordem2Sheet;
  resources: CharacterResource[];
  permissions: { canEditSheet: boolean; canEditPlay: boolean; isGm: boolean; isOwner: boolean };
  /** DT padrão da campanha (7 no playtest). */
  defaultDc?: number;
  variant?: 'full' | 'campaign';
  extra?: ReactNode;
}

export function Ordem2SheetScreen(props: Props) {
  return (
    <DiceProvider
      campaignId={props.variant === 'campaign' ? (props.character.campaign?.id ?? null) : null}
      characterId={props.character.id}
      enabled={props.permissions.canEditPlay}
      sessionGate={props.variant === 'campaign'}
    >
      <Ordem2SheetBody {...props} />
    </DiceProvider>
  );
}

interface LastTest {
  title: string;
  dice: Ordem2Die[];
  fearDie: Ordem2Die | 0;
  result: Ordem2TestResult;
  damage?: { formula: string; value: number };
  outcome?: string;
  table?: {
    title: string;
    roll: number;
    row: Ordem2TableRow;
    kind: 'injury' | 'trauma' | 'fumble';
  };
}

function Ordem2SheetBody({
  character,
  sheet: initial,
  resources: initialResources,
  permissions,
  defaultDc = 7,
  extra,
}: Props) {
  const { toast } = useToast();
  const dice = useDice();
  const [sheet, setSheet] = useState(initial);
  const [version, setVersion] = useState(character.version);
  const [resources, setResources] = useState(initialResources);
  const [tab, setTab] = useState('jogo');
  const [dc, setDc] = useState(defaultDc);
  const [steps, setSteps] = useState(0);
  const [bonus, setBonus] = useState<Ordem2Die | 0>(0);
  const [useFear, setUseFear] = useState(true);
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<LastTest | null>(null);
  const [amount, setAmount] = useState(1);
  const canPlay = permissions.canEditPlay;
  const canEdit = permissions.canEditSheet;

  const save = async (next: Ordem2Sheet): Promise<boolean> => {
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

  const track = (key: string) => resources.find((entry) => entry.key === key) ?? null;
  const adjust = async (key: string, operation: TrackOperation, value: number) => {
    const resource = track(key);
    if (!resource || !canPlay || value < 0) return;
    try {
      const saved = await adjustCharacterResource(
        getSupabaseBrowserClient(),
        resource.id,
        operation,
        value,
      );
      setResources((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível atualizar',
        description: failureMessage(error, 'Tente de novo.'),
      });
    }
  };

  /** Mudanças de PV/PD máximos e de armadura também ajustam as trilhas. */
  const saveSheet = async (next: Ordem2Sheet) => {
    const ok = await save(next);
    if (!ok) return;
    if (next.maxHitPoints !== track('hp')?.max) await adjust('hp', 'set_max', next.maxHitPoints);
    if (next.maxDetermination !== track('pd')?.max)
      await adjust('pd', 'set_max', next.maxDetermination);
    const armor = next.equipment.reduce((sum, item) => sum + item.armor, 0);
    if (armor !== track('armor')?.max) await adjust('armor', 'set_max', armor);
  };

  /** Rola os dados de um teste no servidor (mural da mesa) e, se houver, o dado de pavor. */
  const rollDice = async (testDice: Ordem2Die[], fearDie: Ordem2Die | 0, label: string) => {
    const shown = await dice?.roll({ expression: ordem2Expression(testDice), label, secret });
    const values = shown?.dice.flatMap((group) => group.values) ?? [];
    if (values.length !== testDice.length) return null;
    let fear: number | null = null;
    if (fearDie) {
      const fearShown = await dice?.roll({
        expression: `1d${fearDie}`,
        label: `${label} · dado de pavor`,
        secret,
      });
      fear = fearShown?.dice[0]?.values[0] ?? null;
    }
    return { values, fear };
  };

  const runTest = async (
    title: string,
    testDice: Ordem2Die[],
    fearDie: Ordem2Die | 0,
    options: { dc: number | null; modifier?: number; weapon?: string },
  ) => {
    if (!canPlay || busy) return null;
    setBusy(true);
    try {
      const rolled = await rollDice(testDice, fearDie, title);
      if (!rolled) return null;
      const result = resolveOrdem2Test(rolled.values, {
        dc: options.dc,
        fear: rolled.fear,
        modifier: options.modifier ?? 0,
      });
      const test: LastTest = { title, dice: testDice, fearDie, result };
      if (options.weapon !== undefined && (result.success || options.dc === null))
        test.damage = {
          formula: options.weapon || 'RA',
          value: ordem2Damage(result, options.weapon || 'RA'),
        };
      setLast(test);
      setSteps(0);
      setBonus(0);
      if (result.fearEnds && sheet.fearDie) await save({ ...sheet, fearDie: 0 });
      return test;
    } finally {
      setBusy(false);
    }
  };

  const testSkill = (skill: string, attribute?: Ordem2Attribute, weapon?: string) => {
    const base = attribute ?? ordem2SkillAttribute(skill);
    const test = ordem2SheetTest(sheet, skill, {
      steps,
      bonusDice: bonus ? [bonus] : [],
      fear: useFear,
      attribute: base,
    });
    const label = `${ordem2SkillLabel(skill, sheet.setting)} (${ordem2AttributeLabels[base]} d${sheet.attributes[base]} + d${sheet.skills[skill]?.die ?? 4})`;
    return runTest(weapon !== undefined ? `Ataque · ${label}` : label, test.dice, test.fearDie, {
      dc,
      modifier: ordem2SkillPenalty(sheet, skill),
      ...(weapon !== undefined ? { weapon } : {}),
    });
  };

  const rollTable = async (kind: 'injury' | 'trauma' | 'fumble') => {
    const sides = kind === 'fumble' ? 8 : 20;
    const title =
      kind === 'injury'
        ? 'Tabela de lesões'
        : kind === 'trauma'
          ? 'Tabela de traumas'
          : 'Efeito da falha crítica';
    const shown = await dice?.roll({ expression: `1d${sides}`, label: title, secret });
    const roll = shown?.dice[0]?.values[0];
    if (!roll) return;
    const row =
      kind === 'injury'
        ? ordem2InjuryRow(roll, sheet.tier)
        : kind === 'trauma'
          ? ordem2TraumaRow(roll, sheet.tier)
          : ordem2TableRow(ORDEM2_FUMBLE_TABLE, roll);
    setLast((current) => (current ? { ...current, table: { title, roll, row, kind } } : current));
  };

  /** Teste de lesão (Físico + Vigor) ou de trauma (Emoção + Disciplina): DT 7, +3 por teste na cena. */
  const deathTest = async (kind: 'injury' | 'trauma') => {
    const attribute: Ordem2Attribute = kind === 'injury' ? 'fisico' : 'emocao';
    const skill = kind === 'injury' ? 'vigor' : 'disciplina';
    const previous = kind === 'injury' ? sheet.sceneInjuryTests : sheet.sceneTraumaTests;
    const testDc = ordem2RepeatedDc(previous);
    const test = ordem2SheetTest(sheet, skill, { fear: useFear, attribute });
    const title = `Teste de ${kind === 'injury' ? 'lesão' : 'trauma'} (DT ${testDc})`;
    const done = await runTest(title, test.dice, test.fearDie, {
      dc: testDc,
      modifier: ordem2SkillPenalty(sheet, skill),
    });
    if (!done) return;
    await save({
      ...sheet,
      ...(kind === 'injury'
        ? { sceneInjuryTests: previous + 1 }
        : { sceneTraumaTests: previous + 1 }),
    });
    const outcome =
      kind === 'injury'
        ? {
            recupera: 'Sucesso crítico: recupera 1 PV e sai de inconsciente/moribundo.',
            moribundo:
              'Sucesso: fica inconsciente e moribundo (teste de lesão no fim de cada rodada).',
            lesao: 'Falha: sofre uma lesão. Role na tabela de lesões.',
            morte: 'Falha crítica: o personagem morre.',
          }[ordem2InjuryTestOutcome(done.result)]
        : done.result.success
          ? 'Sucesso: nenhum efeito.'
          : 'Falha: sofre um trauma. Role na tabela de traumas.';
    setLast({ ...done, outcome });
  };

  const applyTableRow = async (row: Ordem2TableRow, kind: 'injury' | 'trauma' | 'fumble') => {
    if (kind === 'trauma' && row.key === 'panico') {
      await save({ ...sheet, fearDie: ordem2GainFear(sheet.fearDie) });
      return;
    }
    if (!row.permanent || kind === 'fumble') return;
    const field = kind === 'injury' ? 'injuries' : 'traumas';
    const next = { ...sheet, [field]: [...sheet[field], row.key] };
    if (row.maxHitPoints) next.maxHitPoints = Math.max(1, next.maxHitPoints + row.maxHitPoints);
    if (row.maxDetermination)
      next.maxDetermination = Math.max(1, next.maxDetermination + row.maxDetermination);
    await saveSheet(next);
  };

  const hp = track('hp');
  const pd = track('pd');
  const armor = track('armor');
  const skills = ordem2SkillsFor(sheet.setting);
  const weapons = sheet.equipment.filter(
    (item) => item.kind === 'corpo-a-corpo' || item.kind === 'distancia',
  );
  const preview = ordem2TestDice(sheet.attributes.fisico, 4, {
    steps,
    bonusDice: bonus ? [bonus] : [],
  });

  const resourceCard = (resource: CharacterResource | null, label: string, icon: ReactNode) =>
    resource ? (
      <div className="flex flex-col gap-2 rounded-md border border-line bg-sunken p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-display text-lg">
            {icon}
            {label}
          </span>
          <span className="tabular text-xl text-fg">
            {resource.current}
            <span className="text-sm text-fg-muted"> / {resource.max ?? '—'}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={!canPlay}
            icon={<Minus className="h-4 w-4" aria-hidden="true" />}
            onClick={() =>
              void adjust(resource.key, resource.key === 'armor' ? 'spend' : 'damage', amount)
            }
          >
            {resource.key === 'armor' ? 'Gastar' : 'Perder'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canPlay}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void adjust(resource.key, 'heal', amount)}
          >
            Recuperar
          </Button>
        </div>
      </div>
    ) : null;

  const playTab = (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Vida, determinação e armadura"
          description={`Gastar 1 ponto de armadura (ação livre) reduz um dano em ${ORDEM2_ARMOR_REDUCTION}.`}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {resourceCard(hp, 'PV', <Skull className="h-4 w-4" aria-hidden="true" />)}
          {resourceCard(pd, 'PD', <Dices className="h-4 w-4" aria-hidden="true" />)}
          {resourceCard(armor, 'Armadura', <Shield className="h-4 w-4" aria-hidden="true" />)}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <TextField
            id="ordem2-amount"
            label="Quantidade"
            type="number"
            min={0}
            max={999}
            value={amount}
            onChange={(event) =>
              setAmount(Math.max(0, Math.trunc(Number(event.target.value) || 0)))
            }
            fieldClassName="w-28"
          />
          <TextField
            id="ordem2-nonlethal"
            label="Dano não letal"
            type="number"
            min={0}
            max={999}
            value={sheet.nonLethal}
            disabled={!canPlay}
            onChange={(event) =>
              void save({
                ...sheet,
                nonLethal: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
              })
            }
            fieldClassName="w-32"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Dado de pavor"
          description="Rolado junto em todo teste: anula resultados menores que ele. Tirar 1 encerra o pavor."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={sheet.fearDie ? 'danger' : 'neutral'}>
            {sheet.fearDie ? `d${sheet.fearDie}` : 'Sem pavor'}
          </Badge>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canPlay}
            onClick={() => void save({ ...sheet, fearDie: ordem2GainFear(sheet.fearDie) })}
          >
            Receber pavor
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canPlay || !sheet.fearDie || (pd?.current ?? 0) < ORDEM2_CONTROL_FEAR_COST}
            onClick={async () => {
              await adjust('pd', 'spend', ORDEM2_CONTROL_FEAR_COST);
              await save({ ...sheet, fearDie: ordem2ControlFear(sheet.fearDie) });
            }}
          >
            Controlar (1 PD)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canPlay || !sheet.fearDie || (pd?.current ?? 0) < ORDEM2_EMBRACE_FEAR_COST}
            onClick={async () => {
              const die = sheet.fearDie;
              if (!die) return;
              await adjust('pd', 'spend', ORDEM2_EMBRACE_FEAR_COST);
              setBonus(die);
              setUseFear(false);
              toast({ tone: 'success', title: `d${die} vira dado bônus no próximo teste` });
            }}
          >
            Abraçar (5 PD: vira bônus)
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Testes"
          description="Dado do atributo + dado da perícia (até 4 dados, somam os 3 maiores). Dois dados iguais de 6 ou mais = crítico; todos em 1 = falha crítica."
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <TextField
            id="ordem2-dc"
            label="DT"
            type="number"
            min={1}
            max={40}
            value={dc}
            onChange={(event) => setDc(Math.max(1, Math.trunc(Number(event.target.value) || 7)))}
          />
          <SelectField
            id="ordem2-steps"
            label="Passos"
            value={String(steps)}
            onChange={(event) => setSteps(Number(event.target.value))}
          >
            {[-3, -2, -1, 0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value > 0
                  ? `+${value} aumento${value > 1 ? 's' : ''}`
                  : value < 0
                    ? `${value} redução${value < -1 ? 'ões' : ''}`
                    : 'Nenhum'}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="ordem2-bonus"
            label="Dado bônus"
            value={String(bonus)}
            onChange={(event) => setBonus(Number(event.target.value) as Ordem2Die | 0)}
          >
            <option value={0}>Nenhum</option>
            {[4, 6, 8, 10, 12].map((die) => (
              <option key={die} value={die}>
                +1d{die}
              </option>
            ))}
          </SelectField>
          <div className="flex flex-col justify-end gap-1">
            <CheckboxField
              id="ordem2-fear"
              label="Rolar pavor"
              checked={useFear && Boolean(sheet.fearDie)}
              disabled={!sheet.fearDie}
              onChange={(event) => setUseFear(event.target.checked)}
            />
            <CheckboxField
              id="ordem2-secret"
              label="Secreta"
              checked={secret}
              onChange={(event) => setSecret(event.target.checked)}
            />
          </div>
        </div>
        {preview.wastedSteps ? (
          <Alert tone="info" className="mt-3">
            Os dados já estão no limite: {preview.wastedSteps} passo(s) não contam.
          </Alert>
        ) : null}
        <div className="mt-4 grid gap-1 sm:grid-cols-2">
          {skills.map((skill) => {
            const penalty = ordem2SkillPenalty(sheet, skill.key);
            return (
              <button
                key={skill.key}
                type="button"
                disabled={!canPlay || busy}
                onClick={() => void testSkill(skill.key)}
                className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-left text-sm transition-colors hover:border-parchment-300/60 hover:bg-hover disabled:opacity-60"
              >
                <span>
                  {skill.labels[sheet.setting]}
                  {penalty ? (
                    <span className="ml-1 text-xs text-fg-muted">
                      ({penalty > 0 ? '+' : ''}
                      {penalty})
                    </span>
                  ) : null}
                </span>
                <span className="tabular text-fg-muted">
                  {ordem2AttributeLabels[skill.attribute].slice(0, 3)} d
                  {sheet.attributes[skill.attribute]} + d{sheet.skills[skill.key]?.die ?? 4}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ORDEM2_ATTRIBUTES.map((attribute) => (
            <Button
              key={attribute}
              size="sm"
              variant="ghost"
              disabled={!canPlay || busy}
              onClick={() =>
                void runTest(
                  `${ordem2AttributeLabels[attribute]} puro`,
                  ordem2TestDice(sheet.attributes[attribute], 4, {
                    steps,
                    bonusDice: bonus ? [bonus] : [],
                  }).dice,
                  useFear ? sheet.fearDie : 0,
                  { dc },
                )
              }
            >
              {ordem2AttributeLabels[attribute]} + d4
            </Button>
          ))}
        </div>
      </Card>

      {weapons.length ? (
        <Card>
          <CardHeader
            title="Ataques"
            description="Corpo a corpo usa Luta; à distância, Pontaria. Dano = rolagem alta + arma (no crítico, soma a segunda maior)."
          />
          <div className="flex flex-wrap gap-2">
            {weapons.map((item, index) => (
              <Button
                key={index}
                variant="secondary"
                disabled={!canPlay || busy}
                onClick={() =>
                  void testSkill(
                    item.kind === 'distancia' ? 'pontaria' : 'luta',
                    undefined,
                    item.damage || 'RA',
                  )
                }
              >
                {item.name} {item.damage ? `(${item.damage})` : ''}
              </Button>
            ))}
            <Button
              variant="ghost"
              disabled={!canPlay || busy}
              onClick={() => void testSkill('luta', undefined, 'RB')}
            >
              Desarmado (RB)
            </Button>
          </div>
        </Card>
      ) : null}

      {last ? (
        <LastTestCard last={last} onTable={rollTable} onApply={applyTableRow} canPlay={canPlay} />
      ) : null}

      <Card>
        <CardHeader
          title="Ferimentos e traumas"
          description={`Lesão: Físico + Vigor (DT ${ordem2RepeatedDc(sheet.sceneInjuryTests)}). Trauma: Emoção + Disciplina (DT ${ordem2RepeatedDc(sheet.sceneTraumaTests)}). A DT sobe 3 a cada teste na cena.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!canPlay || busy}
            onClick={() => void deathTest('injury')}
          >
            Teste de lesão
          </Button>
          <Button
            variant="secondary"
            disabled={!canPlay || busy}
            onClick={() => void deathTest('trauma')}
          >
            Teste de trauma
          </Button>
          <Button
            variant="ghost"
            disabled={!canPlay}
            onClick={() => void save({ ...sheet, sceneInjuryTests: 0, sceneTraumaTests: 0 })}
          >
            Nova cena (zera as DTs)
          </Button>
        </div>
        {sheet.injuries.length || sheet.traumas.length ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {sheet.injuries.map((key, index) => {
              const row = ORDEM2_INJURY_TABLE.find((entry) => entry.key === key);
              return (
                <Sequel
                  key={`i${index}`}
                  label={row?.label ?? key}
                  text={row?.text ?? ''}
                  disabled={!canEdit}
                  onRemove={() =>
                    void saveSheet({
                      ...sheet,
                      injuries: sheet.injuries.filter((_, position) => position !== index),
                    })
                  }
                />
              );
            })}
            {sheet.traumas.map((key, index) => {
              const row = ORDEM2_TRAUMA_TABLE.find((entry) => entry.key === key);
              return (
                <Sequel
                  key={`t${index}`}
                  label={row?.label ?? key}
                  text={row?.text ?? ''}
                  disabled={!canEdit}
                  onRemove={() =>
                    void saveSheet({
                      ...sheet,
                      traumas: sheet.traumas.filter((_, position) => position !== index),
                    })
                  }
                />
              );
            })}
          </ul>
        ) : null}
      </Card>

      {sheet.relations.length ? (
        <Card>
          <CardHeader
            title="Relações"
            description="Invocar uma relação dá um benefício do grau dela; cada relação só pode ser invocada uma vez por missão."
          />
          <ul className="flex flex-col gap-3">
            {sheet.relations.map((relation, index) => (
              <li
                key={index}
                className={cx(
                  'rounded-md border border-line p-3',
                  relation.invoked && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-lg">{relation.name}</span>
                  <Badge tone="parchment">{ordem2RelationGradeLabels[relation.grade]}</Badge>
                </div>
                <ul className="mt-1 list-disc pl-5 text-sm text-fg-secondary">
                  {ORDEM2_RELATION_BENEFITS[relation.grade].map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canPlay || relation.invoked}
                    onClick={() => {
                      setBonus(ordem2RelationDie[relation.grade]);
                      void save({
                        ...sheet,
                        relations: sheet.relations.map((entry, position) =>
                          position === index ? { ...entry, invoked: true } : entry,
                        ),
                      });
                    }}
                  >
                    Invocar (+1d{ordem2RelationDie[relation.grade]} no próximo teste)
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Button
            className="mt-3"
            size="sm"
            variant="ghost"
            disabled={!canPlay}
            onClick={() =>
              void save({
                ...sheet,
                relations: sheet.relations.map((entry) => ({ ...entry, invoked: false })),
              })
            }
          >
            Nova missão (liberar relações)
          </Button>
        </Card>
      ) : null}

      {sheet.abilities.length ? (
        <Card>
          <CardHeader title="Habilidades" />
          <ul className="flex flex-col gap-3 text-sm">
            {sheet.abilities.map((ability, index) => (
              <li key={index}>
                <strong className="font-display text-base text-fg">{ability.name}</strong>
                {ability.source ? (
                  <span className="ml-2 text-xs text-fg-muted">{ability.source}</span>
                ) : null}
                {ability.text ? (
                  <p className="mt-1 whitespace-pre-wrap text-fg-secondary">{ability.text}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card ornate>
        <CardHeader
          title={character.name}
          description={[
            sheet.profile ? ordem2ProfileLabels[sheet.profile] : '',
            sheet.vocation,
            `Nível ${sheet.level}`,
            ordem2TierLabels[sheet.tier],
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <div className="flex flex-wrap gap-2">
          {ORDEM2_ATTRIBUTES.map((attribute) => (
            <Badge key={attribute} tone="parchment">
              {ordem2AttributeLabels[attribute]} d{sheet.attributes[attribute]}
            </Badge>
          ))}
          {sheet.fearDie ? <Badge tone="danger">Pavor d{sheet.fearDie}</Badge> : null}
        </div>
      </Card>
      <Tabs
        label="Seções da ficha"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'jogo', label: 'Jogo', content: playTab },
          {
            value: 'ficha',
            label: 'Ficha',
            content: (
              <Card>
                <div className="flex flex-col gap-6">
                  <Ordem2IdentityEditor
                    sheet={sheet}
                    onChange={(next) => void saveSheet(next)}
                    disabled={!canEdit}
                    lockSetting={Boolean(character.campaign)}
                  />
                  <Ordem2StatsEditor
                    sheet={sheet}
                    onChange={(next) => void save(next)}
                    disabled={!canEdit}
                  />
                </div>
              </Card>
            ),
          },
          {
            value: 'equipamento',
            label: 'Habilidades e equipamento',
            content: (
              <Card>
                <Ordem2GearEditor
                  sheet={sheet}
                  onChange={(next) => void saveSheet(next)}
                  disabled={!canEdit}
                />
              </Card>
            ),
          },
          {
            value: 'historia',
            label: 'Relações e história',
            content: (
              <Card>
                <div className="flex flex-col gap-6">
                  <Ordem2RelationsEditor
                    sheet={sheet}
                    onChange={(next) => void save(next)}
                    disabled={!canEdit}
                  />
                  <TextareaField
                    id="ordem2-appearance"
                    label="Aparência"
                    rows={3}
                    maxLength={4000}
                    value={sheet.identity.appearance}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setSheet({
                        ...sheet,
                        identity: { ...sheet.identity, appearance: event.target.value },
                      })
                    }
                    onBlur={() => void save(sheet)}
                  />
                  <TextareaField
                    id="ordem2-history"
                    label="Histórico"
                    rows={6}
                    maxLength={12000}
                    value={sheet.identity.history}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setSheet({
                        ...sheet,
                        identity: { ...sheet.identity, history: event.target.value },
                      })
                    }
                    onBlur={() => void save(sheet)}
                  />
                  <TextareaField
                    id="ordem2-notes"
                    label="Anotações"
                    rows={6}
                    maxLength={12000}
                    value={sheet.identity.notes}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setSheet({
                        ...sheet,
                        identity: { ...sheet.identity, notes: event.target.value },
                      })
                    }
                    onBlur={() => void save(sheet)}
                  />
                </div>
              </Card>
            ),
          },
        ]}
      />
      {extra}
    </div>
  );
}

function Sequel({
  label,
  text,
  onRemove,
  disabled,
}: {
  label: string;
  text: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-2 rounded-md border border-line px-3 py-2">
      <span>
        <strong className="text-fg">{label}.</strong>{' '}
        <span className="text-fg-secondary">{text}</span>
      </span>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove}>
        Remover
      </Button>
    </li>
  );
}

function LastTestCard({
  last,
  onTable,
  onApply,
  canPlay,
}: {
  last: LastTest;
  onTable: (kind: 'injury' | 'trauma' | 'fumble') => void;
  onApply: (row: Ordem2TableRow, kind: 'injury' | 'trauma' | 'fumble') => void;
  canPlay: boolean;
}) {
  const { result } = last;
  return (
    <Card ornate>
      <CardHeader
        title={last.title}
        description={`Dados: ${last.dice.map((die) => `d${die}`).join(' + ')}${last.fearDie ? ` · pavor d${last.fearDie}` : ''}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="tabular font-display text-4xl text-fg">{result.total}</span>
        {result.critical ? <Badge tone="success">Sucesso crítico</Badge> : null}
        {result.fumble ? <Badge tone="danger">Falha crítica</Badge> : null}
        {result.success === true && !result.critical ? <Badge tone="success">Passou</Badge> : null}
        {result.success === false && !result.fumble ? <Badge tone="warning">Falhou</Badge> : null}
        <span className="text-sm text-fg-muted">
          Rolagens {result.values.join(', ')}
          {result.fear !== null
            ? ` · pavor ${result.fear}${result.kept.length < result.values.length ? ` (anulou ${result.values.length - result.kept.length})` : ''}`
            : ''}
          {' · '}RA {result.high} · RB {result.low}
          {result.modifier
            ? ` · modificador ${result.modifier > 0 ? '+' : ''}${result.modifier}`
            : ''}
        </span>
      </div>
      {result.fearEnds ? (
        <Alert tone="success" className="mt-3">
          O dado de pavor tirou 1: o pavor terminou.
        </Alert>
      ) : null}
      {last.damage ? (
        <p className="mt-3 text-sm">
          Dano ({last.damage.formula}
          {result.critical ? ' + segunda rolagem' : ''}):{' '}
          <strong className="text-fg">{last.damage.value}</strong>
        </p>
      ) : null}
      {last.outcome ? <p className="mt-3 text-sm text-fg">{last.outcome}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {result.fumble ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canPlay}
            onClick={() => onTable('fumble')}
          >
            Rolar efeito da falha crítica (1d8)
          </Button>
        ) : null}
        {last.outcome?.includes('tabela de lesões') ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canPlay}
            onClick={() => onTable('injury')}
          >
            Rolar lesão (1d20)
          </Button>
        ) : null}
        {last.outcome?.includes('tabela de traumas') ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canPlay}
            onClick={() => onTable('trauma')}
          >
            Rolar trauma (1d20)
          </Button>
        ) : null}
      </div>
      {last.table ? (
        <div className="mt-3 rounded-md border border-line bg-sunken p-3 text-sm">
          <p>
            <strong className="text-fg">
              {last.table.title}: {last.table.roll}
            </strong>{' '}
            — {last.table.row.label}. {last.table.row.text}
          </p>
          {(last.table.row.permanent && last.table.kind !== 'fumble') ||
          last.table.row.key === 'panico' ? (
            <Button
              className="mt-2"
              size="sm"
              disabled={!canPlay}
              onClick={() => onApply(last.table!.row, last.table!.kind)}
            >
              {last.table.row.key === 'panico' ? 'Receber dado de pavor' : 'Anotar na ficha'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
