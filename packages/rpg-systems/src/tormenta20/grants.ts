/**
 * Escolhas concedidas: poderes e habilidades de raça que dão magias ("Centelha Mágica: escolha uma
 * magia de 1º círculo", "Tatuagem Mística", "Magia das Fadas"…) ou um poder ("Propósito de
 * Criação" do golem). A ficha calcula o que cada fonte concede e quanto já foi escolhido (pela
 * `source` das magias e poderes gravados); o que falta aparece como escolha pendente na ficha.
 * Vale para fichas criadas, para a subida de nível e para fichas antigas.
 */
import type { AbilityEntryTemplate } from '../types';
import { plainT20, findT20Class, type T20Content, type T20Item } from './content';
import { t20MaxCircle } from './creation';
import { t20PriceValue } from './origin-items';
import type { T20Sheet } from './sheet';
import { T20_SKILLS, type T20Skill } from './skills';

type SpellType = 'arcana' | 'divina' | 'universal';

interface SpellRule {
  count: number;
  /** Círculo máximo: um número fixo ou "o maior que o personagem lança". */
  circle: number | 'max';
  /** Tipos aceitos; `caster` = o tipo das magias da classe conjuradora. */
  types: readonly SpellType[] | 'caster';
  /** Lista fechada de magias (pelo nome). */
  names?: readonly string[];
}

/** Poderes que dão magias, pelo nome simplificado. */
const POWER_SPELLS: Record<string, SpellRule> = {
  'centelha magica': { count: 1, circle: 1, types: ['arcana', 'divina'] },
  'truque magico': { count: 1, circle: 1, types: ['arcana'] },
  'conhecimento magico': { count: 2, circle: 'max', types: 'caster' },
  'aumentar repertorio': { count: 2, circle: 'max', types: ['arcana', 'divina'] },
  'segredos da natureza': { count: 2, circle: 'max', types: ['arcana', 'divina'] },
};

/** Habilidades de raça que dão magias: raça → habilidade → regra. */
const RACE_SPELLS: Record<string, { ability: string; rule: SpellRule; variant?: string }[]> = {
  qareen: [{ ability: 'Tatuagem Mística', rule: { count: 1, circle: 1, types: ['arcana', 'divina'] } }],
  silfide: [
    {
      ability: 'Magia das Fadas',
      rule: { count: 2, circle: 5, types: ['arcana', 'divina', 'universal'], names: ['Criar Ilusão', 'Enfeitiçar', 'Luz', 'Sono'] },
    },
  ],
  suraggel: [
    { ability: 'Luz Sagrada', variant: 'aggelus', rule: { count: 1, circle: 5, types: ['arcana', 'divina', 'universal'], names: ['Luz'] } },
    { ability: 'Sombras Profanas', variant: 'sulfure', rule: { count: 1, circle: 5, types: ['arcana', 'divina', 'universal'], names: ['Escuridão'] } },
  ],
};

/** Habilidades de raça que dão um poder geral à escolha. */
const RACE_POWERS: Record<string, { ability: string; count: number }[]> = {
  golem: [{ ability: 'Propósito de Criação', count: 1 }],
};

const GENERAL_POWER_GROUPS = ['combate', 'destino', 'magia', 'tormenta'];

export interface T20SpellGrant {
  kind: 'spell';
  /** Rótulo gravado como `source` das magias escolhidas (é assim que a ficha sabe o que já foi feito). */
  source: string;
  title: string;
  /** Quantas faltam escolher. */
  missing: number;
  options: T20Item<'spell'>[];
}

export interface T20PowerGrant {
  kind: 'power';
  source: string;
  title: string;
  missing: number;
  options: T20Item<'feat'>[];
}

export type T20Grant = T20SpellGrant | T20PowerGrant;

