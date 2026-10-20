import {
  addCharacterEvent,
  adjustCharacterResource,
  applyCharacterCondition,
  createCharacterAbility,
  removeCharacterCondition,
  saveCharacterSheet,
  type CharacterAbility,
  type CharacterCondition,
  type CharacterItem,
  type CharacterResource,
} from '@codexveil/database';
import { rollDiceLocally, type TrackOperation } from '@codexveil/domain';
import {
  T20_ATTRIBUTES,
  T20_RESOURCE_KEYS,
  T20_REST_QUALITY,
  applyT20LevelUp,
  buildT20Content,
  isT20AttributeIncrease,
  type T20LevelUpChoices,
  computeT20Derived,
  findT20Condition,
  formatT20Bonus,
  planT20LevelUp,
  t20AttributeLabels,
  t20Conditions,
  t20RestRecovery,
  type T20ContentSource,
  type T20RestQuality,
  type T20Sheet,
} from '@codexveil/rpg-systems/tormenta20';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { CheckRow } from '@/components/ui/controls';
import { HealthBar } from '@/components/ui/health-bar';
import { PickerField } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { Notice } from '@/components/ui/states';
import { DiceProvider, useDice } from '@/components/dice/dice';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/lib/theme';

type Tab = 'jogo' | 'pericias' | 'poderes' | 'itens';

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
  const [sheet, setSheet] = useState(props.sheet);
  const [version, setVersion] = useState(props.character.version);
  const [resources, setResources] = useState(props.resources);
  const [conditions, setConditions] = useState(props.conditions);
  const [abilities, setAbilities] = useState(props.abilities);
  const [amount, setAmount] = useState('1');
  const [levelUp, setLevelUp] = useState(false);
  const content = useMemo(() => buildT20Content(props.sources), [props.sources]);
  const derived = useMemo(() => computeT20Derived(sheet, conditions.map((entry) => entry.key)), [sheet, conditions]);
  const track = (key: string) => resources.find((entry) => entry.key === key);
  const value = Math.max(1, Number(amount) || 1);

  const adjust = async (key: string, operation: TrackOperation, quantity: number) => {
    const target = track(key);
    if (!target || quantity <= 0) return;
    try {
      const saved = await adjustCharacterResource(getSupabase(), target.id, operation, quantity);
      setResources((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (error) {
      toast({ tone: 'danger', title: 'Não foi possível atualizar', description: failureMessage(error) });
    }
  };
  const roll = (label: string, bonus: number) => {
    const expression = `1d20${bonus >= 0 ? '+' : ''}${bonus}`;
    if (dice) {
      void dice.roll({ expression, label });
      return;
    }
    const result = rollDiceLocally(expression);
    if (result) toast({ tone: 'info', title: `${label}: ${result.total}`, description: `1d20 (${result.total - bonus}) ${formatT20Bonus(bonus)}` });
  };

  const hp = track(T20_RESOURCE_KEYS.hitPoints);
  const pm = track(T20_RESOURCE_KEYS.manaPoints);
  const money = track(T20_RESOURCE_KEYS.money);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={styles.content}>
      <Card ornate>
        <AppText variant="eyebrow">Tormenta20 · nível {derived.level}</AppText>
        <AppText variant="title">{props.character.name}</AppText>
        <AppText variant="small">
          {[sheet.identity.race, sheet.identity.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / '), sheet.identity.origin].filter(Boolean).join(' · ')}
        </AppText>
        <View style={styles.stats}>
          <Badge label={`Defesa ${derived.defense}`} tone="parchment" />
          <Badge label={`Iniciativa ${formatT20Bonus(derived.initiative)}`} tone="parchment" />
          <Badge label={`${String(derived.speed).replace('.', ',')} m`} tone="parchment" />
          {derived.spellDc !== null ? <Badge label={`CD ${derived.spellDc}`} tone="parchment" /> : null}
        </View>
        {props.canEditSheet && derived.level < 20 ? <Button label="Subir de nível" onPress={() => setLevelUp(true)} /> : null}
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
        ]}
      />

      {tab === 'jogo' ? (
        <>
          {[
            { key: T20_RESOURCE_KEYS.hitPoints, label: 'Pontos de Vida', minus: 'Dano', minusOp: 'damage' as const, plus: 'Cura', data: hp },
            { key: T20_RESOURCE_KEYS.manaPoints, label: 'Pontos de Mana', minus: 'Gastar', minusOp: 'spend' as const, plus: 'Recuperar', data: pm },
          ].map((entry) =>
            entry.data ? (
              <Card key={entry.key}>
                <AppText style={{ fontFamily: fonts.sansMedium }}>{entry.label}</AppText>
                <HealthBar current={entry.data.current} max={entry.data.max} temp={entry.data.temp} />
                {props.canEditPlay ? (
                  <View style={styles.row}>
                    <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" accessibilityLabel="Quantidade" style={styles.input} />
                    <Button label={entry.minus} variant="secondary" compact onPress={() => void adjust(entry.key, entry.minusOp, value)} />
                    <Button label={entry.plus} variant="secondary" compact onPress={() => void adjust(entry.key, 'heal', value)} />
                  </View>
                ) : null}
              </Card>
            ) : null,
          )}
          {props.canEditPlay ? <RestCard level={derived.level} onRest={async (gain) => { await adjust(T20_RESOURCE_KEYS.hitPoints, 'heal', gain); await adjust(T20_RESOURCE_KEYS.manaPoints, 'heal', gain); toast({ tone: 'success', title: `Descanso: +${gain} PV e PM.` }); }} /> : null}
          <Card>
            <AppText style={{ fontFamily: fonts.sansMedium }}>Condições</AppText>
            {conditions.length === 0 ? <AppText variant="small">Nenhuma.</AppText> : null}
            {conditions.map((condition) => (
              <View key={condition.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <AppText>{findT20Condition(condition.key)?.label ?? condition.key}</AppText>
                  <AppText variant="small">{findT20Condition(condition.key)?.summary ?? ''}</AppText>
                </View>
                {props.canEditPlay ? (
                  <Button
                    label="Remover"
                    variant="ghost"
                    compact
                    onPress={async () => {
                      try {
                        await removeCharacterCondition(getSupabase(), condition.id);
                        setConditions((current) => current.filter((entry) => entry.id !== condition.id));
                      } catch (error) {
                        toast({ tone: 'danger', title: failureMessage(error) });
                      }
                    }}
                  />
                ) : null}
              </View>
            ))}
            {props.canEditPlay ? (
              <PickerField
                label="Aplicar condição"
                value=""
                onChange={async (key) => {
                  try {
                    await applyCharacterCondition(getSupabase(), props.character.id, key);
                    setConditions((current) => [...current, { id: `local-${key}`, key, level: null, note: '', roundsRemaining: null }]);
                  } catch (error) {
                    toast({ tone: 'danger', title: failureMessage(error) });
                  }
                }}
                options={t20Conditions.filter((definition) => !conditions.some((entry) => entry.key === definition.key)).map((definition) => ({ value: definition.key, label: definition.label, description: definition.summary }))}
              />
            ) : null}
          </Card>
          {money ? <Badge label={`T$ ${money.current}`} tone="parchment" /> : null}
        </>
      ) : null}

      {tab === 'pericias' ? (
        <Card>
          <View style={styles.stats}>
            {T20_ATTRIBUTES.map((key) => (
              <Pressable key={key} onPress={() => roll(t20AttributeLabels[key].name, derived.attributes[key])} style={styles.attr} accessibilityRole="button">
                <AppText variant="small">{t20AttributeLabels[key].abbreviation}</AppText>
                <AppText variant="number">{formatT20Bonus(derived.attributes[key])}</AppText>
              </Pressable>
            ))}
          </View>
          {Object.values(derived.skills).map((skill) => (
            <Pressable key={skill.skill} onPress={() => skill.usable && roll(skill.label, skill.total)} style={[styles.row, { paddingVertical: 6, opacity: skill.usable ? 1 : 0.5 }]} accessibilityRole="button">
              <AppText style={{ flex: 1, color: skill.trained ? colors.fgAccent : colors.fg }}>
                {skill.trained ? '● ' : '○ '}
                {skill.label}
              </AppText>
              <AppText variant="number">{formatT20Bonus(skill.total)}</AppText>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {tab === 'poderes' ? (
        <>
          {abilities.map((ability) => (
            <Card key={ability.id}>
              <AppText style={{ fontFamily: fonts.sansMedium }}>{ability.name}</AppText>
              <AppText variant="small">{ability.source}</AppText>
              <AppText variant="serif" numberOfLines={8}>
                {ability.description}
              </AppText>
              {ability.kind === 'spell' && props.canEditPlay && pm ? (
                <Button
                  label={`Lançar (${(ability.data as { cost?: number }).cost ?? 1} PM)`}
                  variant="secondary"
                  compact
                  onPress={() => {
                    const cost = (ability.data as { cost?: number }).cost ?? 1;
                    if ((track(T20_RESOURCE_KEYS.manaPoints)?.current ?? 0) < cost) toast({ tone: 'warning', title: 'PM insuficientes.' });
                    else void adjust(T20_RESOURCE_KEYS.manaPoints, 'spend', cost);
                  }}
                />
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {tab === 'itens' ? (
        <Card>
          {props.items.length === 0 ? <AppText variant="small">Sem itens.</AppText> : null}
          {props.items.map((item) => (
            <View key={item.id} style={{ paddingVertical: 6 }}>
              <AppText>
                {item.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                {item.isEquipped ? ' (equipado)' : ''}
              </AppText>
              {item.description ? <AppText variant="small">{item.description}</AppText> : null}
            </View>
          ))}
        </Card>
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
              const saved = await saveCharacterSheet(client, props.character.id, version, { sheet: result.sheet });
              for (const [key, gain] of [
                [T20_RESOURCE_KEYS.hitPoints, result.sheet.hitPoints.max - sheet.hitPoints.max],
                [T20_RESOURCE_KEYS.manaPoints, plan.manaPointsGained],
              ] as const) {
                const target = track(key);
                if (!target || gain <= 0) continue;
                await adjustCharacterResource(client, target.id, 'set_max', (target.max ?? 0) + gain);
                const healed = await adjustCharacterResource(client, target.id, 'heal', gain);
                setResources((current) => current.map((entry) => (entry.id === healed.id ? healed : entry)));
              }
              const created: CharacterAbility[] = [];
              for (const entry of result.abilities) {
                created.push(await createCharacterAbility(client, props.character.id, { kind: entry.kind, name: entry.name, source: entry.source, description: entry.description, data: entry.data as CharacterAbility['data'], resourceId: null }));
              }
              await addCharacterEvent(client, props.character.id, { kind: 'level_up', summary: result.summary, data: { level: plan.newTotalLevel } });
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
        options={(Object.keys(T20_REST_QUALITY) as T20RestQuality[]).map((key) => ({ value: key, label: `${T20_REST_QUALITY[key].label} (+${t20RestRecovery(level, key)})` }))}
      />
      <Button label="Descansar" variant="secondary" onPress={() => void onRest(t20RestRecovery(level, quality))} />
    </Card>
  );
}

function LevelUpModal({ content, sheet, onClose, onApply }: { content: ReturnType<typeof buildT20Content>; sheet: T20Sheet; onClose: () => void; onApply: (choices: T20LevelUpChoices) => Promise<string | null> }) {
  const plan = useMemo(() => planT20LevelUp(content, sheet, 0), [content, sheet]);
  const [powerId, setPowerId] = useState('');
  const [spellIds, setSpellIds] = useState<string[]>([]);
  const [attribute, setAttribute] = useState<T20LevelUpChoices['attribute']>('');
  const [featureChoices, setFeatureChoices] = useState<Record<string, string>>({});
  const preview = applyT20LevelUp(sheet, plan, { powerId, spellIds, attribute, featureChoices });
  const chosenPower = plan.powerOptions.find((power) => power.id === powerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={styles.content}>
        <AppText variant="title">
          Nível {plan.newTotalLevel}: {plan.classDef?.name ?? 'classe'} {plan.newClassLevel}
        </AppText>
        <AppText>
          +{preview.sheet.hitPoints.max - sheet.hitPoints.max} PV e +{plan.manaPointsGained} PM.
        </AppText>
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
            onChange={(id) => setFeatureChoices((current) => ({ ...current, [choice.ability]: id }))}
            options={choice.options.map((option) => ({ value: option.id, label: option.name, description: option.text.slice(0, 140) }))}
          />
        ))}
        {plan.powerChoice ? (
          <PickerField
            label="Poder do nível"
            value={powerId}
            onChange={setPowerId}
            options={plan.powerOptions.map((power) => ({ value: power.id, label: power.name, description: power.problems.length ? `Falta ${power.problems.join(', ')}` : power.text.slice(0, 140), disabled: power.problems.length > 0 }))}
          />
        ) : null}
        {chosenPower && isT20AttributeIncrease(chosenPower.name) ? (
          <PickerField
            label="Atributo que aumenta (+1)"
            value={attribute ?? ''}
            onChange={(value) => setAttribute(value as T20LevelUpChoices['attribute'])}
            options={T20_ATTRIBUTES.map((key) => ({
              value: key,
              label: `${t20AttributeLabels[key].name} (${formatT20Bonus(sheet.attributes[key])} → ${formatT20Bonus(sheet.attributes[key] + 1)})`,
              description: plan.blockedAttributes.includes(key) ? 'Já aumentado neste patamar' : undefined,
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
                onChange={(checked) => setSpellIds((current) => (checked ? [...current, spell.id] : current.filter((id) => id !== spell.id)))}
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
              setError(await onApply({ powerId, spellIds, attribute, featureChoices }));
              setBusy(false);
            }}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginVertical: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  input: { width: 64, borderWidth: 1, borderColor: colors.line, borderRadius: 8, color: colors.fg, paddingHorizontal: 8, paddingVertical: 6 },
  attr: { width: 64, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 6 },
});
