/**
 * Subida de nível pelas regras do SRD 5.2.1: o que muda ao ganhar um nível numa classe (pontos
 * de vida, habilidades novas, subclasse, aumento de atributo ou talento, magias novas e os
 * recursos recalculados), inclusive o primeiro nível numa classe nova (multiclasse). A tela
 * mostra o plano; a ficha aplica as escolhas.
 */
import type { AbilityEntryTemplate, ResourceTemplate } from '../types';
import { ABILITIES, abilityLabels, abilityModifier, type Ability } from './abilities';
import { hasFightingStyleFeature, maxClassSpellLevel } from './creation/choices';
import { proficiencyBonusForLevel } from './progression';
import { spellSchoolLabels } from './entries';
import { hitDiceResourceKey, spellSlotResources } from './resources';
import type { Dnd5eClass, Dnd5eSheet } from './sheet';
import { SKILLS, skillDefinitions, type Skill } from './skills';
import {
  SRD_INVOCATIONS,
  SRD_METAMAGIC,
  type InvocationDefinition,
  type MetamagicDefinition,
} from './srd/class-options';
import {
  SORCERER_METAMAGIC,
  WARLOCK_INVOCATIONS,
  WARLOCK_PACT_SLOTS,
  WARLOCK_SLOT_LEVEL,
  atLevel,
  listClasses,
  listSubclasses,
} from './srd/classes';
import { MUSICAL_INSTRUMENTS } from './srd/equipment';
import { findFeat, listFeats } from './srd/feats';
import { findSpell, listSpells } from './srd/spells';
import type { BookSpell } from './books/active';
import type {
  ClassDefinition,
  ClassId,
  FeatDefinition,
  FeatureDefinition,
  ResourceDefinition,
  SrdSpell,
  SubclassDefinition,
} from './srd/types';

const HIT_DIE_SIDES = { d6: 6, d8: 8, d10: 10, d12: 12 } as const;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Classe (do SRD ou de um livro liberado) pelo nome gravado na ficha ("Mago", "Artífice"). */
export function findClassByName(name: string): ClassDefinition | undefined {
  const target = normalize(name);
  return listClasses().find((entry) => normalize(entry.name) === target);
}

// --------------------------------------------------------------------------- Multiclasse

/** Valor mínimo nos atributos principais para entrar numa classe nova (e para sair das atuais). */
export const MULTICLASS_MIN_SCORE = 13;
export const MAX_CLASSES = 4;

/** O que a classe nova dá a quem já tem outra classe ("como personagem multiclasse", SRD 5.2.1). */
export interface MulticlassTraining {
  armor: string;
  weapons: string;
  tools: string;
  /** Uma perícia à escolha: da lista da classe ou qualquer uma. */
  skill: 'class' | 'any' | null;
  /** Um instrumento musical à escolha (bardo). */
  instrument: boolean;
}

const training = (fields: Partial<MulticlassTraining>): MulticlassTraining => ({
  armor: '',
  weapons: '',
  tools: '',
  skill: null,
  instrument: false,
  ...fields,
});

export const MULTICLASS_TRAINING: Record<ClassId, MulticlassTraining> &
  Partial<Record<string, MulticlassTraining>> = {
  barbarian: training({ armor: 'Escudos', weapons: 'Armas marciais' }),
  bard: training({ armor: 'Armaduras leves', skill: 'any', instrument: true }),
  cleric: training({ armor: 'Armaduras leves e médias, escudos' }),
  druid: training({ armor: 'Armaduras leves, escudos' }),
  fighter: training({ armor: 'Armaduras leves e médias, escudos', weapons: 'Armas marciais' }),
  monk: training({}),
  paladin: training({ armor: 'Armaduras leves e médias, escudos', weapons: 'Armas marciais' }),
  ranger: training({
    armor: 'Armaduras leves e médias, escudos',
    weapons: 'Armas marciais',
    skill: 'class',
  }),
  rogue: training({ armor: 'Armaduras leves', tools: 'Ferramentas de ladrão', skill: 'class' }),
  sorcerer: training({}),
  warlock: training({ armor: 'Armaduras leves' }),
  wizard: training({}),
};

/** Atributos abaixo de 13. "Força ou Destreza": basta um; "Destreza e Sabedoria": os dois. */
function missingPrimary(classDef: ClassDefinition, scores: Record<Ability, number>): Ability[] {
  const below = classDef.primaryAbilities.filter(
    (ability) => scores[ability] < MULTICLASS_MIN_SCORE,
  );
  const anyOf = classDef.primaryAbilityLabel.includes(' ou ');
  return anyOf && below.length < classDef.primaryAbilities.length ? [] : below;
}

function describeMissing(
  classDef: ClassDefinition,
  missing: readonly Ability[],
  scores: Record<Ability, number>,
): string {
  const joiner = classDef.primaryAbilityLabel.includes(' ou ') ? ' ou ' : ' e ';
  return missing
    .map(
      (ability) =>
        `${abilityLabels[ability].name} ${MULTICLASS_MIN_SCORE} (tem ${scores[ability]})`,
    )
    .join(joiner);
}

