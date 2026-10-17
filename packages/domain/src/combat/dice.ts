/**
 * Expressões de dados ("1d20+5", "2d6+1d4+3", "d100"), com os mesmos limites da função
 * `roll_dice` do banco: até 10 termos, 100 dados e faces entre 2 e 1000.
 *
 * Nas campanhas, a rolagem acontece no banco (ninguém escolhe o resultado). A rolagem local
 * serve para personagens sem campanha, em que não há mural nem mestre.
 */

export const DICE_ROLL_MODES = ['normal', 'advantage', 'disadvantage'] as const;
export type DiceRollMode = (typeof DICE_ROLL_MODES)[number];

export const diceRollModeLabels: Record<DiceRollMode, string> = {
  normal: 'Normal',
  advantage: 'Vantagem',
  disadvantage: 'Desvantagem',
};

/** Dados comuns de D&D, na ordem dos botões rápidos. */
export const COMMON_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export interface DiceTerm {
  sign: 1 | -1;
  /** `null` para modificadores fixos (ex.: "+3"). */
  count: number | null;
  sides: number | null;
  value: number;
}

/** Um grupo de dados rolados, como o banco grava em `dice_rolls.dice`. */
export interface RolledDiceGroup {
  sign: number;
  count: number;
  sides: number;
  values: number[];
  /** Dados que contam no total (na vantagem, só o maior dos dois d20). */
  kept: number[];
}

export interface DiceRollResult {
  expression: string;
  mode: DiceRollMode;
  dice: RolledDiceGroup[];
  modifier: number;
  total: number;
}

const FULL_PATTERN = /^[+-]?(\d{0,3}d\d{1,4}|\d{1,5})([+-](\d{0,3}d\d{1,4}|\d{1,5}))*$/;
const TERM_PATTERN = /([+-]?)(\d*d\d+|\d+)/g;

/** Remove espaços e padroniza em minúsculas ("2D6 + 3" → "2d6+3"). */
export function normalizeDiceExpression(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

/** Termos da expressão, ou `null` quando ela é inválida ou passa dos limites. */
export function parseDiceExpression(text: string): DiceTerm[] | null {
  const expression = normalizeDiceExpression(text);
  if (expression.length < 1 || expression.length > 60 || !FULL_PATTERN.test(expression)) return null;
  const terms: DiceTerm[] = [];
  let dice = 0;
  for (const match of expression.matchAll(TERM_PATTERN)) {
    const sign = match[1] === '-' ? -1 : 1;
    const body = match[2] ?? '';
    if (body.includes('d')) {
      const [countText, sidesText] = body.split('d');
      const count = countText ? Number(countText) : 1;
      const sides = Number(sidesText);
      if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
      dice += count;
      terms.push({ sign, count, sides, value: 0 });
    } else {
      terms.push({ sign, count: null, sides: null, value: Number(body) });
    }
  }
  if (terms.length > 10 || dice === 0 || dice > 100) return null;
  return terms;
}

/** Monta a expressão de um teste: 1d20 com o bônus ("1d20+5", "1d20-1"). */
export function d20Expression(bonus: number): string {
  if (bonus === 0) return '1d20';
  return `1d20${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}`;
}

/** Soma um bônus a uma fórmula de dano ("1d8" + 3 → "1d8+3"); devolve `null` se for inválida. */
export function withBonus(formula: string, bonus: number): string | null {
  const base = normalizeDiceExpression(formula).replace(/[−–]/g, '-');
  if (!parseDiceExpression(base)) return null;
  if (bonus === 0) return base;
  const combined = `${base}${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}`;
  return parseDiceExpression(combined) ? combined : base;
}

/**
 * Rola no próprio aparelho (personagens sem campanha). Vantagem/desvantagem vale para o
 * primeiro 1d20 positivo da expressão, como no banco.
 */
export function rollDiceLocally(
  text: string,
  mode: DiceRollMode = 'normal',
  random: () => number = Math.random,
): DiceRollResult | null {
  const terms = parseDiceExpression(text);
  if (!terms) return null;
  const roll = (sides: number) => 1 + Math.floor(random() * sides);
  const dice: RolledDiceGroup[] = [];
  let modifier = 0;
  let total = 0;
  let appliedMode: DiceRollMode = 'normal';
  for (const term of terms) {
    if (term.count === null || term.sides === null) {
      modifier += term.sign * term.value;
      continue;
    }
    let values = Array.from({ length: term.count }, () => roll(term.sides ?? 2));
    let kept = values;
    if (mode !== 'normal' && appliedMode === 'normal' && term.count === 1 && term.sides === 20 && term.sign === 1) {
      values = [values[0] ?? roll(20), roll(20)];
      kept = [mode === 'advantage' ? Math.max(...values) : Math.min(...values)];
      appliedMode = mode;
    }
    total += term.sign * kept.reduce((sum, value) => sum + value, 0);
    dice.push({ sign: term.sign, count: term.count, sides: term.sides, values, kept });
  }
  return { expression: normalizeDiceExpression(text), mode: appliedMode, dice, modifier, total: total + modifier };
}

/** Detalhe legível: "2d6 (3, 5) + 1d4 (2) + 3"; na vantagem, "1d20 (17, ~~4~~)". */
export function describeDiceRoll(roll: Pick<DiceRollResult, 'dice' | 'modifier'>): string {
  const parts: string[] = [];
  roll.dice.forEach((group, index) => {
    const discarded = [...group.values];
    for (const value of group.kept) {
      const position = discarded.indexOf(value);
      if (position >= 0) discarded.splice(position, 1);
    }
    const shown = group.kept.join(', ') + (discarded.length > 0 ? ` | descartado: ${discarded.join(', ')}` : '');
    const sign = group.sign < 0 ? '− ' : index > 0 ? '+ ' : '';
    parts.push(`${sign}${group.count}d${group.sides} (${shown})`);
  });
  if (roll.modifier !== 0) parts.push(`${roll.modifier > 0 ? '+' : '−'} ${Math.abs(roll.modifier)}`);
  return parts.join(' ');
}

/** 20 natural (ou 1 natural) no d20 que conta no total, para destacar acertos e falhas críticos. */
export function naturalD20(roll: Pick<DiceRollResult, 'dice'>): 20 | 1 | null {
  const d20 = roll.dice.find((group) => group.sides === 20 && group.count === 1 && group.sign > 0);
  const value = d20?.kept[0];
  return value === 20 ? 20 : value === 1 ? 1 : null;
}
