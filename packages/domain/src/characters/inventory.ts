/**
 * Inventário genérico de personagens. Moedas e capacidade de carga são definidas por
 * cada sistema de RPG (ver @codexveil/rpg-systems).
 */

export const ITEM_CATEGORIES = [
  'weapon',
  'armor',
  'gear',
  'consumable',
  'tool',
  'treasure',
  'other',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const itemCategoryLabels: Record<ItemCategory, string> = {
  weapon: 'Armas',
  armor: 'Armaduras e escudos',
  gear: 'Equipamento',
  consumable: 'Consumíveis',
  tool: 'Ferramentas',
  treasure: 'Tesouros',
  other: 'Outros',
};

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  /** Peso unitário; `null` quando não se aplica. */
  weight: number | null;
  isEquipped: boolean;
  sortOrder: number;
}

/** Peso total carregado (quantidade × peso unitário), arredondado a duas casas. */
export function totalWeight(items: readonly Pick<InventoryItem, 'quantity' | 'weight'>[]): number {
  const total = items.reduce((sum, item) => sum + item.quantity * (item.weight ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/** Nova quantidade após ajuste, nunca negativa. */
export function adjustQuantity(quantity: number, delta: number): number {
  if (!Number.isInteger(delta)) {
    throw new RangeError(`Ajuste inválido: ${delta}. Use um número inteiro.`);
  }
  return Math.max(0, quantity + delta);
}

/** Agrupa itens por categoria, na ordem de ITEM_CATEGORIES, mantendo a ordenação interna. */
export function groupByCategory<T extends Pick<InventoryItem, 'category' | 'sortOrder' | 'name'>>(
  items: readonly T[],
): { category: ItemCategory; items: T[] }[] {
  return ITEM_CATEGORIES.map((category) => ({
    category,
    items: items
      .filter((item) => item.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR')),
  })).filter((group) => group.items.length > 0);
}
