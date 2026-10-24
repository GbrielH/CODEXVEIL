/**
 * Defesa do Tormenta20 a partir do que está equipado: armadura e escudo do inventário trazem
 * "Defesa +N, penalidade P" na descrição (como a criação grava). Armaduras pesadas não somam a
 * Destreza.
 */
import type { T20Sheet } from './sheet';

export interface T20GearItem {
  name: string;
  category: string;
  description: string;
  isEquipped: boolean;
}

const HEAVY = [
  'brunea',
  'cota de malha',
  'loriga',
  'meia armadura',
  'meia-armadura',
  'armadura completa',
  'placas',
];

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function stats(description: string): { defense: number; penalty: number } | null {
  const defense = /defesa\s*\+?\s*(\d+)/i.exec(description);
  if (!defense) return null;
  const penalty = /penalidade\s*([−-]?\s*\d+)/i.exec(description);
  return {
    defense: Number(defense[1]),
    penalty: penalty ? -Math.abs(Number(penalty[1]!.replace(/[−\s]/g, '').replace('-', ''))) : 0,
  };
}

/** Bônus de armadura/escudo equipados; `null` quando o inventário não tem armaduras (mantém a ficha). */
export function t20DefenseFromItems(items: readonly T20GearItem[]): T20Sheet['defense'] | null {
  const armorItems = items.filter((item) => item.category === 'armor' && stats(item.description));
  if (armorItems.length === 0) return null;
  const equipped = armorItems.filter((item) => item.isEquipped);
  const shield = equipped.find((item) => plain(item.name).includes('escudo'));
  const body = equipped.find((item) => item !== shield);
  const bodyStats = body ? stats(body.description)! : null;
  const shieldStats = shield ? stats(shield.description)! : null;
  return {
    armor: bodyStats?.defense ?? 0,
    shield: shieldStats?.defense ?? 0,
    other: 0,
    useDexterity: !(body && HEAVY.some((name) => plain(body.name).includes(name))),
    armorPenalty: (bodyStats?.penalty ?? 0) + (shieldStats?.penalty ?? 0),
  };
}
