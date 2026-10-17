import { deleteCampaignItem, getCampaign, getCampaignItem, giveCampaignItem, listCampaignCharacters, updateCampaignItem } from '@codexveil/database';
import { ITEM_CATEGORIES, itemCategoryLabels, type ItemCategory } from '@codexveil/domain';
import { campaignItemSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Gift, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow, NumberField } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { PickerField } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

interface ItemForm {
  name: string;
  category: ItemCategory;
  rarity: string;
  value: string;
  weight: number | null;
  description: string;
  requiresAttunement: boolean;
  revealed: boolean;
}

/** Item da biblioteca: descrição para todos; edição e entrega aos personagens para o mestre. */
export default function ItemScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<ItemForm | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<'save' | 'give' | null>(null);
  const [target, setTarget] = useState('');
  const [quantity, setQuantity] = useState<number | null>(1);

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const item = await getCampaignItem(supabase, itemId);
    if (!item || item.campaignId !== campaign.id) return null;
    const party = campaign.role === 'gm' ? await listCampaignCharacters(supabase, campaign.id) : [];
    return { campaign, item, party };
  }, `${id}:${itemId}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Item não encontrado" description="Ele não existe ou ainda não foi revelado." />
      </Screen>
    );
  }
  const { campaign, item, party } = data;
  const canManage = campaign.role === 'gm' && campaign.status === 'active';
  const current: ItemForm = form ?? {
    name: item.name,
    category: item.category,
    rarity: item.rarity,
    value: item.value,
    weight: item.weight,
    description: item.description,
    requiresAttunement: item.requiresAttunement,
    revealed: item.visibility === 'members',
  };
  const characterId = target || party[0]?.id || '';

  const save = async () => {
    const parsed = campaignItemSchema.safeParse({ ...current, visibility: current.revealed ? 'members' : 'gm' });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy('save');
    try {
      await updateCampaignItem(getSupabase(), item.id, parsed.data);
      toast({ tone: 'success', title: 'Item salvo.' });
      setForm(null);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'O item não foi salvo', description: failureMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const give = async () => {
    const character = party.find((entry) => entry.id === characterId);
    if (!character || !quantity) return;
    setBusy('give');
    try {
      await giveCampaignItem(getSupabase(), item, character.id, quantity);
      toast({ tone: 'success', title: `${item.name} foi para o inventário de ${character.name}.` });
    } catch (cause) {
      toast({ tone: 'danger', title: 'O item não foi entregue', description: failureMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `Excluir “${item.name}”?`, message: 'O item sai da biblioteca. As cópias nos inventários continuam.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteCampaignItem(getSupabase(), item.id);
      toast({ tone: 'info', title: 'Item excluído.' });
      router.back();
    } catch (cause) {
      toast({ tone: 'danger', title: 'O item não foi excluído', description: failureMessage(cause) });
    }
  };

  return (
    <Screen eyebrow={itemCategoryLabels[item.category]} title={item.name} subtitle={[item.rarity, item.value ? `Valor: ${item.value}` : null].filter(Boolean).join(' · ') || undefined} refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: item.name }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {item.requiresAttunement ? <Badge label="Exige sintonia" tone="brand" /> : null}
        <Badge label={item.srdName ? 'SRD 5.2.1' : 'Criado pelo mestre'} tone="parchment" />
        {campaign.role === 'gm' && item.visibility === 'gm' ? <Badge label="Oculto dos jogadores" tone="warning" /> : null}
      </View>
      {item.description ? <AppText variant="serif">{item.description}</AppText> : <AppText variant="muted">Sem descrição.</AppText>}
      {item.srdName ? <AppText variant="small">Texto do SRD 5.2.1 (Wizards of the Coast, CC-BY-4.0), no original em inglês.</AppText> : null}

      {canManage ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Gift size={18} color={colors.fgAccent} />
            <AppText variant="heading">Entregar a um personagem</AppText>
          </View>
          {party.length === 0 ? (
            <AppText variant="muted">Nenhum personagem na campanha ainda.</AppText>
          ) : (
            <>
              <PickerField
                label="Personagem"
                value={characterId}
                options={party.map((character) => ({ value: character.id, label: character.name, description: character.ownerName }))}
                onChange={setTarget}
              />
              <NumberField label="Quantidade" value={quantity} onChange={(value) => setQuantity(value && value > 0 ? Math.min(value, 99_999) : 1)} />
              <Button label="Entregar" loading={busy === 'give'} icon={<Gift size={16} color={colors.primaryFg} />} onPress={() => void give()} />
            </>
          )}
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <AppText variant="heading">Editar item</AppText>
          <Field label="Nome" value={current.name} maxLength={120} onChangeText={(name) => setForm({ ...current, name })} error={errors.name} />
          <ChipRow>
            {ITEM_CATEGORIES.map((category) => (
              <Chip key={category} label={itemCategoryLabels[category]} selected={current.category === category} onPress={() => setForm({ ...current, category })} />
            ))}
          </ChipRow>
          <Field label="Raridade" value={current.rarity} maxLength={60} onChangeText={(rarity) => setForm({ ...current, rarity })} />
          <Field label="Valor" value={current.value} maxLength={60} onChangeText={(value) => setForm({ ...current, value })} />
          <NumberField label="Peso (unidade das fichas)" value={current.weight} allowEmpty decimal onChange={(weight) => setForm({ ...current, weight })} />
          <Field label="Descrição e efeitos" value={current.description} multiline maxLength={8000} onChangeText={(description) => setForm({ ...current, description })} error={errors.description} />
          <CheckRow label="Exige sintonia" checked={current.requiresAttunement} onChange={(requiresAttunement) => setForm({ ...current, requiresAttunement })} />
          <CheckRow label="Revelar aos jogadores" checked={current.revealed} onChange={(revealed) => setForm({ ...current, revealed })} />
          <Button label="Salvar item" loading={busy === 'save'} onPress={() => void save()} />
        </Card>
      ) : null}

      {canManage ? <Button label="Excluir item" variant="danger" icon={<Trash2 size={16} color="#EC9384" />} onPress={() => void remove()} /> : null}
    </Screen>
  );
}
