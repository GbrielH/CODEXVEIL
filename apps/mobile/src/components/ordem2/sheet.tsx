import {
  adjustCharacterResource,
  saveCharacterSheet,
  type CharacterResource,
} from '@codexveil/database';
import type { TrackOperation } from '@codexveil/domain';
import {
  ORDEM2_ATTRIBUTES,
  ORDEM2_CONTROL_FEAR_COST,
  ORDEM2_EQUIPMENT_KINDS,
  ORDEM2_FUMBLE_TABLE,
  ORDEM2_INJURY_TABLE,
  ORDEM2_PROFILES,
  ORDEM2_RELATION_BENEFITS,
  ORDEM2_TIERS,
  ORDEM2_TRAUMA_TABLE,
  ordem2AttributeLabels,
  ordem2ControlFear,
  ordem2Damage,
  ordem2EquipmentKindLabels,
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
  ordem2TierLabels,
  ordem2TraumaRow,
  resolveOrdem2Test,
  type Ordem2Attribute,
  type Ordem2Die,
  type Ordem2Sheet,
  type Ordem2TableRow,
  type Ordem2TestResult,
} from '@codexveil/rpg-systems/ordem2';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { DiceProvider, useDice } from '@/components/dice/dice';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

type Tab = 'jogo' | 'ficha' | 'itens' | 'relacoes';
const DICE: Ordem2Die[] = [4, 6, 8, 10, 12];

interface Props {
  character: { id: string; name: string; version: number };
  campaignId: string | null;
  sheet: Ordem2Sheet;
  resources: CharacterResource[];
  canEditSheet: boolean;
  canEditPlay: boolean;
  extras?: ReactNode;
}

