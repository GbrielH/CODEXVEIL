/**
 * Catálogo do SRD 5.2.1 (Wizards of the Coast, CC-BY-4.0): textos das magias, monstros e
 * animais, e itens mágicos. Os dados ficam em `./data` (gerados por
 * `scripts/srd/extract_srd.py`) e são carregados sob demanda, para não pesar nas telas que
 * não os usam.
 *
 * Alterações feitas pelo Codexveil (exigência da licença): os campos estruturados (tamanho,
 * tipo, alinhamento, deslocamento, sentidos, idiomas, perícias, danos e condições) são
 * traduzidos para o português e as distâncias convertidas para metros (5 pés = 1,5 m). Os
 * nomes e os textos descritivos também são traduzidos (`data/*.pt.json`, gerados por
 * `scripts/srd/translate_pt.py`); o nome original em inglês continua sendo o identificador e
 * aparece pequeno ao lado do nome em português.
 */
import { ABILITIES, abilityLabels, type Ability } from '../abilities';
import { dnd5eConditions } from '../conditions';
import { SKILLS, skillDefinitions } from '../skills';
import {
  dnd5eStatBlockSchema,
  type CreatureSize,
  type Dnd5eStatBlock,
  type StatBlockEntry,
} from '../stat-block';
import { damageTypeLabels } from './equipment';
import { ALIGNMENTS, SRD_LANGUAGES } from './languages';
import type { DamageType } from './types';

// --------------------------------------------------------------------------- Tipos dos dados

export interface SrdAbilityLine {
  score: number;
  /** Modificador com sinal, como no SRD: "+2", "-1". */
  mod: string;
  save: string;
}

export interface SrdMonsterEntry {
  name: string;
  description: string;
}

export interface SrdMonster {
  /** Nome original (identificador, endereço e busca em inglês). */
  name: string;
  /** Nome em português. */
  namePt: string;
  size: string;
  type: string;
  tags: string;
  alignment: string;
  ac: number;
  acNote: string;
  initiative: string;
  hp: number;
  hpFormula: string;
  speed: string;
  abilities: Record<Ability, SrdAbilityLine>;
  skills: string;
  resistances: string;
  vulnerabilities: string;
  damageImmunities: string;
  conditionImmunities: string;
  gear: string;
  senses: string;
  languages: string;
  cr: string;
  crDetail: string;
  /** Do apêndice de animais do SRD. */
  animal: boolean;
  traits: SrdMonsterEntry[];
  actions: SrdMonsterEntry[];
  bonusActions: SrdMonsterEntry[];
  reactions: SrdMonsterEntry[];
  legendaryActions: SrdMonsterEntry[];
}

export interface SrdMagicItem {
  /** Nome original (identificador, endereço e busca em inglês). */
  name: string;
  /** Nome em português. */
  namePt: string;
  /** Categoria original: "Armor", "Weapon", "Wondrous Item", "Potion"… */
  category: string;
  subtype: string;
  rarity: string;
  /** "Requires Attunement" ou "Requires Attunement by a Wizard"; vazio se não exige. */
  attunement: string;
  description: string[];
}

/** Parágrafos da descrição de cada magia, pelo nome original. */
export type SrdSpellTexts = Readonly<Record<string, readonly string[]>>;

// --------------------------------------------------------------------------- Carregamento

let spellTexts: Promise<SrdSpellTexts> | null = null;
let monsters: Promise<readonly SrdMonster[]> | null = null;
let magicItems: Promise<readonly SrdMagicItem[]> | null = null;

/** Descrições das magias (em inglês, como no SRD). Carregadas uma vez e reaproveitadas. */
export function loadSrdSpellTexts(): Promise<SrdSpellTexts> {
  spellTexts ??= import('./data/spell-texts.json').then(
    (module) => module.default as unknown as SrdSpellTexts,
  );
  return spellTexts;
}

type MonsterSection = 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions';
interface MonsterPt extends Partial<
  Record<MonsterSection, { name: string | null; description: string | null }[]>
> {
  name: string | null;
}
interface ItemPt {
  name: string | null;
  subtype: string | null;
  description: (string | null)[];
}

