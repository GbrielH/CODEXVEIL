import {
  createCampaignItem,
  createCreature,
  getCampaign,
  listCampaignItems,
  listCreatures,
  setCampaignItemVisibility,
  setCreatureVisibility,
} from '@codexveil/database';
import { ITEM_CATEGORIES, itemCategoryLabels, type ItemCategory, type SharedVisibility } from '@codexveil/domain';
import { campaignItemSchema, creatureSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff, Gem, Plus, Skull } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { ListRow } from '@/components/ui/list-row';
import { NavGrid, NavTile } from '@/components/ui/nav-tile';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

type Tab = 'npc' | 'monster' | 'items' | 'srd';

/** Botão de ocultar/liberar um registro aos jogadores, direto da lista. */
function VisibilityButton({ name, visibility, onToggle }: { name: string; visibility: SharedVisibility; onToggle: (next: SharedVisibility) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const hidden = visibility === 'gm';
  return (
    <Button
      label={hidden ? 'Liberar' : 'Ocultar'}
      compact
      variant={hidden ? 'secondary' : 'ghost'}
      loading={busy}
      icon={hidden ? <Eye size={14} color={colors.fg} /> : <EyeOff size={14} color={colors.fgSecondary} />}
      accessibilityLabel={`${hidden ? 'Liberar aos jogadores' : 'Ocultar dos jogadores'}: ${name}`}
      onPress={async () => {
        setBusy(true);
        await onToggle(hidden ? 'members' : 'gm');
        setBusy(false);
      }}
    />
  );
}

/** Biblioteca da campanha: NPCs, monstros e itens (o mestre cria e revela; o SRD fica a um toque). */
export default function LibraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('npc');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', subtitle: '', revealed: false, category: 'gear' as ItemCategory, rarity: '', value: '', description: '', attunement: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const { data, error, loading, refreshing, reload, mutate } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const [creatures, items] = await Promise.all([listCreatures(supabase, campaign.id), listCampaignItems(supabase, campaign.id)]);
    return { campaign, creatures, items };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Campanha não encontrada" description="Ela não existe ou você não participa dela." />
      </Screen>
    );
  }
  const { campaign, creatures, items } = data;
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  const tabs: { value: Tab; label: string }[] = [
    { value: 'npc', label: 'NPCs' },
    { value: 'monster', label: 'Monstros' },
    { value: 'items', label: 'Itens' },
    ...(isGm && campaign.systemId === 'dnd5e' ? [{ value: 'srd' as const, label: 'SRD' }] : []),
  ];

  const resetForm = () => {
    setCreating(false);
    setErrors({});
    setForm({ name: '', subtitle: '', revealed: false, category: 'gear', rarity: '', value: '', description: '', attunement: false });
  };

  const createRecord = async () => {
    const visibility = form.revealed ? 'members' : 'gm';
    setBusy(true);
    try {
      if (tab === 'items') {
        const parsed = campaignItemSchema.safeParse({
          name: form.name,
          category: form.category,
          rarity: form.rarity,
          value: form.value,
          description: form.description,
          requiresAttunement: form.attunement,
          visibility,
        });
        if (!parsed.success) {
          setErrors(fieldErrorsFrom(parsed.error));
          return;
        }
        const itemId = await createCampaignItem(getSupabase(), campaign.id, parsed.data);
        resetForm();
        reload();
        router.push({ pathname: '/campanha/[id]/item/[itemId]', params: { id: campaign.id, itemId } });
      } else {
        const parsed = creatureSchema.safeParse({ kind: tab === 'monster' ? 'monster' : 'npc', name: form.name, subtitle: form.subtitle, description: '', visibility });
        if (!parsed.success) {
          setErrors(fieldErrorsFrom(parsed.error));
          return;
        }
        const creatureId = await createCreature(getSupabase(), campaign.id, parsed.data);
        resetForm();
        reload();
        router.push({ pathname: '/campanha/[id]/criatura/[creatureId]', params: { id: campaign.id, creatureId } });
      }
    } catch (cause) {
      toast({ tone: 'danger', title: 'O registro não foi criado', description: failureMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  const toggleCreature = async (creatureId: string, name: string, next: SharedVisibility) => {
    try {
      await setCreatureVisibility(getSupabase(), creatureId, next);
      mutate((current) => (current ? { ...current, creatures: current.creatures.map((entry) => (entry.id === creatureId ? { ...entry, visibility: next } : entry)) } : current));
      toast({ tone: 'success', title: next === 'members' ? `${name} foi liberado aos jogadores.` : `${name} foi ocultado dos jogadores.` });
    } catch (cause) {
      toast({ tone: 'danger', title: 'A visibilidade não mudou', description: failureMessage(cause) });
    }
  };

  const toggleItem = async (itemId: string, name: string, next: SharedVisibility) => {
    try {
      await setCampaignItemVisibility(getSupabase(), itemId, next);
      mutate((current) => (current ? { ...current, items: current.items.map((entry) => (entry.id === itemId ? { ...entry, visibility: next } : entry)) } : current));
      toast({ tone: 'success', title: next === 'members' ? `${name} foi liberado aos jogadores.` : `${name} foi ocultado dos jogadores.` });
    } catch (cause) {
      toast({ tone: 'danger', title: 'A visibilidade não mudou', description: failureMessage(cause) });
    }
  };

  const shownCreatures = creatures.filter((creature) => creature.kind === tab);

  return (
    <Screen eyebrow={campaign.name} title="Biblioteca" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Biblioteca' }} />
      <Segmented
        value={tab}
        options={tabs}
        onChange={(next) => {
          setTab(next);
          setCreating(false);
        }}
        accessibilityLabel="Seções da biblioteca"
      />

      {tab === 'srd' ? (
        <View style={{ gap: spacing[3] }}>
          <AppText variant="muted">
            Conteúdo aberto do SRD 5.2.1: copie monstros para a biblioteca e itens mágicos para os itens da campanha. Campos técnicos em
            português; textos no original, em inglês.
          </AppText>
          <NavGrid>
            <NavTile icon={<Skull size={20} color={colors.fgAccent} />} label="Bestiário SRD" hint="330 monstros e animais" onPress={() => router.push({ pathname: '/campanha/[id]/srd', params: { id: campaign.id } })} />
            <NavTile icon={<Gem size={20} color={colors.fgAccent} />} label="Itens mágicos SRD" hint="258 itens" onPress={() => router.push({ pathname: '/campanha/[id]/srd-itens', params: { id: campaign.id } })} />
          </NavGrid>
        </View>
      ) : (
        <>
          {!isGm ? <AppText variant="muted">{tab === 'items' ? 'Itens que o mestre revelou ao grupo.' : 'Personagens e criaturas que o mestre já revelou.'}</AppText> : null}

          {canManage ? (
            creating ? (
              <Card>
                <AppText variant="heading">{tab === 'items' ? 'Novo item' : tab === 'monster' ? 'Novo monstro' : 'Novo NPC'}</AppText>
                <Field label="Nome" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} maxLength={tab === 'items' ? 120 : 80} error={errors.name} />
                {tab === 'items' ? (
                  <>
                    <AppText variant="small" style={{ color: colors.fg }}>
                      Categoria
                    </AppText>
                    <ChipRow>
                      {ITEM_CATEGORIES.map((category) => (
                        <Chip key={category} label={itemCategoryLabels[category]} selected={form.category === category} onPress={() => setForm((current) => ({ ...current, category }))} />
                      ))}
                    </ChipRow>
                    <Field label="Raridade" value={form.rarity} onChangeText={(rarity) => setForm((current) => ({ ...current, rarity }))} maxLength={60} placeholder="Ex.: Raro" />
                    <Field label="Valor" value={form.value} onChangeText={(value) => setForm((current) => ({ ...current, value }))} maxLength={60} placeholder="Ex.: 50 PO" />
                    <Field
                      label="Descrição e efeitos"
                      value={form.description}
                      onChangeText={(description) => setForm((current) => ({ ...current, description }))}
                      multiline
                      maxLength={8000}
                      error={errors.description}
                    />
                    <CheckRow label="Exige sintonia" checked={form.attunement} onChange={(attunement) => setForm((current) => ({ ...current, attunement }))} />
                  </>
                ) : (
                  <Field
                    label="Descrição curta"
                    value={form.subtitle}
                    onChangeText={(subtitle) => setForm((current) => ({ ...current, subtitle }))}
                    maxLength={80}
                    placeholder="Ex.: Taverneiro de Brumafria"
                    error={errors.subtitle}
                  />
                )}
                <CheckRow label="Revelar aos jogadores" checked={form.revealed} onChange={(revealed) => setForm((current) => ({ ...current, revealed }))} />
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  <Button label="Cancelar" variant="ghost" onPress={resetForm} style={{ flex: 1 }} />
                  <Button label="Criar" loading={busy} onPress={() => void createRecord()} style={{ flex: 1 }} />
                </View>
              </Card>
            ) : (
              <Button
                label={tab === 'items' ? 'Novo item' : tab === 'monster' ? 'Novo monstro' : 'Novo NPC'}
                variant="secondary"
                icon={<Plus size={16} color={colors.fg} />}
                onPress={() => setCreating(true)}
              />
            )
          ) : null}

          {tab === 'items' ? (
            items.length === 0 ? (
              <EmptyState title={isGm ? 'Nenhum item ainda' : 'Nada revelado ainda'} description={isGm ? 'Crie um item ou copie um item mágico do SRD.' : 'Quando o mestre revelar itens, eles aparecerão aqui.'} />
            ) : (
              items.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  subtitle={[itemCategoryLabels[item.category], item.rarity, item.requiresAttunement ? 'sintonia' : null].filter(Boolean).join(' · ')}
                  meta={isGm ? `${item.srdName ? 'SRD' : 'Do mestre'}${item.visibility === 'gm' ? ' · oculto' : ''}` : undefined}
                  trailing={canManage ? <VisibilityButton name={item.name} visibility={item.visibility} onToggle={(next) => toggleItem(item.id, item.name, next)} /> : undefined}
                  onPress={() => router.push({ pathname: '/campanha/[id]/item/[itemId]', params: { id: campaign.id, itemId: item.id } })}
                />
              ))
            )
          ) : shownCreatures.length === 0 ? (
            <EmptyState
              title={isGm ? 'Nada cadastrado ainda' : 'Nada revelado ainda'}
              description={isGm ? 'Cadastre aqui ou copie do Bestiário SRD.' : 'Quando o mestre revelar NPCs ou criaturas, eles aparecerão aqui.'}
            />
          ) : (
            shownCreatures.map((creature) => (
              <ListRow
                key={creature.id}
                title={creature.name}
                subtitle={creature.subtitle || undefined}
                meta={isGm && creature.visibility === 'gm' ? 'Oculto dos jogadores' : undefined}
                trailing={
                  canManage ? <VisibilityButton name={creature.name} visibility={creature.visibility} onToggle={(next) => toggleCreature(creature.id, creature.name, next)} /> : undefined
                }
                onPress={() => router.push({ pathname: '/campanha/[id]/criatura/[creatureId]', params: { id: campaign.id, creatureId: creature.id } })}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}
