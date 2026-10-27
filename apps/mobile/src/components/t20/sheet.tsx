import {
  addCharacterEvent,
  adjustCharacterResource,
  applyCharacterCondition,
  createCharacterAbility,
  removeCharacterCondition,
  adjustCharacterItemQuantity,
  deleteCharacterItem,
  setCharacterItemEquipped,
  tickCharacterConditions,
  saveCharacterSheet,
  setCharacterPortrait,
  characterPortraitPath,
  updateCharacterAbility,
  type CharacterAbility,
  type CharacterCondition,
  type CharacterItem,
  type CharacterResource,
} from '@codexveil/database';
import { PendingUpdatesPrompt } from '@/components/sheet/pending-updates';
import {
  groupByCategory,
  itemCategoryLabels,
  rollDiceLocally,
  type DiceRollMode,
  type TrackOperation,
} from '@codexveil/domain';
import {
  T20_ATTRIBUTES,
  T20_RESOURCE_KEYS,
  T20_REST_QUALITY,
  applyT20LevelUp,
  buildT20Content,
  listT20PendingUpdates,
  isT20AttributeIncrease,
  t20PowerSkillPick,
  T20_SKILLS,
  T20_SKILL_IDS,
  type T20Skill,
  type T20LevelUpChoices,
  computeT20Derived,
  t20AbilityChoiceNames,
  listT20Grants,
  listT20ItemGrants,
  listT20LabelGrants,
  t20SituationalBonuses,
  t20DefenseFromItems,
  findT20Condition,
  formatT20Bonus,
  planT20LevelUp,
  t20AbilityCost,
  t20AttributeLabels,
  t20Conditions,
  t20RestRecovery,
  type T20ContentSource,
  type T20RestQuality,
  type T20Sheet,
} from '@codexveil/rpg-systems/tormenta20';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { CheckRow } from '@/components/ui/controls';
import { HealthBar } from '@/components/ui/health-bar';
import { PickerField } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { Notice } from '@/components/ui/states';
import { DiceProvider, useDice } from '@/components/dice/dice';
import { DeleteCharacterCard } from '@/components/sheet/delete-character';
import { T20Attacks } from './attacks';
import { T20AbilityForm, T20MoneyCard, T20SkillsEditor, T20StatsEditor, T20TempHitPoints } from './editors';
import { ImageUploadButtons } from '@/components/ui/image-upload';
import { T20AutomaticBonusesCard, T20GrantsCard, T20SituationalCard } from './automation';
import { LevelGate, type LevelGateInfo } from '@/components/sheet/level-gate';
import { T20NewItem } from './new-item';
import { T20TurnCard, logT20TurnUse } from './turn-card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, palette, spacing } from '@/lib/theme';

type Tab = 'jogo' | 'pericias' | 'poderes' | 'itens' | 'evolucao';

interface Props {
  character: { id: string; name: string; version: number };
  sheet: T20Sheet;
  resources: CharacterResource[];
  conditions: CharacterCondition[];
  items: CharacterItem[];
  abilities: CharacterAbility[];
  canEditSheet: boolean;
  canEditPlay: boolean;
  sources: T20ContentSource[];
  /** Campanha: o mestre libera o nível e o jogador escolhe as melhorias. */
  gate: LevelGateInfo;
  /** Campanha do personagem (turno e registro de uso), ou `null`. */
  campaignId: string | null;
  portraitPath: string | null;
  /** Retrato (endereço assinado), para o cabeçalho e a tela cheia. */
  portraitUrl: string | null;
  /** Recarrega a ficha (depois de trocar o retrato). */
  onReload: () => void;
}

/** Ficha do Tormenta20 no app: vida, mana, condições, testes, poderes, magias, itens e subida de nível. */
export function T20MobileSheet(props: Props) {
  // Mesmo rolador do D&D: dado grande animado na tela.
  return (
    <DiceProvider campaignId={null} characterId={props.character.id} enabled={props.canEditPlay}>
      <T20SheetBody {...props} />
    </DiceProvider>
  );
}