/** Aplica a tradução (quando existe) mantendo o texto original onde ela falta. */
function translateMonster(
  monster: Omit<SrdMonster, 'namePt'>,
  pt: MonsterPt | undefined,
): SrdMonster {
  const sections: MonsterSection[] = [
    'traits',
    'actions',
    'bonusActions',
    'reactions',
    'legendaryActions',
  ];
  const out = { ...monster, namePt: pt?.name ?? monster.name };
  for (const section of sections) {
    out[section] = (monster[section] ?? []).map((entry, index) => {
      const translated = pt?.[section]?.[index];
      return {
        name: translated?.name ?? entry.name,
        description: translated?.description ?? entry.description,
      };
    });
  }
  return out;
}

/** Monstros e animais do SRD em português, em ordem alfabética pelo nome em português. */
export function loadSrdMonsters(): Promise<readonly SrdMonster[]> {
  monsters ??= Promise.all([
    import('./data/monsters.json'),
    import('./data/monsters.pt.json'),
  ]).then(([module, ptModule]) => {
    const pt = ptModule.default as unknown as Record<string, MonsterPt>;
    return (module.default as unknown as Omit<SrdMonster, 'namePt'>[])
      .map((monster) => translateMonster(monster, pt[monster.name]))
      .sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));
  });
  return monsters;
}

/** Itens mágicos do SRD em português, em ordem alfabética pelo nome em português. */
export function loadSrdMagicItems(): Promise<readonly SrdMagicItem[]> {
  magicItems ??= Promise.all([
    import('./data/magic-items.json'),
    import('./data/magic-items.pt.json'),
  ]).then(([module, ptModule]) => {
    const pt = ptModule.default as unknown as Record<string, ItemPt>;
    return (module.default as unknown as Omit<SrdMagicItem, 'namePt'>[])
      .map((item) => {
        const translated = pt[item.name];
        return {
          ...item,
          namePt: translated?.name ?? item.name,
          subtype: translated?.subtype ?? item.subtype,
          description: item.description.map(
            (paragraph, index) => translated?.description[index] ?? paragraph,
          ),
        };
      })
      .sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));
  });
  return magicItems;
}

/** Busca sem acento e sem diferença de maiúsculas, nos nomes em português e em inglês. */
export function srdMatches(entry: { name: string; namePt: string }, query: string): boolean {
  const plain = (text: string) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const wanted = plain(query.trim());
  return !wanted || plain(entry.namePt).includes(wanted) || plain(entry.name).includes(wanted);
}

/** Identificador estável para endereços: "Adult Red Dragon" → "adult-red-dragon". */
export function srdSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --------------------------------------------------------------------------- Tradução

/** Pés para metros (5 pés = 1,5 m), com vírgula decimal. */
export function feetToMeters(feet: number): string {
  const meters = Math.round(feet * 0.3 * 10) / 10;
  return `${String(meters).replace('.', ',')} m`;
}

/** Troca "30 ft." / "30 feet" / "30-foot" por metros num texto. */
export function convertFeetInText(text: string): string {
  return text
    .replace(
      /(\d[\d,]*)\/(\d[\d,]*) ft\.?/g,
      (_match, short: string, long: string) =>
        `${feetToMeters(Number(short.replace(/,/g, ''))).replace(' m', '')}/${feetToMeters(Number(long.replace(/,/g, '')))}`,
    )
    .replace(/(\d[\d,]*)(?: |-)(?:ft\.?|feet|foot)/g, (_match, feet: string) =>
      feetToMeters(Number(feet.replace(/,/g, ''))),
    );
}

const SIZE_KEYS: Record<string, CreatureSize> = {
  tiny: 'tiny',
  small: 'small',
  medium: 'medium',
  large: 'large',
  huge: 'huge',
  gargantuan: 'gargantuan',
};

const SIZE_LABELS: Record<string, string> = {
  Tiny: 'Miúdo',
  Small: 'Pequeno',
  Medium: 'Médio',
  Large: 'Grande',
  Huge: 'Enorme',
  Gargantuan: 'Imenso',
};

const CREATURE_TYPES: Record<string, string> = {
  Aberration: 'Aberração',
  Beast: 'Fera',
  Celestial: 'Celestial',
  Construct: 'Constructo',
  Dragon: 'Dragão',
  Elemental: 'Elemental',
  Fey: 'Fada',
  Fiend: 'Ínfero',
  Giant: 'Gigante',
  Humanoid: 'Humanoide',
  Monstrosity: 'Monstruosidade',
  Ooze: 'Gosma',
  Plant: 'Planta',
  Undead: 'Morto-vivo',
  'Swarm of Tiny Beasts': 'Enxame de Feras Miúdas',
  'Swarm of Tiny Undead': 'Enxame de Mortos-vivos Miúdos',
};

