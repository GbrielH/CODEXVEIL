/**
 * Subida de nível pelas regras do SRD 5.2.1: o que muda ao ganhar um nível numa classe (pontos
 * de vida, habilidades novas, subclasse, aumento de atributo ou talento, magias novas e os
 * recursos recalculados). A tela mostra o plano; a ficha aplica as escolhas.
 */
import type { AbilityEntryTemplate, ResourceTemplate } from '../types';
import { ABILITIES, abilityModifier, type Ability } from './abilities';
import { maxClassSpellLevel } from './creation/choices';
import { proficiencyBonusForLevel } from './progression';
import { spellSchoolLabels } from './entries';
import { hitDiceResourceKey, spellSlotResources } from './resources';
import type { Dnd5eSheet } from './sheet';
import { SRD_INVOCATIONS, SRD_METAMAGIC, type InvocationDefinition, type MetamagicDefinition } from './srd/class-options';
import { SORCERER_METAMAGIC, SRD_CLASSES, WARLOCK_INVOCATIONS, WARLOCK_PACT_SLOTS, WARLOCK_SLOT_LEVEL, atLevel } from './srd/classes';
import { SRD_FEATS } from './srd/feats';
import { SRD_SPELLS } from './srd/spells';
import type { ClassDefinition, FeatDefinition, FeatureDefinition, ResourceDefinition, SrdSpell, SubclassDefinition } from './srd/types';

const HIT_DIE_SIDES = { d6: 6, d8: 8, d10: 10, d12: 12 } as const;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Classe do SRD pelo nome gravado na ficha ("Mago", "Bárbaro"). */
export function findClassByName(name: string): ClassDefinition | undefined {
  const target = normalize(name);
  return Object.values(SRD_CLASSES).find((entry) => normalize(entry.name) === target);
}

export interface Dnd5eLevelUpPlan {
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
  /** Subclasse que entra neste nível (o SRD traz uma por classe); `null` se não houver. */
  subclass: SubclassDefinition | null;
  /** Nível com Aumento no Valor de Atributo (ou talento). */
  abilityScoreImprovement: boolean;
  /** 19º nível: Dádiva Épica (os talentos épicos entram nas opções). */
  epicBoon: boolean;
  feats: FeatDefinition[];
  newCantrips: number;
  newSpells: number;
  maxSpellCircle: number;
  spellOptions: SrdSpell[];
  cantripOptions: SrdSpell[];
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
}

function resourceFrom(definition: ResourceDefinition, context: Parameters<ResourceDefinition['max']>[0], sortOrder: number): ResourceTemplate | null {
  const max = definition.max(context);
  if (max === null || max <= 0) return null;
  return { key: definition.key, label: definition.label, current: max, max, recovery: definition.recovery, display: definition.display, sortOrder };
}

/**
 * Plano do próximo nível na classe `classIndex` da ficha. `knownNames` são os nomes das entradas
 * que o personagem já tem (magias, talentos, invocações), para não oferecer de novo.
 */
