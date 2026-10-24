/**
 * Tesouro por ND do Tormenta20 (capítulo 8), com as tabelas do livro importado (kind 'table').
 *
 * Tabela 8-1 → dinheiro (moedas ou riquezas da Tabela 8-2) e itens (diverso, equipamento,
 * superior, poções ou mágico, nas Tabelas 8-3 a 8-5 e 8-12 a 8-15). "+%" soma 20 na rolagem do
 * tipo de riqueza ou poção; "2D" rola duas vezes para o jogador escolher. Armas e armaduras
 * mágicas indicam a tabela do livro (encantos variam demais para sortear sem o mestre).
 */
import type { T20Item } from './content';

type Table = T20Item<'table'>;
type Range = { min: number; max: number };

export interface T20TreasureLine {
  /** "Dinheiro" ou "Itens". */
  kind: 'money' | 'items';
  /** Resultado da Tabela 8-1 (ex.: "1d3 riquezas menores+%"). */
  rolled: string;
  /** O que o grupo encontra, já sorteado (uma linha por item ou riqueza). */
  results: string[];
  /** Total em T$ do dinheiro (moedas e riquezas), quando há. */
  totalTibares?: number;
}

export interface T20Treasure {
  nd: string;
  lines: T20TreasureLine[];
}

const d = (sides: number, random: () => number) => 1 + Math.floor(random() * sides);
const percent = (random: () => number) => d(100, random);
const inRange = (range: Range | null | undefined, value: number) =>
  Boolean(range && value >= range.min && value <= range.max);
const number = (text: string) => Number(text.replace(/\./g, '').replace(',', '.'));

/** "2d6+1x100", "4d4", "1d4x10", "2d10x1.000" → valor rolado. */
function rollAmount(expression: string, random: () => number): number {
  const m = /^(\d+)d(\d+)(?:\s*\+\s*(\d+))?(?:\s*x\s*([\d.]+))?$/i.exec(
    expression.replace(/\s+/g, ''),
  );
  if (!m) return number(expression) || 0;
  let total = Number(m[3] ?? 0);
  for (let i = 0; i < Number(m[1]); i++) total += d(Number(m[2]), random);
  return total * (m[4] ? number(m[4]) : 1);
}

/** Quantidade "1", "1d3", "1d4+1" → número. */
function rollCount(expression: string, random: () => number): number {
  const m = /^(\d+)(?:d(\d+))?(?:\s*\+\s*(\d+))?$/i.exec(expression.trim());
  if (!m) return 1;
  if (!m[2]) return Number(m[1]);
  let total = Number(m[3] ?? 0);
  for (let i = 0; i < Number(m[1]); i++) total += d(Number(m[2]), random);
  return total;
}

const COIN_TO_TIBAR: Record<string, number> = { TC: 0.1, T$: 1, TO: 10 };

function pick<T extends Range>(rows: readonly T[] | undefined, value: number): T | undefined {
  return rows?.find((row) => inRange(row, value));
}

function subtable(
  tables: readonly Table[],
  key: string,
  label: string,
  random: () => number,
): string {
  const table = tables.find((entry) => entry.title.includes(key));
  const rows = table?.subtables[label] ?? Object.values(table?.subtables ?? {})[0];
  const row = pick(rows, percent(random));
  return row ? [row.text, ...row.extra].filter(Boolean).join(' — ') : `(role na ${key})`;
}

/** Equipamento: 1d6 → 1–3 arma, 4–5 armadura ou escudo, 6 esotérico. */
function equipmentKind(random: () => number): { label: string; superior: string } {
  const roll = d(6, random);
  if (roll <= 3) return { label: 'Arma', superior: 'Armas' };
  if (roll <= 5) return { label: 'Armadura', superior: 'Armaduras/Escudos' };
  return { label: 'Esotérico', superior: 'Esotéricos' };
}