const CREATURE_TAGS: Record<string, string> = {
  Angel: 'Anjo',
  Chromatic: 'Cromático',
  Cleric: 'Clérigo',
  Demon: 'Demônio',
  Devil: 'Diabo',
  Dinosaur: 'Dinossauro',
  Druid: 'Druida',
  Genie: 'Gênio',
  Goblinoid: 'Goblinoide',
  Lycanthrope: 'Licantropo',
  Metallic: 'Metálico',
  Titan: 'Titã',
  Wizard: 'Mago',
};

/** Tipos de criatura do SRD com o rótulo em português (para filtros). */
export const srdCreatureTypes: readonly { value: string; label: string }[] = Object.entries(
  CREATURE_TYPES,
).map(([value, label]) => ({ value, label }));

export function srdCreatureTypeLabel(type: string, tags = ''): string {
  const base = CREATURE_TYPES[type] ?? type;
  const tagLabel = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => CREATURE_TAGS[tag] ?? tag)
    .join(', ');
  return tagLabel ? `${base} (${tagLabel})` : base;
}

export function srdSizeLabel(size: string): string {
  return size
    .split(' or ')
    .map((part) => SIZE_LABELS[part.trim()] ?? part.trim())
    .join(' ou ');
}

export function srdAlignmentLabel(alignment: string): string {
  if (alignment === 'Unaligned') return 'Sem alinhamento';
  const id = alignment.toLowerCase().replace(/ /g, '_');
  return ALIGNMENTS.find((entry) => entry.id === id)?.name ?? alignment;
}

const MOVEMENT_LABELS: Record<string, string> = {
  Fly: 'voo',
  Swim: 'natação',
  Climb: 'escalada',
  Burrow: 'escavação',
};

const FORM_LABELS: Record<string, string> = {
  bear: 'urso',
  boar: 'javali',
  rat: 'rato',
  tiger: 'tigre',
  wolf: 'lobo',
};