function casterInfo(content: T20Content, sheet: T20Sheet): { circle: number; types: SpellType[] } {
  let circle = 0;
  const types = new Set<SpellType>();
  for (const entry of sheet.identity.classes) {
    const klass = findT20Class(content, entry.key) ?? content.classes.find((item) => plainT20(item.name) === plainT20(entry.name));
    if (!klass?.spellcasting) continue;
    circle = Math.max(circle, t20MaxCircle(klass, entry.level));
    types.add(klass.spellcasting.type);
  }
  return { circle, types: [...types] };
}

function spellOptions(content: T20Content, sheet: T20Sheet, rule: SpellRule): T20Item<'spell'>[] {
  const caster = casterInfo(content, sheet);
  const maxCircle = rule.circle === 'max' ? Math.max(1, caster.circle) : rule.circle;
  const types: readonly SpellType[] = rule.types === 'caster' ? (caster.types.length ? [...caster.types, 'universal'] : ['arcana', 'divina', 'universal']) : rule.types;
  const known = new Set(sheet.spells.known.map((spell) => plainT20(spell.name)));
  const names = rule.names?.map(plainT20);
  return content.spells
    .filter((spell) => spell.circle <= maxCircle && types.includes(spell.type) && !known.has(plainT20(spell.name)))
    .filter((spell) => !names || names.includes(plainT20(spell.name)))
    .sort((a, b) => a.circle - b.circle || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Magia de cada animal do Totem Espiritual (quadro do bárbaro). */
const TOTEM_SPELLS: Record<string, string> = {
  coruja: 'Orientação',
  corvo: 'Visão Mística',
  falcao: 'Detectar Ameaças',
  grifo: 'Primor Atlético',
  lobo: 'Concentração de Combate',
  raposa: 'Imagem Espelhada',
  tartaruga: 'Armadura Arcana',
  urso: 'Vitalidade Fantasma',
};

/** O que a raça e os poderes da ficha concedem e ainda não foi escolhido. */
export function listT20Grants(content: T20Content, sheet: T20Sheet): T20Grant[] {
  const grants: T20Grant[] = [];
  const spellsFrom = (source: string) => sheet.spells.known.filter((spell) => spell.source === source).length;

  const totem = sheet.powers.map((power) => /^totem espiritual \((.+)\)$/.exec(plainT20(power.name))?.[1]).find(Boolean);
  const totemSpell = totem ? TOTEM_SPELLS[totem] : undefined;
  if (totemSpell && spellsFrom('Totem Espiritual') === 0) {
    const options = spellOptions(content, sheet, { count: 1, circle: 5, types: ['arcana', 'divina', 'universal'], names: [totemSpell] });
    if (options.length) grants.push({ kind: 'spell', source: 'Totem Espiritual', title: `Totem Espiritual: aprenda ${totemSpell}`, missing: 1, options });
  }

  // Poderes repetíveis contam uma vez por cópia na ficha.
  const powerCounts = new Map<string, { name: string; copies: number }>();
  for (const power of sheet.powers) {
    const base = power.name.replace(/\s*\(.*\)$/, '');
    const key = plainT20(base);
    if (!POWER_SPELLS[key]) continue;
    const current = powerCounts.get(key);
    powerCounts.set(key, { name: base, copies: (current?.copies ?? 0) + 1 });
  }
  for (const [key, { name, copies }] of powerCounts) {
    const rule = POWER_SPELLS[key]!;
    const missing = rule.count * copies - spellsFrom(name);
    if (missing > 0)
      grants.push({ kind: 'spell', source: name, title: `${name}: escolha ${missing === 1 ? 'uma magia' : `${missing} magias`}`, missing, options: spellOptions(content, sheet, rule) });
  }

  const race = plainT20(sheet.identity.race);
  for (const entry of RACE_SPELLS[race] ?? []) {
    if (entry.variant && plainT20(sheet.identity.raceVariant) !== entry.variant) continue;
    const source = `${sheet.identity.race} (${entry.ability})`;
    const missing = entry.rule.count - spellsFrom(source);
    if (missing > 0)
      grants.push({
        kind: 'spell',
        source,
        title: `${entry.ability}: ${entry.rule.names?.length === 1 ? `aprenda ${entry.rule.names[0]}` : `escolha ${missing === 1 ? 'uma magia' : `${missing} magias`}`}`,
        missing,
        options: spellOptions(content, sheet, entry.rule),
      });
  }

  const ownedPowers = new Set(sheet.powers.map((power) => plainT20(power.name.replace(/\s*\(.*\)$/, ''))));
  for (const entry of RACE_POWERS[race] ?? []) {
    const source = `${sheet.identity.race} (${entry.ability})`;
    const missing = entry.count - sheet.powers.filter((power) => power.source === source).length;
    if (missing > 0)
      grants.push({
        kind: 'power',
        source,
        title: `${entry.ability}: escolha um poder geral`,
        missing,
        options: content.powers
          .filter((power) => GENERAL_POWER_GROUPS.includes(power.group) && !ownedPowers.has(plainT20(power.name)))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      });
  }
  return grants;
}

/** Entrada de magia na lista de habilidades da ficha (o mesmo formato da criação). */
export function t20SpellAbility(spell: T20Item<'spell'>, source: string): AbilityEntryTemplate {
  const header = [
    `${spell.type} ${spell.circle} (${spell.school})`,
    spell.execution && `Execução: ${spell.execution}`,
    spell.range && `Alcance: ${spell.range}`,
    spell.duration && `Duração: ${spell.duration}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const upgrades = spell.upgrades.map((upgrade) => `+${upgrade.cost} PM: ${upgrade.text}`).join('\n');
  return {
    kind: 'spell',
    name: spell.name,
    source,
    description: [header, spell.text, upgrades].filter(Boolean).join('\n\n').slice(0, 12000),
    data: { circle: spell.circle, type: spell.type, school: spell.school, cost: [1, 3, 6, 10, 15][spell.circle - 1] ?? 1 },
    sortOrder: 0,
  };
}

/** Grava as escolhas de uma concessão: a ficha nova e as entradas para a lista de habilidades. */
export function applyT20Grant(
  sheet: T20Sheet,
  grant: T20Grant,
  pickedIds: readonly string[],
): { sheet: T20Sheet; abilities: AbilityEntryTemplate[] } | { error: string } {
  const unique = [...new Set(pickedIds)];
  if (unique.length !== grant.missing) return { error: `Escolha ${grant.missing}.` };
  if (grant.kind === 'spell') {
    const spells = unique.map((id) => grant.options.find((option) => option.id === id));
    if (spells.some((spell) => !spell)) return { error: 'Escolha inválida.' };
    const chosen = spells as T20Item<'spell'>[];
    return {
      sheet: {
        ...sheet,
        spells: {
          ...sheet.spells,
          known: [
            ...sheet.spells.known,
            ...chosen.map((spell) => ({ key: spell.id, name: spell.name, source: grant.source, circle: spell.circle, type: spell.type })),
          ],
        },
      },
      abilities: chosen.map((spell) => t20SpellAbility(spell, grant.source)),
    };
  }
  const powers = unique.map((id) => grant.options.find((option) => option.id === id));
  if (powers.some((power) => !power)) return { error: 'Escolha inválida.' };
  const chosen = powers as T20Item<'feat'>[];
  const level = sheet.identity.classes.reduce((total, entry) => total + entry.level, 0) || 1;
  return {
    sheet: { ...sheet, powers: [...sheet.powers, ...chosen.map((power) => ({ key: power.id, name: power.name, source: grant.source, level: Math.min(20, level) }))] },
    abilities: chosen.map((power) => ({
      kind: 'feat' as const,
      name: power.name,
      source: grant.source,
      description: power.text,
      data: { prerequisite: power.prerequisite },
      sortOrder: 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Itens concedidos por habilidade (Protótipo do Inventor)
// ---------------------------------------------------------------------------

type Equipment = T20Item<'equipment'>;

/** Orçamento dos 10 itens alquímicos do Protótipo (o texto extraído do livro corta o valor). */
export const T20_PROTOTYPE_ALCHEMY_BUDGET = 500;
const PROTOTYPE = 'Protótipo';
const isAlchemical = (item: Equipment) => /^alqu[ií]mico/i.test(item.category);

export interface T20ItemGrant {
  kind: 'item';
  /** Gravado nas notas dos itens criados (é assim que a ficha sabe que já escolheu). */
  source: string;
  title: string;
  mode: 'superior' | 'alquimicos';
  /** Itens que podem ser escolhidos (base do item superior ou os alquímicos). */
  options: Equipment[];
  /** Melhorias para o item superior. */
  upgrades: Equipment[];
  /** Preço total máximo (alquímicos). */
  budget: number | null;
}

/**
 * Protótipo do Inventor depois da escolha ("Protótipo (Item superior)" ou "(10 itens
 * alquímicos)"): pede os itens enquanto nenhum item com a nota "Protótipo" estiver no inventário.
 */
export function listT20ItemGrants(
  content: T20Content,
  abilityNames: readonly string[],
  itemNotes: readonly string[],
): T20ItemGrant[] {
  if (itemNotes.some((note) => note.startsWith(PROTOTYPE))) return [];
  const chosen = abilityNames.find((name) => plainT20(name).startsWith('prototipo ('));
  if (!chosen) return [];
  const superior = /superior/i.test(chosen);
  return [
    superior
      ? {
          kind: 'item',
          source: PROTOTYPE,
          title: 'Protótipo: escolha o item superior e a melhoria',
          mode: 'superior',
          options: content.equipment.filter((item) => item.group !== 'melhoria' && !isAlchemical(item)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
          upgrades: content.equipment.filter((item) => item.group === 'melhoria').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
          budget: null,
        }
      : {
          kind: 'item',
          source: PROTOTYPE,
          title: `Protótipo: escolha 10 itens alquímicos (até T$ ${T20_PROTOTYPE_ALCHEMY_BUDGET})`,
          mode: 'alquimicos',
          options: content.equipment.filter(isAlchemical).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
          upgrades: [],
          budget: T20_PROTOTYPE_ALCHEMY_BUDGET,
        },
  ];
}

export interface T20GrantedItem {
  name: string;
  category: 'weapon' | 'armor' | 'gear' | 'consumable';
  quantity: number;
  description: string;
  notes: string;
}

const itemCategory = (item: Equipment): T20GrantedItem['category'] =>
  item.group === 'arma' ? 'weapon' : item.group === 'armadura' ? 'armor' : isAlchemical(item) ? 'consumable' : 'gear';

/** Itens do inventário a criar para a escolha do Protótipo. */
export function applyT20ItemGrant(
  grant: T20ItemGrant,
  picks: { baseId?: string; upgradeId?: string; quantities?: Record<string, number> },
): { items: T20GrantedItem[] } | { error: string } {
  if (grant.mode === 'superior') {
    const base = grant.options.find((item) => item.id === picks.baseId);
    const upgrade = grant.upgrades.find((item) => item.id === picks.upgradeId);
    if (!base || !upgrade) return { error: 'Escolha o item e a melhoria.' };
    return {
      items: [
        {
          name: `${base.name} superior (${upgrade.name})`.slice(0, 120),
          category: itemCategory(base),
          quantity: 1,
          description: [base.text, `Melhoria — ${upgrade.name}: ${upgrade.text}`].filter(Boolean).join('\n\n').slice(0, 4000),
          notes: grant.source,
        },
      ],
    };
  }
  const entries = Object.entries(picks.quantities ?? {}).filter(([, quantity]) => quantity > 0);
  const chosen = entries.map(([id, quantity]) => ({ item: grant.options.find((option) => option.id === id), quantity }));
  if (chosen.some((entry) => !entry.item || !Number.isInteger(entry.quantity))) return { error: 'Escolha inválida.' };
  const total = chosen.reduce((sum, entry) => sum + entry.quantity, 0);
  if (total !== 10) return { error: `Escolha 10 itens (agora: ${total}).` };
  const price = chosen.reduce((sum, entry) => sum + t20PriceValue(entry.item!.price) * entry.quantity, 0);
  if (grant.budget !== null && price > grant.budget) return { error: `Passou do limite: T$ ${price} de T$ ${grant.budget}.` };
  return {
    items: chosen.map(({ item, quantity }) => ({
      name: item!.name,
      category: itemCategory(item!),
      quantity,
      description: item!.text.slice(0, 4000),
      notes: grant.source,
    })),
  };
}

// ---------------------------------------------------------------------------
// Escolhas marcadas no nome (etapa 3): "Foco em Arma" vira "Foco em Arma (Espada longa)"; as de
// perícia também treinam ou dão +2 na ficha.
// ---------------------------------------------------------------------------

type LabelSource = 'skill' | 'intSkill' | 'nobleSkill' | 'trainedSkill' | 'weapon' | 'knownSpell' | 'school' | 'list' | 'skillList' | 'skillOrPower';

interface LabelRule {
  title: string;
  source: LabelSource;
  /** Quantas escolher (número fixo ou calculado pela ficha). */
  count: number | ((sheet: T20Sheet) => number);
  /** O que a escolha faz na ficha além do nome. */
  effect?: 'train' | 'bonus2';
  list?: readonly string[];
  exclude?: readonly T20Skill[];
}

const PARTNER_TYPES = ['Ajudante', 'Assassino', 'Atirador', 'Combatente', 'Fortão', 'Guardião', 'Magivocador', 'Médico', 'Montaria', 'Perseguidor', 'Vigilante'];

/** Pelo nome simplificado da habilidade ou do poder. */
const LABEL_RULES: Record<string, LabelRule> = {
  hibrido: { title: 'Híbrido: perícia treinada', source: 'skill', count: 1, effect: 'train' },
  'memoria postuma': { title: 'Memória Póstuma: uma perícia treinada ou um poder geral', source: 'skillOrPower', count: 1, effect: 'train' },
  etiqueta: { title: 'Etiqueta: +2 em Diplomacia ou Nobreza', source: 'skillList', count: 1, effect: 'bonus2', list: ['diplomacia', 'nobreza'] },
  'totem espiritual': {
    title: 'Totem Espiritual: escolha o animal totêmico',
    source: 'list',
    count: 1,
    list: ['Coruja', 'Corvo', 'Falcão', 'Grifo', 'Lobo', 'Raposa', 'Tartaruga', 'Urso'],
  },
  familiar: {
    title: 'Familiar: escolha o animal',
    source: 'list',
    count: 1,
    list: ['Borboleta', 'Cobra', 'Coruja', 'Corvo', 'Falcão', 'Gato', 'Lagarto', 'Morcego', 'Rato', 'Sapo'],
  },
  'conhecimento enciclopedico': { title: 'Conhecimento Enciclopédico: duas perícias de Inteligência', source: 'intSkill', count: 2, effect: 'train' },
  'educacao privilegiada': { title: 'Educação Privilegiada: duas perícias de nobre', source: 'nobleSkill', count: 2, effect: 'train' },
  deformidade: { title: 'Deformidade: +2 em duas perícias', source: 'skill', count: 2, effect: 'bonus2' },
  'amigo especial': { title: 'Amigo Especial: +2 numa perícia (o animal ajuda)', source: 'skill', count: 1, effect: 'bonus2', exclude: ['luta', 'pontaria'] },
  'foco em arma': { title: 'Foco em Arma: escolha a arma', source: 'weapon', count: 1 },
  'mestre em arma': { title: 'Mestre em Arma: escolha a arma', source: 'weapon', count: 1 },
  'foco em pericia': { title: 'Foco em Perícia: escolha a perícia', source: 'skill', count: 1 },
  'maestria em pericia': {
    title: 'Maestria em Perícia: perícias treinadas (igual à Inteligência)',
    source: 'trainedSkill',
    count: (sheet) => Math.max(1, sheet.attributes.int),
  },
  'foco em magia': { title: 'Foco em Magia: escolha a magia', source: 'knownSpell', count: 1 },
  'mestre em escola': { title: 'Mestre em Escola: escolha a escola', source: 'school', count: 1 },
  proficiencia: { title: 'Proficiência: escolha qual', source: 'list', count: 1, list: ['Armas marciais', 'Armas de fogo', 'Armaduras pesadas', 'Escudos', 'Armas exóticas'] },
  'resistencia elemental': {
    title: 'Resistência Elemental: redução 10 a um tipo de dano',
    source: 'list',
    count: 1,
    list: ['Frio (água)', 'Eletricidade (ar)', 'Fogo (fogo)', 'Ácido (terra)', 'Luz (luz)', 'Trevas (trevas)'],
  },
  'fonte elemental': { title: 'Fonte Elemental: escolha o elemento', source: 'list', count: 1, list: ['Água (frio)', 'Ar (eletricidade)', 'Fogo (fogo)', 'Terra (ácido)'] },
  'inimigo de': {
    title: 'Inimigo de (Criatura): escolha o tipo',
    source: 'list',
    count: 1,
    list: ['Animal', 'Construto', 'Espírito', 'Monstro', 'Morto-vivo', 'Duas raças humanoides'],
  },
  parceiro: { title: 'Parceiro: escolha o tipo', source: 'list', count: 1, list: PARTNER_TYPES },
  automato: { title: 'Autômato: escolha o tipo', source: 'list', count: 1, list: ['Ajudante', 'Assassino', 'Atirador', 'Combatente', 'Guardião', 'Montaria', 'Vigilante'] },
};

export interface T20LabelGrant {
  kind: 'label';
  /** Linha da lista de habilidades da ficha que recebe a escolha no nome. */
  abilityId: string;
  abilityName: string;
  title: string;
  count: number;
  effect: 'train' | 'bonus2' | null;
  options: { id: string; name: string; text?: string }[];
}

/** A habilidade ainda sem a escolha no nome ("Inimigo de (Criatura)" conta como sem escolha). */
function labelKey(name: string): string | null {
  const plain = plainT20(name);
  if (plain === 'inimigo de (criatura)') return 'inimigo de';
  if (name.includes('(')) return null;
  return LABEL_RULES[plain] ? plain : null;
}

export function listT20LabelGrants(
  content: T20Content,
  sheet: T20Sheet,
  abilities: readonly { id: string; name: string }[],
): T20LabelGrant[] {
  const skillOptions = (filter: (skill: T20Skill) => boolean) =>
    (Object.keys(T20_SKILLS) as T20Skill[]).filter(filter).map((skill) => ({ id: skill, name: T20_SKILLS[skill].label }));
  const noble = content.classes.find((klass) => plainT20(klass.name) === 'nobre')?.skillsChoice.options ?? [];
  const out: T20LabelGrant[] = [];
  for (const ability of abilities) {
    const key = labelKey(ability.name);
    if (!key) continue;
    const rule = LABEL_RULES[key]!;
    let options: { id: string; name: string; text?: string }[];
    switch (rule.source) {
      case 'skill':
        options = skillOptions((skill) => !(rule.exclude ?? []).includes(skill) && (rule.effect !== 'train' || !sheet.skills.trained.includes(skill)));
        break;
      case 'intSkill':
        options = skillOptions((skill) => T20_SKILLS[skill].attribute === 'int' && !sheet.skills.trained.includes(skill));
        break;
      case 'nobleSkill':
        options = skillOptions((skill) => (noble as readonly string[]).includes(skill) && !sheet.skills.trained.includes(skill));
        break;
      case 'skillList':
        options = (rule.list ?? []).map((skill) => ({ id: skill, name: T20_SKILLS[skill as T20Skill].label }));
        break;
      case 'skillOrPower': {
        const owned = new Set(sheet.powers.map((power) => plainT20(power.name.replace(/\s*\(.*\)$/, ''))));
        options = [
          ...skillOptions((skill) => !sheet.skills.trained.includes(skill)),
          ...content.powers
            .filter((power) => GENERAL_POWER_GROUPS.includes(power.group) && !owned.has(plainT20(power.name)))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            .map((power) => ({ id: `poder:${power.id}`, name: `Poder: ${power.name}`, text: power.text })),
        ];
        break;
      }
      case 'trainedSkill':
        options = skillOptions((skill) => sheet.skills.trained.includes(skill));
        break;
      case 'weapon':
        options = content.equipment.filter((item) => item.group === 'arma').map((item) => ({ id: item.name, name: item.name }));
        break;
      case 'knownSpell':
        options = sheet.spells.known.map((spell) => ({ id: spell.name, name: spell.name }));
        break;
      case 'school':
        options = [...new Set(content.spells.map((spell) => spell.school).filter(Boolean))].sort().map((school) => ({ id: school, name: school }));
        break;
      default:
        options = (rule.list ?? []).map((name) => ({ id: name, name }));
    }
    const count = Math.min(typeof rule.count === 'function' ? rule.count(sheet) : rule.count, Math.max(1, options.length));
    const base = key === 'inimigo de' ? 'Inimigo de' : ability.name;
    out.push({ kind: 'label', abilityId: ability.id, abilityName: base, title: rule.title, count, effect: rule.effect ?? null, options });
  }
  return out;
}

/** Aplica a escolha: o novo nome da habilidade e a ficha (perícias treinadas ou +2; nome do poder). */
export function applyT20LabelGrant(
  sheet: T20Sheet,
  grant: T20LabelGrant,
  pickedIds: readonly string[],
  originalName: string,
): { sheet: T20Sheet; name: string; abilities: AbilityEntryTemplate[] } | { error: string } {
  const picked = [...new Set(pickedIds)].map((id) => grant.options.find((option) => option.id === id));
  if (picked.length !== grant.count || picked.some((option) => !option)) return { error: `Escolha ${grant.count}.` };
  const chosen = picked as { id: string; name: string; text?: string }[];
  // Osteon pode trocar a perícia por um poder geral: o poder entra na ficha e na lista.
  const power = chosen.find((option) => option.id.startsWith('poder:'));
  if (power) {
    const powerName = power.name.replace(/^Poder: /, '');
    const level = Math.max(1, sheet.identity.classes.reduce((total, entry) => total + entry.level, 0));
    return {
      name: `${grant.abilityName} (${powerName})`.slice(0, 120),
      sheet: { ...sheet, powers: [...sheet.powers, { key: power.id.slice(6), name: powerName, source: grant.abilityName, level }] },
      abilities: [{ kind: 'feat', name: powerName, source: grant.abilityName, description: power.text ?? '', data: {}, sortOrder: 0 }],
    };
  }
  const name = `${grant.abilityName} (${chosen.map((option) => option.name).join(', ')})`.slice(0, 120);
  let next: T20Sheet = {
    ...sheet,
    // O poder gravado na ficha recebe o mesmo nome (o primeiro ainda sem escolha).
    powers: (() => {
      let renamed = false;
      return sheet.powers.map((power) => {
        if (renamed || power.name !== originalName) return power;
        renamed = true;
        return { ...power, name };
      });
    })(),
  };
  const skills = chosen.map((option) => option.id as T20Skill);
  if (grant.effect === 'train') next = { ...next, skills: { ...next.skills, trained: [...new Set([...next.skills.trained, ...skills])] } };
  if (grant.effect === 'bonus2') {
    const bonuses = { ...next.skills.bonuses };
    for (const skill of skills) bonuses[skill] = (bonuses[skill] ?? 0) + 2;
    next = { ...next, skills: { ...next.skills, bonuses } };
  }
  return { sheet: next, name, abilities: [] };
}