export interface MulticlassOption {
  classDef: ClassDefinition;
  /** O que impede a multiclasse; vazio = pode entrar. */
  blocked: string[];
}

/** Classes do SRD que o personagem ainda não tem, com o que falta para entrar em cada uma. */
export function dnd5eMulticlassOptions(sheet: Dnd5eSheet): MulticlassOption[] {
  const current = sheet.identity.classes.map((entry) => findClassByName(entry.name));
  const totalLevel = sheet.identity.classes.reduce((sum, entry) => sum + entry.level, 0);
  const general: string[] = [];
  if (sheet.identity.classes.length >= MAX_CLASSES)
    general.push(`A ficha já tem ${MAX_CLASSES} classes.`);
  if (totalLevel >= 20) general.push('O personagem já está no 20º nível.');
  for (const classDef of current) {
    const missing = classDef ? missingPrimary(classDef, sheet.abilities) : [];
    if (classDef && missing.length)
      general.push(
        `Para sair de ${classDef.name}: ${describeMissing(classDef, missing, sheet.abilities)}.`,
      );
  }
  return listClasses()
    .filter((classDef) => !current.some((entry) => entry?.id === classDef.id))
    .map((classDef) => {
      const missing = missingPrimary(classDef, sheet.abilities);
      return {
        classDef,
        blocked: [
          ...general,
          ...(missing.length
            ? [`Exige ${describeMissing(classDef, missing, sheet.abilities)}.`]
            : []),
        ],
      };
    });
}

export interface Dnd5eMulticlassPlan {
  training: MulticlassTraining;
  /** Perícias para escolher (vazio se a classe não dá perícia). */
  skillOptions: Skill[];
  /** Instrumentos para escolher (bardo). */
  instrumentOptions: { id: string; name: string }[];
  /** O que impede a multiclasse (pré-requisitos); vazio = pode aplicar. */
  blocked: string[];
}

export interface Dnd5eLevelUpPlan {
  /** Classes consideradas pelo plano (na multiclasse, a classe nova entra no fim, em nível 0). */
  classes: Dnd5eClass[];
  classIndex: number;
  className: string;
  classDef: ClassDefinition | null;
  newClassLevel: number;
  newTotalLevel: number;
  hitDieSides: number;
  /** Vida média do nível (metade do dado + 1, mais a Constituição; mínimo 1). */
  averageHp: number;
  conModifier: number;
  features: FeatureDefinition[];
  /** Subclasse que entra neste nível quando só há uma opção; `null` se não houver ou se for preciso escolher. */
  subclass: SubclassDefinition | null;
  /** Subclasses para escolher neste nível (SRD e livros liberados); vazio se não houver escolha. */
  subclassOptions: SubclassDefinition[];
  /** Subclasse que o personagem já tem (para as magias sempre preparadas do novo nível). */
  currentSubclass: SubclassDefinition | null;
  /** Nível com Aumento no Valor de Atributo (ou talento). */
  abilityScoreImprovement: boolean;
  /** 19º nível: Dádiva Épica (os talentos épicos entram nas opções). */
  epicBoon: boolean;
  feats: FeatDefinition[];
  newCantrips: number;
  newSpells: number;
  maxSpellCircle: number;
  spellOptions: BookSpell[];
  cantripOptions: BookSpell[];
  /** Invocações Místicas novas (bruxo) e as opções liberadas até o novo nível. */
  newInvocations: number;
  invocationOptions: InvocationDefinition[];
  /** Opções de Metamagia novas (feiticeiro). */
  newMetamagic: number;
  metamagicOptions: MetamagicDefinition[];
  /** Armas com maestria a mais. */
  newWeaponMasteries: number;
  /** Recursos da classe com os máximos do novo nível (atualizam ou criam trilhas). */
  resources: ResourceTemplate[];
  /** Primeiro nível numa classe nova; `null` ao subir numa classe que o personagem já tem. */
  multiclass: Dnd5eMulticlassPlan | null;
}

function resourceFrom(
  definition: ResourceDefinition,
  context: Parameters<ResourceDefinition['max']>[0],
  sortOrder: number,
): ResourceTemplate | null {
  const max = definition.max(context);
  if (max === null || max <= 0) return null;
  return {
    key: definition.key,
    label: definition.label,
    current: max,
    max,
    recovery: definition.recovery,
    display: definition.display,
    sortOrder,
  };
}

/**
 * Plano do próximo nível na classe `classIndex` da ficha ou, com `newClassId`, do primeiro nível
 * numa classe nova (multiclasse). `knownNames` são os nomes das entradas que o personagem já tem
 * (magias, talentos, invocações), para não oferecer de novo.
 */
