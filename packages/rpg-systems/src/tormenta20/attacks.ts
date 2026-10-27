/**
 * Ataques do Tormenta20 (Jogo do Ano, cap. 5 "Combate"), calculados a partir da arma equipada:
 *   * teste de ataque: Luta (corpo a corpo) ou Pontaria (à distância), com tudo o que a perícia já soma;
 *   * dano: dados da arma + Força (corpo a corpo e arremesso; disparo não soma Força);
 *   * crítico: margem de ameaça e multiplicador da arma ("19", "x3", "19/x3"); só os dados são
 *     multiplicados, os bônus numéricos não;
 *   * Fúria do Bárbaro: +2 no ataque e no dano corpo a corpo (+1 a cada cinco níveis, pagando PM);
 *   * Estilos (cap. 2, poderes de combate): Disparo (+Des no dano de disparo), Arremesso (+2 no
 *     dano de arremesso), Duas Mãos (+5 no dano corpo a corpo com arma de duas mãos, não leve) e
 *     Uma Arma (+2 no ataque com arma corpo a corpo numa mão e nada na outra).
 */
import type { T20Content } from './content';
import type { T20Derived } from './derived';
import type { T20Sheet } from './sheet';

/**
 * melee: só corpo a corpo (Luta, +For); melee-thrown: corpo a corpo que também pode ser arremessada
 * (Luta por padrão); thrown: arma de arremesso (Pontaria, +For); ranged: disparo (Pontaria, sem For).
 */
export type T20WeaponKind = 'melee' | 'melee-thrown' | 'thrown' | 'ranged';
export type T20Grip = 'leve' | 'uma' | 'duas';

export interface T20WeaponStats {
  damage: string;
  damageType: string;
  /** Menor resultado natural do d20 que ameaça crítico. */
  critMargin: number;
  critMultiplier: number;
  /** Corpo a corpo, corpo a corpo que também pode ser arremessada, ou de disparo. */
  kind: T20WeaponKind;
  range: string;
  /** Empunhadura; `null` quando o livro não informa. */
  grip: T20Grip | null;
}

export interface T20AttackEffects {
  /** Bônus da Fúria ativa (0 = desligada). */
  rage: number;
  /** A outra mão está ocupada (outra arma ou escudo equipado): sem Estilo de Uma Arma. */
  offHandBusy?: boolean;
  /** Nome do item (para Foco em Arma, armas anãs, tridente…). */
  weaponName?: string;
  /** Lembretes dos bônus de situação ligados (ataque e dano que a ficha não soma sozinha). */
  reminders?: readonly string[];
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
  return {
    margin: margin ? Number(margin[1]) : 20,
    multiplier: multiplier ? Number(multiplier[1]) : 2,
  };
}

const SHOOTING = /\b(arco|besta|funda|zarabatana|arcabuz|mosquete|pistola|bacamarte|canh[aã]o)\b/;

function weaponKind(
  name: string,
  category: string,
  range: string,
  attack?: 'corpo' | 'distancia',
): T20WeaponKind {
  const hasRange = Boolean(range.trim()) && !/^[—–-]$/.test(range.trim());
  if (!hasRange) return 'melee';
  if (SHOOTING.test(plain(name)) || plain(category).includes('fogo')) return 'ranged';
  // Sem a seção da tabela (livros antigos), arma com alcance que não dispara é tratada como corpo a corpo arremessável.
  return attack === 'distancia' ? 'thrown' : 'melee-thrown';
}

function gripFromText(text: string): T20Grip | null {
  const value = plain(text);
  if (/duas maos/.test(value)) return 'duas';
  if (/\bleve\b/.test(value)) return 'leve';
  if (/uma mao/.test(value)) return 'uma';
  return null;
}

export const t20GripLabels: Record<T20Grip, string> = {
  leve: 'leve',
  uma: 'uma mão',
  duas: 'duas mãos',
};

/**
 * Estatísticas da arma: do livro (equipamento com o mesmo nome) ou, sem o livro, da descrição que
 * o catálogo grava no item ("Dano 1d6 · Crítico 19 · Alcance Curto · Perfuração").
 */
