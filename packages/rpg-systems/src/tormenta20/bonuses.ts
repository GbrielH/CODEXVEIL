/**
 * Bônus automáticos do Tormenta20: habilidades de raça, de classe e poderes que dão um número que
 * vale sempre ("+2 em Misticismo e Percepção", "+1 na Defesa", "+1 PV por nível", "+3m de
 * deslocamento"). A tabela foi montada lendo cada habilidade do livro básico (2026-10-27); bônus
 * que dependem da situação ("contra", "quando", "com a arma X", habilidades ativadas com PM) ficam
 * de fora: o jogador aplica na hora. Condições que a ficha conhece (armadura pesada) são checadas.
 *
 * Tudo sai só da ficha (raça, classes e poderes gravados), sem precisar do livro carregado.
 */
import type { T20Attribute } from './attributes';
import { plainT20 } from './content';
import type { T20Sheet } from './sheet';
import type { T20Skill } from './skills';

export interface T20BonusContext {
  level: number;
  classLevels: Record<string, number>;
  /** Armadura pesada (a Destreza não entra na Defesa). */
  heavyArmor: boolean;
  /** Outros poderes da Tormenta (além do próprio). */
  otherTormentaPowers: number;
  attributes: Record<T20Attribute, number>;
}

export interface T20BonusEffect {
  skills?: Partial<Record<T20Skill, number>>;
  defense?: number;
  /** Metros a mais no deslocamento. */
  speed?: number;
  hitPoints?: number;
  manaPoints?: number;
}

type Rule = (context: T20BonusContext) => T20BonusEffect | null;

const all = (skills: readonly T20Skill[], value: number) => Object.fromEntries(skills.map((skill) => [skill, value])) as Partial<Record<T20Skill, number>>;
/** Poderes da Tormenta: +1, e +1 para cada dois outros poderes da Tormenta. */
const tormenta = (context: T20BonusContext) => 1 + Math.floor(context.otherTormentaPowers / 2);

/** Habilidades de raça: `raça|habilidade`. */
const RACE_RULES: Record<string, Rule> = {
  'elfo|sentidos elficos': () => ({ skills: all(['misticismo', 'percepcao'], 2) }),
  'goblin|rato das ruas': () => ({ skills: { fortitude: 2 } }),
  'minotauro|couro rigido': () => ({ defense: 1 }),
  'golem|chassi': () => ({ defense: 2 }),
  'hynne|pequeno e rechonchudo': () => ({ skills: { enganacao: 2 } }),
  'suraggel|luz sagrada': () => ({ skills: all(['diplomacia', 'intuicao'], 2) }),
  'suraggel|sombras profanas': () => ({ skills: all(['enganacao', 'furtividade'], 2) }),
  'trog|reptiliano': () => ({ defense: 1 }),
};

/** Habilidades de raça de cada raça (para saber quais valem; Suraggel depende da variante). */
const RACE_ABILITIES: Record<string, (variant: string) => string[]> = {
  elfo: () => ['Sentidos Élficos'],
  goblin: () => ['Rato das Ruas'],
  minotauro: () => ['Couro Rígido'],
  golem: () => ['Chassi'],
  hynne: () => ['Pequeno e Rechonchudo'],
  suraggel: (variant) => (variant === 'sulfure' ? ['Sombras Profanas'] : variant === 'aggelus' ? ['Luz Sagrada'] : []),
  trog: () => ['Reptiliano'],
};