/** "40 ft., Fly 80 ft. (hover)" → "12 m, voo 24 m (pairar)". */
export function translateSrdSpeed(speed: string): string {
  let text = speed.replace(
    /\b(Fly|Swim|Climb|Burrow)\b/g,
    (word: string) => MOVEMENT_LABELS[word] ?? word,
  );
  text = text
    .replace(/\(hover\)/g, '(pairar)')
    .replace(
      /\((\w+) form only\)/g,
      (_match, form: string) => `(só na forma de ${FORM_LABELS[form] ?? form})`,
    )
    .replace(/\(GM[’']s choice\)/g, '(à escolha do mestre)')
    .replace(/ or /g, ' ou ');
  return convertFeetInText(text);
}

const SENSES: Record<string, string> = {
  Blindsight: 'Percepção às Cegas',
  Darkvision: 'Visão no Escuro',
  Tremorsense: 'Sentido Sísmico',
  Truesight: 'Visão Verdadeira',
  'Passive Perception': 'Percepção passiva',
};

export function translateSrdSenses(senses: string): string {
  const text = senses
    .replace(
      /Passive Perception|Blindsight|Darkvision|Tremorsense|Truesight/g,
      (word) => SENSES[word] ?? word,
    )
    .replace(/\(unimpeded by magical Darkness\)/g, '(não é impedida por Escuridão mágica)')
    .replace(/\(blind beyond this radius\)/g, '(cego além desse raio)');
  return convertFeetInText(text);
}

const LANGUAGE_IDS: Record<string, string> = {
  Common: 'common',
  'Common Sign Language': 'common_sign_language',
  Draconic: 'draconic',
  Dwarvish: 'dwarvish',
  Elvish: 'elvish',
  Giant: 'giant',
  Gnomish: 'gnomish',
  Goblin: 'goblin',
  Halfling: 'halfling',
  Orc: 'orc',
  Abyssal: 'abyssal',
  Celestial: 'celestial',
  'Deep Speech': 'deep_speech',
  Druidic: 'druidic',
  Infernal: 'infernal',
  Primordial: 'primordial',
  Sylvan: 'sylvan',
  'Thieves’ Cant': 'thieves_cant',
  Undercommon: 'undercommon',
};

const PRIMORDIAL_DIALECTS: Record<string, string> = {
  Aquan: 'Aquano',
  Auran: 'Aurano',
  Ignan: 'Ignano',
  Terran: 'Terrano',
};
const NUMBER_WORDS: Record<string, string> = {
  one: 'um',
  two: 'dois',
  three: 'três',
  four: 'quatro',
  five: 'cinco',
};

export function translateSrdLanguages(languages: string): string {
  let text = languages;
  text = text.replace(/\b(one|two|three|four|five) other languages?\b/g, (_match, count: string) =>
    count === 'one' ? 'mais um idioma' : `mais ${NUMBER_WORDS[count] ?? count} idiomas`,
  );
  text = text
    .replace(
      /Understands commands given in any language but can[’']t speak/g,
      'Entende ordens em qualquer idioma, mas não fala',
    )
    .replace(/\bunderstands\b/gi, 'entende')
    .replace(/ but can[’']t speak( them)?/g, ', mas não fala')
    .replace(
      /\(can[’']t speak in (\w+) form\)/g,
      (_match, form: string) => `(não fala na forma de ${FORM_LABELS[form] ?? form})`,
    )
    .replace(/\btelepathy\b/g, 'telepatia')
    .replace(
      /\(works only with creatures that understand (\w+)\)/g,
      '(só com criaturas que entendem $1)',
    )
    .replace(
      /\(doesn[’']t allow the receiving creature to respond telepathically\)/g,
      '(quem recebe não responde por telepatia)',
    )
    .replace(/\bplus\b/g, '')
    .replace(/\bNone\b/g, 'Nenhum')
    .replace(/\bAll\b/g, 'Todos');
  text = text.replace(
    /\b(Aquan|Auran|Ignan|Terran)\b/g,
    (word) => PRIMORDIAL_DIALECTS[word] ?? word,
  );
  text = text.replace(
    /\b(Common Sign Language|Deep Speech|Thieves’ Cant|[A-Z][a-z]+)\b/g,
    (word) => {
      const id = LANGUAGE_IDS[word];
      return id ? (SRD_LANGUAGES.find((language) => language.id === id)?.name ?? word) : word;
    },
  );
  return convertFeetInText(
    text
      .replace(/\s{2,}/g, ' ')
      .replace(/ ,/g, ',')
      .trim(),
  );
}

const DAMAGE_TYPE_KEYS = Object.keys(damageTypeLabels) as DamageType[];

function damageLabel(word: string): string | null {
  const key = word.toLowerCase() as DamageType;
  return DAMAGE_TYPE_KEYS.includes(key) ? damageTypeLabels[key] : null;
}

const conditionLabelsByEnglish = new Map<string, string>(
  dnd5eConditions.map((condition) => [condition.key, condition.label]),
);

function conditionLabelFromEnglish(word: string): string | null {
  return conditionLabelsByEnglish.get(word.toLowerCase()) ?? null;
}

/** Lista de tipos de dano ou de condições ("Fire, Poison; Charmed") em português. */
export function translateSrdTraitList(list: string): string {
  return list
    .split(/([;,])/)
    .map((part) => {
      const trimmed = part.trim();
      if (trimmed === ';' || trimmed === ',') return trimmed;
      const head = /^([A-Z][a-z]+)(.*)$/.exec(trimmed);
      if (!head) return trimmed;
      const word = head[1] ?? '';
      const label = damageLabel(word) ?? conditionLabelFromEnglish(word);
      return label ? `${label}${head[2] ?? ''}` : trimmed;
    })
    .join(' ')
    .replace(/ ([;,])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const SKILL_BY_ENGLISH = new Map<string, string>(
  SKILLS.map((skill) => [skill.replace(/_/g, ' '), skillDefinitions[skill].label]),
);

/** "Perception +6, Stealth +3" → "Percepção +6, Furtividade +3". */
export function translateSrdSkills(skills: string): string {
  return skills.replace(
    /([A-Za-z][A-Za-z ]*?) ([+−-]\d+)/g,
    (match, name: string, bonus: string) => {
      const label = SKILL_BY_ENGLISH.get(name.trim().toLowerCase());
      return label ? `${label} ${bonus}` : match;
    },
  );
}

/** Salvaguardas diferentes do modificador (proficiência): "DES +5, SAB +6". */
export function srdSavingThrows(abilities: Record<Ability, SrdAbilityLine>): string {
  return ABILITIES.filter((ability) => abilities[ability].save !== abilities[ability].mod)
    .map((ability) => `${abilityLabels[ability].abbreviation} ${abilities[ability].save}`)
    .join(', ');
}

const ENTRY_NAMES: Record<string, string> = { 'Legendary Action Uses': 'Usos de Ações Lendárias' };

function toEntries(entries: readonly SrdMonsterEntry[]): StatBlockEntry[] {
  return entries.slice(0, 40).map((entry) => ({
    name: (ENTRY_NAMES[entry.name] ?? entry.name).slice(0, 80),
    description: entry.description.slice(0, 4000),
  }));
}

/**
 * Converte um monstro do SRD no bloco de estatísticas do Codexveil (para copiar à biblioteca
 * da campanha). Campos estruturados em português; ações e traços no original.
 */
export function srdMonsterToStatBlock(monster: SrdMonster): Dnd5eStatBlock {
  const firstSize = monster.size.split(' or ')[0]?.trim().toLowerCase() ?? 'medium';
  return dnd5eStatBlockSchema.parse({
    size: SIZE_KEYS[firstSize] ?? 'medium',
    creatureType: srdCreatureTypeLabel(monster.type, monster.tags).slice(0, 60),
    alignment: srdAlignmentLabel(monster.alignment).slice(0, 40),
    armorClass: Math.min(monster.ac, 50),
    armorNote: '',
    hitPoints: Math.max(1, Math.min(monster.hp, 9999)),
    hitPointFormula: monster.hpFormula.slice(0, 40),
    speed: translateSrdSpeed(monster.speed).slice(0, 120),
    abilities: Object.fromEntries(
      ABILITIES.map((ability) => [ability, monster.abilities[ability].score]),
    ),
    savingThrows: srdSavingThrows(monster.abilities).slice(0, 200),
    skills: translateSrdSkills(monster.skills).slice(0, 300),
    damageResistances: [
      translateSrdTraitList(monster.resistances),
      monster.vulnerabilities
        ? `Vulnerável: ${translateSrdTraitList(monster.vulnerabilities)}`
        : '',
    ]
      .filter(Boolean)
      .join('; ')
      .slice(0, 300),
    damageImmunities: translateSrdTraitList(monster.damageImmunities).slice(0, 300),
    conditionImmunities: translateSrdTraitList(monster.conditionImmunities).slice(0, 300),
    senses: translateSrdSenses(monster.senses).slice(0, 200),
    languages: translateSrdLanguages(monster.languages).slice(0, 200),
    challengeRating: monster.cr,
    traits: toEntries(monster.traits),
    actions: toEntries(monster.actions),
    bonusActions: toEntries(monster.bonusActions),
    reactions: toEntries(monster.reactions),
    legendaryActions: toEntries(monster.legendaryActions),
  });
}

// --------------------------------------------------------------------------- Itens mágicos

const ITEM_CATEGORIES: Record<string, string> = {
  Armor: 'Armadura',
  Weapon: 'Arma',
  'Wondrous Item': 'Item maravilhoso',
  Potion: 'Poção',
  Ring: 'Anel',
  Rod: 'Bastão',
  Scroll: 'Pergaminho',
  Staff: 'Cajado',
  Wand: 'Varinha',
};

const RARITIES: Record<string, string> = {
  Common: 'Comum',
  Uncommon: 'Incomum',
  Rare: 'Raro',
  'Very Rare': 'Muito raro',
  Legendary: 'Lendário',
  Artifact: 'Artefato',
  'Rarity Varies': 'Raridade variável',
};

/** Categorias de itens mágicos do SRD com o rótulo em português (para filtros). */
export const srdMagicItemCategories: readonly { value: string; label: string }[] = Object.entries(
  ITEM_CATEGORIES,
).map(([value, label]) => ({ value, label }));

/** Raridades em ordem crescente, com o rótulo em português (para filtros). */
export const srdMagicItemRarities: readonly { value: string; label: string }[] = Object.entries(
  RARITIES,
).map(([value, label]) => ({ value, label }));

export function srdMagicItemCategoryLabel(category: string): string {
  return ITEM_CATEGORIES[category] ?? category;
}

/** "Very Rare" → "Muito raro"; "Uncommon (+1), Rare (+2), or Very Rare (+3)" também. */
export function srdRarityLabel(rarity: string): string {
  return rarity
    .replace(
      /Rarity Varies|Very Rare|Uncommon|Common|Rare|Legendary|Artifact/g,
      (word) => RARITIES[word] ?? word,
    )
    .replace(/,? or /g, ' ou ');
}

const CLASS_NAMES: Record<string, string> = {
  Bard: 'Bardo',
  Cleric: 'Clérigo',
  Druid: 'Druida',
  Paladin: 'Paladino',
  Ranger: 'Patrulheiro',
  Sorcerer: 'Feiticeiro',
  Warlock: 'Bruxo',
  Wizard: 'Mago',
  Spellcaster: 'conjurador',
};

/** "Requires Attunement by a Wizard" → "Exige sintonia (Mago)". */
export function srdAttunementLabel(attunement: string): string {
  if (!attunement) return '';
  const by = /by an? (.+)$/.exec(attunement)?.[1];
  if (!by) return 'Exige sintonia';
  const who = by
    .replace(/\b[A-Z][a-z]+\b/g, (word) => CLASS_NAMES[word] ?? word)
    .replace(/ or an? /g, ' ou ')
    .replace(/, an? /g, ', ');
  return `Exige sintonia (${who})`;
}

/** Linha de resumo do item: "Item maravilhoso, Incomum · Exige sintonia". */
export function describeSrdMagicItem(item: SrdMagicItem): string {
  const category =
    srdMagicItemCategoryLabel(item.category) + (item.subtype ? ` (${item.subtype})` : '');
  return [`${category}, ${srdRarityLabel(item.rarity)}`, srdAttunementLabel(item.attunement)]
    .filter(Boolean)
    .join(' · ');
}

// --------------------------------------------------------------------------- Magias

export interface SrdSpellSummaryLine {
  label: string;
  value: string;
}

const SAVE_ABILITIES: Record<string, Ability> = {
  Strength: 'str',
  Dexterity: 'dex',
  Constitution: 'con',
  Intelligence: 'int',
  Wisdom: 'wis',
  Charisma: 'cha',
};

const AREA_SHAPES: Record<string, string> = {
  Sphere: 'Esfera',
  Cone: 'Cone',
  Cube: 'Cubo',
  Line: 'Linha',
  Cylinder: 'Cilindro',
  Emanation: 'Emanação',
};

const DAMAGE_WORDS =
  'Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder';
const DAMAGE_PATTERN = new RegExp(
  `(\\d+d\\d+(?: ?\\+ ?\\d+)?|\\d+) ((?:(?:${DAMAGE_WORDS}),? (?:or )?)*(?:${DAMAGE_WORDS})) damage`,
  'g',
);

function ordinal(level: string): string {
  return `${level}º`;
}

/**
 * Especificações da magia tiradas do texto do SRD, em português: tipo de ataque, teste de
 * resistência, dano, cura, área, condições e o que melhora em círculos maiores.
 */
export function summarizeSrdSpell(paragraphs: readonly string[]): SrdSpellSummaryLine[] {
  const upgrade =
    paragraphs.find((paragraph) =>
      /^(Using a Higher-Level Spell Slot|Cantrip Upgrade)\./.test(paragraph),
    ) ?? '';
  const main = paragraphs.filter((paragraph) => paragraph !== upgrade).join(' ');
  const lines: SrdSpellSummaryLine[] = [];

  const attacks = new Set<string>();
  for (const match of main.matchAll(/\b(melee|ranged) spell attack/gi)) {
    attacks.add(match[1]?.toLowerCase() === 'melee' ? 'corpo a corpo' : 'à distância');
  }
  if (attacks.size > 0)
    lines.push({ label: 'Ataque', value: `Jogada de ataque mágico ${[...attacks].join(' ou ')}` });

  const saves = new Set<string>();
  for (const match of main.matchAll(
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/g,
  )) {
    const ability = SAVE_ABILITIES[match[1] ?? ''];
    if (ability) saves.add(abilityLabels[ability].name);
  }
  if (saves.size > 0) lines.push({ label: 'Resistência', value: [...saves].join(' ou ') });

  const damage = new Set<string>();
  for (const match of main.matchAll(DAMAGE_PATTERN)) {
    const types = (match[2] ?? '')
      .split(/,? or |, /)
      .map((word) => damageLabel(word.trim()) ?? word.trim())
      .join(' ou ');
    damage.add(`${match[1]} de ${types}`);
    if (damage.size >= 4) break;
  }
  if (damage.size > 0) lines.push({ label: 'Dano', value: [...damage].join('; ') });

  const healing =
    /regains? (?:a number of )?Hit Points equal to (\d+d\d+(?: ?\+ ?\d+)?)( plus your spellcasting ability modifier)?/.exec(
      main,
    ) ?? /regains? (\d+d\d+(?: ?\+ ?\d+)?|\d+) Hit Points/.exec(main);
  if (healing) {
    lines.push({
      label: 'Cura',
      value: `${healing[1]}${healing[2] ? ' + modificador de conjuração' : ''} PV`,
    });
  }

  const area =
    /(\d+)-foot(-radius)?(?:,? (\d+)-foot-(?:high|tall))? (Sphere|Cone|Cube|Line|Cylinder|Emanation)/.exec(
      main,
    );
  if (area) {
    const shape = AREA_SHAPES[area[4] ?? ''] ?? area[4] ?? '';
    const size = feetToMeters(Number(area[1]));
    lines.push({
      label: 'Área',
      value: `${shape} de ${size}${area[2] ? ' de raio' : ''}${area[3] ? ` × ${feetToMeters(Number(area[3]))} de altura` : ''}`,
    });
  }

  const conditions = new Set<string>();
  for (const match of main.matchAll(/the (\w+) condition/g)) {
    const label = conditionLabelFromEnglish(match[1] ?? '');
    if (label) conditions.add(label);
  }
  if (conditions.size > 0) lines.push({ label: 'Condições', value: [...conditions].join(', ') });

  const perSlot =
    /The (damage|healing) increases by (\d+d\d+) for each spell slot level above (\d)/.exec(
      upgrade,
    );
  const targets =
    /You can target one additional creature for each spell slot level above (\d)/.exec(upgrade);
  const cantrip = /levels 5 \(([^)]+)\), 11 \(([^)]+)\), and 17 \(([^)]+)\)/.exec(upgrade);
  if (perSlot) {
    lines.push({
      label: 'Círculo maior',
      value: `+${perSlot[2]} de ${perSlot[1] === 'damage' ? 'dano' : 'cura'} por círculo acima do ${ordinal(perSlot[3] ?? '1')}`,
    });
  } else if (targets) {
    lines.push({
      label: 'Círculo maior',
      value: `+1 alvo por círculo acima do ${ordinal(targets[1] ?? '1')}`,
    });
  } else if (cantrip) {
    lines.push({
      label: 'Evolução',
      value: `Nível 5: ${cantrip[1]}; nível 11: ${cantrip[2]}; nível 17: ${cantrip[3]}`,
    });
  } else if (upgrade) {
    lines.push({ label: 'Círculo maior', value: 'Melhora em círculos maiores (veja o texto).' });
  }
  return lines;
}

/** O que rolar ao usar uma magia (botão "Usar" da ficha). */
export interface SrdSpellCast {
  attack: boolean;
  save: Ability | null;
  /** Dados de dano já com o círculo usado / nível do personagem (ex.: "10d6"). */
  damage: { dice: string; type: string } | null;
  /** Cura; `addModifier` = soma o modificador de conjuração. */
  healing: { dice: string; addModifier: boolean } | null;
}

/** Soma dados extras à fórmula: "8d6" + 2×"1d6" = "10d6"; dados diferentes ficam somados ("8d6+2d8"). */
function addDice(base: string, extra: string, times: number): string {
  if (times <= 0) return base;
  const plus = /^(\d+)d(\d+)$/.exec(extra);
  if (!plus) return base;
  const count = Number(plus[1]) * times;
  const sides = plus[2];
  const same = new RegExp(`^(\\d+)d${sides}\\b`).exec(base);
  return same
    ? base.replace(same[0], `${Number(same[1]) + count}d${sides}`)
    : `${base}+${count}d${sides}`;
}

/**
 * Lê o texto do SRD da magia e monta as rolagens de um uso: ataque, resistência, dano e cura,
 * com o aumento por círculo acima do básico e a evolução dos truques nos níveis 5, 11 e 17.
 */
export function planSrdSpellCast(
  paragraphs: readonly string[],
  {
    spellLevel,
    slotLevel,
    characterLevel,
  }: { spellLevel: number; slotLevel: number; characterLevel: number },
): SrdSpellCast {
  const upgrade =
    paragraphs.find((paragraph) =>
      /^(Using a Higher-Level Spell Slot|Cantrip Upgrade)\./.test(paragraph),
    ) ?? '';
  const main = paragraphs.filter((paragraph) => paragraph !== upgrade).join(' ');
  const clean = (dice: string) => dice.replace(/\s+/g, '');

  const saveMatch =
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/.exec(main);
  const damageMatch = new RegExp(DAMAGE_PATTERN.source).exec(main);
  const healingMatch =
    /regains? (?:a number of )?Hit Points equal to (\d+d\d+(?: ?\+ ?\d+)?)( plus your spellcasting ability modifier)?/.exec(
      main,
    ) ?? /regains? (\d+d\d+(?: ?\+ ?\d+)?) Hit Points/.exec(main);

  const above = Math.max(0, slotLevel - spellLevel);
  const perSlot =
    /The (damage|healing) increases by (\d+d\d+) for each spell slot level above/.exec(upgrade);
  // Truque: "levels 5 (2d10), 11 (3d10), and 17 (4d10)".
  const cantrip = /levels 5 \((\d+d\d+)\), 11 \((\d+d\d+)\), and 17 \((\d+d\d+)\)/.exec(upgrade);
  const cantripDice =
    cantrip && spellLevel === 0
      ? characterLevel >= 17
        ? cantrip[3]
        : characterLevel >= 11
          ? cantrip[2]
          : characterLevel >= 5
            ? cantrip[1]
            : null
      : null;

  let damage: SrdSpellCast['damage'] = null;
  if (damageMatch?.[1] && /d/.test(damageMatch[1])) {
    let dice = cantripDice ?? clean(damageMatch[1]);
    if (perSlot?.[1] === 'damage' && perSlot[2]) dice = addDice(dice, perSlot[2], above);
    const type = (damageMatch[2] ?? '')
      .split(/,? or |, /)
      .map((word) => damageLabel(word.trim()) ?? word.trim())
      .join(' ou ');
    damage = { dice, type };
  }

  let healing: SrdSpellCast['healing'] = null;
  if (healingMatch?.[1]) {
    let dice = clean(healingMatch[1]);
    if (perSlot?.[1] === 'healing' && perSlot[2]) dice = addDice(dice, perSlot[2], above);
    healing = { dice, addModifier: Boolean(healingMatch[2]) };
  }

  return {
    attack: /\b(melee|ranged) spell attack/i.test(main),
    save: saveMatch ? (SAVE_ABILITIES[saveMatch[1] ?? ''] ?? null) : null,
    damage,
    healing,
  };
}

// --------------------------------------------------------------------------- Cópia para a campanha

const ITEM_CATEGORY_BY_SRD: Record<string, 'weapon' | 'armor' | 'gear' | 'consumable'> = {
  Armor: 'armor',
  Weapon: 'weapon',
  Potion: 'consumable',
  Scroll: 'consumable',
};

/** Dados do item mágico do SRD no formato da biblioteca de itens da campanha. */
export function srdMagicItemToCampaignItem(item: SrdMagicItem) {
  const subtype = item.subtype ? ` (${item.subtype})` : '';
  return {
    name: item.namePt.slice(0, 120),
    category: ITEM_CATEGORY_BY_SRD[item.category] ?? 'gear',
    rarity:
      `${srdMagicItemCategoryLabel(item.category)}${subtype}, ${srdRarityLabel(item.rarity)}`.slice(
        0,
        60,
      ),
    requiresAttunement: item.attunement !== '',
    weight: null,
    value: '',
    description: [srdAttunementLabel(item.attunement), ...item.description]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 8000),
    visibility: 'gm' as const,
  };
}

/** NPC para humanoides; monstro para o resto (o mestre pode trocar ao copiar). */
export function srdMonsterDefaultKind(monster: Pick<SrdMonster, 'type'>): 'npc' | 'monster' {
  return monster.type === 'Humanoid' ? 'npc' : 'monster';
}

/** Linha curta do monstro: "Grande Dragão (Cromático), Caótico e Mau · ND 17". */
export function describeSrdMonster(monster: SrdMonster): string {
  return `${srdSizeLabel(monster.size)} ${srdCreatureTypeLabel(monster.type, monster.tags)}, ${srdAlignmentLabel(monster.alignment)} · ND ${monster.cr}`;
}
