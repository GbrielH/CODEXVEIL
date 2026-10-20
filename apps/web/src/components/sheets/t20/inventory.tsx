'use client';

import {
  adjustCharacterItemQuantity,
  createCharacterItem,
  deleteCharacterItem,
  setCharacterItemEquipped,
  updateCharacterItem,
  type CharacterItem,
} from '@codexveil/database';
import {
  ITEM_CATEGORIES,
  groupByCategory,
  itemCategoryLabels,
  type ItemCategory,
} from '@codexveil/domain';
import { fieldErrorsFrom, inventoryItemSchema, type FieldErrors } from '@codexveil/validation';
import { Backpack, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Props {
  characterId: string;
  items: CharacterItem[];
  setItems: Dispatch<SetStateAction<CharacterItem[]>>;
  canEdit: boolean;
  /** Limite de carga em espaços (Tormenta20). */
  capacity: number;
}

/** Espaços ocupados: o campo "peso" guarda os espaços de cada item no Tormenta20. */
function usedSpaces(items: readonly CharacterItem[]): number {
  return items.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);
}

/**
 * Inventário do Tormenta20 no mesmo formato do D&D: itens por categoria, equipar, quantidade,
 * adicionar, editar e excluir, e a carga em espaços.
 */
export function T20Inventory({ characterId, items, setItems, canEdit, capacity }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<CharacterItem | 'new' | null>(null);
  const groups = groupByCategory(items);
  const used = usedSpaces(items);

  const run = async <T,>(action: () => Promise<T>, failure: string): Promise<T | null> => {
    try {
      return await action();
    } catch (error) {
      toast({
        tone: 'danger',
        title: failure,
        description: failureMessage(error, 'Tente novamente.'),
      });
      return null;
    }
  };

  const changeQuantity = async (item: CharacterItem, delta: number) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, quantity: Math.max(0, entry.quantity + delta) } : entry,
      ),
    );
    const saved = await run(
      () => adjustCharacterItemQuantity(getSupabaseBrowserClient(), item.id, delta),
      `${item.name}: quantidade não salva`,
    );
    setItems((current) => current.map((entry) => (entry.id === item.id ? (saved ?? item) : entry)));
  };

  const toggleEquipped = async (item: CharacterItem) => {
    const next = !item.isEquipped;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, isEquipped: next } : entry)),
    );
    const ok = await run(
      () => setCharacterItemEquipped(getSupabaseBrowserClient(), item.id, next),
      `${item.name}: alteração não salva`,
    );
    if (ok === null)
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Carga"
          description="Cada item ocupa espaços (campo “Espaços” do item). Acima do limite, o personagem fica sobrecarregado."
        />
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={used}
          aria-label="Espaços ocupados"
        >
          <div
            className={cx(
              'h-full rounded-full',
              used > capacity ? 'bg-ember-400' : 'bg-parchment-300',
            )}
            style={{ width: `${Math.min(100, capacity > 0 ? (used / capacity) * 100 : 0)}%` }}
          />
        </div>
        <p className={cx('mt-2 text-sm', used > capacity ? 'text-ember-300' : 'text-fg-secondary')}>
          {used.toLocaleString('pt-BR')} de {capacity} espaços
          {used > capacity ? ' (sobrecarregado)' : ''}
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Itens"
          action={
            canEdit ? (
              <Button
                size="sm"
                onClick={() => setEditing('new')}
                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Adicionar item
              </Button>
            ) : undefined
          }
        />
        {items.length === 0 ? (
          <EmptyState
            icon={<Backpack className="h-8 w-8" aria-hidden="true" />}
            title="Mochila vazia"
            description="Registre armas, armaduras, poções e qualquer item."
            className="py-8"
          />
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <section key={group.category} aria-label={itemCategoryLabels[group.category]}>
                <h3 className="eyebrow mb-2 text-[11px]">{itemCategoryLabels[group.category]}</h3>
                <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item.isEquipped}
                        disabled={!canEdit}
                        onChange={() => void toggleEquipped(item)}
                        aria-label={`${item.name} equipado`}
                        title="Equipado"
                        className="h-5 w-5 shrink-0 accent-wine-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-fg">
                          {item.name}
                          {item.isEquipped ? (
                            <Badge tone="brand" className="ml-2 align-middle">
                              Equipado
                            </Badge>
                          ) : null}
                        </p>
                        {item.description || item.weight !== null ? (
                          <p className="truncate text-xs text-fg-muted">
                            {[
                              item.weight !== null
                                ? `${item.weight.toLocaleString('pt-BR')} espaço(s) cada`
                                : null,
                              item.description,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                      </div>
                      {canEdit ? (
                        <div className="flex items-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={item.quantity <= 0}
                            onClick={() => void changeQuantity(item, -1)}
                            aria-label={`Diminuir ${item.name}`}
                          >
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <span
                            className="tabular w-8 text-center text-sm"
                            aria-label={`Quantidade: ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void changeQuantity(item, 1)}
                            aria-label={`Aumentar ${item.name}`}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditing(item)}
                            aria-label={`Editar ${item.name}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <span className="tabular text-sm text-fg-secondary">× {item.quantity}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <ItemFormModal
          characterId={characterId}
          item={editing}
          setItems={setItems}
          onClose={() => setEditing(null)}
          run={run}
        />
      </Card>
    </div>
  );
}

interface ItemForm {
  name: string;
  category: ItemCategory;
  quantity: number | null;
  weight: number | null;
  description: string;
  notes: string;
  isEquipped: boolean;
}

const emptyItem: ItemForm = {
  name: '',
  category: 'gear',
  quantity: 1,
  weight: 1,
  description: '',
  notes: '',
  isEquipped: false,
};

function ItemFormModal({
  characterId,
  item,
  setItems,
  onClose,
  run,
}: {
  characterId: string;
  item: CharacterItem | 'new' | null;
  setItems: Dispatch<SetStateAction<CharacterItem[]>>;
  onClose: () => void;
  run: <T>(action: () => Promise<T>, failure: string) => Promise<T | null>;
}) {
  const { toast } = useToast();
  const id = useId();
  const isNew = item === 'new';
  const [form, setForm] = useState<ItemForm>(emptyItem);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<CharacterItem | 'new' | null>(null);

  if (item !== openedFor) {
    setOpenedFor(item);
    setErrors({});
    setForm(
      item && item !== 'new'
        ? {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            weight: item.weight,
            description: item.description,
            notes: item.notes,
            isEquipped: item.isEquipped,
          }
        : emptyItem,
    );
  }

  const submit = async () => {
    const parsed = inventoryItemSchema.safeParse({ ...form, quantity: form.quantity ?? 0 });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setBusy(true);
    const client = getSupabaseBrowserClient();
    const saved = await run(
      () =>
        isNew || !item
          ? createCharacterItem(client, characterId, parsed.data)
          : updateCharacterItem(client, item.id, parsed.data),
      'Não foi possível salvar o item',
    );
    setBusy(false);
    if (!saved) return;
    toast({ tone: 'success', title: isNew ? 'Item adicionado.' : 'Item atualizado.' });
    setItems((current) =>
      isNew ? [...current, saved] : current.map((entry) => (entry.id === saved.id ? saved : entry)),
    );
    onClose();
  };

  const remove = async () => {
    if (!item || item === 'new') return;
    const ok = await run(
      () => deleteCharacterItem(getSupabaseBrowserClient(), item.id),
      'Não foi possível remover o item',
    );
    if (ok === null) throw new Error('O item não foi removido.');
    toast({ tone: 'success', title: 'Item removido.' });
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    onClose();
  };

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={isNew ? 'Novo item' : 'Editar item'}
      busy={busy}
      size="lg"
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <TextField
            id={`${id}-name`}
            label="Nome"
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            error={errors.name}
          />
          <SelectField
            id={`${id}-category`}
            label="Categoria"
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({ ...current, category: event.target.value as ItemCategory }))
            }
          >
            {ITEM_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {itemCategoryLabels[category]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-quantity`} className="text-sm font-medium">
              Quantidade
            </label>
            <NumberInput
              id={`${id}-quantity`}
              value={form.quantity}
              min={0}
              max={99_999}
              onCommit={(value) => setForm((current) => ({ ...current, quantity: value }))}
              invalid={Boolean(errors.quantity)}
            />
            {errors.quantity ? <p className="text-xs text-danger">{errors.quantity}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-weight`} className="text-sm font-medium">
              Espaços (cada)
            </label>
            <NumberInput
              id={`${id}-weight`}
              value={form.weight}
              min={0}
              max={100_000}
              decimal
              allowEmpty
              onCommit={(value) => setForm((current) => ({ ...current, weight: value }))}
            />
            <p className="text-xs text-fg-muted">Itens pequenos ocupam 0,5; a maioria, 1.</p>
          </div>
        </div>
        <TextareaField
          id={`${id}-description`}
          label="Descrição (dano, crítico, Defesa…)"
          rows={3}
          maxLength={4000}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          error={errors.description}
        />
        <TextareaField
          id={`${id}-notes`}
          label="Observações"
          rows={2}
          maxLength={2000}
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          error={errors.notes}
        />
        <CheckboxField
          id={`${id}-equipped`}
          label="Equipado"
          checked={form.isEquipped}
          onChange={(event) =>
            setForm((current) => ({ ...current, isEquipped: event.target.checked }))
          }
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {!isNew && item ? (
            <ConfirmDialog
              trigger={(open) => (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={open}
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                >
                  Excluir
                </Button>
              )}
              title={`Excluir “${item.name}”?`}
              description="O item sai do inventário. Esta ação não pode ser desfeita."
              confirmLabel="Excluir item"
              onConfirm={remove}
            />
          ) : null}
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Salvar
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