export function planDnd5eLevelUp(
  sheet: Dnd5eSheet,
  classIndex: number,
  knownNames: readonly string[] = [],
  newClassId?: string,
): Dnd5eLevelUpPlan {
  const newClass = newClassId ? listClasses().find((entry) => entry.id === newClassId) : undefined;
  const classes: Dnd5eClass[] = newClass
    ? [
        ...sheet.identity.classes,
        { name: newClass.name, subclass: '', level: 0, hitDie: newClass.hitDie },
      ]
    : sheet.identity.classes;
  const index = newClass ? classes.length - 1 : classes[classIndex] ? classIndex : 0;
  const entry = classes[index];
  const classDef = newClass ?? (entry ? (findClassByName(entry.name) ?? null) : null);
  const oldLevel = entry?.level ?? 0;
  const newClassLevel = Math.min(20, oldLevel + 1);
  const newTotalLevel = Math.min(20, classes.reduce((total, item) => total + item.level, 0) + 1);
  const hitDieSides = HIT_DIE_SIDES[classDef?.hitDie ?? entry?.hitDie ?? 'd8'];
  const conModifier = abilityModifier(sheet.abilities.con);
  const averageHp = Math.max(1, Math.floor(hitDieSides / 2) + 1 + conModifier);

  const subclasses = classDef ? listSubclasses(classDef) : [];
  const subclassChosen = Boolean(entry?.subclass.trim());
  const currentSubclass = subclassChosen
    ? subclasses.find((option) => normalize(option.name) === normalize(entry?.subclass ?? ''))
    : undefined;
  // A subclasse chega no 3º nível (ou no primeiro nível depois dele, se ainda não foi escolhida).
  const subclassArrives = Boolean(
    classDef && !subclassChosen && newClassLevel >= 3 && subclasses.length > 0,
  );
  const singleSubclass = subclassArrives && subclasses.length === 1 ? subclasses[0]! : null;
  const subclassFeatures = currentSubclass
    ? currentSubclass.features.filter((feature) => feature.level === newClassLevel)
    : singleSubclass
      ? singleSubclass.features.filter((feature) => feature.level <= newClassLevel)
      : [];
  const features = [
    ...(classDef?.features.filter((feature) => feature.level === newClassLevel) ?? []),
    ...subclassFeatures,
  ];

  const known = new Set(knownNames.map(normalize));
  // No 19º nível toda classe ganha uma Dádiva Épica (ou outro talento em que se qualifique).
  const epicBoon = Boolean(classDef) && newClassLevel === 19;
  const abilityScoreImprovement = Boolean(classDef?.asiLevels.includes(newClassLevel)) || epicBoon;
  const qualifies = (feat: FeatDefinition) =>
    (feat.minLevel ?? 0) <= newTotalLevel &&
    (!feat.minScore ||
      feat.minScore.abilities.some(
        (ability) => sheet.abilities[ability] >= (feat.minScore?.value ?? 0),
      )) &&
    (feat.repeatable || !known.has(normalize(feat.name)));
  // Regras de 2024: no aumento de atributo vale qualquer talento em que o personagem se qualifique
  // (gerais, de origem, de estilo de luta para quem tem Estilo de Luta e, no 19º, dádivas épicas),
  // inclusive os dos livros liberados.
  const hasFightingStyle = classes.some((item, position) =>
    hasFightingStyleFeature(
      (position === index ? classDef : findClassByName(item.name)) ?? undefined,
      position === index ? newClassLevel : item.level,
    ),
  );
  const featOrder: FeatDefinition['category'][] = ['general', 'origin', 'fighting_style', 'epic'];
  const feats = abilityScoreImprovement
    ? listFeats()
        .filter(
          (feat) =>
            (feat.category === 'general' ||
              feat.category === 'origin' ||
              (hasFightingStyle && feat.category === 'fighting_style') ||
              (epicBoon && feat.category === 'epic')) &&
            qualifies(feat),
        )
        .sort((a, b) => featOrder.indexOf(a.category) - featOrder.indexOf(b.category))
    : [];

  const casting = classDef?.spellcasting;
  // Na classe nova (nível 0 → 1), tudo o que o 1º nível dá é novo.
  const before = (table: readonly number[]) => (oldLevel > 0 ? atLevel(table, oldLevel) : 0);
  let newCantrips = 0;
  let newSpells = 0;
  if (casting) {
    newCantrips = casting.cantrips
      ? Math.max(0, atLevel(casting.cantrips, newClassLevel) - before(casting.cantrips))
      : 0;
    newSpells = Math.max(0, atLevel(casting.prepared, newClassLevel) - before(casting.prepared));
    // Mago: o grimório começa com 6 magias e ganha 2 a cada nível, além das que passa a preparar.
    if (casting.spellbook) newSpells = Math.max(newSpells, oldLevel > 0 ? 2 : 6);
  }
  const maxSpellCircle = maxClassSpellLevel(classDef ?? undefined, newClassLevel);
  const gained = (table: readonly number[] | undefined) =>
    table ? Math.max(0, atLevel(table, newClassLevel) - before(table)) : 0;
  // Espaços de magia pelo nível de conjurador somado (multiclasse do SRD 5.2.1): níveis inteiros
  // dos conjuradores completos e metade, arredondada para cima, de paladino e patrulheiro.
  const casterLevel = classes.reduce((sum, item, position) => {
    const definition = position === index ? classDef : findClassByName(item.name);
    const level = position === index ? newClassLevel : item.level;
    const progression = definition?.spellcasting?.progression;
    return (
      sum + (progression === 'full' ? level : progression === 'half' ? Math.ceil(level / 2) : 0)
    );
  }, 0);
  const newInvocations = classDef?.id === 'warlock' ? gained(WARLOCK_INVOCATIONS) : 0;
  const newMetamagic = classDef?.id === 'sorcerer' ? gained(SORCERER_METAMAGIC) : 0;
  const newWeaponMasteries = gained(classDef?.weaponMastery);
  const fromList = casting
    ? listSpells().filter(
        (spell) => spell.classes.includes(casting.list) && !known.has(normalize(spell.name)),
      )
    : [];

  const resources: ResourceTemplate[] = [];
  if (classDef) {
    const modifiers = Object.fromEntries(
      ABILITIES.map((ability) => [ability, abilityModifier(sheet.abilities[ability])]),
    ) as Record<Ability, number>;
    const context = {
      level: newClassLevel,
      proficiencyBonus: proficiencyBonusForLevel(newTotalLevel),
      modifiers,
    };
    classDef.resources.forEach((definition, position) => {
      const resource = resourceFrom(definition, context, 100 + position);
      if (resource) resources.push(resource);
    });
    const resourceSubclass = currentSubclass ?? singleSubclass;
    if (resourceSubclass) {
      (resourceSubclass.resources ?? []).forEach((definition, position) => {
        const resource = resourceFrom(definition, context, 120 + position);
        if (resource) resources.push(resource);
      });
    }
    if (casting && casting.progression !== 'pact' && casterLevel > 0)
      resources.push(...spellSlotResources(casterLevel));
    if (casting?.progression === 'pact') {
      const slots = atLevel(WARLOCK_PACT_SLOTS, newClassLevel);
      resources.push({
        key: 'pact_slots',
        label: `Espaços de pacto (${atLevel(WARLOCK_SLOT_LEVEL, newClassLevel)}º círculo)`,
        current: slots,
        max: slots,
        recovery: 'short_rest',
        display: 'pool',
        sortOrder: 40,
      });
    }
  }

  let multiclass: Dnd5eMulticlassPlan | null = null;
  if (newClass) {
    // Classes de livro sem tabela própria: as armaduras da classe (o texto do livro detalha o resto).
    const trained =
      MULTICLASS_TRAINING[newClass.id] ??
      training({ armor: newClass.armor.length ? newClass.armorLabel : '' });
    const classSkills =
      newClass.skillChoices.options === 'any' ? SKILLS : newClass.skillChoices.options;
    const pool = trained.skill === 'any' ? SKILLS : trained.skill === 'class' ? classSkills : [];
    multiclass = {
      training: trained,
      skillOptions: pool.filter(
        (skill) =>
          sheet.skills[skill].proficiency === 'none' || sheet.skills[skill].proficiency === 'half',
      ),
      instrumentOptions: trained.instrument
        ? MUSICAL_INSTRUMENTS.map((instrument) => ({ id: instrument.id, name: instrument.name }))
        : [],
      blocked: dnd5eMulticlassOptions(sheet).find((option) => option.classDef.id === newClass.id)
        ?.blocked ?? ['O personagem já tem esta classe.'],
    };
  }

  return {
    classes,
    classIndex: index,
    className: entry?.name ?? '',
    classDef,
    newClassLevel,
    newTotalLevel,
    hitDieSides,
    averageHp,
    conModifier,
    features,
    subclass: singleSubclass,
    currentSubclass: currentSubclass ?? null,
    subclassOptions: subclassArrives && !singleSubclass ? subclasses : [],
    abilityScoreImprovement,
    epicBoon,
    feats,
    newCantrips,
    newSpells,
    maxSpellCircle,
    spellOptions: fromList.filter((spell) => spell.level > 0 && spell.level <= maxSpellCircle),
    cantripOptions: fromList.filter((spell) => spell.level === 0),
    newInvocations,
    invocationOptions:
      newInvocations > 0
        ? SRD_INVOCATIONS.filter(
            (invocation) =>
              invocation.minLevel <= newClassLevel && !known.has(normalize(invocation.name)),
          )
        : [],
    newMetamagic,
    metamagicOptions:
      newMetamagic > 0 ? SRD_METAMAGIC.filter((option) => !known.has(normalize(option.name))) : [],
    newWeaponMasteries,
    resources,
    multiclass,
  };
}

