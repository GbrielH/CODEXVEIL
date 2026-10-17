import {
  adjustCharacterItemQuantity,
  createCharacterItem,
  createCharacterResource,
  deleteCharacterItem,
  setCharacterItemEquipped,
  type CharacterItem,
} from '@codexveil/database';
import { ITEM_CATEGORIES, groupByCategory, itemCategoryLabels, totalWeight, type ItemCategory } from '@codexveil/domain';
import { CURRENCIES, currencyLabels, currencyResource, currencyResourceKey, totalInGold, type Currency } from '@codexveil/rpg-systems/dnd5e';
import { fieldErrorsFrom, inventoryItemSchema, type FieldErrors } from '@codexveil/validation';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';
import { useSheet } from './context';

function Coins() {
  const { resources, adjustResource, canEditPlay, characterId, setResources, run } = useSheet();
  const [drafts, setDrafts] = useState<Partial<Record<Currency, string>>>({});
  const amountOf = (coin: Currency) => resources.find((resource) => resource.key === currencyResourceKey(coin))?.current ?? 0;

  const commit = async (coin: Currency) => {
    const text = drafts[coin];
    setDrafts((current) => ({ ...current, [coin]: undefined }));
    if (text === undefined) return;
    const value = Number(text.trim() || '0');
    if (!Number.isInteger(value) || value < 0 || value > 1_000_000) return;
    const existing = resources.find((resource) => resource.key === currencyResourceKey(coin));
    if (existing) {
      adjustResource(existing, 'set_current', value);
      return;
    }
    const created = await run(() => createCharacterResource(getSupabase(), characterId, currencyResource(coin, value)), `${currencyLabels[coin].name}: valor não salvo`);
    if (created) setResources((current) => [...current, created]);
  };

  const amounts = Object.fromEntries(CURRENCIES.map((coin) => [coin, amountOf(coin)])) as Record<Currency, number>;
  return (
    <Card>
      <AppText variant="heading">Moedas</AppText>
      <AppText variant="muted">Total ≈ {totalInGold(amounts).toLocaleString('pt-BR')} PO</AppText>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {CURRENCIES.map((coin) => (
          <View key={coin} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <AppText variant="small">{currencyLabels[coin].abbreviation}</AppText>
            <TextInput
              editable={canEditPlay}
              value={drafts[coin] ?? String(amounts[coin])}
              onChangeText={(text) => setDrafts((current) => ({ ...current, [coin]: text }))}
              onEndEditing={() => void commit(coin)}
              keyboardType="number-pad"
              accessibilityLabel={currencyLabels[coin].name}
              style={styles.coin}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

function NewItem({ onClose }: { onClose: () => void }) {
  const { characterId, setItems, run } = useSheet();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [category, setCategory] = useState<ItemCategory>('gear');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = inventoryItemSchema.safeParse({ name, quantity: Number(quantity), category });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setBusy(true);
    const created = await run(() => createCharacterItem(getSupabase(), characterId, parsed.data), 'O item não foi adicionado');
    setBusy(false);
    if (!created) return;
    setItems((current) => [...current, created]);
    onClose();
  };

  return (
    <Card>
      <AppText variant="heading">Novo item</AppText>
      <Field label="Nome" value={name} onChangeText={setName} maxLength={120} error={errors.name} />
      <Field label="Quantidade" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" error={errors.quantity} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Categoria">
        {ITEM_CATEGORIES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setCategory(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: category === option }}
            style={[styles.chip, category === option && styles.chipSelected]}
          >
            <AppText variant="small" style={{ color: category === option ? colors.fgAccent : colors.fgSecondary }}>
              {itemCategoryLabels[option]}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button label="Adicionar" onPress={() => void submit()} loading={busy} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

function ItemRow({ item }: { item: CharacterItem }) {
  const { canEditPlay, setItems, run } = useSheet();
  const confirm = useConfirm();

  const change = async (delta: number) => {
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, quantity: Math.max(0, entry.quantity + delta) } : entry)));
    const saved = await run(() => adjustCharacterItemQuantity(getSupabase(), item.id, delta), `${item.name}: quantidade não salva`);
    setItems((current) => current.map((entry) => (entry.id === item.id ? (saved ?? item) : entry)));
  };

  const toggleEquipped = async () => {
    const ok = await run(() => setCharacterItemEquipped(getSupabase(), item.id, !item.isEquipped), `${item.name}: alteração não salva`);
    if (ok !== undefined) setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isEquipped: !item.isEquipped } : entry)));
  };

  const remove = async () => {
    const confirmed = await confirm({ title: `Excluir “${item.name}”?`, message: 'O item sai do inventário.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!confirmed) return;
    const ok = await run(() => deleteCharacterItem(getSupabase(), item.id), 'O item não foi removido');
    if (ok !== undefined) setItems((current) => current.filter((entry) => entry.id !== item.id));
  };

  return (
    <View style={styles.item}>
      <Pressable
        disabled={!canEditPlay}
        onPress={() => void toggleEquipped()}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isEquipped, disabled: !canEditPlay }}
        accessibilityLabel={`${item.name} equipado`}
        hitSlop={8}
        style={[styles.equip, item.isEquipped && { backgroundColor: colors.primary, borderColor: colors.primary }]}
      />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{item.name}</AppText>
        {item.isEquipped ? <Badge label="Equipado" tone="brand" /> : null}
      </View>
      {canEditPlay ? <IconButton icon={<Minus size={14} color={colors.fg} />} accessibilityLabel={`Diminuir ${item.name}`} disabled={item.quantity <= 0} onPress={() => void change(-1)} /> : null}
      <AppText style={{ minWidth: 28, textAlign: 'center' }} accessibilityLabel={`Quantidade ${item.quantity}`}>
        {item.quantity}
      </AppText>
      {canEditPlay ? (
        <>
          <IconButton icon={<Plus size={14} color={colors.fg} />} accessibilityLabel={`Aumentar ${item.name}`} onPress={() => void change(1)} />
          <IconButton icon={<Trash2 size={14} color={colors.fgMuted} />} accessibilityLabel={`Excluir ${item.name}`} onPress={() => void remove()} />
        </>
      ) : null}
    </View>
  );
}

export function InventorySection() {
  const { items, canEditPlay, derived, sheet } = useSheet();
  const [adding, setAdding] = useState(false);
  const metric = sheet.combat.speedUnit === 'm';
  return (
    <View style={{ gap: spacing[4] }}>
      <Coins />
      <AppText variant="muted">
        Carga: {totalWeight(items).toLocaleString('pt-BR')} de {(metric ? derived.carryingCapacity.kilograms : derived.carryingCapacity.pounds).toLocaleString('pt-BR')} {metric ? 'kg' : 'lb'}
      </AppText>
      {canEditPlay ? adding ? <NewItem onClose={() => setAdding(false)} /> : <Button label="Adicionar item" variant="secondary" icon={<Plus size={16} color={colors.fg} />} onPress={() => setAdding(true)} /> : null}
      {items.length === 0 ? <AppText variant="muted">Mochila vazia.</AppText> : null}
      {groupByCategory(items).map((group) => (
        <Card key={group.category}>
          <AppText variant="eyebrow">{itemCategoryLabels[group.category]}</AppText>
          {group.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  coin: { width: '100%', height: 44, textAlign: 'center', color: colors.fg, fontSize: 16, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.md, backgroundColor: colors.sunken },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radii.full, borderWidth: 1, borderColor: colors.lineStrong },
  chipSelected: { borderColor: colors.parchmentEdge, backgroundColor: '#3D1520' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line },
  equip: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.lineStrong, marginRight: 6 },
});
