/**
 * Tipos dos dados de regras do SRD 5.2.1 usados na criação de personagens de D&D 5e.
 *
 * Os dados (classes, espécies, antecedentes, talentos, equipamento e magias) vêm do SRD 5.2.1,
 * publicado pela Wizards of the Coast sob CC-BY-4.0. Nomes e resumos estão em português,
 * escritos pelo Codexveil; as alterações em relação ao original estão em docs/CONTENT_LICENSES.md.
 */
import type { ItemCategory, ResourceRecovery } from '@codexveil/domain';
import type { Ability } from '../abilities';
import type { SpellSchool } from '../entries';
import type { HitDie } from '../sheet';
import type { Skill } from '../skills';

export const CLASS_IDS = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export const SPELL_LIST_IDS = [
  'bard',
  'cleric',
  'druid',
  'paladin',
  'ranger',
  'sorcerer',
  'warlock',
  'wizard',
] as const;
export type SpellListId = (typeof SPELL_LIST_IDS)[number];

export interface SrdSpell {
  /** Nome original do SRD (em inglês). */
  name: string;
  /** 0 = truque. */
  level: number;
  school: SpellSchool;
  /** Listas de classe (`SpellListId` no SRD; livros podem trazer outras, como `artificer`). */
  classes: readonly string[];
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration?: boolean;
  ritual?: boolean;
}

/** Valor por nível da classe: índice 0 = 1º nível, sempre 20 posições. */
export type LevelTable = readonly number[];

export interface FeatureDefinition {
  level: number;
  name: string;
  /** Resumo em português escrito pelo Codexveil (não substitui o texto do SRD). */
  description: string;
  /** Trilha de recurso (usos) ligada a esta habilidade. */
  resourceKey?: string;
}

export interface ResourceContext {
  /** Nível na classe (ou nível do personagem, para espécies e talentos). */
  level: number;
  proficiencyBonus: number;
  modifiers: Record<Ability, number>;
}

export interface ResourceDefinition {
  key: string;
  label: string;
  recovery: ResourceRecovery;
  display: 'pool' | 'checkboxes';
  /** Máximo para o contexto; `null` quando ainda não está disponível. */
  max: (context: ResourceContext) => number | null;
}

export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder';

export type WeaponCategory = 'simple' | 'martial';
export type WeaponKind = 'melee' | 'ranged';
export type WeaponProperty =
  | 'ammunition'
  | 'finesse'
  | 'heavy'
  | 'light'
  | 'loading'
  | 'reach'
  | 'thrown'
  | 'two_handed'
  | 'versatile';
export type WeaponMastery =
  'cleave' | 'graze' | 'nick' | 'push' | 'sap' | 'slow' | 'topple' | 'vex';

export interface WeaponDefinition {
  id: string;
  name: string;
  category: WeaponCategory;
  kind: WeaponKind;
  damage: string;
  damageType: DamageType;
  properties: readonly WeaponProperty[];
  versatileDamage?: string;
  /** Alcance normal e longo, em pés (armas de arremesso ou de munição). */
  range?: readonly [number, number];
  mastery: WeaponMastery;
  weightLb: number;
}

export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield';

export interface ArmorDefinition {
  id: string;
  name: string;
  category: ArmorCategory;
  /** CA base (para escudos, o bônus). */
  armorClass: number;
  /** Quanto da Destreza soma: total, até 2 ou nada. */
  dexterity: 'full' | 'max2' | 'none';
  strength?: number;
  stealthDisadvantage: boolean;
  weightLb: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  /** Peso unitário em libras (convertido para a unidade da ficha); `null` = desprezível. */
  weightLb: number | null;
  description?: string;
  weapon?: string;
  armor?: string;
}

export interface EquipmentGrant {
  item: string;
  quantity?: number;
  /** Nome específico no lugar do genérico (ex.: "Livro (orações)"). */
  name?: string;
  /** O item concreto vem de uma escolha do jogador (instrumento, ferramenta, jogo). */
  choice?: 'musical_instrument' | 'class_tool' | 'gaming_set';
}

export interface EquipmentOption {
  id: 'A' | 'B' | 'C';
  items: readonly EquipmentGrant[];
  gold: number;
}

export interface SubclassDefinition {
  id: string;
  name: string;
  /** Livro de origem (ausente no SRD). */
  book?: string;
  description: string;
  features: readonly FeatureDefinition[];
  /** Magias sempre preparadas, liberadas no nível indicado. */
  alwaysPrepared?: readonly { level: number; spells: readonly string[] }[];
  /** Terrenos com magias próprias (Círculo da Terra de livro); o do SRD fica em `CIRCLE_OF_THE_LAND`. */
  landOptions?: readonly {
    id: string;
    name: string;
    spells: readonly { level: number; spells: readonly string[] }[];
  }[];
  resources?: readonly ResourceDefinition[];
}

export interface SpellcastingDefinition {
  ability: 'int' | 'wis' | 'cha';
  /** Lista de magias (`SpellListId` no SRD ou a lista de uma classe de livro). */
  list: string;
  /** Conjurador completo, meio conjurador (metade arredondada para cima) ou Magia de Pacto. */
  progression: 'full' | 'half' | 'pact';
  /** `null` quando a classe não aprende truques. */
  cantrips: LevelTable | null;
  prepared: LevelTable;
  /** Mago: grimório com 6 magias no 1º nível e mais 2 a cada nível. */
  spellbook?: boolean;
}

