import { createCharacterItem, updateCharacterItem, type CharacterItem } from '@codexveil/database';
import { ITEM_CATEGORIES, itemCategoryLabels, type ItemCategory } from '@codexveil/domain';
import { fieldErrorsFrom, inventoryItemSchema, type FieldErrors } from '@codexveil/validation';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

/** Novo item (ou edição de um item) no inventário do Tormenta20; o campo "espaços" usa o peso do item. */
export function T20NewItem({
  characterId,
  item,
  onCreated,
  onClose,
}: {
  characterId: string;
  /** Item existente: o formulário edita em vez de criar. */
  item?: CharacterItem;
  onCreated: (item: CharacterItem) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [spaces, setSpaces] = useState(
    item ? (item.weight === null ? '' : String(item.weight).replace('.', ',')) : '1',
  );
  const [description, setDescription] = useState(item?.description ?? '');
  const [category, setCategory] = useState<ItemCategory>(item?.category ?? 'gear');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const weight = spaces.trim() === '' ? null : Number(spaces.replace(',', '.'));
    const parsed = inventoryItemSchema.safeParse({
      name,
      quantity: Number(quantity),
      category,
      weight: Number.isFinite(weight) ? weight : null,
      description,
      notes: item?.notes ?? '',
      isEquipped: item?.isEquipped ?? false,
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setBusy(true);
    try {
      onCreated(
        item
          ? await updateCharacterItem(getSupabase(), item.id, parsed.data)
          : await createCharacterItem(getSupabase(), characterId, parsed.data),
      );
      onClose();
    } catch (error) {
      toast({
        tone: 'danger',
        title: item ? 'O item não foi salvo' : 'O item não foi adicionado',
        description: failureMessage(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="heading">{item ? 'Editar item' : 'Novo item'}</AppText>
      <Field label="Nome" value={name} onChangeText={setName} maxLength={120} error={errors.name} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Quantidade"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            error={errors.quantity}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Espaços (cada)"
            value={spaces}
            onChangeText={setSpaces}
            keyboardType="decimal-pad"
            error={errors.weight}
          />
        </View>
      </View>
      <Field
        label="Descrição (dano, crítico, Defesa…)"
        value={description}
        onChangeText={setDescription}
        maxLength={4000}
        multiline
        error={errors.description}
      />
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Categoria"
      >
        {ITEM_CATEGORIES.map((option) => (
          <Chip
            key={option}
            label={itemCategoryLabels[option]}
            selected={category === option}
            onPress={() => setCategory(option)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button
          label={item ? 'Salvar' : 'Adicionar'}
          onPress={() => void submit()}
          loading={busy}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}