/** Vida ganha com o dado rolado (ou a média), somando a Constituição; mínimo 1. */
export function hitPointsGained(dieResult: number, conModifier: number): number {
  return Math.max(1, dieResult + conModifier);
}

export type AbilityImprovement =
  | { kind: 'plus_two'; ability: Ability }
  | { kind: 'plus_one_each'; abilities: [Ability, Ability] }
  | { kind: 'feat'; featId: string; ability?: Ability };

/** Atributos que um talento aumenta em 1 (Agarrador: Força ou Destreza; dádivas épicas: qualquer um). */
export function featAbilityIncrease(
  featId: string,
): { abilities: readonly Ability[]; cap: number } | null {
  const feat = findFeat(featId);
  if (!feat) return null;
  if (feat.id === 'grappler') return { abilities: ['str', 'dex'], cap: 20 };
  if (feat.abilityIncrease?.length) return { abilities: feat.abilityIncrease, cap: 20 };
  if (feat.category === 'epic') return { abilities: ABILITIES, cap: 30 };
  return null;
}

/** Aplica o aumento de atributo (máximo 20; 30 nas dádivas épicas). */
export function applyAbilityImprovement(
  scores: Record<Ability, number>,
  choice: AbilityImprovement,
): Record<Ability, number> {
  const next = { ...scores };
  if (choice.kind === 'plus_two') next[choice.ability] = Math.min(20, next[choice.ability] + 2);
  if (choice.kind === 'plus_one_each')
    for (const ability of choice.abilities) next[ability] = Math.min(20, next[ability] + 1);
  if (choice.kind === 'feat' && choice.ability) {
    const increase = featAbilityIncrease(choice.featId);
    if (increase?.abilities.includes(choice.ability))
      next[choice.ability] = Math.min(increase.cap, next[choice.ability] + 1);
  }
  return next;
}