export interface WeaponTraining {
  simple: boolean;
  /** Armas marciais permitidas: todas, só as com Leve, ou só as com Acuidade ou Leve. */
  martial: 'all' | 'light' | 'finesse_or_light' | 'none';
}

export interface ClassDefinition {
  /** `ClassId` no SRD; classes de livro usam "<livro>:<chave>". */
  id: string;
  name: string;
  /** Livro de origem (ausente no SRD). */
  book?: string;
  summary: string;
  primaryAbilities: readonly Ability[];
  primaryAbilityLabel: string;
  complexity: 'Baixa' | 'Média' | 'Alta';
  hitDie: HitDie;
  savingThrows: readonly [Ability, Ability];
  skillChoices: { count: number; options: readonly Skill[] | 'any' };
  weapons: WeaponTraining;
  weaponLabel: string;
  armor: readonly ArmorCategory[];
  armorLabel: string;
  /** Ferramentas fixas (nomes) e escolhas de ferramenta da classe. */
  tools: readonly string[];
  toolChoice?: {
    count: number;
    kind: 'musical_instrument' | 'artisan_or_instrument';
    label: string;
  };
  equipment: readonly EquipmentOption[];
  standardArray: Record<Ability, number>;
  /** Níveis com Aumento no Valor de Atributo (ou outro talento). */
  asiLevels: readonly number[];
  features: readonly FeatureDefinition[];
  subclass: SubclassDefinition;
  spellcasting?: SpellcastingDefinition;
  resources: readonly ResourceDefinition[];
  /** Quantidade de armas com maestria por nível. */
  weaponMastery?: LevelTable;
  /** Magias sempre preparadas pela própria classe (ex.: Marca do Caçador). */
  alwaysPrepared?: readonly { level: number; spells: readonly string[]; note: string }[];
  /** Idiomas concedidos automaticamente (ex.: Druídico). */
  languages?: readonly string[];
}

export type FeatCategory = 'origin' | 'general' | 'fighting_style' | 'epic';

export interface FeatDefinition {
  id: string;
  name: string;
  category: FeatCategory;
  description: string;
  repeatable?: boolean;
  /** Pré-requisito de nível do personagem. */
  minLevel?: number;
  /** Pré-requisito de atributo: pelo menos um dos valores. */
  minScore?: { abilities: readonly Ability[]; value: number };
  /** +1 num destes atributos, à escolha (talentos de livro). */
  abilityIncrease?: readonly Ability[];
  /** Livro de origem (ausente no SRD). */
  book?: string;
}

export interface BackgroundDefinition {
  id: string;
  name: string;
  summary: string;
  /** Atributos que o antecedente pode aumentar (três no SRD; todos nos antecedentes de livro). */
  abilities: readonly Ability[];
  /** Talento de origem concedido; vazio = o jogador escolhe um (antecedentes de livro). */
  feat: string;
  /** Lista de magias fixa do Iniciado em Magia deste antecedente. */
  magicInitiateList?: 'cleric' | 'wizard';
  skills: readonly Skill[];
  /** Ferramenta concedida; ausente quando o antecedente não dá ferramenta. */
  tool?: string | { choice: 'gaming_set' };
  equipment: readonly EquipmentOption[];
  /** Livro de origem (ausente no SRD). */
  book?: string;
  /** Idiomas dos livros de 2014: os citados e quantos são à escolha (de qualquer raridade). */
  bookLanguages?: { fixed: readonly string[]; choices: number };
}

export interface SpeciesOptionDefinition {
  id: string;
  name: string;
  description: string;
}

export interface SpeciesDefinition {
  id: string;
  name: string;
  summary: string;
  /** Livro de origem (ausente no SRD). */
  book?: string;
  /** Idiomas dos livros de 2014 (traço "Idiomas"): no lugar dos dois idiomas padrão da origem. */
  bookLanguages?: { fixed: readonly string[]; choices: number };
  sizes: readonly ('small' | 'medium')[];
  sizeLabel: string;
  /** Deslocamento em pés. */
  speed: number;
  traits: readonly FeatureDefinition[];
  /** Linhagem, ancestralidade ou legado (escolha obrigatória). */
  lineage?: {
    label: string;
    options: readonly (SpeciesOptionDefinition & {
      /** Truques conhecidos no 1º nível. */
      cantrips?: readonly string[];
      /**
       * Magias sempre preparadas a partir do nível do personagem indicado. Cada uma pode ser
       * conjurada sem espaço de magia 1 vez (ou bônus de proficiência vezes) por descanso longo.
       */
      spells?: readonly { level: number; spell: string; uses?: 'once' | 'proficiency' }[];
      speed?: number;
      damageType?: DamageType;
    })[];
  };
  /** Escolhe Inteligência, Sabedoria ou Carisma para as magias da espécie. */
  spellcastingAbilityChoice?: boolean;
  resources?: readonly ResourceDefinition[];
  /** Truques fixos (ex.: Taumaturgia do Tiferino). */
  cantrips?: readonly string[];
}
