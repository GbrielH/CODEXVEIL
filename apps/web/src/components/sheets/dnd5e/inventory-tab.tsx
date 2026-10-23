'use client';

import {
  createCharacterAbility,
  adjustCharacterItemQuantity,
  createCharacterItem,
  createCharacterResource,
  deleteCharacterItem,
  setCharacterItemEquipped,
  updateCharacterAbility,
  updateCharacterItem,
  type CharacterItem,
} from '@codexveil/database';
import {
  ITEM_CATEGORIES,
  groupByCategory,
  itemCategoryLabels,
  totalWeight,
  type ItemCategory,
} from '@codexveil/domain';
import {
  ABILITIES,
  CURRENCIES,
  abilityLabels,
  critRangeLabel,
  currencyLabels,
  currencyResource,
  currencyResourceKey,
  damageTypeLabels,
  dnd5eAttackDataSchema,
  findSrdWeaponByName,
  totalInGold,
  weaponAttackEntry,
  withCurrentOption,
  type Currency,
  type Dnd5eAttackData,
} from '@codexveil/rpg-systems/dnd5e';
import { fieldErrorsFrom, inventoryItemSchema, type FieldErrors } from '@codexveil/validation';
import { Backpack, Coins, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { NumberInput } from '@/components/ui/number-input';
import { EmptyState } from '@/components/ui/states';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ItemCatalogPicker } from '../item-catalog';
import { useSheet } from './context';

export function InventoryTab() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ItemsCard />
      <div className="flex flex-col gap-5">
        <CoinsCard />
        <LoadCard />
      </div>
    </div>
  );
}