export interface Dnd5eLevelUpChoices {
  /** Vida: a média fixa ou o resultado do dado rolado (sem a Constituição). */
  hitPoints: { method: 'average' } | { method: 'roll'; die: number };
  improvement: AbilityImprovement | null;
  cantrips: readonly string[];
  spells: readonly string[];
  invocations: readonly string[];
  metamagic: readonly string[];
  /** Multiclasse: perícia e instrumento escolhidos, quando a classe nova dá. */
  multiclassSkill?: Skill;
  multiclassInstrument?: string;
  /** Talento Habilidoso: as 3 perícias. */
  featSkills?: readonly Skill[];
  /** Talento Iniciado em Magia: lista, 2 truques, 1 magia de 1º círculo e o atributo de conjuração. */
  magicInitiate?: MagicInitiateChoice;
  /** Subclasse escolhida quando o plano oferece mais de uma. */
  subclassId?: string;
}

export const MAGIC_INITIATE_LISTS = ['cleric', 'druid', 'wizard'] as const;
export type MagicInitiateList = (typeof MAGIC_INITIATE_LISTS)[number];
export const magicInitiateListLabels: Record<MagicInitiateList, string> = {
  cleric: 'Clérigo',
  druid: 'Druida',
  wizard: 'Mago',
};

export interface MagicInitiateChoice {
  list: MagicInitiateList | '';
  cantrips: readonly string[];
  spell: string;
  ability: 'int' | 'wis' | 'cha' | '';
}

/** Truques e magias de 1º círculo da lista do Iniciado em Magia, sem as que o personagem já tem. */
export function magicInitiateOptions(
  list: MagicInitiateList,
  knownNames: readonly string[] = [],
): { cantrips: SrdSpell[]; spells: SrdSpell[] } {
  const known = new Set(knownNames.map(normalize));
  const fromList = listSpells().filter(
    (spell) => spell.classes.includes(list) && !known.has(normalize(spell.name)),
  );
  return {
    cantrips: fromList.filter((spell) => spell.level === 0),
    spells: fromList.filter((spell) => spell.level === 1),
  };
}

/** Perícias que o talento Habilidoso pode dar (as que o personagem ainda não domina). */
export function skilledFeatOptions(sheet: Dnd5eSheet): Skill[] {
  return SKILLS.filter(
    (skill) =>
      sheet.skills[skill].proficiency === 'none' || sheet.skills[skill].proficiency === 'half',
  );
}

/** Acrescenta um treinamento ao texto das proficiências, sem repetir o que já está lá. */
function addProficiency(current: string, addition: string): string {
  if (!addition || current.toLowerCase().includes(addition.toLowerCase())) return current;
  return (current.trim() ? `${current.trim()}; ${addition}` : addition).slice(0, 300);
}

export interface Dnd5eLevelUpResult {
  sheet: Dnd5eSheet;
  /** Quanto o máximo de PV sobe (inclui o efeito retroativo de mais Constituição). */
  hitPointsGained: number;
  /** Trilhas a atualizar (pela chave) ou criar. A vida sobe à parte. */
  resources: ResourceTemplate[];
  abilities: AbilityEntryTemplate[];
  /** Escolhas que faltam (vazio = pode aplicar). */
  issues: string[];
  summary: string;
}

function spellEntry(spell: BookSpell, source: string, sortOrder: number): AbilityEntryTemplate {
  const header = `${spell.level === 0 ? 'Truque' : `${spell.level}º círculo`} de ${spellSchoolLabels[spell.school].toLowerCase()}.`;
  return {
    kind: 'spell',
    name: spell.name.slice(0, 120),
    source: `${source} · ${spell.book?.name ?? 'SRD 5.2.1'}`.slice(0, 120),
    description: [header, ...(spell.description ?? [])].join('\n\n').slice(0, 8000),
    data: {
      circle: spell.level,
      school: spell.school,
      castingTime: spell.castingTime,
      range: spell.range,
      components: spell.components,
      duration: spell.duration,
      concentration: Boolean(spell.concentration),
      ritual: Boolean(spell.ritual),
      prepared: true,
    },
    sortOrder,
  };
}