function T20SheetBody(props: Props) {
  const dice = useDice();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('jogo');
  // Seletor de três estados para as rolagens de d20: desvantagem, normal ou vantagem.
  const [rollMode, setRollMode] = useState<DiceRollMode>('normal');
  const [sheet, setSheet] = useState(props.sheet);
  const [version, setVersion] = useState(props.character.version);
  const [resources, setResources] = useState(props.resources);
  const [conditions, setConditions] = useState(props.conditions);
  const [abilities, setAbilities] = useState(props.abilities);
  const [amount, setAmount] = useState('1');
  const [levelUp, setLevelUp] = useState(false);
  const [condRounds, setCondRounds] = useState('');
  const [items, setItems] = useState(props.items);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<CharacterItem | null>(null);
  // Edições à mão (como no site): atributos e perícias, números da ficha e habilidades.
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingStats, setEditingStats] = useState(false);
  const [editingAbility, setEditingAbility] = useState<CharacterAbility | 'new' | null>(null);
  const [portraitOpen, setPortraitOpen] = useState(false);
  const removeItem = async (item: CharacterItem) => {
    try {
      await deleteCharacterItem(getSupabase(), item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      toast({ tone: 'success', title: `${item.name} removido.` });
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    }
  };
  const usedSpaces = items.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);
  const changeQuantity = async (item: CharacterItem, delta: number) => {
    try {
      const saved = await adjustCharacterItemQuantity(getSupabase(), item.id, delta);
      setItems((current) => current.map((entry) => (entry.id === item.id ? saved : entry)));
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    }
  };
  const toggleEquipped = async (item: CharacterItem) => {
    try {
      await setCharacterItemEquipped(getSupabase(), item.id, !item.isEquipped);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, isEquipped: !entry.isEquipped } : entry,
        ),
      );
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    }
  };
  const content = useMemo(() => buildT20Content(props.sources), [props.sources]);
  // Habilidades do nível que faltam na ficha (livro corrigido depois da criação…).
  const pendingUpdates = useMemo(
    () =>
      listT20PendingUpdates(
        content,
        sheet,
        abilities.map((ability) => ability.name),
      ),
    [content, sheet, abilities],
  );

  // Defesa automática: armadura e escudo equipados no inventário (grava na ficha ao mudar).
  const gearDefense = useMemo(() => t20DefenseFromItems(items), [items]);
  const effectiveSheet = useMemo(
    () =>
      gearDefense ? { ...sheet, defense: { ...gearDefense, other: sheet.defense.other } } : sheet,
    [sheet, gearDefense],
  );
  const defenseKey = gearDefense
    ? JSON.stringify({ ...gearDefense, other: sheet.defense.other })
    : null;
  useEffect(() => {
    if (!defenseKey || !props.canEditSheet || JSON.stringify(sheet.defense) === defenseKey) return;
    const next = { ...sheet, defense: JSON.parse(defenseKey) as typeof sheet.defense };
    saveCharacterSheet(getSupabase(), props.character.id, version, { sheet: next })
      .then((saved) => {
        setSheet(next);
        setVersion(saved.version);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grava só quando o equipamento muda a Defesa.
  }, [defenseKey]);
  // Escolhas concedidas (magias, poderes, Protótipo, perícias e marcações no nome).
  const grants = useMemo(() => (content.spells.length || content.powers.length ? listT20Grants(content, sheet) : []), [content, sheet]);
  const labelGrants = useMemo(() => (content.classes.length ? listT20LabelGrants(content, sheet, abilities) : []), [content, sheet, abilities]);
  const itemGrants = useMemo(
    () =>
      listT20ItemGrants(
        content,
        abilities.map((ability) => ability.name),
        items.map((item) => item.notes),
      ),
    [content, abilities, items],
  );
  // Bônus de situação: o jogador liga quando valer (vale enquanto a ficha estiver aberta).
  const situational = useMemo(() => t20SituationalBonuses(sheet), [sheet]);
  const [activeSituations, setActiveSituations] = useState<string[]>([]);
  const situationalEffects = useMemo(
    () => situational.filter((bonus) => activeSituations.includes(bonus.id)).map((bonus) => bonus.effect),
    [situational, activeSituations],
  );
  const derived = useMemo(
    () =>
      computeT20Derived(
        effectiveSheet,
        conditions.map((entry) => entry.key),
        situationalEffects,
      ),
    [effectiveSheet, conditions, situationalEffects],
  );
  // PV e PM de habilidades (Vitalidade, Vontade de Ferro…): a trilha recebe a diferença uma vez.
  const abilityPoolsKey = `${derived.abilityHitPoints}|${derived.abilityManaPoints}`;
  useEffect(() => {
    if (!props.canEditSheet) return;
    const deltas = [
      [T20_RESOURCE_KEYS.hitPoints, derived.abilityHitPoints - sheet.hitPoints.fromAbilities],
      [T20_RESOURCE_KEYS.manaPoints, derived.abilityManaPoints - sheet.manaPoints.fromAbilities],
    ] as const;
    if (deltas.every(([, delta]) => delta === 0)) return;
    const next = {
      ...sheet,
      hitPoints: { ...sheet.hitPoints, fromAbilities: derived.abilityHitPoints },
      manaPoints: { ...sheet.manaPoints, fromAbilities: derived.abilityManaPoints },
    };
    void (async () => {
      try {
        const client = getSupabase();
        const updated: CharacterResource[] = [];
        for (const [key, delta] of deltas) {
          const entry = resources.find((resource) => resource.key === key);
          if (!entry || delta === 0) continue;
          await adjustCharacterResource(client, entry.id, 'set_max', Math.max(0, (entry.max ?? 0) + delta));
          updated.push(await adjustCharacterResource(client, entry.id, delta > 0 ? 'heal' : 'damage', Math.abs(delta)));
        }
        const saved = await saveCharacterSheet(client, props.character.id, version, { sheet: next });
        setSheet(next);
        setVersion(saved.version);
        if (updated.length) setResources((current) => current.map((entry) => updated.find((item) => item.id === entry.id) ?? entry));
      } catch {
        // Tenta de novo na próxima abertura da ficha.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- acerta só quando o total das habilidades muda.
  }, [abilityPoolsKey]);
  const track = (key: string) => resources.find((entry) => entry.key === key);
  const value = Math.max(1, Number(amount) || 1);

  const adjust = async (key: string, operation: TrackOperation, quantity: number) => {
    const target = track(key);
    // `set_temp` aceita 0 (tira os temporários); as demais operações precisam de valor positivo.
    if (!target || quantity < 0 || (quantity === 0 && operation !== 'set_temp')) return;
    try {
      const saved = await adjustCharacterResource(getSupabase(), target.id, operation, quantity);
      setResources((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível atualizar',
        description: failureMessage(error),
      });
    }
  };
  const roll = (label: string, bonus: number) => {
    const expression = `1d20${bonus >= 0 ? '+' : ''}${bonus}`;
    if (dice) {
      void dice.roll({ expression, label, mode: rollMode });
      return;
    }
    const result = rollDiceLocally(expression, rollMode);
    if (result)
      toast({
        tone: 'info',
        title: `${label}: ${result.total}`,
        description: `1d20 (${result.total - bonus}) ${formatT20Bonus(bonus)}`,
      });
  };

  const hp = track(T20_RESOURCE_KEYS.hitPoints);
  const pm = track(T20_RESOURCE_KEYS.manaPoints);
  const money = track(T20_RESOURCE_KEYS.money);


  /** Grava a ficha inteira (edições à mão). */
  const saveSheet = async (next: typeof sheet) => {
    try {
      const saved = await saveCharacterSheet(getSupabase(), props.character.id, version, { sheet: next });
      setSheet(next);
      setVersion(saved.version);
      toast({ tone: 'success', title: 'Ficha salva.' });
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
      throw error;
    }
  };

  // Habilidade com escolha que entrou sem ela (ex.: Protótipo do Inventor): as opções do livro
  // aparecem na própria habilidade; escolher grava "Protótipo (Item superior)".
  const plainName = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const pendingChoices = (ability: CharacterAbility): string[] => {
    if (ability.kind !== 'class_feature' || ability.name.includes('(')) return [];
    for (const klass of content.classes) {
      const source = klass.abilities.find((entry) => plainName(entry.name) === plainName(ability.name));
      const options = source ? t20AbilityChoiceNames(source) : [];
      if (options.length > 1) return options.map((option) => option.charAt(0).toUpperCase() + option.slice(1));
    }
    return [];
  };
  const chooseOption = async (ability: CharacterAbility, option: string) => {
    try {
      const saved = await updateCharacterAbility(getSupabase(), ability.id, {
        name: `${ability.name} (${option})`.slice(0, 120),
        source: ability.source,
        description: ability.description,
        data: ability.data,
        resourceId: ability.resourceId,
      });
      setAbilities((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      <PendingUpdatesPrompt
        characterId={props.character.id}
        enabled={props.gate.isOwner && props.canEditSheet && content.classes.length > 0}
        updates={pendingUpdates}
        onCreated={(created) => setAbilities((current) => [...current, ...created])}
      />
      {props.canEditSheet ? (
        <T20GrantsCard
          characterId={props.character.id}
          sheet={sheet}
          version={version}
          grants={grants}
          itemGrants={itemGrants}
          labelGrants={labelGrants}
          abilities={abilities}
          onSheet={(next, nextVersion) => {
            setSheet(next);
            setVersion(nextVersion);
          }}
          onAbilities={(created) => setAbilities((current) => [...current, ...created])}
          onAbilityUpdated={(updated) => setAbilities((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          onItems={(created) => setItems((current) => [...current, ...created])}
        />
      ) : null}
      <Card ornate>
        {props.portraitUrl || props.canEditSheet ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {props.portraitUrl ? (
              <Pressable onPress={() => setPortraitOpen(true)} accessibilityRole="imagebutton" accessibilityLabel={`Retrato de ${props.character.name} (tela cheia)`}>
                <Image source={{ uri: props.portraitUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} />
              </Pressable>
            ) : null}
            {props.canEditSheet ? (
              <View style={{ flex: 1 }}>
                <ImageUploadButtons
                  preset="portrait"
                  label="Enviar retrato"
                  currentPath={props.portraitPath}
                  pathFor={(fileName) => characterPortraitPath(props.character.id, fileName)}
                  apply={async (path) => {
                    setVersion(await setCharacterPortrait(getSupabase(), props.character.id, path));
                  }}
                  onDone={() => {
                    toast({ tone: 'success', title: 'Retrato atualizado.' });
                    props.onReload();
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        <Modal visible={portraitOpen} transparent animationType="fade" onRequestClose={() => setPortraitOpen(false)}>
          <Pressable style={styles.fullscreen} onPress={() => setPortraitOpen(false)} accessibilityLabel="Fechar o retrato">
            {props.portraitUrl ? <Image source={{ uri: props.portraitUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
          </Pressable>
        </Modal>
        <AppText variant="eyebrow">Tormenta20 · nível {derived.level}</AppText>
        <AppText variant="title">{props.character.name}</AppText>
        <AppText variant="small">
          {[
            sheet.identity.race,
            sheet.identity.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / '),
            sheet.identity.origin,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <View style={styles.stats}>
          <Badge label={`Defesa ${derived.defense}`} tone="parchment" />
          <Badge label={`Iniciativa ${formatT20Bonus(derived.initiative)}`} tone="parchment" />
          <Badge label={`${String(derived.speed).replace('.', ',')} m`} tone="parchment" />
          {derived.spellDc !== null ? (
            <Badge label={`CD ${derived.spellDc}`} tone="parchment" />
          ) : null}
        </View>
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        accessibilityLabel="Seções da ficha"
        options={[
          { value: 'jogo', label: 'Jogo' },
          { value: 'pericias', label: 'Perícias' },
          { value: 'poderes', label: 'Poderes' },
          { value: 'itens', label: 'Itens' },
          { value: 'evolucao', label: 'Evolução' },
        ]}
      />

      {tab === 'evolucao' ? (
        <Card>
          <AppText variant="heading">Evolução</AppText>
          <AppText>
            Nível {derived.level} ·{' '}
            {sheet.identity.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / ')}
          </AppText>
          <AppText variant="small">
            {props.gate.inCampaign
              ? 'Na campanha, o mestre libera o próximo nível e você escolhe as melhorias aqui.'
              : 'Suba de nível escolhendo as melhorias do nível novo.'}
          </AppText>
          <LevelGate
            characterId={props.character.id}
            characterName={props.character.name}
            level={derived.level}
            canEditSheet={props.canEditSheet}
            gate={props.gate}
            onLevelUp={() => setLevelUp(true)}
          />
        </Card>
      ) : null}
      {tab === 'evolucao' && props.canEditSheet && !editingStats ? (
        <Button variant="secondary" label="Ajustar números da ficha" onPress={() => setEditingStats(true)} />
      ) : null}
      {tab === 'evolucao' && editingStats ? (
        <T20StatsEditor
          sheet={sheet}
          hitPointsMax={hp?.max ?? sheet.hitPoints.max}
          manaPointsMax={pm?.max ?? sheet.manaPoints.max}
          onCancel={() => setEditingStats(false)}
          onSave={async (change) => {
            await saveSheet(change.sheet);
            if (hp && change.hitPointsMax !== hp.max) await adjust(T20_RESOURCE_KEYS.hitPoints, 'set_max', change.hitPointsMax);
            if (pm && change.manaPointsMax !== pm.max) await adjust(T20_RESOURCE_KEYS.manaPoints, 'set_max', change.manaPointsMax);
            setEditingStats(false);
          }}
        />
      ) : null}
      {tab === 'evolucao' && props.gate.isOwner ? (
        <DeleteCharacterCard
          characterId={props.character.id}
          name={props.character.name}
          portraitPath={props.portraitPath}
        />
      ) : null}

      {tab === 'jogo' && props.campaignId ? (
        <T20TurnCard
          campaignId={props.campaignId}
          characterId={props.character.id}
          canAct={props.canEditPlay}
          onConditionsEnded={(ended) =>
            setConditions((current) =>
              current
                .filter((entry) => !ended.includes(entry.key))
                .map((entry) =>
                  entry.roundsRemaining !== null
                    ? { ...entry, roundsRemaining: Math.max(0, entry.roundsRemaining - 1) }
                    : entry,
                ),
            )
          }
        />
      ) : null}
      {tab === 'jogo' ? (
        <T20Attacks
          characterId={props.character.id}
          sheet={effectiveSheet}
          derived={derived}
          items={items}
          content={content}
          mode={rollMode}
          canAct={props.canEditPlay}
          reminders={situational
            .filter((bonus) => activeSituations.includes(bonus.id) && bonus.effect.note)
            .map((bonus) => `${bonus.source}: ${bonus.effect.note}`)}
        />
      ) : null}
      {tab === 'jogo' ? (
        <>
          {[
            {
              key: T20_RESOURCE_KEYS.hitPoints,
              label: 'Pontos de Vida',
              minus: 'Dano',
              minusOp: 'damage' as const,
              plus: 'Cura',
              data: hp,
            },
            {
              key: T20_RESOURCE_KEYS.manaPoints,
              label: 'Pontos de Mana',
              minus: 'Gastar',
              minusOp: 'spend' as const,
              plus: 'Recuperar',
              data: pm,
            },
          ].map((entry) =>
            entry.data ? (
              <Card key={entry.key}>
                <AppText style={{ fontFamily: fonts.sansMedium }}>{entry.label}</AppText>
                <HealthBar
                  current={entry.data.current}
                  max={entry.data.max}
                  temp={entry.data.temp}
                />
                {props.canEditPlay ? (
                  <View style={styles.row}>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="number-pad"
                      accessibilityLabel="Quantidade"
                      style={styles.input}
                    />
                    <Button
                      label={entry.minus}
                      variant="secondary"
                      compact
                      onPress={() => void adjust(entry.key, entry.minusOp, value)}
                    />
                    <Button
                      label={entry.plus}
                      variant="secondary"
                      compact
                      onPress={() => void adjust(entry.key, 'heal', value)}
                    />
                  </View>
                ) : null}
                {props.canEditPlay && entry.key === T20_RESOURCE_KEYS.hitPoints ? (
                  <T20TempHitPoints current={entry.data.temp ?? 0} onSet={(n) => adjust(T20_RESOURCE_KEYS.hitPoints, 'set_temp', n)} />
                ) : null}
              </Card>
            ) : null,
          )}
          {props.canEditPlay ? (
            <RestCard
              level={derived.level}
              onRest={async (gain) => {
                await adjust(T20_RESOURCE_KEYS.hitPoints, 'heal', gain);
                await adjust(T20_RESOURCE_KEYS.manaPoints, 'heal', gain);
                toast({ tone: 'success', title: `Descanso: +${gain} PV e PM.` });
              }}
            />
          ) : null}
          <Card>
            <AppText style={{ fontFamily: fonts.sansMedium }}>Condições</AppText>
            {conditions.length === 0 ? <AppText variant="small">Nenhuma.</AppText> : null}
            {conditions.map((condition) => (
              <View key={condition.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <AppText>
                    {findT20Condition(condition.key)?.label ?? condition.key}
                    {condition.roundsRemaining !== null
                      ? ` · ${condition.roundsRemaining === 1 ? '1 rodada' : `${condition.roundsRemaining} rodadas`}`
                      : ''}
                  </AppText>
                  <AppText variant="small">
                    {findT20Condition(condition.key)?.summary ?? ''}
                  </AppText>
                </View>
                {props.canEditPlay ? (
                  <Button
                    label="Remover"
                    variant="ghost"
                    compact
                    onPress={async () => {
                      try {
                        await removeCharacterCondition(getSupabase(), condition.id);
                        setConditions((current) =>
                          current.filter((entry) => entry.id !== condition.id),
                        );
                      } catch (error) {
                        toast({ tone: 'danger', title: failureMessage(error) });
                      }
                    }}
                  />
                ) : null}
              </View>
            ))}
            {props.canEditPlay ? (
              <View style={styles.row}>
                <AppText variant="small" style={{ flex: 1 }}>
                  Duração em rodadas (vazio = até remover)
                </AppText>
                <TextInput
                  value={condRounds}
                  onChangeText={(text) => setCondRounds(text.replace(/[^0-9]/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  placeholder="Rodadas"
                  placeholderTextColor={colors.fgMuted}
                  accessibilityLabel="Duração em rodadas"
                  style={{
                    minWidth: 80,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    color: colors.fg,
                  }}
                />
              </View>
            ) : null}
            {props.canEditPlay && conditions.some((entry) => entry.roundsRemaining !== null) ? (
              <Button
                label="Passar rodada"
                variant="secondary"
                compact
                onPress={async () => {
                  try {
                    const ended = await tickCharacterConditions(getSupabase(), props.character.id);
                    setConditions((current) =>
                      current
                        .filter((entry) => !ended.includes(entry.key))
                        .map((entry) =>
                          entry.roundsRemaining !== null
                            ? { ...entry, roundsRemaining: Math.max(0, entry.roundsRemaining - 1) }
                            : entry,
                        ),
                    );
                    if (ended.length)
                      toast({
                        tone: 'info',
                        title: `Terminou: ${ended.map((key) => findT20Condition(key)?.label ?? key).join(', ')}.`,
                      });
                  } catch (error) {
                    toast({ tone: 'danger', title: failureMessage(error) });
                  }
                }}
              />
            ) : null}
            {props.canEditPlay ? (
              <PickerField
                label="Aplicar condição"
                value=""
                onChange={async (key) => {
                  try {
                    const rounds = condRounds && Number(condRounds) > 0 ? Number(condRounds) : null;
                    await applyCharacterCondition(
                      getSupabase(),
                      props.character.id,
                      key,
                      null,
                      rounds,
                    );
                    setConditions((current) => [
                      ...current,
                      { id: `local-${key}`, key, level: null, note: '', roundsRemaining: rounds },
                    ]);
                    setCondRounds('');
                  } catch (error) {
                    toast({ tone: 'danger', title: failureMessage(error) });
                  }
                }}
                options={t20Conditions
                  .filter((definition) => !conditions.some((entry) => entry.key === definition.key))
                  .map((definition) => ({
                    value: definition.key,
                    label: definition.label,
                    description: definition.summary,
                  }))}
              />
            ) : null}
          </Card>
          {money ? (
            <T20MoneyCard
              amount={money.current}
              canEdit={props.canEditPlay}
              onSpend={(n) => adjust(T20_RESOURCE_KEYS.money, 'spend', n)}
              onReceive={(n) => adjust(T20_RESOURCE_KEYS.money, 'set_current', money.current + n)}
            />
          ) : null}
        </>
      ) : null}

      {tab === 'pericias' || tab === 'jogo' ? (
        <Segmented<DiceRollMode>
          value={rollMode}
          onChange={setRollMode}
          accessibilityLabel="Modo da rolagem"
          options={[
            { value: 'disadvantage', label: 'Desvantagem' },
            { value: 'normal', label: 'Normal' },
            { value: 'advantage', label: 'Vantagem' },
          ]}
        />
      ) : null}

      {tab === 'pericias' && props.canEditSheet && !editingSkills ? (
        <Button variant="secondary" label="Editar atributos e perícias" onPress={() => setEditingSkills(true)} />
      ) : null}
      {tab === 'pericias' && editingSkills ? (
        <T20SkillsEditor
          sheet={sheet}
          onCancel={() => setEditingSkills(false)}
          onSave={async (next) => {
            await saveSheet(next);
            setEditingSkills(false);
          }}
        />
      ) : null}
      {tab === 'pericias' ? <T20AutomaticBonusesCard bonuses={derived.automaticBonuses} /> : null}
      {tab === 'pericias' ? (
        <T20SituationalCard
          list={situational}
          active={activeSituations}
          onToggle={(id) =>
            setActiveSituations((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
          }
        />
      ) : null}
      {tab === 'pericias' ? (
        <Card>
          <View style={styles.stats}>
            {T20_ATTRIBUTES.map((key) => (
              <Pressable
                key={key}
                onPress={() => roll(t20AttributeLabels[key].name, derived.attributes[key])}
                style={styles.attr}
                accessibilityRole="button"
              >
                <AppText variant="small">{t20AttributeLabels[key].abbreviation}</AppText>
                <AppText variant="number">{formatT20Bonus(derived.attributes[key])}</AppText>
              </Pressable>
            ))}
          </View>
          {Object.values(derived.skills).map((skill) => (
            <Pressable
              key={skill.skill}
              onPress={() => skill.usable && roll(skill.label, skill.total)}
              style={[styles.row, { paddingVertical: 6, opacity: skill.usable ? 1 : 0.5 }]}
              accessibilityRole="button"
            >
              <AppText style={{ flex: 1, color: skill.trained ? colors.fgAccent : colors.fg }}>
                {skill.trained ? '● ' : '○ '}
                {skill.label}
              </AppText>
              <AppText variant="number">{formatT20Bonus(skill.total)}</AppText>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {tab === 'poderes' && props.canEditSheet && editingAbility === null ? (
        <Button variant="secondary" label="Adicionar habilidade, poder ou magia" onPress={() => setEditingAbility('new')} />
      ) : null}
      {tab === 'poderes' && editingAbility !== null ? (
        <T20AbilityForm
          characterId={props.character.id}
          entry={editingAbility === 'new' ? null : editingAbility}
          onCancel={() => setEditingAbility(null)}
          onSaved={(saved, isNew) => {
            setAbilities((current) => (isNew ? [...current, saved] : current.map((entry) => (entry.id === saved.id ? saved : entry))));
            setEditingAbility(null);
          }}
          onDeleted={(abilityId) => {
            setAbilities((current) => current.filter((entry) => entry.id !== abilityId));
            setEditingAbility(null);
          }}
        />
      ) : null}
      {tab === 'poderes' ? (
        <>
          {abilities.map((ability) => (
            <Card key={ability.id}>
              <AppText style={{ fontFamily: fonts.sansMedium }}>{ability.name}</AppText>
              <AppText variant="small">{ability.source}</AppText>
              {props.canEditSheet && pendingChoices(ability).length ? (
                <View style={{ gap: 6 }}>
                  <AppText variant="small" style={{ color: colors.fgAccent }}>
                    Escolha uma opção:
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {pendingChoices(ability).map((option) => (
                      <Button key={option} compact variant="secondary" label={option} onPress={() => void chooseOption(ability, option)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {props.canEditSheet ? (
                <Button compact variant="ghost" label="Editar" onPress={() => setEditingAbility(ability)} />
              ) : null}
              <AppText variant="serif" numberOfLines={8}>
                {ability.description}
              </AppText>
              {props.canEditPlay ? (
                <Button
                  label={`${ability.kind === 'spell' ? 'Lançar' : 'Usar'}${t20AbilityCost(ability) > 0 ? ` (${t20AbilityCost(ability)} PM)` : ''}`}
                  variant="secondary"
                  compact
                  onPress={() => {
                    const cost = t20AbilityCost(ability);
                    if (cost > 0 && (track(T20_RESOURCE_KEYS.manaPoints)?.current ?? 0) < cost) {
                      toast({
                        tone: 'warning',
                        title: `PM insuficientes para ${ability.name} (${cost} PM).`,
                      });
                      return;
                    }
                    if (cost > 0) void adjust(T20_RESOURCE_KEYS.manaPoints, 'spend', cost);
                    const label = `${ability.kind === 'spell' ? 'Lançou' : 'Usou'}: ${ability.name}`;
                    const diceText = /\b\d{0,2}d\d{1,3}(?:\s*[+-]\s*\d+)?\b/i
                      .exec(ability.description ?? '')?.[0]
                      ?.replace(/\s+/g, '');
                    if (diceText && dice) void dice.roll({ expression: diceText, label });
                    else
                      toast({
                        tone: 'success',
                        title: label,
                        description: cost > 0 ? `−${cost} PM` : undefined,
                      });
                    if (props.campaignId)
                      void logT20TurnUse(props.campaignId, props.character.id, label);
                  }}
                />
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {tab === 'itens' ? (
        <>
          <Card>
            <AppText variant="heading">Carga</AppText>
            <AppText
              variant="small"
              style={{
                color: usedSpaces > derived.carryCapacity ? palette.ember[300] : colors.fgSecondary,
              }}
            >
              {usedSpaces.toLocaleString('pt-BR')} de {derived.carryCapacity} espaços
              {usedSpaces > derived.carryCapacity ? ' (sobrecarregado)' : ''}
            </AppText>
          </Card>
          {editingItem ? (
            <T20NewItem
              key={editingItem.id}
              characterId={props.character.id}
              item={editingItem}
              onCreated={(saved) =>
                setItems((current) =>
                  current.map((entry) => (entry.id === saved.id ? saved : entry)),
                )
              }
              onClose={() => setEditingItem(null)}
            />
          ) : null}
          {props.canEditPlay ? (
            addingItem ? (
              <T20NewItem
                characterId={props.character.id}
                onCreated={(item) => setItems((current) => [...current, item])}
                onClose={() => setAddingItem(false)}
              />
            ) : (
              <Button
                label="Adicionar item"
                variant="secondary"
                onPress={() => setAddingItem(true)}
              />
            )
          ) : null}
          {items.length === 0 ? (
            <Card>
              <AppText variant="small">Mochila vazia.</AppText>
            </Card>
          ) : null}
          {groupByCategory(items).map((group) => (
            <Card key={group.category}>
              <AppText variant="eyebrow">{itemCategoryLabels[group.category]}</AppText>
              {group.items.map((item) => (
                <View key={item.id} style={[styles.row, { paddingVertical: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <AppText>
                      {item.name}
                      {item.isEquipped ? ' · equipado' : ''}
                    </AppText>
                    {item.description || item.weight !== null ? (
                      <AppText variant="small">
                        {[
                          item.weight !== null
                            ? `${item.weight.toLocaleString('pt-BR')} espaço(s) cada`
                            : null,
                          item.description,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </AppText>
                    ) : null}
                  </View>
                  {props.canEditPlay ? (
                    <>
                      <Button
                        label={item.isEquipped ? 'Tirar' : 'Equipar'}
                        variant="ghost"
                        compact
                        onPress={() => void toggleEquipped(item)}
                      />
                      <Button
                        label="−"
                        variant="ghost"
                        compact
                        disabled={item.quantity <= 0}
                        onPress={() => void changeQuantity(item, -1)}
                      />
                      <AppText>{item.quantity}</AppText>
                      <Button
                        label="+"
                        variant="ghost"
                        compact
                        onPress={() => void changeQuantity(item, 1)}
                      />
                      <Button
                        label="Editar"
                        variant="ghost"
                        compact
                        onPress={() => setEditingItem(item)}
                      />
                      <Button
                        label="Excluir"
                        variant="ghost"
                        compact
                        onPress={() => void removeItem(item)}
                      />
                    </>
                  ) : (
                    <AppText>× {item.quantity}</AppText>
                  )}
                </View>
              ))}
            </Card>
          ))}
        </>
      ) : null}

      {levelUp ? (
        <LevelUpModal
          content={content}
          sheet={sheet}
          onClose={() => setLevelUp(false)}
          onApply={async (choices) => {
            const plan = planT20LevelUp(content, sheet, 0);
            const result = applyT20LevelUp(sheet, plan, choices);
            if (result.issues.length) return result.issues.join(' ');
            try {
              const client = getSupabase();
              for (const [key, gain] of [
                [T20_RESOURCE_KEYS.hitPoints, result.sheet.hitPoints.max - sheet.hitPoints.max],
                [T20_RESOURCE_KEYS.manaPoints, plan.manaPointsGained],
              ] as const) {
                const target = track(key);
                if (!target || gain <= 0) continue;
                await adjustCharacterResource(
                  client,
                  target.id,
                  'set_max',
                  (target.max ?? 0) + gain,
                );
                const healed = await adjustCharacterResource(client, target.id, 'heal', gain);
                setResources((current) =>
                  current.map((entry) => (entry.id === healed.id ? healed : entry)),
                );
              }
              const created: CharacterAbility[] = [];
              for (const entry of result.abilities) {
                created.push(
                  await createCharacterAbility(client, props.character.id, {
                    kind: entry.kind,
                    name: entry.name,
                    source: entry.source,
                    description: entry.description,
                    data: entry.data as CharacterAbility['data'],
                    resourceId: null,
                  }),
                );
              }
              // Ficha por último: numa campanha com edição bloqueada, o nível liberado é o que permite criar as habilidades.
              const saved = await saveCharacterSheet(client, props.character.id, version, {
                sheet: result.sheet,
              });
              await addCharacterEvent(client, props.character.id, {
                kind: 'level_up',
                summary: result.summary,
                data: { level: plan.newTotalLevel },
              });
              setSheet(result.sheet);
              setVersion(saved.version);
              setAbilities((current) => [...current, ...created]);
              toast({ tone: 'success', title: `Nível ${plan.newTotalLevel}!` });
              setLevelUp(false);
              return null;
            } catch (error) {
              return failureMessage(error);
            }
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function RestCard({ level, onRest }: { level: number; onRest: (gain: number) => Promise<void> }) {
  const [quality, setQuality] = useState<T20RestQuality>('normal');
  return (
    <Card>
      <PickerField
        label="Descanso"
        value={quality}
        onChange={(value) => setQuality(value as T20RestQuality)}
        options={(Object.keys(T20_REST_QUALITY) as T20RestQuality[]).map((key) => ({
          value: key,
          label: `${T20_REST_QUALITY[key].label} (+${t20RestRecovery(level, key)})`,
        }))}
      />
      <Button
        label="Descansar"
        variant="secondary"
        onPress={() => void onRest(t20RestRecovery(level, quality))}
      />
    </Card>
  );
}

function LevelUpModal({
  content,
  sheet,
  onClose,
  onApply,
}: {
  content: ReturnType<typeof buildT20Content>;
  sheet: T20Sheet;
  onClose: () => void;
  onApply: (choices: T20LevelUpChoices) => Promise<string | null>;
}) {
  const plan = useMemo(() => planT20LevelUp(content, sheet, 0), [content, sheet]);
  const [powerId, setPowerId] = useState('');
  const [spellIds, setSpellIds] = useState<string[]>([]);
  const [attribute, setAttribute] = useState<T20LevelUpChoices['attribute']>('');
  const [featureChoices, setFeatureChoices] = useState<Record<string, string>>({});
  const [skills, setSkills] = useState<T20Skill[]>([]);
  const preview = applyT20LevelUp(sheet, plan, {
    powerId,
    spellIds,
    attribute,
    featureChoices,
    skills,
  });
  const chosenPower = plan.powerOptions.find((power) => power.id === powerId);
  const skillPick = chosenPower ? t20PowerSkillPick(chosenPower) : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={styles.content}
      >
        <AppText variant="title">
          Nível {plan.newTotalLevel}: {plan.classDef?.name ?? 'classe'} {plan.newClassLevel}
        </AppText>
        <AppText>
          +{preview.sheet.hitPoints.max - sheet.hitPoints.max} PV e +{plan.manaPointsGained} PM.
        </AppText>
        {plan.tableText ? (
          <AppText variant="small">Neste nível (tabela da classe): {plan.tableText}.</AppText>
        ) : null}
        {plan.abilities.map((ability) => (
          <Card key={ability.name}>
            <AppText style={{ fontFamily: fonts.sansMedium }}>{ability.name}</AppText>
            <AppText variant="small" numberOfLines={6}>
              {ability.text}
            </AppText>
          </Card>
        ))}
        {plan.featureChoices.map((choice) => (
          <PickerField
            key={choice.ability}
            label={`${choice.ability}: escolha`}
            value={featureChoices[choice.ability] ?? ''}
            onChange={(id) =>
              setFeatureChoices((current) => ({ ...current, [choice.ability]: id }))
            }
            options={choice.options.map((option) => ({
              value: option.id,
              label: option.name,
              description: option.text.slice(0, 140),
            }))}
          />
        ))}
        {plan.powerChoice ? (
          <PickerField
            label="Poder do nível"
            value={powerId}
            onChange={(value) => {
              setPowerId(value);
              setSkills([]);
            }}
            options={plan.powerOptions.map((power) => ({
              value: power.id,
              label: power.name,
              description: power.problems.length
                ? `Falta ${power.problems.join(', ')}`
                : power.text.slice(0, 140),
              disabled: power.problems.length > 0,
            }))}
          />
        ) : null}
        {skillPick ? (
          <View style={{ gap: 4 }}>
            <AppText variant="small">
              Perícias ({skills.length}/{skillPick.count})
            </AppText>
            {T20_SKILL_IDS.map((skill) => {
              const blocked = skillPick.trains && sheet.skills.trained.includes(skill);
              return (
                <CheckRow
                  key={skill}
                  label={`${T20_SKILLS[skill].label}${blocked ? ' (já treinada)' : ''}`}
                  checked={skills.includes(skill)}
                  disabled={
                    blocked || (!skills.includes(skill) && skills.length >= skillPick.count)
                  }
                  onChange={(checked) =>
                    setSkills((current) =>
                      checked ? [...current, skill] : current.filter((entry) => entry !== skill),
                    )
                  }
                />
              );
            })}
          </View>
        ) : null}
        {chosenPower && isT20AttributeIncrease(chosenPower.name) ? (
          <PickerField
            label="Atributo que aumenta (+1)"
            value={attribute ?? ''}
            onChange={(value) => setAttribute(value as T20LevelUpChoices['attribute'])}
            options={T20_ATTRIBUTES.map((key) => ({
              value: key,
              label: `${t20AttributeLabels[key].name} (${formatT20Bonus(sheet.attributes[key])} → ${formatT20Bonus(sheet.attributes[key] + 1)})`,
              description: plan.blockedAttributes.includes(key)
                ? 'Já aumentado neste patamar'
                : undefined,
              disabled: plan.blockedAttributes.includes(key),
            }))}
          />
        ) : null}
        {plan.newSpells > 0
          ? plan.spellOptions.map((spell) => (
              <CheckRow
                key={spell.id}
                label={`${spell.name} (${spell.circle}º)`}
                checked={spellIds.includes(spell.id)}
                disabled={!spellIds.includes(spell.id) && spellIds.length >= plan.newSpells}
                onChange={(checked) =>
                  setSpellIds((current) =>
                    checked ? [...current, spell.id] : current.filter((id) => id !== spell.id),
                  )
                }
              />
            ))
          : null}
        {error ? <Notice tone="warning" message={error} /> : null}
        <View style={styles.row}>
          <Button label="Cancelar" variant="ghost" onPress={onClose} />
          <View style={{ flex: 1 }} />
          <Button
            label={`Aplicar nível ${plan.newTotalLevel}`}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(await onApply({ powerId, spellIds, attribute, featureChoices, skills }));
              setBusy(false);
            }}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginVertical: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  input: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.fg,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  attr: {
    width: 64,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingVertical: 6,
  },
});