/** Ficha do Ordem Paranormal 2 no app (jogador). As rolagens vão ao mural da campanha. */
export function Ordem2MobileSheet(props: Props) {
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

interface Last {
  title: string;
  result: Ordem2TestResult;
  damage?: number;
  outcome?: string;
  table?: { kind: 'injury' | 'trauma' | 'fumble'; roll: number; row: Ordem2TableRow };
}

function Body({
  character,
  sheet: initial,
  resources: initialResources,
  canEditSheet,
  canEditPlay,
  extras,
}: Props) {
  const toast = useToast();
  const dice = useDice();
  const [sheet, setSheet] = useState(initial);
  const [version, setVersion] = useState(character.version);
  const [resources, setResources] = useState(initialResources);
  const [tab, setTab] = useState<Tab>('jogo');
  const [dc, setDc] = useState(7);
  const [steps, setSteps] = useState(0);
  const [bonus, setBonus] = useState<Ordem2Die | 0>(0);
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Last | null>(null);

  const save = async (next: Ordem2Sheet) => {
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
  const track = (key: string) => resources.find((entry) => entry.key === key) ?? null;
  const adjust = async (key: string, operation: TrackOperation, value: number) => {
    const resource = track(key);
    if (!resource || !canEditPlay) return;
    try {
      const saved = await adjustCharacterResource(getSupabase(), resource.id, operation, value);
      setResources((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível atualizar',
        description: failureMessage(error),
      });
    }
  };
  const saveSheet = async (next: Ordem2Sheet) => {
    if (!(await save(next))) return;
    if (next.maxHitPoints !== track('hp')?.max) await adjust('hp', 'set_max', next.maxHitPoints);
    if (next.maxDetermination !== track('pd')?.max)
      await adjust('pd', 'set_max', next.maxDetermination);
    const armor = next.equipment.reduce((sum, item) => sum + item.armor, 0);
    if (armor !== track('armor')?.max) await adjust('armor', 'set_max', armor);
  };

  const run = async (
    title: string,
    testDice: Ordem2Die[],
    fearDie: Ordem2Die | 0,
    testDc: number | null,
    modifier = 0,
    weapon?: string,
  ) => {
    if (!dice || busy) return null;
    setBusy(true);
    try {
      const shown = await dice.roll({ expression: ordem2Expression(testDice), label: title });
      const values = shown?.dice.flatMap((group) => group.values) ?? [];
      if (values.length !== testDice.length) return null;
      let fear: number | null = null;
      if (fearDie) {
        const fearShown = await dice.roll({
          expression: `1d${fearDie}`,
          label: `${title} · dado de pavor`,
        });
        fear = fearShown?.dice[0]?.values[0] ?? null;
      }
      const result = resolveOrdem2Test(values, { dc: testDc, fear, modifier });
      const next: Last = { title, result };
      if (weapon !== undefined && result.success)
        next.damage = ordem2Damage(result, weapon || 'RA');
      setLast(next);
      setSteps(0);
      setBonus(0);
      if (result.fearEnds && sheet.fearDie) await save({ ...sheet, fearDie: 0 });
      return next;
    } finally {
      setBusy(false);
    }
  };

  const testSkill = (skill: string, weapon?: string) => {
    const attribute = ordem2SkillAttribute(skill);
    const test = ordem2SheetTest(sheet, skill, { steps, bonusDice: bonus ? [bonus] : [] });
    const label = `${ordem2SkillLabel(skill, sheet.setting)} (${ordem2AttributeLabels[attribute]} d${sheet.attributes[attribute]} + d${sheet.skills[skill]?.die ?? 4})`;
    return run(
      weapon !== undefined ? `Ataque · ${label}` : label,
      test.dice,
      test.fearDie,
      dc,
      ordem2SkillPenalty(sheet, skill),
      weapon,
    );
  };

  const deathTest = async (kind: 'injury' | 'trauma') => {
    const attribute: Ordem2Attribute = kind === 'injury' ? 'fisico' : 'emocao';
    const skill = kind === 'injury' ? 'vigor' : 'disciplina';
    const previous = kind === 'injury' ? sheet.sceneInjuryTests : sheet.sceneTraumaTests;
    const testDc = ordem2RepeatedDc(previous);
    const test = ordem2SheetTest(sheet, skill, { attribute });
    const done = await run(
      `Teste de ${kind === 'injury' ? 'lesão' : 'trauma'} (DT ${testDc})`,
      test.dice,
      test.fearDie,
      testDc,
      ordem2SkillPenalty(sheet, skill),
    );
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
            recupera: 'Crítico: recupera 1 PV.',
            moribundo: 'Sucesso: inconsciente e moribundo.',
            lesao: 'Falha: role na tabela de lesões.',
            morte: 'Falha crítica: o personagem morre.',
          }[ordem2InjuryTestOutcome(done.result)]
        : done.result.success
          ? 'Sucesso: nenhum efeito.'
          : 'Falha: role na tabela de traumas.';
    setLast({ ...done, outcome });
  };

  const rollTable = async (kind: 'injury' | 'trauma' | 'fumble') => {
    const shown = await dice?.roll({
      expression: kind === 'fumble' ? '1d8' : '1d20',
      label:
        kind === 'injury'
          ? 'Tabela de lesões'
          : kind === 'trauma'
            ? 'Tabela de traumas'
            : 'Falha crítica',
    });
    const roll = shown?.dice[0]?.values[0];
    if (!roll) return;
    const row =
      kind === 'injury'
        ? ordem2InjuryRow(roll, sheet.tier)
        : kind === 'trauma'
          ? ordem2TraumaRow(roll, sheet.tier)
          : ordem2TableRow(ORDEM2_FUMBLE_TABLE, roll);
    setLast((current) => (current ? { ...current, table: { kind, roll, row } } : current));
  };

  const applyRow = async (row: Ordem2TableRow, kind: 'injury' | 'trauma' | 'fumble') => {
    if (row.key === 'panico')
      return void save({ ...sheet, fearDie: ordem2GainFear(sheet.fearDie) });
    if (!row.permanent || kind === 'fumble') return;
    const field = kind === 'injury' ? 'injuries' : 'traumas';
    const next = { ...sheet, [field]: [...sheet[field], row.key] };
    if (row.maxHitPoints) next.maxHitPoints = Math.max(1, next.maxHitPoints + row.maxHitPoints);
    if (row.maxDetermination)
      next.maxDetermination = Math.max(1, next.maxDetermination + row.maxDetermination);
    await saveSheet(next);
  };

  const resourceRow = (key: string, label: string) => {
    const resource = track(key);
    if (!resource) return null;
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
        <AppText variant="heading">
          {label} {resource.current}/{resource.max ?? '—'}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <Button
            compact
            variant="secondary"
            label={key === 'armor' ? 'Gastar' : `−${amount}`}
            disabled={!canEditPlay}
            onPress={() =>
              void adjust(key, key === 'armor' ? 'spend' : 'damage', key === 'armor' ? 1 : amount)
            }
          />
          <Button
            compact
            variant="ghost"
            label={`+${key === 'armor' ? 1 : amount}`}
            disabled={!canEditPlay}
            onPress={() => void adjust(key, 'heal', key === 'armor' ? 1 : amount)}
          />
        </View>
      </View>
    );
  };

  const weapons = sheet.equipment.filter(
    (item) => item.kind === 'corpo-a-corpo' || item.kind === 'distancia',
  );

  return (
    <View style={{ gap: spacing[4] }}>
      <Card ornate>
        <AppText variant="title">{character.name}</AppText>
        <AppText variant="muted">
          {[
            sheet.profile ? ordem2ProfileLabels[sheet.profile] : '',
            sheet.vocation,
            `Nível ${sheet.level}`,
            ordem2TierLabels[sheet.tier],
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] }}
        >
          {ORDEM2_ATTRIBUTES.map((attribute) => (
            <Badge
              key={attribute}
              tone="parchment"
              label={`${ordem2AttributeLabels[attribute]} d${sheet.attributes[attribute]}`}
            />
          ))}
          {sheet.fearDie ? <Badge tone="danger" label={`Pavor d${sheet.fearDie}`} /> : null}
        </View>
      </Card>
      <Segmented
        value={tab}
        onChange={setTab}
        accessibilityLabel="Seções da ficha"
        options={[
          { value: 'jogo', label: 'Jogo' },
          { value: 'ficha', label: 'Ficha' },
          { value: 'itens', label: 'Habilidades e itens' },
          { value: 'relacoes', label: 'Relações' },
        ]}
      />

      {tab === 'jogo' ? (
        <>
          <Card>
            {resourceRow('hp', 'PV')}
            {resourceRow('pd', 'PD')}
            {resourceRow('armor', 'Armadura')}
            <AppText variant="small">Quantidade para perder ou recuperar</AppText>
            <ChipRow>
              {[1, 2, 3, 5, 10].map((value) => (
                <Chip
                  key={value}
                  label={String(value)}
                  selected={amount === value}
                  onPress={() => setAmount(value)}
                />
              ))}
            </ChipRow>
            <AppText variant="small">Gastar 1 ponto de armadura reduz um dano em 10.</AppText>
          </Card>

          <Card>
            <AppText variant="heading">
              Dado de pavor: {sheet.fearDie ? `d${sheet.fearDie}` : 'nenhum'}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              <Button
                compact
                variant="secondary"
                label="Receber pavor"
                disabled={!canEditPlay}
                onPress={() => void save({ ...sheet, fearDie: ordem2GainFear(sheet.fearDie) })}
              />
              <Button
                compact
                variant="ghost"
                label="Controlar (1 PD)"
                disabled={!canEditPlay || !sheet.fearDie}
                onPress={async () => {
                  await adjust('pd', 'spend', ORDEM2_CONTROL_FEAR_COST);
                  await save({ ...sheet, fearDie: ordem2ControlFear(sheet.fearDie) });
                }}
              />
            </View>
          </Card>

          <Card>
            <AppText variant="heading">Testes</AppText>
            <AppText variant="small">
              Atributo + perícia; até 4 dados, somam os 3 maiores. Dois iguais de 6+ = crítico.
            </AppText>
            <AppText variant="small">DT</AppText>
            <ChipRow>
              {[5, 7, 10, 13, 16].map((value) => (
                <Chip
                  key={value}
                  label={String(value)}
                  selected={dc === value}
                  onPress={() => setDc(value)}
                />
              ))}
            </ChipRow>
            <AppText variant="small">Passos</AppText>
            <ChipRow>
              {[-2, -1, 0, 1, 2].map((value) => (
                <Chip
                  key={value}
                  label={value > 0 ? `+${value}` : String(value)}
                  selected={steps === value}
                  onPress={() => setSteps(value)}
                />
              ))}
            </ChipRow>
            <AppText variant="small">Dado bônus</AppText>
            <ChipRow>
              {([0, 4, 6, 8, 12] as const).map((value) => (
                <Chip
                  key={value}
                  label={value ? `+d${value}` : 'nenhum'}
                  selected={bonus === value}
                  onPress={() => setBonus(value)}
                />
              ))}
            </ChipRow>
            <View style={{ gap: spacing[1], marginTop: spacing[2] }}>
              {ordem2SkillsFor(sheet.setting).map((skill) => (
                <Pressable
                  key={skill.key}
                  accessibilityRole="button"
                  disabled={!canEditPlay || busy}
                  onPress={() => void testSkill(skill.key)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: spacing[2],
                    paddingHorizontal: spacing[3],
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <AppText>{skill.labels[sheet.setting]}</AppText>
                  <AppText variant="muted">
                    d{sheet.attributes[skill.attribute]} + d{sheet.skills[skill.key]?.die ?? 4}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </Card>

          {weapons.length ? (
            <Card>
              <AppText variant="heading">Ataques</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {weapons.map((item, index) => (
                  <Button
                    key={index}
                    compact
                    variant="secondary"
                    label={`${item.name}${item.damage ? ` (${item.damage})` : ''}`}
                    disabled={!canEditPlay || busy}
                    onPress={() =>
                      void testSkill(
                        item.kind === 'distancia' ? 'pontaria' : 'luta',
                        item.damage || 'RA',
                      )
                    }
                  />
                ))}
              </View>
            </Card>
          ) : null}

          {last ? (
            <Card ornate>
              <AppText variant="small">{last.title}</AppText>
              <AppText variant="display">{last.result.total}</AppText>
              <AppText variant="muted">
                {last.result.critical
                  ? 'Sucesso crítico · '
                  : last.result.fumble
                    ? 'Falha crítica · '
                    : last.result.success
                      ? 'Passou · '
                      : last.result.success === false
                        ? 'Falhou · '
                        : ''}
                Rolagens {last.result.values.join(', ')}
                {last.result.fear !== null ? ` · pavor ${last.result.fear}` : ''} · RA{' '}
                {last.result.high} · RB {last.result.low}
              </AppText>
              {last.damage !== undefined ? <AppText>Dano: {last.damage}</AppText> : null}
              {last.outcome ? <AppText>{last.outcome}</AppText> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {last.result.fumble ? (
                  <Button
                    compact
                    variant="secondary"
                    label="Efeito (1d8)"
                    onPress={() => void rollTable('fumble')}
                  />
                ) : null}
                {last.outcome?.includes('lesões') ? (
                  <Button
                    compact
                    variant="secondary"
                    label="Rolar lesão"
                    onPress={() => void rollTable('injury')}
                  />
                ) : null}
                {last.outcome?.includes('traumas') ? (
                  <Button
                    compact
                    variant="secondary"
                    label="Rolar trauma"
                    onPress={() => void rollTable('trauma')}
                  />
                ) : null}
              </View>
              {last.table ? (
                <>
                  <AppText>
                    {last.table.roll}: {last.table.row.label}. {last.table.row.text}
                  </AppText>
                  {(last.table.row.permanent && last.table.kind !== 'fumble') ||
                  last.table.row.key === 'panico' ? (
                    <Button
                      compact
                      label={last.table.row.key === 'panico' ? 'Receber pavor' : 'Anotar na ficha'}
                      onPress={() => void applyRow(last.table!.row, last.table!.kind)}
                    />
                  ) : null}
                </>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <AppText variant="heading">Ferimentos e traumas</AppText>
            <AppText variant="small">
              Lesão DT {ordem2RepeatedDc(sheet.sceneInjuryTests)} · Trauma DT{' '}
              {ordem2RepeatedDc(sheet.sceneTraumaTests)}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              <Button
                compact
                variant="secondary"
                label="Teste de lesão"
                disabled={!canEditPlay || busy}
                onPress={() => void deathTest('injury')}
              />
              <Button
                compact
                variant="secondary"
                label="Teste de trauma"
                disabled={!canEditPlay || busy}
                onPress={() => void deathTest('trauma')}
              />
              <Button
                compact
                variant="ghost"
                label="Nova cena"
                disabled={!canEditPlay}
                onPress={() => void save({ ...sheet, sceneInjuryTests: 0, sceneTraumaTests: 0 })}
              />
            </View>
            {[
              ...sheet.injuries.map((key) => ORDEM2_INJURY_TABLE.find((row) => row.key === key)),
              ...sheet.traumas.map((key) => ORDEM2_TRAUMA_TABLE.find((row) => row.key === key)),
            ].map((row, index) =>
              row ? (
                <AppText key={index} variant="small">
                  {row.label}: {row.text}
                </AppText>
              ) : null,
            )}
          </Card>

          {sheet.abilities.length ? (
            <Card>
              <AppText variant="heading">Habilidades</AppText>
              {sheet.abilities.map((ability, index) => (
                <View key={index} style={{ gap: spacing[1] }}>
                  <AppText style={{ color: colors.fgAccent }}>{ability.name}</AppText>
                  {ability.text ? <AppText variant="muted">{ability.text}</AppText> : null}
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'ficha' ? (
        <Card>
          <AppText variant="small">Perfil</AppText>
          <ChipRow>
            {ORDEM2_PROFILES.map((profile) => (
              <Chip
                key={profile}
                label={ordem2ProfileLabels[profile]}
                selected={sheet.profile === profile}
                disabled={!canEditSheet}
                onPress={() => void save({ ...sheet, profile })}
              />
            ))}
          </ChipRow>
          <Field
            label="Vocação"
            value={sheet.vocation}
            editable={canEditSheet}
            maxLength={120}
            onChangeText={(vocation) => setSheet({ ...sheet, vocation })}
            onEndEditing={() => void save(sheet)}
          />
          <AppText variant="small">Nível</AppText>
          <ChipRow>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
              <Chip
                key={level}
                label={String(level)}
                selected={sheet.level === level}
                disabled={!canEditSheet}
                onPress={() => void save({ ...sheet, level })}
              />
            ))}
          </ChipRow>
          <AppText variant="small">Patamar</AppText>
          <ChipRow>
            {ORDEM2_TIERS.map((tier) => (
              <Chip
                key={tier}
                label={ordem2TierLabels[tier]}
                selected={sheet.tier === tier}
                disabled={!canEditSheet}
                onPress={() => void save({ ...sheet, tier })}
              />
            ))}
          </ChipRow>
          <Field
            label="PV máximos"
            keyboardType="number-pad"
            editable={canEditSheet}
            value={String(sheet.maxHitPoints)}
            onChangeText={(text) =>
              setSheet({ ...sheet, maxHitPoints: Math.max(1, Number(text) || 1) })
            }
            onEndEditing={() => void saveSheet(sheet)}
          />
          <Field
            label="PD máximos"
            keyboardType="number-pad"
            editable={canEditSheet}
            value={String(sheet.maxDetermination)}
            onChangeText={(text) =>
              setSheet({ ...sheet, maxDetermination: Math.max(1, Number(text) || 1) })
            }
            onEndEditing={() => void saveSheet(sheet)}
          />
          {ORDEM2_ATTRIBUTES.map((attribute) => (
            <View key={attribute} style={{ gap: spacing[1] }}>
              <AppText variant="heading">{ordem2AttributeLabels[attribute]}</AppText>
              <ChipRow>
                {DICE.map((die) => (
                  <Chip
                    key={die}
                    label={`d${die}`}
                    selected={sheet.attributes[attribute] === die}
                    disabled={!canEditSheet}
                    onPress={() =>
                      void save({ ...sheet, attributes: { ...sheet.attributes, [attribute]: die } })
                    }
                  />
                ))}
              </ChipRow>
            </View>
          ))}
          {ordem2SkillsFor(sheet.setting).map((skill) => (
            <View key={skill.key} style={{ gap: spacing[1] }}>
              <AppText>
                {skill.labels[sheet.setting]}{' '}
                <AppText variant="small">({ordem2AttributeLabels[skill.attribute]})</AppText>
              </AppText>
              <ChipRow>
                {DICE.map((die) => (
                  <Chip
                    key={die}
                    label={`d${die}`}
                    selected={(sheet.skills[skill.key]?.die ?? 4) === die}
                    disabled={!canEditSheet}
                    onPress={() =>
                      void save({
                        ...sheet,
                        skills: {
                          ...sheet.skills,
                          [skill.key]: { die, modifier: sheet.skills[skill.key]?.modifier ?? 0 },
                        },
                      })
                    }
                  />
                ))}
              </ChipRow>
            </View>
          ))}
        </Card>
      ) : null}

      {tab === 'itens' ? (
        <Card>
          <AppText variant="heading">Habilidades</AppText>
          {sheet.abilities.map((ability, index) => (
            <View key={index} style={{ gap: spacing[1] }}>
              <Field
                label="Nome"
                value={ability.name}
                editable={canEditSheet}
                maxLength={160}
                onChangeText={(name) =>
                  setSheet({
                    ...sheet,
                    abilities: sheet.abilities.map((entry, position) =>
                      position === index ? { ...entry, name } : entry,
                    ),
                  })
                }
                onEndEditing={() => void save(sheet)}
              />
              <Field
                label="Como funciona"
                multiline
                value={ability.text}
                editable={canEditSheet}
                maxLength={6000}
                onChangeText={(text) =>
                  setSheet({
                    ...sheet,
                    abilities: sheet.abilities.map((entry, position) =>
                      position === index ? { ...entry, text } : entry,
                    ),
                  })
                }
                onEndEditing={() => void save(sheet)}
              />
              <Button
                compact
                variant="ghost"
                label="Remover"
                disabled={!canEditSheet}
                onPress={() =>
                  void save({
                    ...sheet,
                    abilities: sheet.abilities.filter((_, position) => position !== index),
                  })
                }
              />
            </View>
          ))}
          <Button
            compact
            variant="secondary"
            label="Adicionar habilidade"
            disabled={!canEditSheet}
            onPress={() =>
              void save({
                ...sheet,
                abilities: [...sheet.abilities, { name: 'Nova habilidade', source: '', text: '' }],
              })
            }
          />
          <AppText variant="heading">Equipamento</AppText>
          {sheet.equipment.map((item, index) => (
            <View key={index} style={{ gap: spacing[1] }}>
              <Field
                label="Item"
                value={item.name}
                editable={canEditSheet}
                maxLength={160}
                onChangeText={(name) =>
                  setSheet({
                    ...sheet,
                    equipment: sheet.equipment.map((entry, position) =>
                      position === index ? { ...entry, name } : entry,
                    ),
                  })
                }
                onEndEditing={() => void save(sheet)}
              />
              <ChipRow>
                {ORDEM2_EQUIPMENT_KINDS.map((kind) => (
                  <Chip
                    key={kind}
                    label={ordem2EquipmentKindLabels[kind]}
                    selected={item.kind === kind}
                    disabled={!canEditSheet}
                    onPress={() =>
                      void save({
                        ...sheet,
                        equipment: sheet.equipment.map((entry, position) =>
                          position === index ? { ...entry, kind } : entry,
                        ),
                      })
                    }
                  />
                ))}
              </ChipRow>
              <Field
                label="Dano (ex.: RA+3)"
                value={item.damage}
                editable={canEditSheet}
                maxLength={80}
                onChangeText={(damage) =>
                  setSheet({
                    ...sheet,
                    equipment: sheet.equipment.map((entry, position) =>
                      position === index ? { ...entry, damage } : entry,
                    ),
                  })
                }
                onEndEditing={() => void save(sheet)}
              />
              <Field
                label="Pontos de armadura"
                keyboardType="number-pad"
                value={String(item.armor)}
                editable={canEditSheet}
                onChangeText={(text) =>
                  setSheet({
                    ...sheet,
                    equipment: sheet.equipment.map((entry, position) =>
                      position === index
                        ? { ...entry, armor: Math.max(0, Math.min(20, Number(text) || 0)) }
                        : entry,
                    ),
                  })
                }
                onEndEditing={() => void saveSheet(sheet)}
              />
              <Button
                compact
                variant="ghost"
                label="Remover"
                disabled={!canEditSheet}
                onPress={() =>
                  void saveSheet({
                    ...sheet,
                    equipment: sheet.equipment.filter((_, position) => position !== index),
                  })
                }
              />
            </View>
          ))}
          <Button
            compact
            variant="secondary"
            label="Adicionar item"
            disabled={!canEditSheet}
            onPress={() =>
              void save({
                ...sheet,
                equipment: [
                  ...sheet.equipment,
                  { name: 'Novo item', kind: 'outro', damage: '', armor: 0, notes: '' },
                ],
              })
            }
          />
        </Card>
      ) : null}

      {tab === 'relacoes' ? (
        <Card>
          {sheet.relations.map((relation, index) => (
            <View key={index} style={{ gap: spacing[1], opacity: relation.invoked ? 0.6 : 1 }}>
              <AppText variant="heading">
                {relation.name} · {ordem2RelationGradeLabels[relation.grade]}
              </AppText>
              {ORDEM2_RELATION_BENEFITS[relation.grade].map((benefit) => (
                <AppText key={benefit} variant="small">
                  • {benefit}
                </AppText>
              ))}
              <Button
                compact
                variant="secondary"
                label={`Invocar (+d${ordem2RelationDie[relation.grade]})`}
                disabled={!canEditPlay || relation.invoked}
                onPress={() => {
                  setBonus(ordem2RelationDie[relation.grade]);
                  setTab('jogo');
                  void save({
                    ...sheet,
                    relations: sheet.relations.map((entry, position) =>
                      position === index ? { ...entry, invoked: true } : entry,
                    ),
                  });
                }}
              />
            </View>
          ))}
          <Field
            label="Nova relação (nome)"
            editable={canEditSheet}
            onSubmitEditing={(event) => {
              const name = event.nativeEvent.text.trim();
              if (name)
                void save({
                  ...sheet,
                  relations: [
                    ...sheet.relations,
                    { name: name.slice(0, 160), grade: 1, description: '', invoked: false },
                  ],
                });
            }}
          />
          <Button
            compact
            variant="ghost"
            label="Nova missão (liberar relações)"
            disabled={!canEditPlay}
            onPress={() =>
              void save({
                ...sheet,
                relations: sheet.relations.map((entry) => ({ ...entry, invoked: false })),
              })
            }
          />
        </Card>
      ) : null}
      {extras}
    </View>
  );
}
