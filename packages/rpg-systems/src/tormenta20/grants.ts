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

/** O que a raça e os poderes da ficha concedem e ainda não foi escolhido. */
export function listT20Grants(content: T20Content, sheet: T20Sheet): T20Grant[] {
  const grants: T20Grant[] = [];
  const spellsFrom = (source: string) => sheet.spells.known.filter((spell) => spell.source === source).length;

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