/** Habilidades de classe: `classe|habilidade` com o nível de classe em que começa. */
const CLASS_RULES: Record<string, { label: string; from: number; rule: (classLevel: number, context: T20BonusContext) => T20BonusEffect | null }> = {
  'barbaro|instinto selvagem': { label: 'Bárbaro: Instinto Selvagem', from: 3, rule: (level) => ({ skills: all(['percepcao', 'reflexos'], 1 + Math.floor((level - 3) / 6)) }) },
  'bucaneiro|esquiva sagaz': {
    label: 'Bucaneiro: Esquiva Sagaz',
    from: 3,
    rule: (level, context) => (context.heavyArmor ? null : { defense: 1 + Math.floor((level - 3) / 4), skills: { reflexos: 1 + Math.floor((level - 3) / 4) } }),
  },
  'cacador|rastreador': { label: 'Caçador: Rastreador', from: 1, rule: () => ({ skills: { sobrevivencia: 2 } }) },
  'lutador|casca grossa': {
    label: 'Lutador: Casca Grossa',
    from: 3,
    rule: (level, context) =>
      context.heavyArmor ? null : { defense: Math.min(Math.max(0, context.attributes.con), context.level) + (level >= 7 ? 1 + Math.floor((level - 7) / 4) : 0) },
  },
};

/** Poderes (pelo nome simplificado). */
const POWER_RULES: Record<string, Rule> = {
  esquiva: () => ({ defense: 2, skills: { reflexos: 2 } }),
  'saque rapido': () => ({ skills: { iniciativa: 2 } }),
  vitalidade: (context) => ({ hitPoints: context.level, skills: { fortitude: 2 } }),
  atletico: () => ({ skills: { atletismo: 2 }, speed: 3 }),
  investigador: (context) => ({ skills: { investigacao: 2, intuicao: context.attributes.int } }),
  'sentidos agucados': () => ({ skills: { percepcao: 2 } }),
  'vontade de ferro': (context) => ({ manaPoints: Math.floor(context.level / 2), skills: { vontade: 2 } }),
  'astucia da serpente': () => ({ skills: all(['enganacao', 'furtividade', 'intuicao'], 2) }),
  'bencao do mana': (context) => ({ manaPoints: Math.ceil(context.level / 2) }),
  'compreender os ermos': () => ({ skills: { sobrevivencia: 2 } }),
  'escamas draconicas': () => ({ defense: 2, skills: { fortitude: 2 } }),
  'golpista divino': () => ({ skills: all(['enganacao', 'jogatina', 'ladinagem'], 2) }),
  'mente analitica': () => ({ skills: all(['intuicao', 'investigacao', 'vontade'], 2) }),
  'mente vazia': () => ({ skills: all(['iniciativa', 'percepcao', 'vontade'], 2) }),
  'talento artistico': () => ({ skills: all(['acrobacia', 'atuacao', 'diplomacia'], 2) }),
  antenas: (context) => ({ skills: all(['iniciativa', 'percepcao', 'vontade'], tormenta(context)) }),
  'articulacoes flexiveis': (context) => ({ skills: all(['acrobacia', 'furtividade', 'reflexos'], tormenta(context)) }),
  carapaca: (context) => ({ defense: tormenta(context) }),
  'maos membranosas': (context) => ({ skills: all(['atletismo', 'fortitude'], tormenta(context)) }),
  'olhos vermelhos': (context) => ({ skills: { intimidacao: tormenta(context) } }),
  'poder magico': (context) => ({ manaPoints: context.classLevels.arcanista ?? 0 }),
  'furia da savana': () => ({ speed: 3 }),
  'pele de ferro': (context) => (context.heavyArmor ? null : { defense: 4 }),
  encouracado: (context) => (context.heavyArmor ? { defense: 2 } : null),
  inexpugnavel: (context) => (context.heavyArmor ? { skills: all(['fortitude', 'reflexos', 'vontade'], 2) } : null),
  'pernas do mar': () => ({ skills: all(['acrobacia', 'atletismo'], 2) }),
  pajem: () => ({ skills: { diplomacia: 2 } }),
  'forca dos penhascos': () => ({ skills: { fortitude: 2 } }),
  gatuno: () => ({ skills: { atletismo: 2 } }),
  sombra: () => ({ skills: { furtividade: 2 } }),
  'voz poderosa': () => ({ skills: all(['diplomacia', 'intimidacao'], 2) }),
  'dom artistico': () => ({ skills: { atuacao: 2 } }),
  'esse cheiro...': () => ({ skills: { fortitude: 2 } }),
  'coracao heroico': (context) => ({ manaPoints: 3 * (1 + [5, 11, 17].filter((level) => context.level >= level).length) }),
  sarado: (context) => ({ hitPoints: context.attributes.for, skills: { fortitude: context.attributes.for } }),
};

