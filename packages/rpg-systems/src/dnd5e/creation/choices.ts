/**
 * Escolhas da criação de personagem de D&D 5e (SRD 5.2.1).
 *
 * A partir do rascunho, `listDnd5eChoices` devolve as escolhas que as regras exigem neste
 * momento (perícias da classe, linhagem, talentos, magias...). Cada escolha tem um passo do
 * assistente; escolhas aninhadas (ex.: as magias do Iniciado em Magia) aparecem quando a
 * escolha de que dependem é respondida. `validateDnd5eDraft` confere tudo, inclusive regras
 * que cruzam passos (perícias repetidas, pré-requisitos de talentos, limites de atributos).
 */
import { ABILITIES, abilityLabels, type Ability } from '../abilities';
import type { SpellSchool } from '../entries';
import { suggestedSpellSlots } from '../progression';
import { SKILLS, skillDefinitions, type Skill } from '../skills';
import { findBackground } from '../srd/backgrounds';
import { CIRCLE_OF_THE_LAND, SRD_INVOCATIONS, SRD_METAMAGIC } from '../srd/class-options';
import {
  SORCERER_METAMAGIC,
  WARLOCK_INVOCATIONS,
  WARLOCK_SLOT_LEVEL,
  atLevel,
  findClass,
  listSubclasses,
} from '../srd/classes';
import { spellNamePt } from '../srd/spell-names-pt';
import {
  ALL_TOOLS,
  ARMOR_COST_GP,
  ARTISAN_TOOLS,
  GAMING_SETS,
  MUSICAL_INSTRUMENTS,
  SRD_ARMOR,
  SRD_ITEMS,
  SRD_WEAPONS,
  findTool,
} from '../srd/equipment';
import { epicBoonAbilities, findFeat, listFeats } from '../srd/feats';
import { ALIGNMENTS, CLASS_ONLY_LANGUAGES, SRD_LANGUAGES, languageName } from '../srd/languages';
import { findSpecies } from '../srd/species';
import { findSpell, listSpells } from '../srd/spells';
import { hasSpeciesBenefits, parseSpeciesBenefits, type SpeciesBenefits } from './species-benefits';
import type {
  BackgroundDefinition,
  ClassDefinition,
  EquipmentOption,
  FeatDefinition,
  SpeciesDefinition,
  SubclassDefinition,
} from '../srd/types';
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  RANDOM_SCORE_MAX,
  RANDOM_SCORE_MIN,
  STANDARD_ARRAY,
  pointBuyCost,
  selectionIncrease,
  selectionList,
  selectionText,
  type AbilityScoreMethod,
  type Dnd5eDraft,
} from './draft';

export const DND5E_STEPS = [
  'start',
  'class',
  'background',
  'species',
  'proficiencies',
  'abilities',
  'spells',
  'equipment',
  'details',
  'review',
] as const;
export type Dnd5eStep = (typeof DND5E_STEPS)[number];

export const dnd5eStepLabels: Record<Dnd5eStep, string> = {
  start: 'Início',
  class: 'Classe',
  background: 'Antecedente',
  species: 'Espécie',
  proficiencies: 'Idiomas e perícias',
  abilities: 'Atributos',
  spells: 'Magias',
  equipment: 'Equipamento',
  details: 'Detalhes',
  review: 'Revisão',
};

export interface ChoiceOption {
  id: string;
  name: string;
  description?: string;
  /** Motivo pelo qual a opção não pode ser escolhida agora. */
  disabledReason?: string;
}

export interface SpellOption extends ChoiceOption {
  level: number;
  school: SpellSchool;
  concentration: boolean;
  ritual: boolean;
}

interface BaseChoice {
  id: string;
  step: Dnd5eStep;
  label: string;
  description?: string;
  /** De onde vem a escolha (ex.: "Classe: Ladino", "Antecedente: Sábio"). */
  source: string;
}

export type ChoiceSpec =
  | (BaseChoice & { kind: 'option'; options: ChoiceOption[] })
  | (BaseChoice & { kind: 'multi'; count: number; options: ChoiceOption[] })
  | (BaseChoice & { kind: 'spells'; count: number; options: SpellOption[] })
  | (BaseChoice & {
      kind: 'ability_increase';
      mode: 'background' | 'asi';
      abilities: readonly Ability[];
      cap: number;
    });

export interface FeatInstance {
  /** Identificador da escolha que concedeu o talento (prefixo das escolhas aninhadas). */
  specId: string;
  featId: string;
  source: string;
  /** Nível do personagem em que o talento foi obtido (ordem de aplicação). */
  level: number;
  /** Lista fixa do Iniciado em Magia concedido pelo antecedente. */
  fixedList?: 'cleric' | 'wizard';
}

export interface Dnd5eCreationContext {
  /** Nível fixado pela campanha; `null` em fichas pessoais (o jogador escolhe). */
  lockedLevel: number | null;
  abilityScoreMethods: readonly AbilityScoreMethod[];
  allowEvilAlignments: boolean;
}

export const PERSONAL_SHEET_CONTEXT: Dnd5eCreationContext = {
  lockedLevel: null,
  abilityScoreMethods: ['standard_array', 'point_buy', 'random'],
  allowEvilAlignments: true,
};

// ---------------------------------------------------------------------------
// Consultas básicas ao rascunho
// ---------------------------------------------------------------------------

export function draftClass(draft: Dnd5eDraft): ClassDefinition | undefined {
  return draft.classId ? findClass(draft.classId) : undefined;
}

/** Subclasses que o personagem pode escolher (a do SRD e as dos livros liberados). */
export function draftSubclassOptions(draft: Dnd5eDraft): SubclassDefinition[] {
  const classDef = draftClass(draft);
  return classDef ? listSubclasses(classDef) : [];
}

/** Subclasse do personagem a partir do 3º nível: a única disponível ou a escolhida. */
export function draftSubclass(draft: Dnd5eDraft): SubclassDefinition | undefined {
  if (draft.level < 3) return undefined;
  const options = draftSubclassOptions(draft);
  if (options.length <= 1) return options[0];
  const chosen = selectionText(draft, 'class.subclass');
  return options.find((option) => option.id === chosen);
}

export function draftBackground(draft: Dnd5eDraft): BackgroundDefinition | undefined {
  return findBackground(draft.backgroundId);
}

export function draftSpecies(draft: Dnd5eDraft): SpeciesDefinition | undefined {
  return findSpecies(draft.speciesId);
}

export function draftLineage(draft: Dnd5eDraft) {
  const species = draftSpecies(draft);
  const id = selectionText(draft, 'species.lineage');
  return species?.lineage?.options.find((option) => option.id === id);
}

/**
 * Benefícios das raças de livro (2014), lidos do texto: os da linhagem escolhida, se ela os
 * descreve (Humano padrão/variante); senão, os das características da raça. As espécies do SRD
 * 5.2.1 não têm (os aumentos vêm do antecedente).
 */
export function draftSpeciesBenefits(draft: Dnd5eDraft): SpeciesBenefits | null {
  const species = draftSpecies(draft);
  if (!species?.book) return null;
  const lineage = draftLineage(draft);
  const fromLineage = lineage ? parseSpeciesBenefits(lineage.description) : null;
  if (fromLineage && hasSpeciesBenefits(fromLineage)) return fromLineage;
  const fromTraits = parseSpeciesBenefits(
    species.traits.map((trait) => `${trait.name}. ${trait.description}`).join(' '),
  );
  return hasSpeciesBenefits(fromTraits) ? fromTraits : null;
}

/** Aumentos de atributo da raça de livro: os fixos e os escolhidos. */
export function speciesIncrease(draft: Dnd5eDraft): Partial<Record<Ability, number>> {
  const benefits = draftSpeciesBenefits(draft);
  if (!benefits) return {};
  const increase: Partial<Record<Ability, number>> = { ...benefits.fixed };
  if (benefits.choiceCount > 0) {
    for (const id of selectionList(draft, 'species.book_abilities').slice(
      0,
      benefits.choiceCount,
    )) {
      if ((ABILITIES as readonly string[]).includes(id))
        increase[id as Ability] = (increase[id as Ability] ?? 0) + benefits.choiceAmount;
    }
  }
  return increase;
}

const skillName = (skill: Skill) => skillDefinitions[skill].label;
const skillOptions = (skills: readonly Skill[]): ChoiceOption[] =>
  skills.map((skill) => ({ id: skill, name: skillName(skill) }));
const isSkill = (value: string): value is Skill => (SKILLS as readonly string[]).includes(value);
const abilityOptions = (abilities: readonly Ability[]): ChoiceOption[] =>
  abilities.map((ability) => ({ id: ability, name: abilityLabels[ability].name }));

const SPELL_LIST_LABELS: Record<string, string> = {
  artificer: 'Artífice',
  bard: 'Bardo',
  cleric: 'Clérigo',
  druid: 'Druida',
  paladin: 'Paladino',
  ranger: 'Patrulheiro',
  sorcerer: 'Feiticeiro',
  warlock: 'Bruxo',
  wizard: 'Mago',
};
export function spellListLabel(list: string): string {
  return SPELL_LIST_LABELS[list] ?? list;
}

/** O personagem tem a habilidade Estilo de Luta neste nível? */
export function hasFightingStyleFeature(
  classDef: ClassDefinition | undefined,
  level: number,
): boolean {
  if (!classDef) return false;
  if (classDef.id === 'fighter') return true;
  if (classDef.id === 'paladin' || classDef.id === 'ranger') return level >= 2;
  return false;
}

/** Maior círculo de magia que a classe consegue conjurar no nível. */
export function maxClassSpellLevel(classDef: ClassDefinition | undefined, level: number): number {
  const casting = classDef?.spellcasting;
  if (!casting) return 0;
  if (casting.progression === 'pact') return atLevel(WARLOCK_SLOT_LEVEL, level);
  const casterLevel = casting.progression === 'half' ? Math.ceil(level / 2) : level;
  return suggestedSpellSlots(casterLevel).length;
}

