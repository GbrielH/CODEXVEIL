/**
 * Ataques do Tormenta20 (Jogo do Ano, cap. 5 "Combate"), calculados a partir da arma equipada:
 *   * teste de ataque: Luta (corpo a corpo) ou Pontaria (à distância), com tudo o que a perícia já soma;
 *   * dano: dados da arma + Força (corpo a corpo e arremesso; disparo não soma Força);
 *   * crítico: margem de ameaça e multiplicador da arma ("19", "x3", "19/x3"); só os dados são
 *     multiplicados, os bônus numéricos não;
 *   * Fúria do Bárbaro: +2 no ataque e no dano corpo a corpo (+1 a cada cinco níveis, pagando PM);
 *   * Estilo de Disparo: soma a Destreza no dano com armas de disparo.
 */
import type { T20Content } from './content';
import type { T20Derived } from './derived';
import type { T20Sheet } from './sheet';

export type T20WeaponKind = 'melee' | 'thrown' | 'ranged';

export interface T20WeaponStats {
  damage: string;
  damageType: string;
  /** Menor resultado natural do d20 que ameaça crítico. */
  critMargin: number;
  critMultiplier: number;
  /** Corpo a corpo, corpo a corpo que também pode ser arremessada, ou de disparo. */
  kind: T20WeaponKind;
  range: string;
}

export interface T20AttackEffects {
  /** Bônus da Fúria ativa (0 = desligada). */
  rage: number;
}

export interface ResolvedT20Attack {
  skill: 'luta' | 'pontaria';
  toHit: number;
  damage: string;
  critical: string;
  critMargin: number;
  critMultiplier: number;
  notes: string[];
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
}

/** "19" → margem 19 ×2; "x3" → 20 ×3; "19/x3" → 19 ×3; vazio ou "—" → 20 ×2. */
export function parseT20Critical(text: string): { margin: number; multiplier: number } {
  const margin = /(?:^|\D)(1[89]|20)(?!\d)/.exec(text);
  const multiplier = /[x×](\d)/i.exec(text);
  return { margin: margin ? Number(margin[1]) : 20, multiplier: multiplier ? Number(multiplier[1]) : 2 };
}

const SHOOTING = /\b(arco|besta|funda|zarabatana|arcabuz|mosquete|pistola|bacamarte|canh[aã]o)\b/;

function weaponKind(name: string, category: string, range: string): T20WeaponKind {
  const hasRange = Boolean(range.trim()) && !/^[—–-]$/.test(range.trim());
  if (!hasRange) return 'melee';
  return SHOOTING.test(plain(name)) || plain(category).includes('fogo') ? 'ranged' : 'thrown';
}

/**
 * Estatísticas da arma: do livro (equipamento com o mesmo nome) ou, sem o livro, da descrição que
 * o catálogo grava no item ("Dano 1d6 · Crítico 19 · Alcance Curto · Perfuração").
 */
export function t20WeaponStats(itemName: string, description: string, content: T20Content | null): T20WeaponStats | null {
  const target = plain(itemName);
  const fromBook = content?.equipment.find((entry) => entry.group === 'arma' && plain(entry.name) === target);
  if (fromBook) {
    const crit = parseT20Critical(fromBook.critical);
    return {
      damage: fromBook.damage,
      damageType: fromBook.damageType,
      critMargin: crit.margin,
      critMultiplier: crit.multiplier,
      kind: weaponKind(fromBook.name, fromBook.category, fromBook.range),
      range: fromBook.range,
    };
  }
  const damage = /Dano\s+(\d+d\d+(?:\+\d+)?)/i.exec(description);
  if (!damage?.[1]) return null;
  const crit = parseT20Critical(/Cr[ií]tico\s+([^·\n]+)/i.exec(description)?.[1] ?? '');
  const range = /Alcance\s+([^·\n]+)/i.exec(description)?.[1]?.trim() ?? '';
  return {
    damage: damage[1],
    damageType: '',
    critMargin: crit.margin,
    critMultiplier: crit.multiplier,
    kind: weaponKind(itemName, '', range),
    range,
  };
}

function classLevel(sheet: T20Sheet, name: string): number {
  return sheet.identity.classes.filter((entry) => plain(entry.name) === plain(name)).reduce((total, entry) => total + entry.level, 0);
}

/** Bônus máximo da Fúria pelo nível de Bárbaro (+2, e +1 a cada cinco níveis pagando +1 PM). */
export function t20RageMaxBonus(sheet: T20Sheet): number {
  const level = classLevel(sheet, 'Bárbaro');
  return level > 0 ? 2 + Math.floor(level / 5) : 0;
}

function hasPower(sheet: T20Sheet, name: string): boolean {
  return sheet.powers.some((power) => plain(power.name) === plain(name));
}

const sign = (value: number) => (value >= 0 ? `+${value}` : String(value));

function withBonus(formula: string, bonus: number): string {
  return bonus ? `${formula}${bonus > 0 ? '+' : ''}${bonus}` : formula;
}

/** Multiplica só os dados ("1d8+2" ×3 → "3d8+2"). */
function multiplyDice(formula: string, multiplier: number): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_, count: string, sides: string) => `${(Number(count) || 1) * multiplier}d${sides}`);
}

export function resolveT20Attack(stats: T20WeaponStats, sheet: T20Sheet, derived: T20Derived, effects: T20AttackEffects): ResolvedT20Attack {
  const notes: string[] = [];
  const melee = stats.kind !== 'ranged';
  const skill = melee ? 'luta' : 'pontaria';
  let toHit = derived.skills[skill].total;
  notes.push(`${melee ? 'Luta' : 'Pontaria'} ${sign(toHit)}`);

  let bonus = 0;
  if (melee) {
    bonus += derived.attributes.for;
    notes.push(`Força ${sign(derived.attributes.for)} no dano`);
    if (stats.kind === 'thrown') notes.push('Pode ser arremessada (use Pontaria)');
  }
  if (stats.kind === 'ranged' && hasPower(sheet, 'Estilo de Disparo')) {
    bonus += derived.attributes.des;
    notes.push(`Estilo de Disparo: Destreza ${sign(derived.attributes.des)} no dano`);
  }
  if (effects.rage && melee) {
    toHit += effects.rage;
    bonus += effects.rage;
    notes.push(`Fúria +${effects.rage} no ataque e no dano`);
  }
  if (hasPower(sheet, 'Estilo de Duas Mãos')) notes.push('Estilo de Duas Mãos: +5 no dano se usar a arma com as duas mãos');
  if (hasPower(sheet, 'Estilo de Uma Arma')) notes.push('Estilo de Uma Arma: +2 no ataque se a outra mão estiver livre');

  return {
    skill,
    toHit,
    damage: withBonus(stats.damage, bonus),
    critical: withBonus(multiplyDice(stats.damage, stats.critMultiplier), bonus),
    critMargin: stats.critMargin,
    critMultiplier: stats.critMultiplier,
    notes,
  };
}