export function planDnd5eLevelUp(sheet: Dnd5eSheet, classIndex: number, knownNames: readonly string[] = []): Dnd5eLevelUpPlan {
  const index = sheet.identity.classes[classIndex] ? classIndex : 0;
  const entry = sheet.identity.classes[index];
  const classDef = entry ? (findClassByName(entry.name) ?? null) : null;
  const oldLevel = entry?.level ?? 0;
  const newClassLevel = Math.min(20, oldLevel + 1);
  const newTotalLevel = Math.min(20, sheet.identity.classes.reduce((total, item) => total + item.level, 0) + 1);
  const hitDieSides = HIT_DIE_SIDES[classDef?.hitDie ?? entry?.hitDie ?? 'd8'];
  const conModifier = abilityModifier(sheet.abilities.con);
  const averageHp = Math.max(1, Math.floor(hitDieSides / 2) + 1 + conModifier);

  const subclassChosen = Boolean(entry?.subclass.trim());
  const subclassMatches = Boolean(classDef && subclassChosen && normalize(entry?.subclass ?? '') === normalize(classDef.subclass.name));
  const subclassArrives = Boolean(
    classDef && !subclassChosen && classDef.subclass.features.some((feature) => feature.level === newClassLevel),
  );
  const subclassFeatures = classDef && (subclassMatches || subclassArrives) ? classDef.subclass.features.filter((feature) => feature.level === newClassLevel) : [];
  const features = [...(classDef?.features.filter((feature) => feature.level === newClassLevel) ?? []), ...subclassFeatures];

  const known = new Set(knownNames.map(normalize));
  // No 19º nível toda classe ganha uma Dádiva Épica (ou outro talento em que se qualifique).
  const epicBoon = Boolean(classDef) && newClassLevel === 19;
  const abilityScoreImprovement = Boolean(classDef?.asiLevels.includes(newClassLevel)) || epicBoon;
  const qualifies = (feat: FeatDefinition) =>
    (feat.minLevel ?? 0) <= newTotalLevel &&
    (!feat.minScore || feat.minScore.abilities.some((ability) => sheet.abilities[ability] >= (feat.minScore?.value ?? 0))) &&
    (feat.repeatable || !known.has(normalize(feat.name)));
  const feats = abilityScoreImprovement ? SRD_FEATS.filter((feat) => (feat.category === 'general' || (epicBoon && feat.category === 'epic')) && qualifies(feat)) : [];

  const casting = classDef?.spellcasting;
  let newCantrips = 0;
  let newSpells = 0;
  if (casting && oldLevel > 0) {
    newCantrips = casting.cantrips ? Math.max(0, atLevel(casting.cantrips, newClassLevel) - atLevel(casting.cantrips, oldLevel)) : 0;
    newSpells = Math.max(0, atLevel(casting.prepared, newClassLevel) - atLevel(casting.prepared, oldLevel));
    // Mago: o grimório ganha 2 magias a cada nível, além das que passa a preparar.
    if (casting.spellbook) newSpells = Math.max(newSpells, 2);
  }
  const maxSpellCircle = maxClassSpellLevel(classDef ?? undefined, newClassLevel);
  const gained = (table: readonly number[] | undefined) => (table && oldLevel > 0 ? Math.max(0, atLevel(table, newClassLevel) - atLevel(table, oldLevel)) : 0);
  const newInvocations = classDef?.id === 'warlock' ? gained(WARLOCK_INVOCATIONS) : 0;
  const newMetamagic = classDef?.id === 'sorcerer' ? gained(SORCERER_METAMAGIC) : 0;
  const newWeaponMasteries = gained(classDef?.weaponMastery);
  const fromList = casting ? SRD_SPELLS.filter((spell) => spell.classes.includes(casting.list) && !known.has(normalize(spell.name))) : [];

  const resources: ResourceTemplate[] = [];
  if (classDef) {
    const modifiers = Object.fromEntries(ABILITIES.map((ability) => [ability, abilityModifier(sheet.abilities[ability])])) as Record<Ability, number>;
    const context = { level: newClassLevel, proficiencyBonus: proficiencyBonusForLevel(newTotalLevel), modifiers };
    classDef.resources.forEach((definition, position) => {
      const resource = resourceFrom(definition, context, 100 + position);
      if (resource) resources.push(resource);
    });
    if (subclassMatches || subclassArrives) {
      (classDef.subclass.resources ?? []).forEach((definition, position) => {
        const resource = resourceFrom(definition, context, 120 + position);
        if (resource) resources.push(resource);
      });
    }
    if (casting?.progression === 'full') resources.push(...spellSlotResources(newClassLevel));
    if (casting?.progression === 'half') resources.push(...spellSlotResources(Math.ceil(newClassLevel / 2)));
    if (casting?.progression === 'pact') {
      const slots = atLevel(WARLOCK_PACT_SLOTS, newClassLevel);
      resources.push({ key: 'pact_slots', label: `Espaços de pacto (${atLevel(WARLOCK_SLOT_LEVEL, newClassLevel)}º círculo)`, current: slots, max: slots, recovery: 'short_rest', display: 'pool', sortOrder: 40 });
    }
  }

  return {
    classIndex: index,
    className: entry?.name ?? '',
    classDef,
    newClassLevel,
    newTotalLevel,
    hitDieSides,
    averageHp,
    conModifier,
    features,
    subclass: subclassArrives && classDef ? classDef.subclass : null,
    abilityScoreImprovement,
    epicBoon,
    feats,
    newCantrips,
    newSpells,
    maxSpellCircle,
    spellOptions: fromList.filter((spell) => spell.level > 0 && spell.level <= maxSpellCircle),
    cantripOptions: fromList.filter((spell) => spell.level === 0),
    newInvocations,
    invocationOptions: newInvocations > 0 ? SRD_INVOCATIONS.filter((invocation) => invocation.minLevel <= newClassLevel && !known.has(normalize(invocation.name))) : [],
    newMetamagic,
    metamagicOptions: newMetamagic > 0 ? SRD_METAMAGIC.filter((option) => !known.has(normalize(option.name))) : [],
    newWeaponMasteries,
    resources,
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
export function featAbilityIncrease(featId: string): { abilities: readonly Ability[]; cap: number } | null {
  const feat = SRD_FEATS.find((entry) => entry.id === featId);
  if (!feat) return null;
  if (feat.id === 'grappler') return { abilities: ['str', 'dex'], cap: 20 };
  if (feat.category === 'epic') return { abilities: ABILITIES, cap: 30 };
  return null;
}

/** Aplica o aumento de atributo (máximo 20; 30 nas dádivas épicas). */
export function applyAbilityImprovement(scores: Record<Ability, number>, choice: AbilityImprovement): Record<Ability, number> {
  const next = { ...scores };
  if (choice.kind === 'plus_two') next[choice.ability] = Math.min(20, next[choice.ability] + 2);
  if (choice.kind === 'plus_one_each') for (const ability of choice.abilities) next[ability] = Math.min(20, next[ability] + 1);
  if (choice.kind === 'feat' && choice.ability) {
    const increase = featAbilityIncrease(choice.featId);
    if (increase?.abilities.includes(choice.ability)) next[choice.ability] = Math.min(increase.cap, next[choice.ability] + 1);
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

function spellEntry(spell: SrdSpell, source: string, sortOrder: number): AbilityEntryTemplate {
  return {
    kind: 'spell',
    name: spell.name,
    source: `${source} · SRD 5.2.1`.slice(0, 120),
    description: `${spell.level === 0 ? 'Truque' : `${spell.level}º círculo`} de ${spellSchoolLabels[spell.school].toLowerCase()}.`,
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

const ABILITY_SHORT: Record<Ability, string> = { str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };

/** Monta a ficha do novo nível com as escolhas feitas no painel. */
export function applyDnd5eLevelUp(sheet: Dnd5eSheet, plan: Dnd5eLevelUpPlan, choices: Dnd5eLevelUpChoices): Dnd5eLevelUpResult {
  const issues: string[] = [];
  const pick = (count: number, chosen: readonly string[], singular: string, plural: string) => {
    if (chosen.length < count) issues.push(`Escolha ${count} ${count === 1 ? singular : plural} (faltam ${count - chosen.length}).`);
    if (chosen.length > count) issues.push(`Escolha no máximo ${count} ${count === 1 ? singular : plural}.`);
  };
  pick(plan.newCantrips, choices.cantrips, 'truque', 'truques');
  pick(plan.newSpells, choices.spells, 'magia', 'magias');
  pick(plan.newInvocations, choices.invocations, 'invocação', 'invocações');
  pick(plan.newMetamagic, choices.metamagic, 'opção de Metamagia', 'opções de Metamagia');
  if (plan.abilityScoreImprovement && !choices.improvement) issues.push('Escolha o aumento de atributo ou um talento.');
  if (choices.improvement?.kind === 'plus_one_each' && choices.improvement.abilities[0] === choices.improvement.abilities[1]) {
    issues.push('Escolha dois atributos diferentes (ou +2 em um só).');
  }
  if (choices.improvement?.kind === 'feat' && featAbilityIncrease(choices.improvement.featId) && !choices.improvement.ability) {
    issues.push('Escolha o atributo que o talento aumenta.');
  }
  if (choices.hitPoints.method === 'roll' && (choices.hitPoints.die < 1 || choices.hitPoints.die > plan.hitDieSides)) issues.push('Role o dado de vida.');

  const improvement = plan.abilityScoreImprovement ? choices.improvement : null;
  const abilities = improvement ? applyAbilityImprovement(sheet.abilities, improvement) : { ...sheet.abilities };
  const conChange = abilityModifier(abilities.con) - abilityModifier(sheet.abilities.con);
  const die = choices.hitPoints.method === 'roll' ? choices.hitPoints.die : Math.floor(plan.hitDieSides / 2) + 1;
  // Constituição maior aumenta o máximo de PV também nos níveis anteriores.
  const hpGain = Math.max(1, hitPointsGained(die, abilityModifier(abilities.con)) + conChange * (plan.newTotalLevel - 1));

  const classes = sheet.identity.classes.map((entry, position) =>
    position === plan.classIndex ? { ...entry, level: plan.newClassLevel, subclass: plan.subclass ? plan.subclass.name : entry.subclass } : entry,
  );
  const nextSheet: Dnd5eSheet = { ...sheet, abilities, identity: { ...sheet.identity, classes } };

  const resources = [...plan.resources];
  const hitDie = sheet.identity.classes[plan.classIndex]?.hitDie ?? plan.classDef?.hitDie ?? 'd8';
  const hitDice = classes.filter((entry) => entry.hitDie === hitDie).reduce((sum, entry) => sum + entry.level, 0);
  resources.push({ key: hitDiceResourceKey(hitDie), label: `Dados de vida (${hitDie})`, current: hitDice, max: hitDice, recovery: 'long_rest', display: 'pool', sortOrder: 10 });

  const entries: AbilityEntryTemplate[] = [];
  let order = 500;
  const className = plan.classDef?.name ?? plan.className;
  const levelSource = `${className} ${plan.newClassLevel}º nível`;
  const subclassFeatures = new Set(plan.classDef?.subclass.features ?? []);
  for (const feature of plan.features) {
    const owner = subclassFeatures.has(feature) ? (plan.classDef?.subclass.name ?? className) : className;
    entries.push({
      kind: 'class_feature',
      name: feature.name,
      source: `${owner} ${feature.level}º nível`,
      description: feature.description,
      data: {},
      ...(feature.resourceKey ? { resourceKey: feature.resourceKey } : {}),
      sortOrder: order++,
    });
  }
  if (improvement?.kind === 'feat') {
    const feat = SRD_FEATS.find((entry) => entry.id === improvement.featId);
    if (feat) {
      const extra = improvement.ability ? ` Atributo aumentado: ${ABILITY_SHORT[improvement.ability]} +1.` : '';
      entries.push({ kind: 'feat', name: feat.name, source: levelSource, description: `${feat.description}${extra}`, data: {}, sortOrder: order++ });
    }
  }
  for (const name of [...choices.cantrips, ...choices.spells]) {
    const spell = SRD_SPELLS.find((entry) => entry.name === name);
    if (spell) entries.push(spellEntry(spell, levelSource, order++));
  }
  for (const id of choices.invocations) {
    const invocation = SRD_INVOCATIONS.find((entry) => entry.id === id);
    if (invocation) entries.push({ kind: 'class_feature', name: invocation.name, source: 'Invocação Mística', description: invocation.description, data: {}, sortOrder: order++ });
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

  const parts = [`${className} ${plan.newClassLevel} (nível ${plan.newTotalLevel})`, `+${hpGain} PV máximos`];
  if (plan.subclass) parts.push(`subclasse ${plan.subclass.name}`);
  if (improvement?.kind === 'plus_two') parts.push(`${ABILITY_SHORT[improvement.ability]} +2`);
  if (improvement?.kind === 'plus_one_each') parts.push(improvement.abilities.map((ability) => `${ABILITY_SHORT[ability]} +1`).join(', '));
  if (improvement?.kind === 'feat') parts.push(`talento ${SRD_FEATS.find((entry) => entry.id === improvement.featId)?.name ?? improvement.featId}`);
  const learned = choices.cantrips.length + choices.spells.length;
  if (learned) parts.push(`${learned} ${learned === 1 ? 'magia nova' : 'magias novas'}`);

  return { sheet: nextSheet, hitPointsGained: hpGain, resources, abilities: entries, issues, summary: `Subiu de nível: ${parts.join(' · ')}.`.slice(0, 300) };
}