/** Magia pelo nome: do SRD ou de um livro liberado. */
export function findSrdSpell(name: string) {
  return findSpell(name);
}

function spellOptions(filter: {
  lists: readonly string[];
  minLevel: number;
  maxLevel: number;
  school?: SpellSchool;
  only?: readonly string[];
}): SpellOption[] {
  const allowed = filter.only ? new Set(filter.only) : null;
  return listSpells()
    .filter(
      (spell) =>
        spell.level >= filter.minLevel &&
        spell.level <= filter.maxLevel &&
        spell.classes.some((list) => filter.lists.includes(list)) &&
        (!filter.school || spell.school === filter.school) &&
        (!allowed || allowed.has(spell.name)),
    )
    .map((spell) => ({
      id: spell.name,
      name: spellNamePt(spell.name),
      description: spell.book ? spell.book.name : spell.name,
      level: spell.level,
      school: spell.school,
      concentration: Boolean(spell.concentration),
      ritual: Boolean(spell.ritual),
    }));
}

// ---------------------------------------------------------------------------
// Talentos obtidos e suas escolhas
// ---------------------------------------------------------------------------

/** Talentos do personagem, na ordem em que são obtidos. */
export function draftFeats(draft: Dnd5eDraft): FeatInstance[] {
  const feats: FeatInstance[] = [];
  const classDef = draftClass(draft);
  const background = draftBackground(draft);
  const species = draftSpecies(draft);

  if (background) {
    // Antecedentes de livro (2014) não trazem talento: o jogador escolhe um de origem.
    const featId = background.feat || selectionText(draft, 'background.origin_feat');
    if (featId) {
      feats.push({
        specId: 'background.feat',
        featId,
        source: `Antecedente: ${background.name}`,
        level: 1,
        ...(background.magicInitiateList ? { fixedList: background.magicInitiateList } : {}),
      });
    }
  }
  if (draftSpeciesBenefits(draft)?.featChoice) {
    const featId = selectionText(draft, 'species.book_feat');
    if (featId)
      feats.push({
        specId: 'species.book_feat',
        featId,
        source: `Espécie: ${species?.name ?? ''}`,
        level: 1,
      });
  }
  if (species?.id === 'human') {
    const featId = selectionText(draft, 'species.versatile');
    if (featId)
      feats.push({ specId: 'species.versatile', featId, source: 'Humano (Versátil)', level: 1 });
  }
  if (classDef && hasFightingStyleFeature(classDef, draft.level)) {
    const style = selectionText(draft, 'class.fighting_style');
    if (findFeat(style)?.category === 'fighting_style') {
      feats.push({
        specId: 'class.fighting_style',
        featId: style,
        source: `${classDef.name}: Estilo de Luta`,
        level: classDef.id === 'fighter' ? 1 : 2,
      });
    }
  }
  if (
    classDef?.id === 'warlock' &&
    selectionList(draft, 'class.invocations').includes('lessons_of_the_first_ones')
  ) {
    const featId = selectionText(draft, 'class.invocations.lessons');
    if (featId)
      feats.push({
        specId: 'class.invocations.lessons',
        featId,
        source: 'Invocação: Lições dos Primeiros',
        level: 2,
      });
  }
  if (classDef) {
    for (const asiLevel of classDef.asiLevels) {
      if (asiLevel > draft.level) continue;
      const featId = selectionText(draft, `asi.${asiLevel}`);
      if (featId)
        feats.push({
          specId: `asi.${asiLevel}`,
          featId,
          source: `${classDef.name} ${asiLevel}º nível`,
          level: asiLevel,
        });
    }
    if (classDef.id === 'fighter' && draft.level >= 7) {
      const style = selectionText(draft, 'subclass.fighting_style');
      if (findFeat(style)?.category === 'fighting_style') {
        feats.push({
          specId: 'subclass.fighting_style',
          featId: style,
          source: 'Campeão: Estilo de Luta Adicional',
          level: 7,
        });
      }
    }
    if (draft.level >= 19) {
      const featId = selectionText(draft, 'epic.19');
      if (featId)
        feats.push({ specId: 'epic.19', featId, source: `${classDef.name} 19º nível`, level: 19 });
    }
  }
  return feats;
}

/** Lista de magias escolhida para um Iniciado em Magia. */
export function magicInitiateList(
  draft: Dnd5eDraft,
  feat: FeatInstance,
): 'cleric' | 'druid' | 'wizard' | null {
  if (feat.fixedList) return feat.fixedList;
  const list = selectionText(draft, `${feat.specId}.list`);
  return list === 'cleric' || list === 'druid' || list === 'wizard' ? list : null;
}

/** Marca como indisponíveis as opções já concedidas por outra origem. */
function markTaken(
  options: ChoiceOption[],
  taken: Map<string, string>,
  toKey: (id: string) => string = (id) => id,
): ChoiceOption[] {
  return options.map((option) => {
    const source = taken.get(toKey(option.id));
    return source ? { ...option, disabledReason: `Já vem de ${source}.` } : option;
  });
}

/** Perícias (ou ferramentas) concedidas por origens diferentes da escolha indicada. */
function grantedElsewhere(grants: readonly Grant[], specId: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const grant of grants)
    if (grant.specId !== specId && !map.has(grant.id)) map.set(grant.id, grant.source);
  return map;
}