function rollItem(tables: readonly Table[], text: string, random: () => number): string[] {
  const clean = text.replace(/2D$/, '').trim();
  if (clean === '—' || !clean) return [];
  if (/^diverso/i.test(clean)) return [subtable(tables, '8-3', 'Item', random)];
  if (/^equipamento/i.test(clean)) {
    const kind = equipmentKind(random);
    return [`${kind.label}: ${subtable(tables, '8-4', kind.label, random)}`];
  }
  const superior = /^superior\s*\((\d+)\s+melhorias?\)/i.exec(clean);
  if (superior) {
    const kind = equipmentKind(random);
    const base = subtable(tables, '8-4', kind.label, random);
    const upgrades = Array.from({ length: Number(superior[1]) }, () =>
      subtable(tables, '8-5', kind.superior, random),
    );
    return [`${kind.label} superior: ${base} (${upgrades.join(', ')})`];
  }
  const potions = /^(\S+)\s+poç(?:ão|ões)(\+%)?$/i.exec(clean);
  if (potions) {
    const count = rollCount(potions[1]!, random);
    const table = tables.find((entry) => entry.title.includes('8-12'));
    return Array.from({ length: count }, () => {
      const roll = Math.min(100, percent(random) + (potions[2] ? 20 : 0));
      const row = pick(table?.subtables['Poção'] ?? Object.values(table?.subtables ?? {})[0], roll);
      return row ? `Poção: ${[row.text, ...row.extra].join(' — ')}` : 'Poção (role na Tabela 8-12)';
    });
  }
  const magic = /^m[áa]gico\s*\((menor|m[ée]dio|maior)\)/i.exec(clean);
  if (magic) {
    const tier = magic[1]!.toLowerCase().startsWith('men')
      ? 'menor'
      : magic[1]!.toLowerCase().startsWith('mai')
        ? 'maior'
        : 'médio';
    const roll = d(6, random);
    if (roll <= 2) return [`Arma mágica (${tier}): role na Tabela 8-8 do livro`];
    if (roll === 3) return [`Armadura ou escudo mágico (${tier}): role na Tabela 8-10 do livro`];
    const key = tier === 'menor' ? '8-13' : tier === 'maior' ? '8-15' : '8-14';
    return [`Acessório (${tier}): ${subtable(tables, key, 'Acessório', random)}`];
  }
  return [clean];
}

function rollMoney(
  tables: readonly Table[],
  text: string,
  random: () => number,
): { results: string[]; total: number } {
  const clean = text.trim();
  if (clean === '—' || !clean) return { results: [], total: 0 };
  const coins = /^(.+?)\s*(TC|T\$|TO)$/i.exec(clean);
  if (coins && /d/i.test(coins[1]!)) {
    const amount = rollAmount(coins[1]!, random);
    const coin = coins[2]!.toUpperCase();
    return {
      results: [`${amount.toLocaleString('pt-BR')} ${coin}`],
      total: amount * (COIN_TO_TIBAR[coin] ?? 1),
    };
  }
  const riches = /^(\S+)\s+riquezas?\s+(menor(?:es)?|m[ée]dias?|maior(?:es)?)(\+%)?$/i.exec(clean);
  if (riches) {
    const count = rollCount(riches[1]!, random);
    const tier = riches[2]!.toLowerCase();
    const column = tier.startsWith('men') ? 'menor' : tier.startsWith('mai') ? 'maior' : 'media';
    const rows = tables.find((entry) => entry.format === 'riches')?.riches ?? [];
    let total = 0;
    const results = Array.from({ length: count }, () => {
      const roll = Math.min(100, percent(random) + (riches[3] ? 20 : 0));
      const row = rows.find((entry) => inRange(entry[column], roll));
      if (!row) return 'Riqueza (role na Tabela 8-2)';
      const value = rollAmount(row.value, random);
      total += value;
      return `Riqueza de T$ ${value.toLocaleString('pt-BR')} — ${row.example}`;
    });
    return { results, total };
  }
  return { results: [clean], total: 0 };
}

/** Rola o tesouro de uma criatura (ou encontro) de ND `nd` com as tabelas do livro. */
export function rollT20Treasure(
  tables: readonly Table[],
  nd: string,
  random: () => number = Math.random,
): T20Treasure | null {
  const byNd = tables.find((entry) => entry.format === 'nd');
  const row = byNd?.nd.find((entry) => entry.nd === nd);
  if (!row) return null;
  const lines: T20TreasureLine[] = [];
  const moneyRow = pick(row.money, percent(random));
  if (moneyRow) {
    const money = rollMoney(tables, moneyRow.text, random);
    lines.push({
      kind: 'money',
      rolled: moneyRow.text,
      results: money.results,
      ...(money.total ? { totalTibares: Math.round(money.total) } : {}),
    });
  }
  const itemRow = pick(row.items, percent(random));
  if (itemRow) {
    const twice = /2D$/.test(itemRow.text);
    const first = rollItem(tables, itemRow.text, random);
    const results =
      twice && first.length
        ? [
            ...first.map((text) => `Opção 1: ${text}`),
            ...rollItem(tables, itemRow.text, random).map((text) => `Opção 2: ${text}`),
          ]
        : first;
    lines.push({ kind: 'items', rolled: itemRow.text, results });
  }
  return { nd, lines };
}

/** NDs com linha na Tabela 8-1 do livro. */
export function t20TreasureNds(tables: readonly Table[]): string[] {
  return tables.find((entry) => entry.format === 'nd')?.nd.map((row) => row.nd) ?? [];
}