function CoinsCard() {
  const { resources, adjustResource, permissions, character, setResources, run } = useSheet();
  const id = useId();
  const coinResource = (coin: Currency) =>
    resources.find((resource) => resource.key === currencyResourceKey(coin));
  const amounts = Object.fromEntries(
    CURRENCIES.map((coin) => [coin, coinResource(coin)?.current ?? 0]),
  ) as Record<Currency, number>;

  const setAmount = async (coin: Currency, value: number) => {
    const existing = coinResource(coin);
    if (existing) {
      adjustResource(existing, 'set_current', value);
      return;
    }
    // Personagens antigos podem não ter a trilha da moeda: ela é criada na primeira alteração.
    const created = await run(
      () =>
        createCharacterResource(
          getSupabaseBrowserClient(),
          character.id,
          currencyResource(coin, value),
        ),
      { failure: `${currencyLabels[coin].name}: valor não salvo` },
    );
    if (created) setResources((current) => [...current, created]);
  };

  return (
    <Card>
      <CardHeader
        icon={<Coins className="h-5 w-5" aria-hidden="true" />}
        title="Moedas"
        description={`Total ≈ ${totalInGold(amounts).toLocaleString('pt-BR')} PO`}
      />
      <div className="grid grid-cols-5 gap-2">
        {CURRENCIES.map((coin) => (
          <div key={coin} className="flex flex-col items-center gap-1">
            <label htmlFor={`${id}-${coin}`} className="text-xs font-semibold text-fg-secondary">
              <abbr title={currencyLabels[coin].name} className="no-underline">
                {currencyLabels[coin].abbreviation}
              </abbr>
            </label>
            <NumberInput
              id={`${id}-${coin}`}
              value={amounts[coin]}
              min={0}
              max={1_000_000}
              disabled={!permissions.canEditPlay}
              onCommit={(value) => void setAmount(coin, value ?? 0)}
              className="h-10 px-1 text-sm"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function LoadCard() {
  const { items, derived, sheet } = useSheet();
  const metric = sheet.combat.speedUnit === 'm';
  const carried = totalWeight(items);
  const capacity = metric ? derived.carryingCapacity.kilograms : derived.carryingCapacity.pounds;
  const unit = metric ? 'kg' : 'lb';
  const percent = capacity > 0 ? Math.min(100, Math.round((carried / capacity) * 100)) : 0;
  return (
    <Card>
      <CardHeader icon={<Backpack className="h-5 w-5" aria-hidden="true" />} title="Carga" />
      <p className="tabular text-sm text-fg-secondary">
        <strong className="text-fg">{carried.toLocaleString('pt-BR')}</strong> de{' '}
        {capacity.toLocaleString('pt-BR')} {unit}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-sunken ring-1 ring-line"
        aria-hidden="true"
      >
        <div
          className={cx(
            'h-full',
            percent > 100 || carried > capacity ? 'bg-hp-critical' : 'bg-parchment-400',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        Capacidade = Força × {metric ? '7,5 kg' : '15 lb'}. Pesos informados na unidade da ficha.
      </p>
    </Card>
  );
}

function ItemsCard() {
  const { items, permissions, setItems, run, abilities, setAbilities, sheet, character } =
    useSheet();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CharacterItem | 'new' | null>(null);
  const groups = groupByCategory(items);

  const changeQuantity = async (item: CharacterItem, delta: number) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, quantity: Math.max(0, entry.quantity + delta) } : entry,
      ),
    );
    const saved = await run(
      () => adjustCharacterItemQuantity(getSupabaseBrowserClient(), item.id, delta),
      {
        failure: `${item.name}: quantidade não salva`,
      },
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
      {
        failure: `${item.name}: alteração não salva`,
      },
    );
    if (ok === undefined) {
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
      return;
    }
    // Arma do SRD equipada sem ataque na ficha: a ficha ganha o ataque.
    const weapon = next ? findSrdWeaponByName(item.name) : undefined;
    if (
      !weapon ||
      abilities.some(
        (entry) =>
          entry.kind === 'attack' && entry.name.toLowerCase() === weapon.name.toLowerCase(),
      )
    )
      return;
    if (!permissions.canEditSheet) {
      toast({
        tone: 'info',
        title: `${weapon.name} equipada`,
        description: 'Peça ao mestre para liberar a edição da ficha para criar o ataque.',
      });
      return;
    }
    const attack = weaponAttackEntry(weapon, sheet);
    const created = await run(
      () =>
        createCharacterAbility(getSupabaseBrowserClient(), character.id, {
          ...attack,
          data: { ...attack.data },
          resourceId: null,
        }),
      {
        success: `Ataque com ${weapon.name} adicionado à ficha.`,
        failure: 'O ataque não foi criado',
      },
    );
    if (created) setAbilities((current) => [...current, created]);
  };

  return (
    <Card>
      <CardHeader
        title="Itens"
        action={
          permissions.canEditPlay ? (
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
          description="Registre armas, armaduras, poções e qualquer item personalizado."
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
                      disabled={!permissions.canEditPlay}
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
                              ? `${item.weight.toLocaleString('pt-BR')} cada`
                              : null,
                            item.description,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    {permissions.canEditPlay ? (
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
      <ItemFormModal item={editing} onClose={() => setEditing(null)} />
    </Card>
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
  weight: null,
  description: '',
  notes: '',
  isEquipped: false,
};

function ItemFormModal({
  item,
  onClose,
}: {
  item: CharacterItem | 'new' | null;
  onClose: () => void;
}) {
  const { character, setItems, run, abilities, setAbilities, permissions, sheet } = useSheet();
  // Ataque ligado à arma (pelo nome): dano, tipo, crítico e afins ficam no ataque da ficha.
  const linkedAttack =
    item && item !== 'new' ? (abilities.find((entry) => entry.kind === 'attack' && entry.name.toLowerCase() === item.name.toLowerCase()) ?? null) : null;
  const [attack, setAttack] = useState<Dnd5eAttackData>(() => dnd5eAttackDataSchema.parse({}));
  const id = useId();
  const isNew = item === 'new';
  const [form, setForm] = useState<ItemForm>(emptyItem);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<CharacterItem | 'new' | null>(null);

  if (item !== openedFor) {
    setOpenedFor(item);
    setErrors({});
    const parsedAttack = dnd5eAttackDataSchema.safeParse(linkedAttack?.data ?? {});
    setAttack(parsedAttack.success ? parsedAttack.data : dnd5eAttackDataSchema.parse({}));
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
          ? createCharacterItem(client, character.id, parsed.data)
          : updateCharacterItem(client, item.id, parsed.data),
      {
        success: isNew ? 'Item adicionado.' : 'Item atualizado.',
        failure: 'Não foi possível salvar o item',
      },
    );
    if (saved && form.category === 'weapon' && permissions.canEditSheet && attack.damage.trim()) {
      // Grava o ataque da arma (cria se ainda não houver), com o nome do item.
      const fields = { name: saved.name, source: linkedAttack?.source || 'Arma', description: linkedAttack?.description ?? '', data: { ...attack }, resourceId: linkedAttack?.resourceId ?? null };
      const stored = await run(
        () => (linkedAttack ? updateCharacterAbility(client, linkedAttack.id, fields) : createCharacterAbility(client, character.id, { kind: 'attack', ...fields })),
        { failure: 'O ataque da arma não foi salvo' },
      );
      if (stored) setAbilities((current) => (linkedAttack ? current.map((entry) => (entry.id === stored.id ? stored : entry)) : [...current, stored]));
    }
    setBusy(false);
    if (!saved) return;
    setItems((current) =>
      isNew ? [...current, saved] : current.map((entry) => (entry.id === saved.id ? saved : entry)),
    );
    onClose();
  };

  const remove = async () => {
    if (!item || item === 'new') return;
    const ok = await run(() => deleteCharacterItem(getSupabaseBrowserClient(), item.id), {
      success: 'Item removido.',
      failure: 'Não foi possível remover o item',
    });
    if (ok === undefined) throw new Error('O item não foi removido.');
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
        {isNew ? (
          <ItemCatalogPicker
            metric={sheet.combat.speedUnit === 'm'}
            onPick={(picked) =>
              setForm((current) => ({ ...current, name: picked.name, category: picked.category, weight: picked.weight, description: picked.description }))
            }
          />
        ) : null}
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
              Peso unitário
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
            <p className="text-xs text-fg-muted">Opcional.</p>
          </div>
        </div>
        <TextareaField
          id={`${id}-description`}
          label="Descrição"
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
        {form.category === 'weapon' ? (
          <fieldset className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-4" disabled={!permissions.canEditSheet}>
            <legend className="px-1 text-sm font-medium">Ataque {linkedAttack ? '' : '(novo, ao salvar)'}</legend>
            <SelectField
              id={`${id}-atk-ability`}
              label="Atributo"
              value={attack.ability ?? ''}
              onChange={(event) => setAttack((current) => ({ ...current, ability: (event.target.value || null) as Dnd5eAttackData['ability'] }))}
            >
              {ABILITIES.map((ability) => (
                <option key={ability} value={ability}>
                  {abilityLabels[ability].name}
                </option>
              ))}
              <option value="">Nenhum (bônus fixo)</option>
            </SelectField>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-atk-bonus`} className="text-sm font-medium">
                Bônus no acerto
              </label>
              <NumberInput id={`${id}-atk-bonus`} value={attack.bonus} min={-30} max={30} onCommit={(value) => setAttack((current) => ({ ...current, bonus: value ?? 0 }))} />
            </div>
            <TextField id={`${id}-atk-damage`} label="Dano (dados)" placeholder="1d8" maxLength={60} value={attack.damage} onChange={(event) => setAttack((current) => ({ ...current, damage: event.target.value }))} />
            <SelectField id={`${id}-atk-type`} label="Tipo de dano" value={attack.damageType} onChange={(event) => setAttack((current) => ({ ...current, damageType: event.target.value }))}>
              <option value="">—</option>
              {withCurrentOption(Object.values(damageTypeLabels), attack.damageType).map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </SelectField>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-atk-dmgbonus`} className="text-sm font-medium">
                Bônus no dano
              </label>
              <NumberInput id={`${id}-atk-dmgbonus`} value={attack.damageBonus} min={-30} max={30} onCommit={(value) => setAttack((current) => ({ ...current, damageBonus: value ?? 0 }))} />
            </div>
            <TextField id={`${id}-atk-extra`} label="Dano adicional" placeholder="1d6" maxLength={40} value={attack.extraDamage} onChange={(event) => setAttack((current) => ({ ...current, extraDamage: event.target.value }))} />
            <SelectField id={`${id}-atk-extratype`} label="Tipo do adicional" value={attack.extraDamageType} onChange={(event) => setAttack((current) => ({ ...current, extraDamageType: event.target.value }))}>
              <option value="">—</option>
              {withCurrentOption(Object.values(damageTypeLabels), attack.extraDamageType).map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </SelectField>
            <TextField id={`${id}-atk-range`} label="Alcance" placeholder="1,5 m" maxLength={60} value={attack.range} onChange={(event) => setAttack((current) => ({ ...current, range: event.target.value }))} />
            <SelectField id={`${id}-atk-crit`} label="Crítico com" value={String(attack.critRange)} onChange={(event) => setAttack((current) => ({ ...current, critRange: Number(event.target.value) }))}>
              {[20, 19, 18, 17, 16, 15].map((value) => (
                <option key={value} value={value}>
                  {critRangeLabel(value)} no d20
                </option>
              ))}
            </SelectField>
            <TextField
              id={`${id}-atk-critextra`}
              label="Dano extra no crítico"
              placeholder="1d8"
              maxLength={40}
              value={attack.critExtra}
              onChange={(event) => setAttack((current) => ({ ...current, critExtra: event.target.value }))}
            />
            <CheckboxField
              id={`${id}-atk-prof`}
              label="Proficiente"
              checked={attack.proficient}
              onChange={(event) => setAttack((current) => ({ ...current, proficient: event.target.checked }))}
              className="self-end sm:col-span-2"
            />
            <p className="text-xs text-fg-muted sm:col-span-4">
              No crítico os dados do dano (e do adicional) dobram e entra o dano extra de crítico. O ataque aparece em Jogo, com os botões de dano e de crítico.
            </p>
          </fieldset>
        ) : null}
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
