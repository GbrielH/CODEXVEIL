import {
  createCharacterAbility,
  createCharacterItem,
  saveCharacterSheet,
  updateCharacterAbility,
  type CharacterAbility,
  type CharacterItem,
} from '@codexveil/database';
import {
  T20_SKILLS,
  applyT20Grant,
  applyT20ItemGrant,
  applyT20LabelGrant,
  t20PriceValue,
  type T20AutomaticBonus,
  type T20BonusEffect,
  type T20Grant,
  type T20ItemGrant,
  type T20LabelGrant,
  type T20Sheet,
  type T20SituationalBonus,
  type T20Skill,
} from '@codexveil/rpg-systems/tormenta20';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { AppText, Card, CardTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

/** "+2 em Percepção, +1 na Defesa…" (o mesmo texto do site). */
export function describeT20Bonus(effect: T20BonusEffect): string {
  return [
    ...Object.entries(effect.skills ?? {})
      .filter(([, value]) => value)
      .map(([skill, value]) => `${value > 0 ? '+' : ''}${value} em ${T20_SKILLS[skill as T20Skill].label}`),
    effect.defense ? `+${effect.defense} na Defesa` : '',
    effect.speed ? `+${effect.speed}m de deslocamento` : '',
    effect.hitPoints ? `+${effect.hitPoints} PV` : '',
    effect.manaPoints ? `+${effect.manaPoints} PM` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Bônus que valem sempre, já somados na ficha, com a origem. */
export function T20AutomaticBonusesCard({ bonuses }: { bonuses: readonly T20AutomaticBonus[] }) {
  if (!bonuses.length) return null;
  return (
    <Card>
      <CardTitle title="Bônus automáticos" description="Raça, classe e poderes que valem sempre. Já estão somados aos números." />
      {bonuses.map((bonus) => (
        <AppText key={bonus.source} variant="small">
          <AppText style={{ color: colors.fg }}>{bonus.source}</AppText> {describeT20Bonus(bonus.effect)}
        </AppText>
      ))}
    </Card>
  );
}

/** Bônus de situação: o jogador liga quando valer. */
export function T20SituationalCard({
  list,
  active,
  onToggle,
}: {
  list: readonly T20SituationalBonus[];
  active: readonly string[];
  onToggle: (id: string) => void;
}) {
  if (!list.length) return null;
  return (
    <Card>
      <CardTitle title="Bônus de situação" description="Ligue quando valer. Perícias, Defesa e deslocamento somam; ataque e dano viram lembrete." />
      {list.map((bonus) => {
        const on = active.includes(bonus.id);
        return (
          <View key={bonus.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText style={{ color: colors.fg }}>{bonus.source}</AppText>
              <AppText variant="small">{bonus.when}</AppText>
              <AppText variant="small" style={{ color: on ? colors.fgAccent : colors.fgSecondary }}>
                {[describeT20Bonus(bonus.effect), bonus.effect.note].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <Switch value={on} onValueChange={() => onToggle(bonus.id)} accessibilityLabel={`${bonus.source}: ${bonus.when}`} />
          </View>
        );
      })}
    </Card>
  );
}

interface GrantsProps {
  characterId: string;
  sheet: T20Sheet;
  version: number;
  grants: T20Grant[];
  itemGrants: T20ItemGrant[];
  labelGrants: T20LabelGrant[];
  abilities: CharacterAbility[];
  onSheet: (sheet: T20Sheet, version: number) => void;
  onAbilities: (created: CharacterAbility[]) => void;
  onAbilityUpdated: (updated: CharacterAbility) => void;
  onItems: (created: CharacterItem[]) => void;
}

/** Escolhas pendentes (magias e poderes concedidos, Protótipo, perícias e marcações no nome). */
export function T20GrantsCard(props: GrantsProps) {
  if (!props.grants.length && !props.itemGrants.length && !props.labelGrants.length) return null;
  return (
    <Card>
      <CardTitle title="Escolhas pendentes" description="Habilidades e poderes que pedem uma escolha. Escolha e confirme." />
      {props.grants.map((grant) => (
        <Picker
          key={grant.source}
          title={grant.title}
          count={grant.missing}
          options={grant.options.map((option) => ({ id: option.id, name: 'circle' in option ? `${option.name} (${option.circle}º)` : option.name }))}
          onConfirm={async (picked) => {
            const result = applyT20Grant(props.sheet, grant, picked);
            if ('error' in result) throw new Error(result.error);
            const client = getSupabase();
            const created: CharacterAbility[] = [];
            for (const entry of result.abilities)
              created.push(
                await createCharacterAbility(client, props.characterId, {
                  kind: entry.kind,
                  name: entry.name,
                  source: entry.source,
                  description: entry.description,
                  data: entry.data as CharacterAbility['data'],
                  resourceId: null,
                }),
              );
            const saved = await saveCharacterSheet(client, props.characterId, props.version, { sheet: result.sheet });
            props.onSheet(result.sheet, saved.version);
            props.onAbilities(created);
          }}
        />
      ))}
      {props.labelGrants.map((grant) => (
        <Picker
          key={grant.abilityId}
          title={grant.title}
          count={grant.count}
          options={grant.options}
          onConfirm={async (picked) => {
            const ability = props.abilities.find((entry) => entry.id === grant.abilityId);
            if (!ability) return;
            const result = applyT20LabelGrant(props.sheet, grant, picked, ability.name);
            if ('error' in result) throw new Error(result.error);
            const client = getSupabase();
            props.onAbilityUpdated(
              await updateCharacterAbility(client, ability.id, {
                name: result.name,
                source: ability.source,
                description: ability.description,
                data: ability.data,
                resourceId: ability.resourceId,
              }),
            );
            const created: CharacterAbility[] = [];
            for (const entry of result.abilities)
              created.push(
                await createCharacterAbility(client, props.characterId, {
                  kind: entry.kind,
                  name: entry.name,
                  source: entry.source,
                  description: entry.description,
                  data: entry.data as CharacterAbility['data'],
                  resourceId: null,
                }),
              );
            if (created.length) props.onAbilities(created);
            if (JSON.stringify(result.sheet) !== JSON.stringify(props.sheet)) {
              const saved = await saveCharacterSheet(client, props.characterId, props.version, { sheet: result.sheet });
              props.onSheet(result.sheet, saved.version);
            }
          }}
        />
      ))}
      {props.itemGrants.map((grant) => (
        <ItemGrant key={grant.source} grant={grant} {...props} />
      ))}
    </Card>
  );
}

function Picker({
  title,
  count,
  options,
  onConfirm,
}: {
  title: string;
  count: number;
  options: readonly { id: string; name: string }[];
  onConfirm: (picked: string[]) => Promise<void>;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : count === 1 ? [id] : current.length < count ? [...current, id] : current,
    );
  const shown = open ? options : options.slice(0, 12);
  return (
    <View style={styles.block}>
      <AppText style={{ color: colors.fg }}>{title}</AppText>
      <View style={styles.chips}>
        {shown.map((option) => {
          const on = picked.includes(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() => toggle(option.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <AppText variant="small" style={{ color: on ? colors.fg : colors.fgSecondary }}>
                {option.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {options.length > 12 ? (
        <Button variant="ghost" compact label={open ? 'Mostrar menos' : `Ver todas (${options.length})`} onPress={() => setOpen(!open)} />
      ) : null}
      <Button
        compact
        label={`Confirmar (${picked.length} de ${count})`}
        loading={busy}
        disabled={picked.length !== count}
        onPress={() => {
          setBusy(true);
          onConfirm(picked)
            .then(() => toast({ tone: 'success', title: 'Escolha gravada na ficha.' }))
            .catch((error: unknown) => toast({ tone: 'danger', title: error instanceof Error && !('code' in error) ? error.message : failureMessage(error) }))
            .finally(() => setBusy(false));
        }}
      />
    </View>
  );
}

function ItemGrant({ grant, characterId, onItems }: GrantsProps & { grant: T20ItemGrant }) {
  const toast = useToast();
  const [baseId, setBaseId] = useState('');
  const [upgradeId, setUpgradeId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const count = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const price = grant.options.reduce((sum, item) => sum + t20PriceValue(item.price) * (quantities[item.id] ?? 0), 0);
  const confirm = async () => {
    const result = applyT20ItemGrant(grant, { baseId, upgradeId, quantities });
    if ('error' in result) return toast({ tone: 'danger', title: result.error });
    setBusy(true);
    try {
      const created: CharacterItem[] = [];
      for (const item of result.items) created.push(await createCharacterItem(getSupabase(), characterId, { ...item, weight: null, isEquipped: false }));
      onItems(created);
      toast({ tone: 'success', title: 'Itens do Protótipo no inventário.' });
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };
  const chips = (list: readonly { id: string; name: string }[], value: string, set: (id: string) => void) => (
    <View style={styles.chips}>
      {list.map((option) => (
        <Pressable key={option.id} onPress={() => set(option.id)} style={[styles.chip, value === option.id && styles.chipOn]}>
          <AppText variant="small" style={{ color: value === option.id ? colors.fg : colors.fgSecondary }}>
            {option.name}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={styles.block}>
      <AppText style={{ color: colors.fg }}>{grant.title}</AppText>
      {grant.mode === 'superior' ? (
        <>
          <AppText variant="small">Item</AppText>
          {chips(grant.options, baseId, setBaseId)}
          <AppText variant="small">Melhoria</AppText>
          {chips(grant.upgrades, upgradeId, setUpgradeId)}
        </>
      ) : (
        <>
          {grant.options.map((item) => (
            <View key={item.id} style={styles.row}>
              <AppText variant="small" style={{ flex: 1 }}>
                {item.name} ({item.price})
              </AppText>
              <Button compact variant="ghost" label="–" onPress={() => setQuantities({ ...quantities, [item.id]: Math.max(0, (quantities[item.id] ?? 0) - 1) })} />
              <AppText style={{ color: colors.fg, minWidth: 20, textAlign: 'center' }}>{quantities[item.id] ?? 0}</AppText>
              <Button compact variant="ghost" label="+" onPress={() => setQuantities({ ...quantities, [item.id]: (quantities[item.id] ?? 0) + 1 })} />
            </View>
          ))}
          <AppText variant="small">
            {count} de 10 itens · T$ {price} de T$ {grant.budget}
          </AppText>
        </>
      )}
      <Button compact label="Confirmar" loading={busy} onPress={() => void confirm()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1] },
  block: { gap: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  chipOn: { borderColor: colors.fgAccent, backgroundColor: colors.hover },
});