const TORMENTA_POWERS = new Set(
  [
    'Anatomia Insana', 'Antenas', 'Armamento Aberrante', 'Articulações Flexíveis', 'Asas Insetoides', 'Carapaça', 'Corpo Aberrante',
    'Cuspir Enxame', 'Dentes Afiados', 'Desprezar a Realidade', 'Empunhadura Rubra', 'Fome de Mana', 'Larva Explosiva', 'Legião Aberrante',
    'Mãos Membranosas', 'Membros Estendidos', 'Membros extras', 'Mente Aberrante', 'Olhos Vermelhos', 'Pele Corrompida', 'Sangue Ácido', 'Visco Rubro',
  ].map(plainT20),
);

export interface T20AutomaticBonus {
  /** De onde vem (ex.: "Esquiva", "Elfo: Sentidos Élficos", "Bárbaro: Instinto Selvagem"). */
  source: string;
  effect: T20BonusEffect;
}

const baseName = (name: string) => plainT20(name.replace(/\s*\(.*\)$/, ''));

/** Bônus que valem sempre para esta ficha, cada um com a origem. */
export function t20AutomaticBonuses(sheet: T20Sheet, attributes: Record<T20Attribute, number> = sheet.attributes): T20AutomaticBonus[] {
  const classLevels: Record<string, number> = {};
  for (const entry of sheet.identity.classes) classLevels[plainT20(entry.name)] = (classLevels[plainT20(entry.name)] ?? 0) + entry.level;
  const level = Math.max(1, Object.values(classLevels).reduce((sum, value) => sum + value, 0));
  const powers = sheet.powers.map((power) => baseName(power.name));
  const context: T20BonusContext = {
    level,
    classLevels,
    heavyArmor: !sheet.defense.useDexterity,
    otherTormentaPowers: Math.max(0, powers.filter((name) => TORMENTA_POWERS.has(name)).length - 1),
    attributes,
  };
  const out: T20AutomaticBonus[] = [];
  const push = (source: string, effect: T20BonusEffect | null) => {
    if (effect) out.push({ source, effect });
  };

  const race = plainT20(sheet.identity.race);
  for (const ability of RACE_ABILITIES[race]?.(plainT20(sheet.identity.raceVariant)) ?? []) {
    const rule = RACE_RULES[`${race}|${plainT20(ability)}`];
    if (rule) push(`${sheet.identity.race}: ${ability}`, rule(context));
  }
  for (const [key, entry] of Object.entries(CLASS_RULES)) {
    const classLevel = classLevels[key.split('|')[0]!] ?? 0;
    if (classLevel >= entry.from) push(entry.label, entry.rule(classLevel, context));
  }
  // Poder repetido (ex.: escolhido duas vezes) conta uma vez: nenhum destes é cumulativo.
  for (const name of new Set(powers)) {
    const rule = POWER_RULES[name];
    if (rule) push(sheet.powers.find((power) => baseName(power.name) === name)?.name ?? name, rule(context));
  }
  return out;
}

/** Soma dos bônus automáticos (o que a ficha acrescenta aos números). */
export function sumT20Bonuses(bonuses: readonly T20AutomaticBonus[]): Required<T20BonusEffect> {
  const total: Required<T20BonusEffect> = { skills: {}, defense: 0, speed: 0, hitPoints: 0, manaPoints: 0 };
  for (const { effect } of bonuses) {
    total.defense += effect.defense ?? 0;
    total.speed += effect.speed ?? 0;
    total.hitPoints += effect.hitPoints ?? 0;
    total.manaPoints += effect.manaPoints ?? 0;
    for (const [skill, value] of Object.entries(effect.skills ?? {}) as [T20Skill, number][])
      total.skills[skill] = (total.skills[skill] ?? 0) + value;
  }
  return total;
}