function featChoiceSpecs(draft: Dnd5eDraft, feat: FeatInstance, step: Dnd5eStep): ChoiceSpec[] {
  const definition = findFeat(feat.featId);
  if (!definition) return [];
  const prefix = feat.specId;
  const source = `${definition.name} (${feat.source})`;
  const specs: ChoiceSpec[] = [];
  switch (definition.id) {
    case 'magic_initiate': {
      if (!feat.fixedList) {
        const usedLists = new Map(
          draftFeats(draft)
            .filter((other) => other.featId === 'magic_initiate' && other.specId !== feat.specId)
            .map((other) => [magicInitiateList(draft, other), other.source] as const)
            .filter(
              (entry): entry is readonly ['cleric' | 'druid' | 'wizard', string] =>
                entry[0] !== null,
            ),
        );
        specs.push({
          kind: 'option',
          id: `${prefix}.list`,
          step,
          label: 'Lista de magias do Iniciado em Magia',
          source,
          options: markTaken(
            (['cleric', 'druid', 'wizard'] as const).map((list) => ({
              id: list,
              name: spellListLabel(list),
            })),
            usedLists,
          ),
        });
      }
      specs.push({
        kind: 'option',
        id: `${prefix}.ability`,
        step,
        label: 'Atributo de conjuração do Iniciado em Magia',
        source,
        options: abilityOptions(['int', 'wis', 'cha']),
      });
      const list = magicInitiateList(draft, feat);
      if (list) {
        const fixed = new Map(fixedSpells(draft).map((spell) => [spell.name, spell.source]));
        specs.push(
          {
            kind: 'spells',
            id: `${prefix}.cantrips`,
            step: 'spells',
            label: `Truques do Iniciado em Magia (${spellListLabel(list)})`,
            source,
            count: 2,
            options: spellOptions({ lists: [list], minLevel: 0, maxLevel: 0 }).map((option) =>
              fixed.has(option.id)
                ? { ...option, disabledReason: `Já vem de ${fixed.get(option.id)}.` }
                : option,
            ),
          },
          {
            kind: 'spells',
            id: `${prefix}.spell`,
            step: 'spells',
            label: `Magia de 1º círculo do Iniciado em Magia (${spellListLabel(list)})`,
            description:
              'Sempre preparada; conjurável 1 vez sem espaço de magia por descanso longo.',
            source,
            count: 1,
            options: spellOptions({ lists: [list], minLevel: 1, maxLevel: 1 }),
          },
        );
      }
      break;
    }
    case 'skilled': {
      const id = `${prefix}.proficiencies`;
      const skills = grantedElsewhere(skillGrants(draft), id);
      const tools = grantedElsewhere(toolGrants(draft), id);
      specs.push({
        kind: 'multi',
        id,
        step,
        label: 'Proficiências do talento Habilidoso (3 perícias ou ferramentas)',
        source,
        count: 3,
        options: [
          ...markTaken(
            SKILLS.map((skill) => ({
              id: `skill:${skill}`,
              name: skillName(skill),
              description: 'Perícia',
            })),
            skills,
            (value) => value.slice(6),
          ),
          ...markTaken(
            ALL_TOOLS.map((tool) => ({
              id: `tool:${tool.id}`,
              name: tool.name,
              description: 'Ferramenta',
            })),
            tools,
            (value) => value.slice(5),
          ),
        ],
      });
      break;
    }
    case 'ability_score_improvement':
      specs.push({
        kind: 'ability_increase',
        id: `${prefix}.increase`,
        step,
        label: 'Aumento no Valor de Atributo',
        description: '+2 em um atributo ou +1 em dois atributos (máximo 20).',
        source,
        mode: 'asi',
        abilities: ABILITIES,
        cap: 20,
      });
      break;
    case 'grappler':
      specs.push({
        kind: 'option',
        id: `${prefix}.ability`,
        step,
        label: 'Agarrador: Força ou Destreza +1',
        source,
        options: abilityOptions(['str', 'dex']),
      });
      break;
    default:
      if (definition.abilityIncrease?.length) {
        specs.push({
          kind: 'option',
          id: `${prefix}.ability`,
          step,
          label: `${definition.name}: atributo +1 (máximo 20)`,
          source,
          options: abilityOptions(definition.abilityIncrease),
        });
      } else if (definition.category === 'epic') {
        specs.push({
          kind: 'option',
          id: `${prefix}.ability`,
          step,
          label: `${definition.name}: atributo +1 (máximo 30)`,
          source,
          options: abilityOptions(epicBoonAbilities(definition.id)),
        });
      }
      break;
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Proficiências concedidas (fixas e escolhidas)
// ---------------------------------------------------------------------------

export interface Grant {
  id: string;
  source: string;
  /** Escolha que concedeu; ausente quando é fixa (ex.: perícias do antecedente). */
  specId?: string;
}

/** Perícias com proficiência, com a origem de cada uma. */
export function skillGrants(draft: Dnd5eDraft): Grant[] {
  const grants: Grant[] = [];
  const classDef = draftClass(draft);
  const background = draftBackground(draft);
  const species = draftSpecies(draft);
  const push = (skills: readonly string[], source: string, specId?: string) => {
    for (const skill of skills)
      if (isSkill(skill)) grants.push({ id: skill, source, ...(specId ? { specId } : {}) });
  };
  if (background) push(background.skills, `Antecedente: ${background.name}`);
  if (classDef)
    push(selectionList(draft, 'class.skills'), `Classe: ${classDef.name}`, 'class.skills');
  if (classDef?.id === 'barbarian' && draft.level >= 3)
    push(
      selectionList(draft, 'class.primal_knowledge'),
      'Conhecimento Primitivo',
      'class.primal_knowledge',
    );
  if (classDef?.id === 'bard' && draft.level >= 3)
    push(
      selectionList(draft, 'subclass.lore_proficiencies'),
      'Colégio do Conhecimento',
      'subclass.lore_proficiencies',
    );
  if (species?.id === 'elf')
    push(
      selectionList(draft, 'species.keen_senses'),
      'Elfo (Sentidos Aguçados)',
      'species.keen_senses',
    );
  if (species?.id === 'human')
    push(selectionList(draft, 'species.skillful'), 'Humano (Hábil)', 'species.skillful');
  if (species && draftSpeciesBenefits(draft)?.skillChoices)
    push(
      selectionList(draft, 'species.book_skills'),
      `Espécie: ${species.name}`,
      'species.book_skills',
    );
  for (const feat of draftFeats(draft)) {
    if (feat.featId !== 'skilled') continue;
    const id = `${feat.specId}.proficiencies`;
    push(
      selectionList(draft, id)
        .filter((entry) => entry.startsWith('skill:'))
        .map((entry) => entry.slice(6)),
      `Habilidoso (${feat.source})`,
      id,
    );
  }
  return grants;
}

/** Proficiências com ferramentas, com a origem de cada uma. */
export function toolGrants(draft: Dnd5eDraft): Grant[] {
  const grants: Grant[] = [];
  const classDef = draftClass(draft);
  const background = draftBackground(draft);
  if (classDef) {
    for (const tool of classDef.tools)
      grants.push({ id: tool, source: `Classe: ${classDef.name}` });
    if (classDef.toolChoice) {
      for (const tool of selectionList(draft, 'class.tools'))
        grants.push({ id: tool, source: `Classe: ${classDef.name}`, specId: 'class.tools' });
    }
  }
  if (background?.tool) {
    if (typeof background.tool === 'string')
      grants.push({ id: background.tool, source: `Antecedente: ${background.name}` });
    else {
      const tool = selectionText(draft, 'background.tool');
      if (tool)
        grants.push({
          id: tool,
          source: `Antecedente: ${background.name}`,
          specId: 'background.tool',
        });
    }
  }
  for (const feat of draftFeats(draft)) {
    if (feat.featId !== 'skilled') continue;
    const id = `${feat.specId}.proficiencies`;
    for (const entry of selectionList(draft, id)) {
      if (entry.startsWith('tool:'))
        grants.push({ id: entry.slice(5), source: `Habilidoso (${feat.source})`, specId: id });
    }
  }
  return grants;
}

/** Idiomas à escolha da raça de livro: os do traço "Idiomas" e o "Idioma Adicional" da sub-raça (Alto Elfo). */
function speciesLanguageChoices(draft: Dnd5eDraft): number {
  const species = draftSpecies(draft);
  if (!species?.bookLanguages) return 0;
  const lineage = draftLineage(draft);
  return (
    species.bookLanguages.choices +
    (lineage && /idioma adicional/i.test(lineage.description) ? 1 : 0)
  );
}

/** Idiomas conhecidos, com a origem de cada um. */
export function languageGrants(draft: Dnd5eDraft): Grant[] {
  const grants: Grant[] = [{ id: 'common', source: 'Todos os personagens' }];
  const classDef = draftClass(draft);
  const species = draftSpecies(draft);
  const background = draftBackground(draft);
  // Raça de um livro de 2014 com o traço "Idiomas": no lugar dos dois idiomas padrão da origem.
  if (!species?.bookLanguages) {
    for (const language of selectionList(draft, 'origin.languages'))
      grants.push({ id: language, source: 'Origem', specId: 'origin.languages' });
  }
  if (species?.bookLanguages) {
    for (const language of species.bookLanguages.fixed)
      grants.push({ id: language, source: `Espécie: ${species.name}` });
    for (const language of selectionList(draft, 'species.languages'))
      grants.push({
        id: language,
        source: `Espécie: ${species.name}`,
        specId: 'species.languages',
      });
  }
  if (background?.bookLanguages) {
    for (const language of background.bookLanguages.fixed)
      grants.push({ id: language, source: `Antecedente: ${background.name}` });
    for (const language of selectionList(draft, 'background.languages')) {
      grants.push({
        id: language,
        source: `Antecedente: ${background.name}`,
        specId: 'background.languages',
      });
    }
  }
  if (classDef) {
    for (const language of classDef.languages ?? [])
      grants.push({ id: language, source: `Classe: ${classDef.name}` });
    if (classDef.id === 'rogue') {
      for (const language of selectionList(draft, 'class.thieves_cant_language')) {
        grants.push({
          id: language,
          source: 'Gíria de Ladrão',
          specId: 'class.thieves_cant_language',
        });
      }
    }
    if (classDef.id === 'ranger' && draft.level >= 2) {
      for (const language of selectionList(draft, 'class.deft_explorer_languages')) {
        grants.push({
          id: language,
          source: 'Explorador Hábil',
          specId: 'class.deft_explorer_languages',
        });
      }
    }
  }
  return grants;
}

/** Escolhas de Especialização da classe disponíveis no nível. */
function expertiseSpecs(
  classDef: ClassDefinition,
  level: number,
): { id: string; count: number; from?: readonly Skill[]; label: string }[] {
  switch (classDef.id) {
    case 'rogue':
      return [
        { id: 'class.expertise.1', count: 2, label: 'Especialização (1º nível)' },
        ...(level >= 6
          ? [{ id: 'class.expertise.6', count: 2, label: 'Especialização (6º nível)' }]
          : []),
      ];
    case 'bard':
      return [
        ...(level >= 2
          ? [{ id: 'class.expertise.2', count: 2, label: 'Especialização (2º nível)' }]
          : []),
        ...(level >= 9
          ? [{ id: 'class.expertise.9', count: 2, label: 'Especialização (9º nível)' }]
          : []),
      ];
    case 'ranger':
      return [
        ...(level >= 2
          ? [{ id: 'class.expertise.2', count: 1, label: 'Explorador Hábil: Especialização' }]
          : []),
        ...(level >= 9
          ? [{ id: 'class.expertise.9', count: 2, label: 'Especialização (9º nível)' }]
          : []),
      ];
    case 'wizard':
      return level >= 2
        ? [
            {
              id: 'class.expertise.2',
              count: 1,
              from: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'],
              label: 'Estudioso: Especialização',
            },
          ]
        : [];
    default:
      return [];
  }
}

export function expertiseSkills(draft: Dnd5eDraft): Skill[] {
  const classDef = draftClass(draft);
  if (!classDef) return [];
  return expertiseSpecs(classDef, draft.level).flatMap((spec) =>
    selectionList(draft, spec.id).filter(isSkill),
  );
}

// ---------------------------------------------------------------------------
// Magias conhecidas por origem fixa (espécie, subclasse, classe)
// ---------------------------------------------------------------------------

export interface FixedSpell {
  name: string;
  source: string;
  /** Pode ser conjurada sem espaço: uma vez ou "proficiência" vezes por descanso longo. */
  freeUses?: 'once' | 'proficiency';
  /** Atributo de conjuração quando não é o da classe. */
  ability?: Ability;
}

export function fixedSpells(draft: Dnd5eDraft): FixedSpell[] {
  const result: FixedSpell[] = [];
  const classDef = draftClass(draft);
  const subclass = draftSubclass(draft);
  const species = draftSpecies(draft);
  const lineage = draftLineage(draft);
  const speciesAbility = selectionText(draft, 'species.spell_ability');
  const ability = (ABILITIES as readonly string[]).includes(speciesAbility)
    ? (speciesAbility as Ability)
    : undefined;
  if (species) {
    const source = lineage ? `${species.name} (${lineage.name})` : species.name;
    for (const name of species.cantrips ?? [])
      result.push({ name, source, ...(ability ? { ability } : {}) });
    for (const name of lineage?.cantrips ?? [])
      result.push({ name, source, ...(ability ? { ability } : {}) });
    for (const entry of lineage?.spells ?? []) {
      if (entry.level <= draft.level)
        result.push({
          name: entry.spell,
          source,
          freeUses: entry.uses ?? 'once',
          ...(ability ? { ability } : {}),
        });
    }
  }
  if (classDef) {
    for (const entry of classDef.alwaysPrepared ?? []) {
      if (entry.level <= draft.level)
        for (const name of entry.spells) result.push({ name, source: entry.note });
    }
  }
  if (subclass) {
    for (const entry of subclass.alwaysPrepared ?? []) {
      if (entry.level <= draft.level)
        for (const name of entry.spells) result.push({ name, source: subclass.name });
    }
    if (subclass.id === 'land') {
      const land = CIRCLE_OF_THE_LAND.find(
        (option) => option.id === selectionText(draft, 'subclass.land'),
      );
      for (const entry of land?.spells ?? []) {
        if (entry.level <= draft.level)
          for (const name of entry.spells)
            result.push({ name, source: `Círculo da Terra (${land!.name})` });
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lista de escolhas
// ---------------------------------------------------------------------------

/** O mago prepara magias do grimório (e das ganhas pelo Sábio da Evocação): repetir é esperado. */
function spellOverlapAllowed(a: string, b: string): boolean {
  const book = (id: string) => id === 'spells.spellbook' || id === 'subclass.evocation_savant';
  return (a === 'spells.prepared' && book(b)) || (b === 'spells.prepared' && book(a));
}

function weaponMasteryOptions(classDef: ClassDefinition): ChoiceOption[] {
  return Object.values(SRD_WEAPONS)
    .filter((weapon) => {
      if (classDef.id === 'barbarian') return weapon.kind === 'melee';
      if (weapon.category === 'simple') return classDef.weapons.simple;
      switch (classDef.weapons.martial) {
        case 'all':
          return true;
        case 'light':
          return weapon.properties.includes('light');
        case 'finesse_or_light':
          return weapon.properties.includes('finesse') || weapon.properties.includes('light');
        case 'none':
          return false;
      }
    })
    .map((weapon) => ({ id: weapon.id, name: weapon.name }));
}

function equipmentDescription(option: EquipmentOption): string {
  const items = option.items.map((grant) => {
    const item = SRD_ITEMS[grant.item];
    const name =
      grant.choice === 'musical_instrument'
        ? 'Instrumento musical à escolha'
        : grant.choice === 'class_tool'
          ? 'A ferramenta ou instrumento escolhido na classe'
          : grant.choice === 'gaming_set'
            ? 'O jogo escolhido no antecedente'
            : (grant.name ?? item?.name ?? grant.item);
    return grant.quantity && grant.quantity > 1 ? `${grant.quantity} × ${name}` : name;
  });
  return [...items, `${option.gold} PO`].join(', ');
}

function featOptionsFor(
  draft: Dnd5eDraft,
  categories: readonly FeatDefinition['category'][],
  specId: string,
  scoresBefore: Record<Ability, number> | null,
): ChoiceOption[] {
  const taken = draftFeats(draft).filter((feat) => feat.specId !== specId);
  const ordered = listFeats()
    .filter((feat) => categories.includes(feat.category))
    .sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
  return ordered.map((feat) => {
    let disabledReason: string | undefined;
    if (!feat.repeatable && taken.some((entry) => entry.featId === feat.id))
      disabledReason = 'Você já tem este talento.';
    else if (
      feat.id === 'magic_initiate' &&
      taken.filter((entry) => entry.featId === 'magic_initiate').length >= 3
    ) {
      disabledReason = 'Você já usou as três listas de magia.';
    } else if (feat.minLevel && draft.level < feat.minLevel)
      disabledReason = `Exige ${feat.minLevel}º nível.`;
    else if (
      feat.minScore &&
      scoresBefore &&
      !feat.minScore.abilities.some((ability) => scoresBefore[ability] >= feat.minScore!.value)
    ) {
      disabledReason = `Exige ${feat.minScore.abilities.map((ability) => abilityLabels[ability].abbreviation).join(' ou ')} ${feat.minScore.value}+.`;
    }
    const description = feat.book ? `${feat.book}. ${feat.description}` : feat.description;
    return {
      id: feat.id,
      name: feat.name,
      description,
      ...(disabledReason ? { disabledReason } : {}),
    };
  });
}

/** Escolhas exigidas pelas regras para o rascunho atual, na ordem do assistente. */
/** Ouro dos pacotes de equipamento escolhidos (classe + antecedente), antes das compras. */
export function equipmentGold(draft: Dnd5eDraft): number {
  const classOption = draftClass(draft)?.equipment.find(
    (option) => option.id === selectionText(draft, 'equipment.class'),
  );
  const backgroundOption = draftBackground(draft)?.equipment.find(
    (option) => option.id === selectionText(draft, 'equipment.background'),
  );
  return (classOption?.gold ?? 0) + (backgroundOption?.gold ?? 0);
}

/** O pacote de classe escolhido não traz armadura nem escudo (o de ouro): dá para comprar. */
export function canBuyArmor(draft: Dnd5eDraft): boolean {
  const classDef = draftClass(draft);
  const chosen = classDef?.equipment.find(
    (option) => option.id === selectionText(draft, 'equipment.class'),
  );
  if (!classDef || !chosen || classDef.armor.length === 0) return false;
  return !chosen.items.some((grant) => SRD_ITEMS[grant.item]?.category === 'armor');
}

/** Armadura e escudo comprados com o ouro inicial e o custo total. */
export function armorPurchases(draft: Dnd5eDraft): { ids: string[]; cost: number } {
  if (!canBuyArmor(draft)) return { ids: [], cost: 0 };
  const ids = [
    selectionText(draft, 'equipment.buy_armor'),
    selectionText(draft, 'equipment.buy_shield'),
  ].filter((id) => id && id !== 'none' && SRD_ARMOR[id]);
  return { ids, cost: ids.reduce((total, id) => total + (ARMOR_COST_GP[id] ?? 0), 0) };
}

export function listDnd5eChoices(draft: Dnd5eDraft): ChoiceSpec[] {
  const specs: ChoiceSpec[] = [];
  const classDef = draftClass(draft);
  const subclass = draftSubclass(draft);
  const background = draftBackground(draft);
  const species = draftSpecies(draft);
  const level = draft.level;
  const feats = draftFeats(draft);

  // Classe -------------------------------------------------------------------
  const skillsGranted = skillGrants(draft);
  const skillChoiceOptions = (skills: readonly Skill[], specId: string) =>
    markTaken(skillOptions(skills), grantedElsewhere(skillsGranted, specId));
  if (classDef) {
    const classSource = `Classe: ${classDef.name}`;
    const subclassOptions = draftSubclassOptions(draft);
    if (level >= 3 && subclassOptions.length > 1) {
      specs.push({
        kind: 'option',
        id: 'class.subclass',
        step: 'class',
        label: 'Subclasse',
        description: 'A subclasse do SRD e as dos livros liberados pelo mestre.',
        source: classSource,
        options: subclassOptions.map((option) => ({
          id: option.id,
          name: option.name,
          description: option.book ? `${option.book}. ${option.description}` : option.description,
        })),
      });
    }
    const options =
      classDef.skillChoices.options === 'any' ? SKILLS : classDef.skillChoices.options;
    specs.push({
      kind: 'multi',
      id: 'class.skills',
      step: 'class',
      label: `Perícias de ${classDef.name}`,
      description: `Escolha ${classDef.skillChoices.count}.`,
      source: classSource,
      count: classDef.skillChoices.count,
      options: skillChoiceOptions(options, 'class.skills'),
    });
    if (classDef.toolChoice) {
      const tools =
        classDef.toolChoice.kind === 'musical_instrument'
          ? MUSICAL_INSTRUMENTS
          : [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS];
      specs.push({
        kind: 'multi',
        id: 'class.tools',
        step: 'class',
        label: classDef.toolChoice.label,
        source: classSource,
        count: classDef.toolChoice.count,
        options: markTaken(
          tools.map((tool) => ({ id: tool.id, name: tool.name })),
          grantedElsewhere(toolGrants(draft), 'class.tools'),
        ),
      });
    }
    if (classDef.id === 'cleric') {
      specs.push({
        kind: 'option',
        id: 'class.divine_order',
        step: 'class',
        label: 'Ordem Divina',
        source: classSource,
        options: [
          {
            id: 'protector',
            name: 'Protetor',
            description: 'Proficiência com armas marciais e treino com armaduras pesadas.',
          },
          {
            id: 'thaumaturge',
            name: 'Taumaturgo',
            description:
              'Um truque de clérigo extra e bônus do mod. de Sabedoria (mín. +1) em Arcanismo e Religião.',
          },
        ],
      });
    }
    if (classDef.id === 'druid') {
      specs.push({
        kind: 'option',
        id: 'class.primal_order',
        step: 'class',
        label: 'Ordem Primal',
        source: classSource,
        options: [
          {
            id: 'magician',
            name: 'Mágico',
            description:
              'Um truque de druida extra e bônus do mod. de Sabedoria (mín. +1) em Arcanismo e Natureza.',
          },
          {
            id: 'warden',
            name: 'Guardião',
            description: 'Proficiência com armas marciais e treino com armaduras médias.',
          },
        ],
      });
    }
    if (hasFightingStyleFeature(classDef, level)) {
      const alternative =
        classDef.id === 'paladin'
          ? [
              {
                id: 'blessed_warrior',
                name: 'Guerreiro Abençoado',
                description:
                  'Dois truques de clérigo que contam como magias de paladino (Carisma).',
              },
            ]
          : classDef.id === 'ranger'
            ? [
                {
                  id: 'druidic_warrior',
                  name: 'Guerreiro Druídico',
                  description:
                    'Dois truques de druida que contam como magias de patrulheiro (Sabedoria).',
                },
              ]
            : [];
      specs.push({
        kind: 'option',
        id: 'class.fighting_style',
        step: 'class',
        label: 'Estilo de Luta',
        source: classSource,
        options: [
          ...featOptionsFor(draft, ['fighting_style'], 'class.fighting_style', null),
          ...alternative,
        ],
      });
    }
    if (classDef.weaponMastery) {
      specs.push({
        kind: 'multi',
        id: 'class.weapon_mastery',
        step: 'class',
        label: 'Maestria em Armas',
        description: 'Tipos de arma cujas propriedades de maestria você usa.',
        source: classSource,
        count: atLevel(classDef.weaponMastery, level),
        options: weaponMasteryOptions(classDef),
      });
    }
    if (classDef.id === 'cleric' && level >= 7) {
      specs.push({
        kind: 'option',
        id: 'class.blessed_strikes',
        step: 'class',
        label: 'Golpes Abençoados',
        source: classSource,
        options: [
          {
            id: 'divine_strike',
            name: 'Golpe Divino',
            description:
              'Uma vez por turno, +1d8 de dano necrótico ou radiante ao acertar com uma arma.',
          },
          {
            id: 'potent_spellcasting',
            name: 'Conjuração Potente',
            description: 'Soma o mod. de Sabedoria ao dano dos truques de clérigo.',
          },
        ],
      });
    }
    if (classDef.id === 'druid' && level >= 7) {
      specs.push({
        kind: 'option',
        id: 'class.elemental_fury',
        step: 'class',
        label: 'Fúria Elemental',
        source: classSource,
        options: [
          {
            id: 'potent_spellcasting',
            name: 'Conjuração Potente',
            description: 'Soma o mod. de Sabedoria ao dano dos truques de druida.',
          },
          {
            id: 'primal_strike',
            name: 'Golpe Primal',
            description:
              'Uma vez por turno, +1d8 de frio, fogo, elétrico ou trovejante ao acertar.',
          },
        ],
      });
    }
    if (classDef.id === 'warlock') {
      const chosen = selectionList(draft, 'class.invocations');
      specs.push({
        kind: 'multi',
        id: 'class.invocations',
        step: 'class',
        label: 'Invocações Místicas',
        source: classSource,
        count: atLevel(WARLOCK_INVOCATIONS, level),
        options: SRD_INVOCATIONS.map((invocation) => {
          let disabledReason: string | undefined;
          if (invocation.minLevel > level)
            disabledReason = `Exige bruxo de ${invocation.minLevel}º nível.`;
          else if (invocation.requires && !chosen.includes(invocation.requires)) {
            disabledReason = `Exige a invocação ${SRD_INVOCATIONS.find((entry) => entry.id === invocation.requires)?.name ?? invocation.requires}.`;
          }
          return {
            id: invocation.id,
            name: invocation.name,
            description: invocation.description,
            ...(disabledReason ? { disabledReason } : {}),
          };
        }),
      });
      if (chosen.includes('lessons_of_the_first_ones')) {
        specs.push({
          kind: 'option',
          id: 'class.invocations.lessons',
          step: 'class',
          label: 'Lições dos Primeiros: talento de origem',
          source: 'Invocação: Lições dos Primeiros',
          options: featOptionsFor(draft, ['origin'], 'class.invocations.lessons', null),
        });
      }
    }
    if (classDef.id === 'sorcerer' && level >= 2) {
      specs.push({
        kind: 'multi',
        id: 'class.metamagic',
        step: 'class',
        label: 'Metamagia',
        source: classSource,
        count: atLevel(SORCERER_METAMAGIC, level),
        options: SRD_METAMAGIC.map((option) => ({
          id: option.id,
          name: `${option.name} (${option.cost} PF)`,
          description: option.description,
        })),
      });
    }
    if (subclass?.id === 'land') {
      specs.push({
        kind: 'option',
        id: 'subclass.land',
        step: 'class',
        label: 'Tipo de terra (Círculo da Terra)',
        description:
          'Pode ser trocado a cada descanso longo; define as magias do Círculo preparadas agora.',
        source: subclass.name,
        options: CIRCLE_OF_THE_LAND.map((land) => ({
          id: land.id,
          name: land.name,
          description: land.spells
            .map((entry) => `${entry.level}º: ${entry.spells.join(', ')}`)
            .join(' · '),
        })),
      });
    }
    if (subclass?.id === 'champion' && level >= 7) {
      specs.push({
        kind: 'option',
        id: 'subclass.fighting_style',
        step: 'class',
        label: 'Estilo de Luta Adicional',
        source: subclass.name,
        options: featOptionsFor(draft, ['fighting_style'], 'subclass.fighting_style', null),
      });
    }
    if (subclass?.id === 'draconic' && level >= 6) {
      specs.push({
        kind: 'option',
        id: 'subclass.elemental_affinity',
        step: 'class',
        label: 'Afinidade Elemental',
        source: subclass.name,
        options: [
          { id: 'acid', name: 'Ácido' },
          { id: 'cold', name: 'Frio' },
          { id: 'fire', name: 'Fogo' },
          { id: 'lightning', name: 'Elétrico' },
          { id: 'poison', name: 'Veneno' },
        ],
      });
    }
  }
  for (const feat of feats.filter((entry) => entry.specId === 'class.invocations.lessons'))
    specs.push(...featChoiceSpecs(draft, feat, 'class'));

  // Antecedente ---------------------------------------------------------------
  if (background) {
    if (!background.feat) {
      specs.push({
        kind: 'option',
        id: 'background.origin_feat',
        step: 'background',
        label: 'Talento de origem',
        description:
          'Antecedentes de livros antigos não trazem talento: escolha um talento de origem.',
        source: `Antecedente: ${background.name}`,
        options: featOptionsFor(draft, ['origin'], 'background.feat', null),
      });
    }
    if (background.tool && typeof background.tool !== 'string') {
      specs.push({
        kind: 'option',
        id: 'background.tool',
        step: 'background',
        label: 'Jogo (proficiência)',
        source: `Antecedente: ${background.name}`,
        options: GAMING_SETS.map((set) => ({ id: set.id, name: set.name })),
      });
    }
    for (const feat of feats.filter((entry) => entry.specId === 'background.feat'))
      specs.push(...featChoiceSpecs(draft, feat, 'background'));
  }

  // Espécie -------------------------------------------------------------------
  if (species) {
    const source = `Espécie: ${species.name}`;
    if (species.lineage) {
      specs.push({
        kind: 'option',
        id: 'species.lineage',
        step: 'species',
        label: species.lineage.label,
        source,
        options: species.lineage.options.map((option) => ({
          id: option.id,
          name: option.name,
          description: option.description,
        })),
      });
    }
    if (species.sizes.length > 1) {
      specs.push({
        kind: 'option',
        id: 'species.size',
        step: 'species',
        label: 'Tamanho',
        source,
        options: species.sizes.map((size) => ({
          id: size,
          name: size === 'small' ? 'Pequeno' : 'Médio',
        })),
      });
    }
    if (species.spellcastingAbilityChoice) {
      specs.push({
        kind: 'option',
        id: 'species.spell_ability',
        step: 'species',
        label: 'Atributo de conjuração das magias da espécie',
        source,
        options: abilityOptions(['int', 'wis', 'cha']),
      });
    }
    const benefits = draftSpeciesBenefits(draft);
    if (benefits?.choiceCount) {
      specs.push({
        kind: 'multi',
        id: 'species.book_abilities',
        step: 'species',
        label: `Aumento de atributo: escolha ${benefits.choiceCount}`,
        description: `Cada atributo escolhido aumenta em ${benefits.choiceAmount}.`,
        source,
        count: benefits.choiceCount,
        options: abilityOptions(ABILITIES.filter((ability) => !benefits.fixed[ability])),
      });
    }
    if (benefits?.skillChoices) {
      specs.push({
        kind: 'multi',
        id: 'species.book_skills',
        step: 'species',
        label:
          benefits.skillChoices === 1
            ? 'Perícia à sua escolha'
            : `Perícias à sua escolha (${benefits.skillChoices})`,
        source,
        count: benefits.skillChoices,
        options: skillChoiceOptions(SKILLS, 'species.book_skills'),
      });
    }
    if (benefits?.featChoice) {
      specs.push({
        kind: 'option',
        id: 'species.book_feat',
        step: 'species',
        label: 'Talento à sua escolha',
        source,
        options: featOptionsFor(draft, ['origin', 'general'], 'species.book_feat', null),
      });
      for (const feat of feats.filter((entry) => entry.specId === 'species.book_feat'))
        specs.push(...featChoiceSpecs(draft, feat, 'species'));
    }
    if (species.id === 'elf') {
      specs.push({
        kind: 'multi',
        id: 'species.keen_senses',
        step: 'species',
        label: 'Sentidos Aguçados',
        source,
        count: 1,
        options: skillChoiceOptions(['insight', 'perception', 'survival'], 'species.keen_senses'),
      });
    }
    if (species.id === 'human') {
      specs.push(
        {
          kind: 'multi',
          id: 'species.skillful',
          step: 'species',
          label: 'Hábil: perícia',
          source,
          count: 1,
          options: skillChoiceOptions(SKILLS, 'species.skillful'),
        },
        {
          kind: 'option',
          id: 'species.versatile',
          step: 'species',
          label: 'Versátil: talento de origem',
          source,
          options: featOptionsFor(draft, ['origin'], 'species.versatile', null),
        },
      );
      for (const feat of feats.filter((entry) => entry.specId === 'species.versatile'))
        specs.push(...featChoiceSpecs(draft, feat, 'species'));
    }
  }

  // Idiomas e perícias --------------------------------------------------------
  const known = new Set(languageGrants(draft).map((grant) => grant.id));
  const languageOptions = (specId: string, rarity: 'standard' | 'any') => {
    const own = new Set(selectionList(draft, specId));
    return SRD_LANGUAGES.filter(
      (language) =>
        language.id !== 'common' &&
        !(CLASS_ONLY_LANGUAGES as readonly string[]).includes(language.id) &&
        (rarity === 'any' || language.rarity === 'standard'),
    ).map((language) => ({
      id: language.id,
      name: language.name,
      ...(known.has(language.id) && !own.has(language.id)
        ? { disabledReason: 'Você já conhece este idioma.' }
        : {}),
    }));
  };
  const bookSpecies = draftSpecies(draft);
  const bookBackground = draftBackground(draft);
  if (bookSpecies?.bookLanguages) {
    // Livros de 2014: a raça dá os próprios idiomas (e às vezes um à escolha, de qualquer raridade).
    const choices = speciesLanguageChoices(draft);
    if (choices > 0) {
      specs.push({
        kind: 'multi',
        id: 'species.languages',
        step: 'proficiencies',
        label: 'Idiomas da espécie',
        description: `${bookSpecies.name} conhece ${['Comum', ...bookSpecies.bookLanguages.fixed.map(languageName)].join(', ')} e escolhe mais ${choices}.`,
        source: `Espécie: ${bookSpecies.name}`,
        count: choices,
        options: languageOptions('species.languages', 'any'),
      });
    }
  } else {
    specs.push({
      kind: 'multi',
      id: 'origin.languages',
      step: 'proficiencies',
      label: 'Idiomas',
      description: 'Todo personagem conhece o Comum e mais dois idiomas padrão.',
      source: 'Origem',
      count: 2,
      options: languageOptions('origin.languages', 'standard'),
    });
  }
  if (bookBackground?.bookLanguages && bookBackground.bookLanguages.choices > 0) {
    specs.push({
      kind: 'multi',
      id: 'background.languages',
      step: 'proficiencies',
      label: 'Idiomas do antecedente',
      description: `${bookBackground.name}: ${bookBackground.bookLanguages.choices === 1 ? 'um idioma' : `${bookBackground.bookLanguages.choices} idiomas`} à sua escolha, inclusive os raros.`,
      source: `Antecedente: ${bookBackground.name}`,
      count: bookBackground.bookLanguages.choices,
      options: languageOptions('background.languages', 'any'),
    });
  }
  if (classDef?.id === 'rogue') {
    specs.push({
      kind: 'multi',
      id: 'class.thieves_cant_language',
      step: 'proficiencies',
      label: 'Gíria de Ladrão: idioma adicional',
      source: 'Classe: Ladino',
      count: 1,
      options: languageOptions('class.thieves_cant_language', 'any'),
    });
  }
  if (classDef?.id === 'ranger' && level >= 2) {
    specs.push({
      kind: 'multi',
      id: 'class.deft_explorer_languages',
      step: 'proficiencies',
      label: 'Explorador Hábil: idiomas',
      source: 'Classe: Patrulheiro',
      count: 2,
      options: languageOptions('class.deft_explorer_languages', 'any'),
    });
  }
  if (classDef?.id === 'barbarian' && level >= 3) {
    specs.push({
      kind: 'multi',
      id: 'class.primal_knowledge',
      step: 'proficiencies',
      label: 'Conhecimento Primitivo: perícia',
      source: 'Classe: Bárbaro',
      count: 1,
      options: skillChoiceOptions(
        classDef.skillChoices.options === 'any' ? SKILLS : classDef.skillChoices.options,
        'class.primal_knowledge',
      ),
    });
  }
  if (subclass?.id === 'lore') {
    specs.push({
      kind: 'multi',
      id: 'subclass.lore_proficiencies',
      step: 'proficiencies',
      label: 'Proficiências Adicionais (3 perícias)',
      source: subclass.name,
      count: 3,
      options: skillChoiceOptions(SKILLS, 'subclass.lore_proficiencies'),
    });
  }
  if (classDef) {
    const proficient = new Set(skillGrants(draft).map((grant) => grant.id));
    const all = expertiseSpecs(classDef, level);
    for (const spec of all) {
      const elsewhere = new Set(
        all
          .filter((other) => other.id !== spec.id)
          .flatMap((other) => selectionList(draft, other.id)),
      );
      specs.push({
        kind: 'multi',
        id: spec.id,
        step: 'proficiencies',
        label: spec.label,
        description: 'Dobra o bônus de proficiência numa perícia em que você já é proficiente.',
        source: `Classe: ${classDef.name}`,
        count: spec.count,
        options: skillOptions(spec.from ?? SKILLS).map((option) => {
          if (!proficient.has(option.id))
            return { ...option, disabledReason: 'Exige proficiência nesta perícia.' };
          if (elsewhere.has(option.id))
            return { ...option, disabledReason: 'Já tem Especialização.' };
          return option;
        }),
      });
    }
  }

  // Atributos -----------------------------------------------------------------
  if (background) {
    specs.push({
      kind: 'ability_increase',
      id: 'background.abilities',
      step: 'abilities',
      label: `Aumentos do antecedente (${background.name})`,
      description: '+2 em um e +1 em outro, ou +1 em todos os três (máximo 20).',
      source: `Antecedente: ${background.name}`,
      mode: 'background',
      abilities: background.abilities,
      cap: 20,
    });
  }
  if (classDef) {
    for (const asiLevel of classDef.asiLevels) {
      if (asiLevel > level) continue;
      const id = `asi.${asiLevel}`;
      const categories: FeatDefinition['category'][] = [
        'general',
        'origin',
        ...(hasFightingStyleFeature(classDef, asiLevel) ? (['fighting_style'] as const) : []),
      ];
      specs.push({
        kind: 'option',
        id,
        step: 'abilities',
        label: `Talento do ${asiLevel}º nível`,
        description:
          'Aumento no Valor de Atributo ou outro talento para o qual você se qualifique.',
        source: `Classe: ${classDef.name}`,
        options: featOptionsFor(draft, categories, id, abilityScoresBefore(draft, asiLevel)),
      });
      for (const feat of feats.filter((entry) => entry.specId === id))
        specs.push(...featChoiceSpecs(draft, feat, 'abilities'));
    }
    if (level >= 19) {
      const categories: FeatDefinition['category'][] = [
        'epic',
        'general',
        'origin',
        ...(hasFightingStyleFeature(classDef, 19) ? (['fighting_style'] as const) : []),
      ];
      specs.push({
        kind: 'option',
        id: 'epic.19',
        step: 'abilities',
        label: 'Dádiva Épica (19º nível)',
        description: 'Uma Dádiva Épica ou outro talento para o qual você se qualifique.',
        source: `Classe: ${classDef.name}`,
        options: featOptionsFor(draft, categories, 'epic.19', abilityScoresBefore(draft, 19)),
      });
      for (const feat of feats.filter((entry) => entry.specId === 'epic.19'))
        specs.push(...featChoiceSpecs(draft, feat, 'abilities'));
    }
  }

  // Magias --------------------------------------------------------------------
  const casting = classDef?.spellcasting;
  const maxLevel = maxClassSpellLevel(classDef, level);
  const fixed = fixedSpells(draft);
  const fixedNames = new Map(fixed.map((spell) => [spell.name, spell.source]));
  const markFixed = (options: SpellOption[], specId: string): SpellOption[] => {
    const own = new Set(selectionList(draft, specId));
    return options.map((option) =>
      fixedNames.has(option.id) && !own.has(option.id)
        ? { ...option, disabledReason: `Já vem de ${fixedNames.get(option.id)}.` }
        : option,
    );
  };
  if (classDef && casting) {
    const source = `Classe: ${classDef.name}`;
    if (casting.cantrips) {
      const extra =
        (classDef.id === 'cleric' &&
          selectionText(draft, 'class.divine_order') === 'thaumaturge') ||
        (classDef.id === 'druid' && selectionText(draft, 'class.primal_order') === 'magician')
          ? 1
          : 0;
      specs.push({
        kind: 'spells',
        id: 'spells.cantrips',
        step: 'spells',
        label: `Truques de ${classDef.name}`,
        source,
        count: atLevel(casting.cantrips, level) + extra,
        options: markFixed(
          spellOptions({ lists: [casting.list], minLevel: 0, maxLevel: 0 }),
          'spells.cantrips',
        ),
      });
    }
    if (casting.spellbook) {
      specs.push({
        kind: 'spells',
        id: 'spells.spellbook',
        step: 'spells',
        label: 'Grimório',
        description:
          'Seis magias de 1º círculo no 1º nível e mais duas a cada nível, de círculos que você pode conjurar.',
        source,
        count: 6 + 2 * (level - 1),
        options: spellOptions({ lists: ['wizard'], minLevel: 1, maxLevel }),
      });
    }
    const preparedLists: string[] =
      classDef.id === 'bard' && level >= 10
        ? ['bard', 'cleric', 'druid', 'wizard']
        : [casting.list];
    const book = casting.spellbook
      ? [
          ...selectionList(draft, 'spells.spellbook'),
          ...selectionList(draft, 'subclass.evocation_savant'),
        ]
      : undefined;
    specs.push({
      kind: 'spells',
      id: 'spells.prepared',
      step: 'spells',
      label: casting.spellbook ? 'Magias preparadas (do grimório)' : 'Magias preparadas',
      description:
        classDef.id === 'bard' && level >= 10
          ? 'Segredos Mágicos: pode escolher também das listas de clérigo, druida e mago.'
          : 'Magias de círculos para os quais você tem espaços de magia.',
      source,
      count: atLevel(casting.prepared, level),
      options: markFixed(
        spellOptions({
          lists: preparedLists,
          minLevel: 1,
          maxLevel,
          ...(book ? { only: book } : {}),
        }),
        'spells.prepared',
      ),
    });
    if (classDef.id === 'warlock') {
      for (const [arcanumLevel, spellLevel] of [
        [11, 6],
        [13, 7],
        [15, 8],
        [17, 9],
      ] as const) {
        if (level < arcanumLevel) continue;
        specs.push({
          kind: 'spells',
          id: `class.arcanum.${spellLevel}`,
          step: 'spells',
          label: `Arcana Mística (${spellLevel}º círculo)`,
          source,
          count: 1,
          options: spellOptions({ lists: ['warlock'], minLevel: spellLevel, maxLevel: spellLevel }),
        });
      }
    }
  }
  const style = selectionText(draft, 'class.fighting_style');
  if (
    classDef &&
    hasFightingStyleFeature(classDef, level) &&
    (style === 'blessed_warrior' || style === 'druidic_warrior')
  ) {
    const list = style === 'blessed_warrior' ? 'cleric' : 'druid';
    specs.push({
      kind: 'spells',
      id: 'class.fighting_style.cantrips',
      step: 'spells',
      label: `${style === 'blessed_warrior' ? 'Guerreiro Abençoado' : 'Guerreiro Druídico'}: truques de ${spellListLabel(list)}`,
      source: `Classe: ${classDef.name}`,
      count: 2,
      options: markFixed(
        spellOptions({ lists: [list], minLevel: 0, maxLevel: 0 }),
        'class.fighting_style.cantrips',
      ),
    });
  }
  if (subclass?.id === 'lore' && level >= 6) {
    specs.push({
      kind: 'spells',
      id: 'subclass.magical_discoveries',
      step: 'spells',
      label: 'Descobertas Mágicas',
      description:
        'Duas magias de clérigo, druida ou mago (truques ou de círculos que você pode conjurar); sempre preparadas.',
      source: subclass.name,
      count: 2,
      options: markFixed(
        spellOptions({ lists: ['cleric', 'druid', 'wizard'], minLevel: 0, maxLevel }),
        'subclass.magical_discoveries',
      ),
    });
  }
  if (subclass?.id === 'evoker') {
    const newSlotLevels = [5, 7, 9, 11, 13, 15, 17].filter((value) => value <= level).length;
    specs.push({
      kind: 'spells',
      id: 'subclass.evocation_savant',
      step: 'spells',
      label: 'Sábio da Evocação: magias de evocação no grimório',
      description:
        'Duas de até 2º círculo e mais uma a cada novo círculo de espaços após o 3º nível.',
      source: subclass.name,
      count: 2 + newSlotLevels,
      options: spellOptions({ lists: ['wizard'], minLevel: 1, maxLevel, school: 'evocation' }),
    });
  }
  // Uma magia escolhida numa lista fica indisponível nas outras (exceto grimório → preparadas).
  const spellSpecs = specs.filter(
    (spec): spec is Extract<ChoiceSpec, { kind: 'spells' }> => spec.kind === 'spells',
  );
  for (const spec of spellSpecs) {
    const own = new Set(selectionList(draft, spec.id));
    const elsewhere = new Map<string, string>();
    for (const other of spellSpecs) {
      if (other.id === spec.id || spellOverlapAllowed(spec.id, other.id)) continue;
      for (const name of selectionList(draft, other.id))
        if (!elsewhere.has(name)) elsewhere.set(name, other.label);
    }
    spec.options = spec.options.map((option) =>
      !own.has(option.id) && !option.disabledReason && elsewhere.has(option.id)
        ? { ...option, disabledReason: `Já escolhida em “${elsewhere.get(option.id)}”.` }
        : option,
    );
  }

  // Equipamento ---------------------------------------------------------------
  if (classDef) {
    specs.push({
      kind: 'option',
      id: 'equipment.class',
      step: 'equipment',
      label: `Equipamento inicial de ${classDef.name}`,
      source: `Classe: ${classDef.name}`,
      options: classDef.equipment.map((option) => ({
        id: option.id,
        name: `Opção ${option.id}`,
        description: equipmentDescription(option),
      })),
    });
    const chosen = classDef.equipment.find(
      (option) => option.id === selectionText(draft, 'equipment.class'),
    );
    if (chosen?.items.some((grant) => grant.choice === 'musical_instrument')) {
      specs.push({
        kind: 'option',
        id: 'equipment.class.instrument',
        step: 'equipment',
        label: 'Instrumento musical do equipamento',
        source: `Classe: ${classDef.name}`,
        options: MUSICAL_INSTRUMENTS.map((instrument) => ({
          id: instrument.id,
          name: instrument.name,
        })),
      });
    }
  }
  // Regra oficial: com o pacote de ouro (sem armadura), compra-se armadura e escudo com o ouro
  // inicial, entre os que a classe tem treino.
  if (classDef && canBuyArmor(draft)) {
    const gold = equipmentGold(draft);
    const source = `Classe: ${classDef.name}`;
    const otherCost = (id: string) =>
      id === 'equipment.buy_armor'
        ? (ARMOR_COST_GP[selectionText(draft, 'equipment.buy_shield')] ?? 0)
        : (ARMOR_COST_GP[selectionText(draft, 'equipment.buy_armor')] ?? 0);
    const purchase = (id: string, ids: string[]) => [
      { id: 'none', name: 'Não comprar' },
      ...ids.map((armorId) => {
        const definition = SRD_ARMOR[armorId]!;
        const cost = ARMOR_COST_GP[armorId] ?? 0;
        const free = gold - otherCost(id);
        return {
          id: armorId,
          name: `${definition.name} (${cost} PO)`,
          description:
            definition.category === 'shield'
              ? `+${definition.armorClass} na CA.`
              : `CA ${definition.armorClass}${definition.dexterity === 'full' ? ' + Des' : definition.dexterity === 'max2' ? ' + Des (máx. 2)' : ''}${definition.strength ? ` · For ${definition.strength}` : ''}${definition.stealthDisadvantage ? ' · desvantagem em Furtividade' : ''}.`,
          ...(cost > free
            ? { disabledReason: `Custa ${cost} PO; sobram ${Math.max(0, free)} PO.` }
            : {}),
        };
      }),
    ];
    const trainedArmor = Object.values(SRD_ARMOR)
      .filter(
        (definition) =>
          definition.category !== 'shield' && classDef.armor.includes(definition.category),
      )
      .map((definition) => definition.id);
    if (trainedArmor.length) {
      specs.push({
        kind: 'option',
        id: 'equipment.buy_armor',
        step: 'equipment',
        label: 'Comprar armadura com o ouro inicial',
        description: `Ouro inicial: ${gold} PO. Só armaduras em que a classe tem treino.`,
        source,
        options: purchase('equipment.buy_armor', trainedArmor),
      });
    }
    if (classDef.armor.includes('shield')) {
      specs.push({
        kind: 'option',
        id: 'equipment.buy_shield',
        step: 'equipment',
        label: 'Comprar escudo com o ouro inicial',
        source,
        options: purchase('equipment.buy_shield', ['shield']),
      });
    }
  }
  if (background) {
    specs.push({
      kind: 'option',
      id: 'equipment.background',
      step: 'equipment',
      label: `Equipamento do antecedente (${background.name})`,
      source: `Antecedente: ${background.name}`,
      options: background.equipment.map((option) => ({
        id: option.id,
        name: `Opção ${option.id}`,
        description: equipmentDescription(option),
      })),
    });
  }

  return specs;
}

// ---------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------

/** Valores base informados (ou `null` se algum faltar). */
export function baseAbilityScores(draft: Dnd5eDraft): Record<Ability, number> | null {
  const scores = {} as Record<Ability, number>;
  for (const ability of ABILITIES) {
    const value = draft.baseScores[ability];
    if (value === null || value === undefined) return null;
    scores[ability] = value;
  }
  return scores;
}

function applyIncrease(
  scores: Record<Ability, number>,
  increase: Partial<Record<Ability, number>>,
  cap: number,
) {
  for (const ability of ABILITIES) {
    const amount = increase[ability] ?? 0;
    if (amount > 0) scores[ability] = Math.min(cap, scores[ability] + amount);
  }
}

/** Aumentos de atributo concedidos por um talento escolhido. */
export function featIncrease(
  draft: Dnd5eDraft,
  feat: FeatInstance,
): { increase: Partial<Record<Ability, number>>; cap: number } {
  const definition = findFeat(feat.featId);
  if (!definition) return { increase: {}, cap: 20 };
  if (definition.id === 'ability_score_improvement')
    return { increase: selectionIncrease(draft, `${feat.specId}.increase`), cap: 20 };
  const ability = selectionText(draft, `${feat.specId}.ability`);
  if (!(ABILITIES as readonly string[]).includes(ability)) return { increase: {}, cap: 20 };
  if (definition.id === 'grappler') return { increase: { [ability]: 1 }, cap: 20 };
  if (definition.abilityIncrease?.includes(ability as Ability))
    return { increase: { [ability]: 1 }, cap: 20 };
  if (definition.category === 'epic') return { increase: { [ability]: 1 }, cap: 30 };
  return { increase: {}, cap: 20 };
}

/** Atributos antes do talento obtido no nível indicado (para pré-requisitos). */
export function abilityScoresBefore(
  draft: Dnd5eDraft,
  featLevel: number,
): Record<Ability, number> | null {
  const base = baseAbilityScores(draft);
  if (!base) return null;
  const scores = { ...base };
  applyIncrease(scores, selectionIncrease(draft, 'background.abilities'), 20);
  applyIncrease(scores, speciesIncrease(draft), 20);
  for (const feat of draftFeats(draft)) {
    if (feat.level >= featLevel) continue;
    const { increase, cap } = featIncrease(draft, feat);
    applyIncrease(scores, increase, cap);
  }
  return scores;
}

/** Atributos finais: base, antecedente, talentos e habilidades de 20º nível. */
export function finalAbilityScores(draft: Dnd5eDraft): Record<Ability, number> | null {
  const base = baseAbilityScores(draft);
  if (!base) return null;
  const scores = { ...base };
  applyIncrease(scores, selectionIncrease(draft, 'background.abilities'), 20);
  applyIncrease(scores, speciesIncrease(draft), 20);
  for (const feat of draftFeats(draft)) {
    const { increase, cap } = featIncrease(draft, feat);
    applyIncrease(scores, increase, cap);
  }
  const classDef = draftClass(draft);
  if (draft.level >= 20 && classDef?.id === 'barbarian')
    applyIncrease(scores, { str: 4, con: 4 }, 25);
  if (draft.level >= 20 && classDef?.id === 'monk') applyIncrease(scores, { dex: 4, wis: 4 }, 25);
  return scores;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export interface DraftIssue {
  /** Escolha (`ChoiceSpec.id`) ou campo do rascunho (`name`, `classId`, `baseScores`...). */
  path: string;
  step: Dnd5eStep;
  message: string;
}

const FIELD_STEPS: Record<string, Dnd5eStep> = {
  level: 'start',
  classId: 'class',
  backgroundId: 'background',
  speciesId: 'species',
  abilityMethod: 'abilities',
  baseScores: 'abilities',
  alignment: 'details',
  name: 'start',
};

function validateSpec(spec: ChoiceSpec, draft: Dnd5eDraft): string | null {
  switch (spec.kind) {
    case 'option': {
      const value = selectionText(draft, spec.id);
      if (!value) return 'Faça uma escolha.';
      const option = spec.options.find((entry) => entry.id === value);
      if (!option) return 'Escolha uma opção válida.';
      if (option.disabledReason) return `${option.name}: ${option.disabledReason}`;
      return null;
    }
    case 'multi':
    case 'spells': {
      const values = selectionList(draft, spec.id);
      if (new Set(values).size !== values.length) return 'Não repita opções.';
      for (const value of values) {
        const option = (spec.options as ChoiceOption[]).find((entry) => entry.id === value);
        if (!option) return `Opção inválida: ${value}.`;
        if (option.disabledReason) return `${option.name}: ${option.disabledReason}`;
      }
      if (values.length !== spec.count) {
        return spec.count === 1
          ? 'Escolha 1 opção.'
          : `Escolha ${spec.count} opções (${values.length} escolhidas).`;
      }
      return null;
    }
    case 'ability_increase': {
      const increase = selectionIncrease(draft, spec.id);
      const entries = ABILITIES.map((ability) => [ability, increase[ability] ?? 0] as const).filter(
        ([, amount]) => amount > 0,
      );
      if (entries.some(([ability]) => !spec.abilities.includes(ability)))
        return 'Aumente apenas os atributos permitidos.';
      const amounts = entries.map(([, amount]) => amount).sort((a, b) => b - a);
      if (spec.mode === 'background') {
        const valid =
          (amounts.length === 2 && amounts[0] === 2 && amounts[1] === 1) ||
          (amounts.length === 3 && amounts.every((amount) => amount === 1));
        return valid ? null : 'Escolha +2 e +1 em atributos diferentes, ou +1 nos três.';
      }
      const valid =
        (amounts.length === 1 && amounts[0] === 2) ||
        (amounts.length === 2 && amounts.every((amount) => amount === 1));
      return valid ? null : 'Escolha +2 em um atributo ou +1 em dois atributos.';
    }
  }
}

/** Confere o rascunho inteiro contra as regras do SRD e as da campanha. */
export function validateDnd5eDraft(draft: Dnd5eDraft, context: Dnd5eCreationContext): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const add = (path: string, message: string, step?: Dnd5eStep) => {
    if (!issues.some((issue) => issue.path === path))
      issues.push({ path, step: step ?? FIELD_STEPS[path] ?? 'review', message });
  };

  if (context.lockedLevel !== null && draft.level !== context.lockedLevel) {
    add('level', `O mestre definiu que os personagens começam no ${context.lockedLevel}º nível.`);
  }
  const classDef = draftClass(draft);
  if (!classDef) add('classId', 'Escolha uma classe.');
  if (!draftBackground(draft)) add('backgroundId', 'Escolha um antecedente.');
  if (!draftSpecies(draft)) add('speciesId', 'Escolha uma espécie.');
  if (!draft.name.trim()) add('name', 'Dê um nome ao personagem.');

  // Atributos base
  if (!context.abilityScoreMethods.includes(draft.abilityMethod)) {
    add('abilityMethod', 'O mestre não permite este método de atributos nesta campanha.');
  }
  const base = baseAbilityScores(draft);
  if (!base) add('baseScores', 'Defina os seis valores de atributo.');
  else {
    const values = ABILITIES.map((ability) => base[ability]);
    switch (draft.abilityMethod) {
      case 'standard_array': {
        const sorted = [...values].sort((a, b) => b - a);
        if (sorted.join(',') !== STANDARD_ARRAY.join(','))
          add(
            'baseScores',
            'Use cada valor do conjunto padrão (15, 14, 13, 12, 10, 8) uma única vez.',
          );
        break;
      }
      case 'point_buy': {
        if (values.some((value) => value < POINT_BUY_MIN || value > POINT_BUY_MAX))
          add(
            'baseScores',
            `Na compra de pontos, cada valor fica entre ${POINT_BUY_MIN} e ${POINT_BUY_MAX}.`,
          );
        else {
          const cost = pointBuyCost(base) ?? Infinity;
          if (cost > POINT_BUY_BUDGET)
            add('baseScores', `Você gastou ${cost} pontos; o limite é ${POINT_BUY_BUDGET}.`);
        }
        break;
      }
      case 'random':
        if (values.some((value) => value < RANDOM_SCORE_MIN || value > RANDOM_SCORE_MAX))
          add(
            'baseScores',
            `Cada rolagem de 4d6 (descartando o menor) fica entre ${RANDOM_SCORE_MIN} e ${RANDOM_SCORE_MAX}.`,
          );
        break;
    }
  }

  // Escolhas
  const specs = listDnd5eChoices(draft);
  for (const spec of specs) {
    const message = validateSpec(spec, draft);
    if (message) add(spec.id, message, spec.step);
  }

  // Perícias e idiomas repetidos entre origens diferentes
  const checkDuplicates = (grants: Grant[], noun: string, describe: (id: string) => string) => {
    const seen = new Map<string, Grant>();
    for (const grant of grants) {
      const previous = seen.get(grant.id);
      if (previous) {
        const culprit = grant.specId ? grant : previous.specId ? previous : null;
        if (culprit?.specId) {
          const other = culprit === grant ? previous : grant;
          const spec = specs.find((entry) => entry.id === culprit.specId);
          add(
            culprit.specId,
            `${describe(grant.id)} já vem de ${other.source}; escolha outra ${noun}.`,
            spec?.step,
          );
        }
      } else seen.set(grant.id, grant);
    }
  };
  checkDuplicates(skillGrants(draft), 'perícia', (id) => (isSkill(id) ? skillName(id) : id));
  checkDuplicates(languageGrants(draft), 'opção', languageName);
  checkDuplicates(toolGrants(draft), 'ferramenta', (id) => findTool(id)?.name ?? id);

  // Magias repetidas entre escolhas diferentes (as preparadas vêm do grimório do mago).
  const seenSpells = new Map<string, string>();
  for (const spec of specs) {
    if (spec.kind !== 'spells') continue;
    for (const name of selectionList(draft, spec.id)) {
      const previous = seenSpells.get(name);
      if (previous && previous !== spec.id && !spellOverlapAllowed(previous, spec.id)) {
        add(spec.id, `${name} já foi escolhida em outra opção de magia.`, 'spells');
      }
      if (!previous) seenSpells.set(name, spec.id);
    }
  }
  if (
    selectionList(draft, 'subclass.evocation_savant').filter(
      (name) => (findSrdSpell(name)?.level ?? 0) <= 2,
    ).length < Math.min(2, selectionList(draft, 'subclass.evocation_savant').length)
  ) {
    add(
      'subclass.evocation_savant',
      'As duas primeiras magias do Sábio da Evocação precisam ser de até 2º círculo.',
      'spells',
    );
  }

  // Talentos: repetição e listas do Iniciado em Magia
  const feats = draftFeats(draft);
  for (const feat of feats) {
    const definition = findFeat(feat.featId);
    if (!definition) continue;
    if (
      !definition.repeatable &&
      feats.filter((entry) => entry.featId === feat.featId).length > 1
    ) {
      add(feat.specId, `${definition.name} só pode ser obtido uma vez.`);
    }
    if (definition.id === 'magic_initiate' && !feat.fixedList) {
      const list = magicInitiateList(draft, feat);
      const repeated = feats.some(
        (other) =>
          other !== feat &&
          other.featId === 'magic_initiate' &&
          magicInitiateList(draft, other) === list,
      );
      if (list && repeated)
        add(
          `${feat.specId}.list`,
          'O Iniciado em Magia repetido precisa usar outra lista de magias.',
        );
    }
  }

  // Limites de atributo depois dos aumentos
  if (base) {
    const scores = { ...base };
    const background = selectionIncrease(draft, 'background.abilities');
    for (const ability of ABILITIES) {
      if ((background[ability] ?? 0) > 0 && scores[ability] + (background[ability] ?? 0) > 20) {
        add('background.abilities', `${abilityLabels[ability].name} passaria de 20.`, 'abilities');
      }
    }
    applyIncrease(scores, background, 20);
    for (const feat of feats) {
      const { increase, cap } = featIncrease(draft, feat);
      for (const ability of ABILITIES) {
        const amount = increase[ability] ?? 0;
        if (amount > 0 && scores[ability] + amount > cap)
          add(`${feat.specId}`, `${abilityLabels[ability].name} passaria de ${cap}.`, 'abilities');
      }
      applyIncrease(scores, increase, cap);
    }
  }

  // Alinhamento
  if (draft.alignment) {
    const alignment = ALIGNMENTS.find((entry) => entry.id === draft.alignment);
    if (!alignment) add('alignment', 'Escolha um alinhamento válido.');
    else if (alignment.evil && !context.allowEvilAlignments)
      add('alignment', 'O mestre não liberou alinhamentos malignos nesta campanha.');
  } else add('alignment', 'Escolha um alinhamento.');

  return issues;
}

/** Passos que ainda têm pendências (para habilitar o botão "Próximo"). */
export function issuesByStep(issues: readonly DraftIssue[]): Map<Dnd5eStep, DraftIssue[]> {
  const result = new Map<Dnd5eStep, DraftIssue[]>();
  for (const issue of issues) result.set(issue.step, [...(result.get(issue.step) ?? []), issue]);
  return result;
}

/** Itens do catálogo para exibir nomes de ferramentas, armas etc. */
export function catalogItemName(id: string): string {
  return SRD_ITEMS[id]?.name ?? findTool(id)?.name ?? id;
}
