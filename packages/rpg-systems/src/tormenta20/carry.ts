/**
 * Carga do Tormenta20: espaços ocupados pelos itens (o campo "peso" guarda os espaços) e itens que
 * aumentam a capacidade quando vestidos (Mochila de aventureiro +2, Mochila de carga +10; elas
 * próprias não gastam espaço).
 */
import { plainT20 } from './content';

interface CarryItem {
  name: string;
  weight: number | null;
  quantity: number;
  isEquipped: boolean;
}

/** Aumento de carga de um item vestido (0 se não for um item de carga). */
function carryBonusOf(name: string): number {
  const plain = plainT20(name);
  if (!plain.startsWith('mochila')) return 0;
  // "Mochila de carga" é o item mágico; as demais mochilas valem como a de aventureiro.
  return plain.startsWith('mochila de carga') ? 10 : 2;
}

export interface T20Carry {
  used: number;
  capacity: number;
  /** Itens vestidos que aumentam a carga (ex.: "Mochila de aventureiro +2"). */
  bonuses: { name: string; bonus: number }[];
}

export function t20Carry(items: readonly CarryItem[], baseCapacity: number): T20Carry {
  const bonuses: T20Carry['bonuses'] = [];
  let used = 0;
  for (const item of items) {
    const bonus = item.isEquipped ? carryBonusOf(item.name) : 0;
    // Só uma mochila vale ao mesmo tempo (a maior); as outras ocupam espaço normalmente.
    if (bonus > 0 && bonuses.length === 0) {
      bonuses.push({ name: item.name, bonus });
      used += (item.weight ?? 0) * Math.max(0, item.quantity - 1);
      continue;
    }
    if (bonus > (bonuses[0]?.bonus ?? 0)) {
      const previous = items.find((entry) => entry.name === bonuses[0]!.name);
      used += previous?.weight ?? 0;
      bonuses[0] = { name: item.name, bonus };
      used += (item.weight ?? 0) * Math.max(0, item.quantity - 1);
      continue;
    }
    used += (item.weight ?? 0) * item.quantity;
  }
  return { used, capacity: baseCapacity + (bonuses[0]?.bonus ?? 0), bonuses };
}