const ABILITY_SHORT: Record<Ability, string> = {
  str: 'FOR',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAB',
  cha: 'CAR',
};

/** Monta a ficha do novo nível com as escolhas feitas no painel. */
export function applyDnd5eLevelUp(
  sheet: Dnd5eSheet,
  plan: Dnd5eLevelUpPlan,
  choices: Dnd5eLevelUpChoices,
): Dnd5eLevelUpResult {
  const issues: string[] = [];
  const pick = (count: number, chosen: readonly string[], singular: string, plural: string) => {
    if (chosen.length < count)
      issues.push(
        `Escolha ${count} ${count === 1 ? singular : plural} (faltam ${count - chosen.length}).`,
      );
    if (chosen.length > count)
      issues.push(`Escolha no máximo ${count} ${count === 1 ? singular : plural}.`);
  };
  pick(plan.newCantrips, choices.cantrips, 'truque', 'truques');
  pick(plan.newSpells, choices.spells, 'magia', 'magias');
  pick(plan.newInvocations, choices.invocations, 'invocação', 'invocações');
  pick(plan.newMetamagic, choices.metamagic, 'opção de Metamagia', 'opções de Metamagia');
  if (plan.abilityScoreImprovement && !choices.improvement)
    issues.push('Escolha o aumento de atributo ou um talento.');
  if (
    choices.improvement?.kind === 'plus_one_each' &&
    choices.improvement.abilities[0] === choices.improvement.abilities[1]
  ) {
    issues.push('Escolha dois atributos diferentes (ou +2 em um só).');
  }
  if (
    choices.improvement?.kind === 'feat' &&
    featAbilityIncrease(choices.improvement.featId) &&
    !choices.improvement.ability
  ) {
    issues.push('Escolha o atributo que o talento aumenta.');
  }
  if (
    choices.hitPoints.method === 'roll' &&
    (choices.hitPoints.die < 1 || choices.hitPoints.die > plan.hitDieSides)
  )
    issues.push('Role o dado de vida.');
  // Talentos com escolhas próprias.
  const chosenFeatId =
    plan.abilityScoreImprovement && choices.improvement?.kind === 'feat'
      ? choices.improvement.featId
      : '';
  const skilledOptions = skilledFeatOptions(sheet);
  const featSkills =
    chosenFeatId === 'skilled'
      ? [...new Set(choices.featSkills ?? [])].filter((skill) => skilledOptions.includes(skill))
      : [];
  if (chosenFeatId === 'skilled' && featSkills.length !== 3)
    issues.push('Escolha as 3 perícias do talento Habilidoso.');
  const initiate = chosenFeatId === 'magic_initiate' ? choices.magicInitiate : undefined;
  let initiateSpells: SrdSpell[] = [];
  if (chosenFeatId === 'magic_initiate') {
    if (!initiate?.list) issues.push('Escolha a lista do Iniciado em Magia.');
    else {
      const options = magicInitiateOptions(initiate.list);
      const cantrips = options.cantrips.filter((spell) => initiate.cantrips.includes(spell.name));
      const spell = options.spells.find((entry) => entry.name === initiate.spell);
      if (cantrips.length !== 2) issues.push('Escolha 2 truques do Iniciado em Magia.');
      if (!spell) issues.push('Escolha a magia de 1º círculo do Iniciado em Magia.');
      initiateSpells = [...cantrips, ...(spell ? [spell] : [])];
    }
    if (!initiate?.ability) issues.push('Escolha o atributo de conjuração do Iniciado em Magia.');
  }
  const multiclass = plan.multiclass;
  const multiclassSkill =
    multiclass &&
    choices.multiclassSkill &&
    multiclass.skillOptions.includes(choices.multiclassSkill)
      ? choices.multiclassSkill
      : null;
  const instrument =
    multiclass?.instrumentOptions.find((option) => option.id === choices.multiclassInstrument) ??
    null;
  if (multiclass) {
    issues.push(...multiclass.blocked);
    if (multiclass.skillOptions.length > 0 && !multiclassSkill)
      issues.push('Escolha a perícia que a nova classe dá.');
    if (multiclass.instrumentOptions.length > 0 && !instrument)
      issues.push('Escolha o instrumento musical.');
  }
  const chosenSubclass =
    plan.subclass ??
    plan.subclassOptions.find((option) => option.id === choices.subclassId) ??
    null;
  if (plan.subclassOptions.length > 0 && !chosenSubclass) issues.push('Escolha a subclasse.');

  const improvement = plan.abilityScoreImprovement ? choices.improvement : null;
  const abilities = improvement
    ? applyAbilityImprovement(sheet.abilities, improvement)
    : { ...sheet.abilities };
  const conChange = abilityModifier(abilities.con) - abilityModifier(sheet.abilities.con);
  const die =
    choices.hitPoints.method === 'roll'
      ? choices.hitPoints.die
      : Math.floor(plan.hitDieSides / 2) + 1;
  // Constituição maior aumenta o máximo de PV também nos níveis anteriores.
  // Extras por nível: anão (Tenacidade Anã) e feiticeiro dracônico ganham +1 por nível; o
  // talento Robusto escolhido agora vale +2 por nível de personagem, retroativo.
  const sorcererDraconic =
    plan.classDef?.id === 'sorcerer' &&
    /drac|dragon/i.test((chosenSubclass ?? plan.currentSubclass)?.name ?? '');
  const toughNow = /\b(tough|robusto)\b/i.test(
    `${chosenFeatId} ${findFeat(chosenFeatId)?.name ?? ''}`,
  );
  const extraHp =
    (/an[aã]o|dwarf/i.test(sheet.identity.species) ? 1 : 0) +
    (sorcererDraconic
      ? plan.newClassLevel === 3 && !plan.currentSubclass
        ? 3
        : plan.newClassLevel > 3
          ? 1
          : 0
      : 0) +
    (toughNow ? 2 * plan.newTotalLevel : 0);
  const hpGain = Math.max(
    1,
    hitPointsGained(die, abilityModifier(abilities.con)) +
      conChange * (plan.newTotalLevel - 1) +
      extraHp,
  );

  const classes = plan.classes.map((entry, position) =>
    position === plan.classIndex
      ? {
          ...entry,
          level: plan.newClassLevel,
          subclass: chosenSubclass ? chosenSubclass.name : entry.subclass,
        }
      : entry,
  );
  let nextSheet: Dnd5eSheet = { ...sheet, abilities, identity: { ...sheet.identity, classes } };
  if (multiclass) {
    // Treinamentos da classe nova (sem os testes de resistência, que ficam os da primeira classe).
    nextSheet = {
      ...nextSheet,
      proficiencies: {
        ...nextSheet.proficiencies,
        armor: addProficiency(nextSheet.proficiencies.armor, multiclass.training.armor),
        weapons: addProficiency(nextSheet.proficiencies.weapons, multiclass.training.weapons),
        tools: addProficiency(
          nextSheet.proficiencies.tools,
          [multiclass.training.tools, instrument?.name ?? ''].filter(Boolean).join(', '),
        ),
      },
      skills: multiclassSkill
        ? {
            ...nextSheet.skills,
            [multiclassSkill]: { ...nextSheet.skills[multiclassSkill], proficiency: 'proficient' },
          }
        : nextSheet.skills,
    };
  }

  if (featSkills.length === 3) {
    nextSheet = {
      ...nextSheet,
      skills: {
        ...nextSheet.skills,
        ...Object.fromEntries(
          featSkills.map((skill) => [
            skill,
            { ...nextSheet.skills[skill], proficiency: 'proficient' },
          ]),
        ),
      },
    };
  }

  const resources = [...plan.resources];
  if (chosenSubclass && !plan.subclass) {
    const modifiers = Object.fromEntries(
      ABILITIES.map((ability) => [ability, abilityModifier(abilities[ability])]),
    ) as Record<Ability, number>;
    const context = {
      level: plan.newClassLevel,
      proficiencyBonus: proficiencyBonusForLevel(plan.newTotalLevel),
      modifiers,
    };
    (chosenSubclass.resources ?? []).forEach((definition, position) => {
      const resource = resourceFrom(definition, context, 120 + position);
      if (resource) resources.push(resource);
    });
  }
  const hitDie = plan.classes[plan.classIndex]?.hitDie ?? plan.classDef?.hitDie ?? 'd8';
  const hitDice = classes
    .filter((entry) => entry.hitDie === hitDie)
    .reduce((sum, entry) => sum + entry.level, 0);
  resources.push({
    key: hitDiceResourceKey(hitDie),
    label: `Dados de vida (${hitDie})`,
    current: hitDice,
    max: hitDice,
    recovery: 'long_rest',
    display: 'pool',
    sortOrder: 10,
  });

  const entries: AbilityEntryTemplate[] = [];
  let order = 500;
  const className = plan.classDef?.name ?? plan.className;
  const levelSource = `${className} ${plan.newClassLevel}º nível`;
  // Habilidades da subclasse escolhida agora (até o novo nível) e o dono de cada habilidade.
  const chosenFeatures =
    chosenSubclass && !plan.subclass
      ? chosenSubclass.features.filter((feature) => feature.level <= plan.newClassLevel)
      : [];
  const owners = new Map<FeatureDefinition, string>();
  for (const option of [chosenSubclass, ...(plan.classDef ? listSubclasses(plan.classDef) : [])]) {
    for (const feature of option?.features ?? [])
      if (!owners.has(feature)) owners.set(feature, option!.name);
  }
  for (const feature of [...plan.features, ...chosenFeatures]) {
    const owner = owners.get(feature) ?? className;
    entries.push({
      kind: 'class_feature',
      name: feature.name,
      source: `${owner} ${feature.level}º nível`,
      description: feature.description.slice(0, 8000),
      data: {},
      ...(feature.resourceKey ? { resourceKey: feature.resourceKey } : {}),
      sortOrder: order++,
    });
  }
  if (improvement?.kind === 'feat') {
    const feat = findFeat(improvement.featId);
    if (feat) {
      const listLabel = initiate?.list ? magicInitiateListLabels[initiate.list] : '';
      const extra = [
        improvement.ability ? `Atributo aumentado: ${ABILITY_SHORT[improvement.ability]} +1.` : '',
        featSkills.length
          ? `Perícias: ${featSkills.map((skill) => skillDefinitions[skill].label).join(', ')}.`
          : '',
        listLabel ? `Lista: ${listLabel}.` : '',
        initiate?.ability ? `Atributo de conjuração: ${abilityLabels[initiate.ability].name}.` : '',
      ].filter(Boolean);
      entries.push({
        kind: 'feat',
        name: listLabel ? `${feat.name} (${listLabel})` : feat.name,
        source: levelSource,
        description: [feat.description, ...extra].join(' '),
        data: {},
        sortOrder: order++,
      });
      if (initiate?.list) {
        const source = `Iniciado em Magia (${listLabel})`;
        for (const spell of initiateSpells) {
          const entry = spellEntry(spell, source, order++);
          if (spell.level > 0) {
            // A magia de 1º círculo pode ser conjurada 1 vez sem espaço por descanso longo.
            const key = `feat_magic_initiate_${initiate.list}`;
            resources.push({
              key,
              label: `${spell.name} sem espaço`.slice(0, 60),
              current: 1,
              max: 1,
              recovery: 'long_rest',
              display: 'checkboxes',
              sortOrder: 160,
            });
            entries.push({ ...entry, resourceKey: key });
          } else entries.push(entry);
        }
      }
    }
  }
  for (const name of [...choices.cantrips, ...choices.spells]) {
    const spell = findSpell(name);
    if (spell) entries.push(spellEntry(spell, levelSource, order++));
  }
  // Magias sempre preparadas que chegam com o nível (domínio, juramento, círculo, classe): não
  // gastam escolhas de magia. Subclasse nova traz as do nível atual e as anteriores.
  const preparedGroups = [
    ...(plan.classDef?.alwaysPrepared ?? [])
      .filter((group) => group.level === plan.newClassLevel)
      .map((group) => ({ spells: group.spells, owner: className })),
    ...(chosenSubclass && !plan.currentSubclass
      ? (chosenSubclass.alwaysPrepared ?? [])
          .filter((group) => group.level <= plan.newClassLevel)
          .map((group) => ({ spells: group.spells, owner: chosenSubclass.name }))
      : (plan.currentSubclass?.alwaysPrepared ?? [])
          .filter((group) => group.level === plan.newClassLevel)
          .map((group) => ({ spells: group.spells, owner: plan.currentSubclass!.name }))),
  ];
  for (const group of preparedGroups) {
    for (const name of group.spells) {
      const spell = findSpell(name);
      if (spell && !choices.spells.includes(spell.name)) {
        const entry = spellEntry(spell, `${group.owner} (sempre preparada)`, order++);
        entries.push({
          ...entry,
          description:
            `Sempre preparada; não conta no limite de magias preparadas.\n\n${entry.description}`.slice(
              0,
              8000,
            ),
        });
      }
    }
  }
  for (const id of choices.invocations) {
    const invocation = SRD_INVOCATIONS.find((entry) => entry.id === id);
    if (invocation)
      entries.push({
        kind: 'class_feature',
        name: invocation.name,
        source: 'Invocação Mística',
        description: invocation.description,
        data: {},
        sortOrder: order++,
      });
  }
  for (const id of choices.metamagic) {
    const option = SRD_METAMAGIC.find((entry) => entry.id === id);
    if (option) {
      entries.push({
        kind: 'class_feature',
        name: option.name,
        source: 'Metamagia',
        description: `Custo: ${option.cost} Ponto${option.cost > 1 ? 's' : ''} de Feitiçaria. ${option.description}`,
        data: {},
        sortOrder: order++,
      });
    }
  }

  const parts = [
    `${className} ${plan.newClassLevel} (nível ${plan.newTotalLevel})`,
    `+${hpGain} PV máximos`,
  ];
  if (multiclass) parts.push(`multiclasse em ${className}`);
  if (chosenSubclass && !plan.classes[plan.classIndex]?.subclass.trim())
    parts.push(`subclasse ${chosenSubclass.name}`);
  if (improvement?.kind === 'plus_two') parts.push(`${ABILITY_SHORT[improvement.ability]} +2`);
  if (improvement?.kind === 'plus_one_each')
    parts.push(improvement.abilities.map((ability) => `${ABILITY_SHORT[ability]} +1`).join(', '));
  if (improvement?.kind === 'feat')
    parts.push(`talento ${findFeat(improvement.featId)?.name ?? improvement.featId}`);
  const learned = choices.cantrips.length + choices.spells.length;
  if (learned) parts.push(`${learned} ${learned === 1 ? 'magia nova' : 'magias novas'}`);

  return {
    sheet: nextSheet,
    hitPointsGained: hpGain,
    resources,
    abilities: entries,
    issues,
    summary: `Subiu de nível: ${parts.join(' · ')}.`.slice(0, 300),
  };
}