export function t20WeaponStats(
  itemName: string,
  description: string,
  content: T20Content | null,
): T20WeaponStats | null {
  const target = plain(itemName);
  const fromBook = content?.equipment.find(
    (entry) => entry.group === 'arma' && plain(entry.name) === target,
  );
  if (fromBook) {
    const crit = parseT20Critical(fromBook.critical);
    return {
      damage: fromBook.damage,
      damageType: fromBook.damageType,
      critMargin: crit.margin,
      critMultiplier: crit.multiplier,
      kind: weaponKind(fromBook.name, fromBook.category, fromBook.range, fromBook.attack),
      range: fromBook.range,
      grip: fromBook.grip ?? null,
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
    kind: weaponKind(
      itemName,
      '',
      range,
      /distância|distancia/i.test(description) ? 'distancia' : undefined,
    ),
    range,
    grip: gripFromText(description),
  };
}

function classLevel(sheet: T20Sheet, name: string): number {
  return sheet.identity.classes
    .filter((entry) => plain(entry.name) === plain(name))
    .reduce((total, entry) => total + entry.level, 0);
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
  return formula.replace(
    /(\d*)d(\d+)/gi,
    (_, count: string, sides: string) => `${(Number(count) || 1) * multiplier}d${sides}`,
  );
}

export function resolveT20Attack(
  stats: T20WeaponStats,
  sheet: T20Sheet,
  derived: T20Derived,
  effects: T20AttackEffects,
): ResolvedT20Attack {
  const notes: string[] = [];
  const melee = stats.kind === 'melee' || stats.kind === 'melee-thrown';
  const skill = melee ? 'luta' : 'pontaria';
  let toHit = derived.skills[skill].total;
  notes.push(`${melee ? 'Luta' : 'Pontaria'} ${sign(toHit)}`);

  let bonus = 0;
  if (stats.kind !== 'ranged') {
    // Corpo a corpo e arremesso somam a Força no dano.
    bonus += derived.attributes.for;
    notes.push(`Força ${sign(derived.attributes.for)} no dano`);
  }
  if (stats.kind === 'melee-thrown') notes.push('Pode ser arremessada (aí o teste é de Pontaria)');
  if (stats.kind === 'ranged' && hasPower(sheet, 'Estilo de Disparo')) {
    bonus += derived.attributes.des;
    notes.push(`Estilo de Disparo: Destreza ${sign(derived.attributes.des)} no dano`);
  }
  if (stats.kind === 'thrown' && hasPower(sheet, 'Estilo de Arremesso')) {
    bonus += 2;
    notes.push('Estilo de Arremesso +2 no dano');
  }
  if (melee && stats.grip === 'duas' && hasPower(sheet, 'Estilo de Duas Mãos')) {
    bonus += 5;
    notes.push('Estilo de Duas Mãos +5 no dano');
  }
  if (
    melee &&
    (stats.grip === 'leve' || stats.grip === 'uma') &&
    hasPower(sheet, 'Estilo de Uma Arma')
  ) {
    if (effects.offHandBusy) notes.push('Estilo de Uma Arma: a outra mão está ocupada (sem o +2)');
    else {
      toHit += 2;
      notes.push('Estilo de Uma Arma +2 no ataque');
    }
  }
  // Poderes e habilidades que valem com uma arma específica (o nome da arma está no item).
  const weapon = plain(effects.weaponName ?? '');
  const chosen = (power: string) =>
    sheet.powers.some((entry) => {
      const match = /^(.*?)\s*\((.+)\)$/.exec(entry.name);
      return Boolean(match && plain(match[1]!) === plain(power) && weapon && weapon.startsWith(plain(match[2]!)));
    });
  if (chosen('Foco em Arma')) {
    toHit += 2;
    notes.push('Foco em Arma +2 no ataque');
  }
  if (chosen('Mestre em Arma')) notes.push('Mestre em Arma: dano um passo acima; 2 PM para rolar de novo o ataque');
  const racePlain = plain(sheet.identity.race);
  if (racePlain === 'anao' && /machado|martelo|marreta|picareta/.test(weapon)) {
    toHit += 2;
    notes.push('Tradição de Heredrimm +2 no ataque');
  }
  const tridentFamily = /azagaia|lanca|tridente/.test(weapon);
  if (tridentFamily && racePlain === 'sereia/tritao') {
    bonus += 2;
    notes.push('Mestre do Tridente +2 no dano');
  }
  if (tridentFamily && hasPower(sheet, 'Arsenal das profundezas')) {
    bonus += 2;
    notes.push('Arsenal das Profundezas +2 no dano e +1 no multiplicador');
  }
  const extraMultiplier = tridentFamily && hasPower(sheet, 'Arsenal das profundezas') ? 1 : 0;
  let extraMargin = 0;
  if (hasPower(sheet, 'Armas da ambição')) {
    toHit += 1;
    extraMargin += 1;
    notes.push('Armas da Ambição +1 no ataque e na margem de ameaça');
  }
  for (const reminder of effects.reminders ?? []) notes.push(reminder);
  if (effects.rage && melee) {
    toHit += effects.rage;
    bonus += effects.rage;
    notes.push(`Fúria +${effects.rage} no ataque e no dano`);
  }
  if (
    !stats.grip &&
    (hasPower(sheet, 'Estilo de Duas Mãos') || hasPower(sheet, 'Estilo de Uma Arma'))
  ) {
    notes.push('Empunhadura desconhecida: reimporte o livro para aplicar os Estilos');
  }

  return {
    skill,
    toHit,
    damage: withBonus(stats.damage, bonus),
    critical: withBonus(multiplyDice(stats.damage, stats.critMultiplier + extraMultiplier), bonus),
    critMargin: stats.critMargin - extraMargin,
    critMultiplier: stats.critMultiplier + extraMultiplier,
    notes,
  };
}
