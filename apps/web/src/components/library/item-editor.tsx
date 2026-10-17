'use client';

import { giveCampaignItem, setCampaignItemVisibility, updateCampaignItem, type CampaignItem } from '@codexveil/database';
import { ITEM_CATEGORIES, itemCategoryLabels, type ItemCategory, type SharedVisibility } from '@codexveil/domain';
import { campaignItemSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { Eye, EyeOff, Gift, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { deleteItemAction } from '@/app/(app)/campanhas/[campaignId]/biblioteca/actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Oculta ou revela o item aos jogadores, direto da lista. */
export function ItemVisibilityToggle({ itemId, name, visibility }: { itemId: string; name: string; visibility: SharedVisibility }) {
  const router = useRouter();
  const { toast } = useToast();
  const [current, setCurrent] = useState(visibility);
  const [busy, setBusy] = useState(false);
  const hidden = current === 'gm';
  const label = hidden ? 'Liberar aos jogadores' : 'Ocultar dos jogadores';

  const toggle = async () => {
    const next: SharedVisibility = hidden ? 'members' : 'gm';
    setBusy(true);
    try {
      await setCampaignItemVisibility(getSupabaseBrowserClient(), itemId, next);
      setCurrent(next);
      toast({ tone: 'success', title: next === 'members' ? `${name} foi liberado aos jogadores.` : `${name} foi ocultado dos jogadores.` });
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: 'A visibilidade não mudou', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={hidden ? 'secondary' : 'ghost'}
      size="sm"
      loading={busy}
      icon={busy ? undefined : hidden ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
      aria-label={`${label}: ${name}`}
      title={label}
      onClick={() => void toggle()}
    >
      {hidden ? 'Liberar' : 'Ocultar'}
    </Button>
  );
}

interface ItemForm {
  name: string;
  category: ItemCategory;
  rarity: string;
  requiresAttunement: boolean;
  weight: number | null;
  value: string;
  description: string;
  revealed: boolean;
}

/** Edição do item da biblioteca (o que já foi entregue aos personagens não muda). */
export function ItemEditor({ item }: { item: CampaignItem }) {
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const [form, setForm] = useState<ItemForm>({
    name: item.name,
    category: item.category,
    rarity: item.rarity,
    requiresAttunement: item.requiresAttunement,
    weight: item.weight,
    value: item.value,
    description: item.description,
    revealed: item.visibility === 'members',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ItemForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    const parsed = campaignItemSchema.safeParse({ ...form, visibility: form.revealed ? 'members' : 'gm' });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await updateCampaignItem(getSupabaseBrowserClient(), item.id, parsed.data);
      toast({ tone: 'success', title: 'Item salvo.' });
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: 'O item não foi salvo', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card ornate>
      <CardHeader title="Editar item" description="As cópias já entregues aos personagens não mudam." />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField id={`${id}-name`} label="Nome" required maxLength={120} value={form.name} onChange={(event) => set({ name: event.target.value })} error={errors.name} />
        <SelectField id={`${id}-category`} label="Categoria" value={form.category} onChange={(event) => set({ category: event.target.value as ItemCategory })}>
          {ITEM_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {itemCategoryLabels[category]}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField id={`${id}-rarity`} label="Raridade" maxLength={60} value={form.rarity} onChange={(event) => set({ rarity: event.target.value })} error={errors.rarity} />
          <TextField id={`${id}-value`} label="Valor" maxLength={60} value={form.value} onChange={(event) => set({ value: event.target.value })} error={errors.value} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-weight`} className="text-sm font-medium">
            Peso <span className="font-normal text-fg-muted">(unidade das fichas)</span>
          </label>
          <NumberInput id={`${id}-weight`} value={form.weight} min={0} max={100_000} decimal allowEmpty onCommit={(value) => set({ weight: value })} className="w-32" />
        </div>
        <TextareaField
          id={`${id}-description`}
          label="Descrição e efeitos"
          rows={8}
          maxLength={8000}
          value={form.description}
          onChange={(event) => set({ description: event.target.value })}
          error={errors.description}
        />
        <CheckboxField id={`${id}-attunement`} label="Exige sintonia" checked={form.requiresAttunement} onChange={(event) => set({ requiresAttunement: event.target.checked })} />
        <CheckboxField id={`${id}-revealed`} label="Revelar aos jogadores" checked={form.revealed} onChange={(event) => set({ revealed: event.target.checked })} />
        <div>
          <Button type="submit" loading={busy}>
            Salvar item
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Entrega uma cópia do item ao inventário de um personagem da campanha. */
export function GiveItemCard({ item, party }: { item: CampaignItem; party: { id: string; name: string; ownerName: string }[] }) {
  const { toast } = useToast();
  const id = useId();
  const [characterId, setCharacterId] = useState(party[0]?.id ?? '');
  const [quantity, setQuantity] = useState<number | null>(1);
  const [busy, setBusy] = useState(false);

  const give = async () => {
    const target = party.find((character) => character.id === characterId);
    if (!target || !quantity) return;
    setBusy(true);
    try {
      await giveCampaignItem(getSupabaseBrowserClient(), item, target.id, quantity);
      toast({ tone: 'success', title: `${item.name} foi para o inventário de ${target.name}.` });
    } catch (error) {
      toast({ tone: 'danger', title: 'O item não foi entregue', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={<Gift className="h-5 w-5" aria-hidden="true" />} title="Entregar a um personagem" description="Uma cópia vai para o inventário da ficha." />
      {party.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum personagem na campanha ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <SelectField id={`${id}-character`} label="Personagem" value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
            {party.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name} ({character.ownerName})
              </option>
            ))}
          </SelectField>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-quantity`} className="text-sm font-medium">
              Quantidade
            </label>
            <NumberInput id={`${id}-quantity`} value={quantity} min={1} max={99_999} onCommit={setQuantity} className="w-28" />
          </div>
          <div>
            <Button onClick={() => void give()} loading={busy} disabled={!characterId || !quantity} icon={<Gift className="h-4 w-4" aria-hidden="true" />}>
              Entregar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function DeleteItemCard({ campaignId, itemId, name }: { campaignId: string; itemId: string; name: string }) {
  return (
    <Card className="border-ember-400/40">
      <CardHeader title="Excluir item" description="Sai da biblioteca. As cópias nos inventários continuam." />
      <ConfirmDialog
        trigger={(open) => (
          <Button variant="danger" onClick={open} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
            Excluir item
          </Button>
        )}
        title={`Excluir “${name}”?`}
        description="O item será apagado da biblioteca da campanha."
        confirmLabel="Excluir item"
        onConfirm={async () => {
          const result = await deleteItemAction(campaignId, itemId);
          if (!result.ok) throw new Error(result.message);
        }}
      />
    </Card>
  );
}
