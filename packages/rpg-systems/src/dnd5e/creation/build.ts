/**
 * Monta o personagem de D&D 5e a partir do rascunho do assistente: ficha, trilhas de recurso,
 * habilidades, magias, ataques e inventário, aplicando as regras do SRD 5.2.1.
 *
 * Funciona também com rascunhos incompletos (para a prévia); a criação de verdade só acontece
 * depois de `validateDnd5eDraft` não apontar pendências.
 */
import { ABILITIES, abilityLabels, abilityModifier, type Ability } from '../abilities';
import { computeDnd5eDerived } from '../derived';
import { spellSchoolLabels } from '../entries';
import { EXPERIENCE_THRESHOLDS, proficiencyBonusForLevel } from '../progression';
import {
  DND5E_RESOURCE_KEYS,
  currencyResourceKey,
  dnd5eDefaultResources,
  spellSlotResources,
} from '../resources';
import { parseDnd5eSheet, type Dnd5eSheet } from '../sheet';
import { SKILLS, skillDefinitions, type ProficiencyLevel, type Skill } from '../skills';
import { CIRCLE_OF_THE_LAND, SRD_INVOCATIONS, SRD_METAMAGIC } from '../srd/class-options';
import { MONK_MARTIAL_ARTS_DIE, MONK_UNARMORED_MOVEMENT, WARLOCK_PACT_SLOTS, WARLOCK_SLOT_LEVEL, atLevel } from '../srd/classes';
import {
  SRD_ARMOR,
  SRD_ITEMS,
  SRD_WEAPONS,
  damageTypeLabels,
  findTool,
  formatDistance,
  weaponMasteryLabels,
  weaponPropertyLabels,
  weightForUnit,
} from '../srd/equipment';
import { findFeat } from '../srd/feats';
import { ALIGNMENTS, languageName } from '../srd/languages';
import { sizeLabels } from '../srd/species';
import type { ClassDefinition, EquipmentGrant, ResourceDefinition, WeaponDefinition } from '../srd/types';
import type { AbilityEntryTemplate, ItemTemplate, ResourceTemplate } from '../../types';
import {
  draftBackground,
  draftClass,
  draftFeats,
  draftLineage,
  draftSpecies,
  draftSubclass,
  expertiseSkills,
  findSrdSpell,
  finalAbilityScores,
  fixedSpells,
  languageGrants,
  magicInitiateList,
  skillGrants,
  spellListLabel,
  toolGrants,
  type FeatInstance,
} from './choices';
import { selectionList, selectionText, type Dnd5eDraft } from './draft';

export interface BuiltDnd5eCharacter {
  name: string;
  sheet: Dnd5eSheet;
  resources: ResourceTemplate[];
  abilities: AbilityEntryTemplate[];
  items: ItemTemplate[];
}

const UNIT = 'm' as const;
const DIE_SIZE = { d6: 6, d8: 8, d10: 10, d12: 12 } as const;

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

function modifiers(scores: Record<Ability, number>): Record<Ability, number> {
  return Object.fromEntries(ABILITIES.map((ability) => [ability, abilityModifier(scores[ability])])) as Record<Ability, number>;
}

function defaultScores(draft: Dnd5eDraft): Record<Ability, number> {
  return finalAbilityScores(draft) ?? (Object.fromEntries(ABILITIES.map((ability) => [ability, 10])) as Record<Ability, number>);
}

// ---------------------------------------------------------------------------
// Equipamento
// ---------------------------------------------------------------------------

interface ResolvedItem {
  catalogId: string;
  name: string;
  quantity: number;
}

function resolveGrant(draft: Dnd5eDraft, grant: EquipmentGrant): ResolvedItem {
  let catalogId = grant.item;
  if (grant.choice === 'musical_instrument') catalogId = selectionText(draft, 'equipment.class.instrument') || grant.item;
  if (grant.choice === 'class_tool') catalogId = selectionList(draft, 'class.tools')[0] ?? grant.item;
  if (grant.choice === 'gaming_set') catalogId = selectionText(draft, 'background.tool') || grant.item;
  const name = grant.choice ? (SRD_ITEMS[catalogId]?.name ?? findTool(catalogId)?.name ?? catalogId) : (grant.name ?? SRD_ITEMS[catalogId]?.name ?? catalogId);
  return { catalogId, name, quantity: grant.quantity ?? 1 };
}

/** Itens e ouro do equipamento inicial escolhido (classe + antecedente). */
export function startingEquipment(draft: Dnd5eDraft): { items: ResolvedItem[]; gold: number } {
  const classDef = draftClass(draft);
  const background = draftBackground(draft);
  const classOption = classDef?.equipment.find((option) => option.id === selectionText(draft, 'equipment.class'));
  const backgroundOption = background?.equipment.find((option) => option.id === selectionText(draft, 'equipment.background'));
  const items: ResolvedItem[] = [];
  for (const grant of [...(classOption?.items ?? []), ...(backgroundOption?.items ?? [])]) {
    const resolved = resolveGrant(draft, grant);
    const existing = items.find((item) => item.catalogId === resolved.catalogId && item.name === resolved.name);
    if (existing) existing.quantity += resolved.quantity;
    else items.push(resolved);
  }
  return { items, gold: (classOption?.gold ?? 0) + (backgroundOption?.gold ?? 0) };
}

// ---------------------------------------------------------------------------
// Proficiências com armas e armaduras
// ---------------------------------------------------------------------------

function extraMartial(draft: Dnd5eDraft): boolean {
  return (
    (draft.classId === 'cleric' && selectionText(draft, 'class.divine_order') === 'protector') ||
    (draft.classId === 'druid' && selectionText(draft, 'class.primal_order') === 'warden')
  );
}

export function isWeaponProficient(classDef: ClassDefinition, weapon: WeaponDefinition, martialBonus: boolean): boolean {
  if (weapon.category === 'simple') return classDef.weapons.simple;
  if (martialBonus) return true;
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
}

function armorText(classDef: ClassDefinition, draft: Dnd5eDraft): string {
  const kinds = new Set(classDef.armor);
  if (draft.classId === 'cleric' && selectionText(draft, 'class.divine_order') === 'protector') kinds.add('heavy');
  if (draft.classId === 'druid' && selectionText(draft, 'class.primal_order') === 'warden') kinds.add('medium');
  if (kinds.size === 0) return 'Nenhuma';
  const armor = (['light', 'medium', 'heavy'] as const).filter((kind) => kinds.has(kind));
  const names = { light: 'leves', medium: 'médias', heavy: 'pesadas' } as const;
  const parts: string[] = [];
  if (armor.length === 3) parts.push('Todas as armaduras');
  else if (armor.length > 0) parts.push(`Armaduras ${armor.map((kind) => names[kind]).join(' e ')}`);
  if (kinds.has('shield')) parts.push(parts.length > 0 ? 'escudos' : 'Escudos');
  return parts.join(' e ');
}

function isMonkWeapon(weapon: WeaponDefinition): boolean {
  return weapon.kind === 'melee' && (weapon.category === 'simple' || weapon.properties.includes('light'));
}

function maxDamage(dice: string): number {
  const match = /^(\d+)d(\d+)$/.exec(dice);
  return match ? Number(match[1]) * Number(match[2]) : Number(dice) || 0;
}

// ---------------------------------------------------------------------------
// Combate: CA, deslocamento e PV
// ---------------------------------------------------------------------------

export interface CombatSummary {
  armorClass: number;
  armorClassSource: string;
  /** Deslocamento em pés (o SRD usa pés; a ficha converte para metros). */
  speedFeet: number;
  hitPointMax: number;
}

export function combatSummary(draft: Dnd5eDraft): CombatSummary {
  const classDef = draftClass(draft);
  const species = draftSpecies(draft);
  const lineage = draftLineage(draft);
  const scores = defaultScores(draft);
  const mods = modifiers(scores);
  const level = draft.level;
  const equipment = startingEquipment(draft);
  const armorItem = equipment.items.map((item) => SRD_ARMOR[item.catalogId]).find((armor) => armor && armor.category !== 'shield');
  const hasShield = equipment.items.some((item) => SRD_ARMOR[item.catalogId]?.category === 'shield');
  const feats = draftFeats(draft).map((feat) => feat.featId);

  // Classe de Armadura
  let armorClass: number;
  let armorClassSource: string;
  if (armorItem) {
    const dex = armorItem.dexterity === 'full' ? mods.dex : armorItem.dexterity === 'max2' ? Math.min(2, mods.dex) : 0;
    armorClass = armorItem.armorClass + dex;
    armorClassSource = armorItem.name;
  } else {
    const options: { value: number; source: string }[] = [{ value: 10 + mods.dex, source: 'Sem armadura' }];
    if (classDef?.id === 'barbarian') options.push({ value: 10 + mods.dex + mods.con, source: 'Defesa sem Armadura' });
    if (classDef?.id === 'monk' && !hasShield) options.push({ value: 10 + mods.dex + mods.wis, source: 'Defesa sem Armadura' });
    if (classDef?.id === 'sorcerer' && level >= 3) options.push({ value: 10 + mods.dex + mods.cha, source: 'Resiliência Dracônica' });
    const best = options.reduce((a, b) => (b.value > a.value ? b : a));
    armorClass = best.value;
    armorClassSource = best.source;
  }
  if (hasShield) {
    armorClass += 2;
    armorClassSource += ' + escudo';
  }
  if (armorItem && feats.includes('defense')) {
    armorClass += 1;
    armorClassSource += ' + Defesa';
  }

  // Deslocamento
  let speedFeet = lineage?.speed ?? species?.speed ?? 30;
  const heavy = armorItem?.category === 'heavy';
  if (classDef?.id === 'monk' && !armorItem && !hasShield) speedFeet += atLevel(MONK_UNARMORED_MOVEMENT, level);
  if (classDef?.id === 'barbarian' && level >= 5 && !heavy) speedFeet += 10;
  if (classDef?.id === 'ranger' && level >= 6 && !heavy) speedFeet += 10;
  if (heavy && armorItem.strength && scores.str < armorItem.strength) speedFeet -= 10;

  // Pontos de vida: máximo do dado no 1º nível e valor fixo nos demais
  let hitPointMax = 0;
  if (classDef) {
    const size = DIE_SIZE[classDef.hitDie];
    for (let current = 1; current <= level; current++) {
      hitPointMax += Math.max(1, (current === 1 ? size : size / 2 + 1) + mods.con);
    }
  }
  if (species?.id === 'dwarf') hitPointMax += level;
  if (classDef?.id === 'sorcerer' && level >= 3) hitPointMax += level;
  return { armorClass, armorClassSource, speedFeet, hitPointMax: Math.max(1, hitPointMax) };
}

// ---------------------------------------------------------------------------
// Magias conhecidas
// ---------------------------------------------------------------------------

export interface KnownSpell {
  name: string;
  source: string;
  prepared: boolean;
  note: string;
  /** Trilha de usos gratuitos ligada à magia. */
  resource?: ResourceTemplate;
}

export function knownSpells(draft: Dnd5eDraft): KnownSpell[] {
  const classDef = draftClass(draft);
  const subclass = draftSubclass(draft);
  const result: KnownSpell[] = [];
  const proficiencyBonus = proficiencyBonusForLevel(draft.level);
  const push = (spell: KnownSpell) => {
    if (!result.some((entry) => entry.name === spell.name)) result.push(spell);
  };
  const className = classDef?.name ?? '';

  for (const name of selectionList(draft, 'spells.cantrips')) push({ name, source: className, prepared: true, note: 'Truque.' });
  const prepared = new Set(selectionList(draft, 'spells.prepared'));
  for (const name of selectionList(draft, 'spells.prepared')) push({ name, source: className, prepared: true, note: 'Preparada.' });
  for (const name of [...selectionList(draft, 'spells.spellbook'), ...selectionList(draft, 'subclass.evocation_savant')]) {
    push({ name, source: `${className} (grimório)`, prepared: prepared.has(name), note: prepared.has(name) ? 'Preparada.' : 'No grimório, não preparada.' });
  }
  for (const spell of fixedSpells(draft)) {
    const note = [
      'Sempre preparada.',
      spell.freeUses === 'once' ? 'Pode ser conjurada 1 vez sem espaço de magia por descanso longo.' : '',
      spell.freeUses === 'proficiency' ? 'Pode ser conjurada sem espaço de magia, usos iguais ao bônus de proficiência por descanso longo.' : '',
      spell.ability ? `Atributo de conjuração: ${abilityLabels[spell.ability].name}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const resource: ResourceTemplate | undefined = spell.freeUses
      ? {
          key: `species_spell_${slug(spell.name)}`,
          label: clip(`${spell.name} sem espaço`, 60),
          current: spell.freeUses === 'proficiency' ? proficiencyBonus : 1,
          max: spell.freeUses === 'proficiency' ? proficiencyBonus : 1,
          recovery: 'long_rest',
          display: spell.freeUses === 'proficiency' ? 'pool' : 'checkboxes',
          sortOrder: 150,
        }
      : undefined;
    push({ name: spell.name, source: spell.source, prepared: true, note, ...(resource ? { resource } : {}) });
  }
  const style = selectionText(draft, 'class.fighting_style');
  for (const name of selectionList(draft, 'class.fighting_style.cantrips')) {
    push({ name, source: style === 'blessed_warrior' ? 'Guerreiro Abençoado' : 'Guerreiro Druídico', prepared: true, note: `Conta como magia de ${className}.` });
  }
  if (subclass) {
    for (const name of selectionList(draft, 'subclass.magical_discoveries')) push({ name, source: 'Descobertas Mágicas', prepared: true, note: 'Sempre preparada; conta como magia de bardo.' });
  }
  for (const spellLevel of [6, 7, 8, 9]) {
    for (const name of selectionList(draft, `class.arcanum.${spellLevel}`)) {
      push({
        name,
        source: 'Arcana Mística',
        prepared: true,
        note: 'Pode ser conjurada 1 vez sem espaço de magia por descanso longo.',
        resource: {
          key: `class_mystic_arcanum_${spellLevel}`,
          label: clip(`Arcana Mística: ${name}`, 60),
          current: 1,
          max: 1,
          recovery: 'long_rest',
          display: 'checkboxes',
          sortOrder: 110 + spellLevel,
        },
      });
    }
  }
  for (const feat of draftFeats(draft)) {
    if (feat.featId !== 'magic_initiate') continue;
    const list = magicInitiateList(draft, feat);
    const abilityId = selectionText(draft, `${feat.specId}.ability`);
    const abilityNote = (ABILITIES as readonly string[]).includes(abilityId) ? ` Atributo de conjuração: ${abilityLabels[abilityId as Ability].name}.` : '';
    const source = `Iniciado em Magia${list ? ` (${spellListLabel(list)})` : ''}`;
    for (const name of selectionList(draft, `${feat.specId}.cantrips`)) push({ name, source, prepared: true, note: `Truque.${abilityNote}` });
    for (const name of selectionList(draft, `${feat.specId}.spell`)) {
      push({
        name,
        source,
        prepared: true,
        note: `Sempre preparada; pode ser conjurada 1 vez sem espaço de magia por descanso longo.${abilityNote}`,
        resource: {
          key: `feat_magic_initiate_${list ?? slug(feat.specId)}`,
          label: clip(`${name} sem espaço`, 60),
          current: 1,
          max: 1,
          recovery: 'long_rest',
          display: 'checkboxes',
          sortOrder: 160,
        },
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Notas das escolhas de cada habilidade
// ---------------------------------------------------------------------------

function namesOf(ids: readonly string[], resolve: (id: string) => string): string {
  return ids.map(resolve).join(', ');
}

function featureChoiceNotes(draft: Dnd5eDraft): Record<string, string> {
  const notes: Record<string, string> = {};
  const skill = (id: string) => skillDefinitions[id as Skill]?.label ?? id;
  const mastery = selectionList(draft, 'class.weapon_mastery');
  if (mastery.length) notes['Maestria em Armas'] = `Armas escolhidas: ${namesOf(mastery, (id) => SRD_WEAPONS[id]?.name ?? id)}.`;
  const order = selectionText(draft, 'class.divine_order');
  if (order) notes['Ordem Divina'] = `Escolha: ${order === 'protector' ? 'Protetor' : 'Taumaturgo'}.`;
  const primal = selectionText(draft, 'class.primal_order');
  if (primal) notes['Ordem Primal'] = `Escolha: ${primal === 'magician' ? 'Mágico' : 'Guardião'}.`;
  const strikes = selectionText(draft, 'class.blessed_strikes');
  if (strikes) notes['Golpes Abençoados'] = `Escolha: ${strikes === 'divine_strike' ? 'Golpe Divino' : 'Conjuração Potente'}.`;
  const fury = selectionText(draft, 'class.elemental_fury');
  if (fury) notes['Fúria Elemental'] = `Escolha: ${fury === 'primal_strike' ? 'Golpe Primal' : 'Conjuração Potente'}.`;
  const style = selectionText(draft, 'class.fighting_style');
  if (style) {
    notes['Estilo de Luta'] = `Escolha: ${style === 'blessed_warrior' ? 'Guerreiro Abençoado' : style === 'druidic_warrior' ? 'Guerreiro Druídico' : (findFeat(style)?.name ?? style)}.`;
  }
  const extraStyle = selectionText(draft, 'subclass.fighting_style');
  if (extraStyle) notes['Estilo de Luta Adicional'] = `Escolha: ${findFeat(extraStyle)?.name ?? extraStyle}.`;
  const expertise1 = [...selectionList(draft, 'class.expertise.1'), ...selectionList(draft, 'class.expertise.2')];
  if (expertise1.length) {
    const text = `Perícias: ${namesOf(expertise1, skill)}.`;
    notes['Especialização'] = text;
    notes['Estudioso'] = text;
    notes['Explorador Hábil'] = `${text} Idiomas: ${namesOf(selectionList(draft, 'class.deft_explorer_languages'), languageName)}.`;
  }
  const expertiseLater = [...selectionList(draft, 'class.expertise.6'), ...selectionList(draft, 'class.expertise.9')];
  if (expertiseLater.length) {
    notes['Especialização Adicional'] = `Perícias: ${namesOf(expertiseLater, skill)}.`;
    if (draft.classId === 'ranger') notes['Especialização'] = `Perícias: ${namesOf(expertiseLater, skill)}.`;
  }
  const primalKnowledge = selectionList(draft, 'class.primal_knowledge');
  if (primalKnowledge.length) notes['Conhecimento Primitivo'] = `Perícia: ${namesOf(primalKnowledge, skill)}.`;
  const lore = selectionList(draft, 'subclass.lore_proficiencies');
  if (lore.length) notes['Proficiências Adicionais'] = `Perícias: ${namesOf(lore, skill)}.`;
  const land = CIRCLE_OF_THE_LAND.find((entry) => entry.id === selectionText(draft, 'subclass.land'));
  if (land) notes['Magias do Círculo da Terra'] = `Terra atual: ${land.name}.`;
  const affinity = selectionText(draft, 'subclass.elemental_affinity');
  if (affinity) notes['Afinidade Elemental'] = `Tipo escolhido: ${damageTypeLabels[affinity as keyof typeof damageTypeLabels] ?? affinity}.`;
  const cant = selectionList(draft, 'class.thieves_cant_language');
  if (cant.length) notes['Gíria de Ladrão'] = `Idioma adicional: ${namesOf(cant, languageName)}.`;
  const metamagic = selectionList(draft, 'class.metamagic');
  if (metamagic.length) notes['Metamagia'] = `Opções: ${namesOf(metamagic, (id) => SRD_METAMAGIC.find((entry) => entry.id === id)?.name ?? id)}.`;
  const invocations = selectionList(draft, 'class.invocations');
  if (invocations.length) notes['Invocações Místicas'] = `Conhecidas: ${namesOf(invocations, (id) => SRD_INVOCATIONS.find((entry) => entry.id === id)?.name ?? id)}.`;
  const arcanum = [6, 7, 8, 9].flatMap((spellLevel) => selectionList(draft, `class.arcanum.${spellLevel}`));
  if (arcanum.length) notes['Arcana Mística'] = `Magias: ${arcanum.join(', ')}.`;
  return notes;
}

function featDescription(draft: Dnd5eDraft, feat: FeatInstance): string {
  const definition = findFeat(feat.featId);
  if (!definition) return '';
  const extra: string[] = [];
  if (definition.id === 'magic_initiate') {
    const list = magicInitiateList(draft, feat);
    if (list) extra.push(`Lista: ${spellListLabel(list)}.`);
    const ability = selectionText(draft, `${feat.specId}.ability`);
    if ((ABILITIES as readonly string[]).includes(ability)) extra.push(`Atributo de conjuração: ${abilityLabels[ability as Ability].name}.`);
    const spells = [...selectionList(draft, `${feat.specId}.cantrips`), ...selectionList(draft, `${feat.specId}.spell`)];
    if (spells.length) extra.push(`Magias: ${spells.join(', ')}.`);
  }
  if (definition.id === 'skilled') {
    const picks = selectionList(draft, `${feat.specId}.proficiencies`).map((entry) =>
      entry.startsWith('skill:') ? (skillDefinitions[entry.slice(6) as Skill]?.label ?? entry) : (findTool(entry.slice(5))?.name ?? entry),
    );
    if (picks.length) extra.push(`Proficiências: ${picks.join(', ')}.`);
  }
  if (definition.id === 'ability_score_improvement') {
    const increase = draft.selections[`${feat.specId}.increase`];
    if (increase && typeof increase === 'object' && !Array.isArray(increase)) {
      const parts = ABILITIES.filter((ability) => (increase[ability] ?? 0) > 0).map((ability) => `${abilityLabels[ability].name} +${increase[ability]}`);
      if (parts.length) extra.push(`Aumentos: ${parts.join(', ')}.`);
    }
  }
  const ability = selectionText(draft, `${feat.specId}.ability`);
  if ((definition.id === 'grappler' || definition.category === 'epic') && (ABILITIES as readonly string[]).includes(ability)) {
    extra.push(`Atributo aumentado: ${abilityLabels[ability as Ability].name} +1.`);
  }
  return [definition.description, ...extra].join(' ');
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

function resourceFrom(definition: ResourceDefinition, context: Parameters<ResourceDefinition['max']>[0], sortOrder: number): ResourceTemplate | null {
  const max = definition.max(context);
  if (max === null || max <= 0) return null;
  return { key: definition.key, label: definition.label, current: max, max, recovery: definition.recovery, display: definition.display, sortOrder };
}

export function buildDnd5eCharacterFromDraft(draft: Dnd5eDraft): BuiltDnd5eCharacter {
  const classDef = draftClass(draft);
  const subclass = draftSubclass(draft);
  const background = draftBackground(draft);
  const species = draftSpecies(draft);
  const lineage = draftLineage(draft);
  const level = draft.level;
  const proficiencyBonus = proficiencyBonusForLevel(level);
  const scores = defaultScores(draft);
  const mods = modifiers(scores);
  const feats = draftFeats(draft);
  const featIds = feats.map((feat) => feat.featId);
  const combat = combatSummary(draft);
  const equipment = startingEquipment(draft);

  // Perícias
  const proficient = new Set(skillGrants(draft).map((grant) => grant.id as Skill));
  const expertise = new Set(expertiseSkills(draft));
  const jackOfAllTrades = classDef?.id === 'bard' && level >= 2;
  const skillBonus: Partial<Record<Skill, number>> = {};
  const wisBonus = Math.max(1, mods.wis);
  if (classDef?.id === 'cleric' && selectionText(draft, 'class.divine_order') === 'thaumaturge') {
    skillBonus.arcana = wisBonus;
    skillBonus.religion = wisBonus;
  }
  if (classDef?.id === 'druid' && selectionText(draft, 'class.primal_order') === 'magician') {
    skillBonus.arcana = wisBonus;
    skillBonus.nature = wisBonus;
  }
  const skills = Object.fromEntries(
    SKILLS.map((skill) => {
      const proficiency: ProficiencyLevel = expertise.has(skill) ? 'expertise' : proficient.has(skill) ? 'proficient' : jackOfAllTrades ? 'half' : 'none';
      return [skill, { proficiency, bonus: skillBonus[skill] ?? 0 }];
    }),
  );

  // Testes de resistência
  const saves = new Set<Ability>(classDef?.savingThrows ?? []);
  if (classDef?.id === 'monk' && level >= 14) for (const ability of ABILITIES) saves.add(ability);
  if (classDef?.id === 'rogue' && level >= 15) {
    saves.add('wis');
    saves.add('cha');
  }

  // Conjuração
  const spells = knownSpells(draft);
  const speciesAbility = selectionText(draft, 'species.spell_ability');
  const fallbackAbility =
    ['int', 'wis', 'cha'].find((ability) => ability === speciesAbility) ??
    feats.map((feat) => selectionText(draft, `${feat.specId}.ability`)).find((ability) => ['int', 'wis', 'cha'].includes(ability));
  const spellcastingAbility = classDef?.spellcasting?.ability ?? (spells.length ? (fallbackAbility as 'int' | 'wis' | 'cha' | undefined) ?? null : null);

  const tools = [...new Set(toolGrants(draft).map((grant) => findTool(grant.id)?.name ?? grant.id))];
  const languages = [...new Set(languageGrants(draft).map((grant) => languageName(grant.id)))];
  const alignment = ALIGNMENTS.find((entry) => entry.id === draft.alignment)?.name ?? '';
  const size = selectionText(draft, 'species.size') || species?.sizes[0] || 'medium';
  const speciesLabel = species ? (lineage ? `${species.name} (${lineage.name})` : species.name) : '';
  const weaponText = classDef ? (extraMartial(draft) ? 'Armas simples e marciais' : classDef.weaponLabel) : '';

  const sheet = parseDnd5eSheet({
    identity: {
      species: speciesLabel,
      background: background?.name ?? '',
      alignment,
      classes: [
        {
          name: classDef?.name ?? '',
          subclass: subclass?.name ?? '',
          level,
          hitDie: classDef?.hitDie ?? 'd8',
        },
      ],
      experience: EXPERIENCE_THRESHOLDS[level - 1] ?? 0,
    },
    abilities: scores,
    savingThrows: Object.fromEntries(ABILITIES.map((ability) => [ability, { proficient: saves.has(ability), bonus: 0 }])),
    skills,
    combat: {
      armorClass: Math.min(50, combat.armorClass),
      initiativeBonus: 0,
      initiativeProficiency: featIds.includes('alert') ? 'proficient' : jackOfAllTrades ? 'half' : 'none',
      speed: Math.round(combat.speedFeet * 0.3 * 10) / 10,
      speedUnit: UNIT,
    },
    spellcasting: { ability: spellcastingAbility, saveDcBonus: 0, attackBonus: 0 },
    proficiencies: {
      armor: classDef ? armorText(classDef, draft) : '',
      weapons: weaponText,
      tools: tools.join(', '),
      languages: languages.join(', '),
    },
    details: { ...draft.details, notes: '' },
  });

  // Trilhas de recurso -------------------------------------------------------
  const resources = dnd5eDefaultResources(sheet).map((resource) => {
    if (resource.key === DND5E_RESOURCE_KEYS.hitPoints) return { ...resource, current: combat.hitPointMax, max: combat.hitPointMax };
    if (resource.key === currencyResourceKey('gp')) return { ...resource, current: equipment.gold };
    if (resource.key === DND5E_RESOURCE_KEYS.heroicInspiration && species?.id === 'human') return { ...resource, current: 1 };
    return resource;
  });
  const addResource = (resource: ResourceTemplate | null) => {
    if (resource && !resources.some((existing) => existing.key === resource.key)) resources.push(resource);
  };
  const casting = classDef?.spellcasting;
  if (casting?.progression === 'full') for (const resource of spellSlotResources(level)) addResource(resource);
  if (casting?.progression === 'half') for (const resource of spellSlotResources(Math.ceil(level / 2))) addResource(resource);
  if (casting?.progression === 'pact') {
    const slots = atLevel(WARLOCK_PACT_SLOTS, level);
    addResource({
      key: 'pact_slots',
      label: `Espaços de pacto (${atLevel(WARLOCK_SLOT_LEVEL, level)}º círculo)`,
      current: slots,
      max: slots,
      recovery: 'short_rest',
      display: 'pool',
      sortOrder: 40,
    });
  }
  const classContext = { level, proficiencyBonus, modifiers: mods };
  (classDef?.resources ?? []).forEach((definition, index) => addResource(resourceFrom(definition, classContext, 100 + index)));
  (subclass?.resources ?? []).forEach((definition, index) => addResource(resourceFrom(definition, classContext, 120 + index)));
  (species?.resources ?? []).forEach((definition, index) => addResource(resourceFrom(definition, classContext, 140 + index)));
  for (const spell of spells) if (spell.resource) addResource(spell.resource);

  // Habilidades, magias e ataques ---------------------------------------------
  const abilities: AbilityEntryTemplate[] = [];
  let order = 0;
  const resourceKeys = new Set(resources.map((resource) => resource.key));
  const withResource = (key: string | undefined) => (key && resourceKeys.has(key) ? { resourceKey: key } : {});
  const notes = featureChoiceNotes(draft);

  if (classDef) {
    for (const feature of classDef.features) {
      if (feature.level > level) continue;
      const note = notes[feature.name];
      abilities.push({
        kind: 'class_feature',
        name: feature.name,
        source: `${classDef.name} ${feature.level}º nível`,
        description: note ? `${feature.description}\n\n${note}` : feature.description,
        data: {},
        ...withResource(feature.resourceKey),
        sortOrder: order++,
      });
    }
    for (const id of selectionList(draft, 'class.invocations')) {
      const invocation = SRD_INVOCATIONS.find((entry) => entry.id === id);
      if (invocation) abilities.push({ kind: 'class_feature', name: invocation.name, source: 'Invocação Mística', description: invocation.description, data: {}, sortOrder: order++ });
    }
    for (const id of selectionList(draft, 'class.metamagic')) {
      const option = SRD_METAMAGIC.find((entry) => entry.id === id);
      if (option) {
        abilities.push({
          kind: 'class_feature',
          name: option.name,
          source: 'Metamagia',
          description: `Custo: ${option.cost} Ponto${option.cost > 1 ? 's' : ''} de Feitiçaria. ${option.description}`,
          data: {},
          sortOrder: order++,
        });
      }
    }
  }
  if (subclass) {
    for (const feature of subclass.features) {
      if (feature.level > level) continue;
      const note = notes[feature.name];
      abilities.push({
        kind: 'class_feature',
        name: feature.name,
        source: `${subclass.name} ${feature.level}º nível`,
        description: note ? `${feature.description}\n\n${note}` : feature.description,
        data: {},
        ...withResource(feature.resourceKey),
        sortOrder: order++,
      });
    }
  }
  if (species) {
    const speciesNotes: Record<string, string> = {};
    if (lineage) {
      const lineageNote = `${species.lineage?.label ?? 'Linhagem'}: ${lineage.name}. ${lineage.description}`;
      for (const name of ['Linhagem Élfica', 'Linhagem Gnômica', 'Legado Ínfero', 'Ancestralidade Gigante', 'Arma de Sopro', 'Resistência a Dano']) speciesNotes[name] = lineageNote;
    }
    const keen = selectionList(draft, 'species.keen_senses');
    if (keen.length) speciesNotes['Sentidos Aguçados'] = `Perícia: ${namesOf(keen, (id) => skillDefinitions[id as Skill]?.label ?? id)}.`;
    const skillful = selectionList(draft, 'species.skillful');
    if (skillful.length) speciesNotes['Hábil'] = `Perícia: ${namesOf(skillful, (id) => skillDefinitions[id as Skill]?.label ?? id)}.`;
    const versatile = findFeat(selectionText(draft, 'species.versatile'));
    if (versatile) speciesNotes['Versátil'] = `Talento: ${versatile.name}.`;
    const spellAbility = selectionText(draft, 'species.spell_ability');
    if ((ABILITIES as readonly string[]).includes(spellAbility)) {
      for (const name of ['Linhagem Élfica', 'Linhagem Gnômica', 'Legado Ínfero']) {
        speciesNotes[name] = `${speciesNotes[name] ?? ''} Atributo de conjuração: ${abilityLabels[spellAbility as Ability].name}.`.trim();
      }
    }
    abilities.push({
      kind: 'species_trait',
      name: 'Tamanho e deslocamento',
      source: speciesLabel,
      description: `Humanoide ${(size === 'small' ? sizeLabels.small : sizeLabels.medium).toLowerCase()}. Deslocamento base de ${formatDistance(lineage?.speed ?? species.speed, UNIT)}.`,
      data: {},
      sortOrder: order++,
    });
    for (const trait of species.traits) {
      if (trait.level > level) continue;
      const note = speciesNotes[trait.name];
      abilities.push({
        kind: 'species_trait',
        name: trait.name,
        source: speciesLabel,
        description: note ? `${trait.description}\n\n${note}` : trait.description,
        data: {},
        ...withResource(trait.resourceKey),
        sortOrder: order++,
      });
    }
  }
  if (background) {
    const tool = typeof background.tool === 'string' ? (findTool(background.tool)?.name ?? background.tool) : (findTool(selectionText(draft, 'background.tool'))?.name ?? 'jogo à escolha');
    const increase = draft.selections['background.abilities'];
    const increaseText =
      increase && typeof increase === 'object' && !Array.isArray(increase)
        ? ABILITIES.filter((ability) => (increase[ability] ?? 0) > 0)
            .map((ability) => `${abilityLabels[ability].name} +${increase[ability]}`)
            .join(', ')
        : '';
    abilities.push({
      kind: 'background_feature',
      name: background.name,
      source: 'Antecedente',
      description: [
        background.summary,
        `Perícias: ${background.skills.map((skill) => skillDefinitions[skill].label).join(' e ')}.`,
        `Ferramenta: ${tool}.`,
        `Talento: ${findFeat(background.feat)?.name ?? background.feat}.`,
        increaseText ? `Aumentos de atributo: ${increaseText}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      data: {},
      sortOrder: order++,
    });
  }
  for (const feat of feats) {
    const definition = findFeat(feat.featId);
    if (!definition) continue;
    const list = definition.id === 'magic_initiate' ? magicInitiateList(draft, feat) : null;
    abilities.push({
      kind: 'feat',
      name: list ? `${definition.name} (${spellListLabel(list)})` : definition.name,
      source: feat.source,
      description: featDescription(draft, feat),
      data: {},
      ...(list ? withResource(`feat_magic_initiate_${list}`) : {}),
      sortOrder: order++,
    });
  }

  for (const spell of spells) {
    const srd = findSrdSpell(spell.name);
    if (!srd) continue;
    abilities.push({
      kind: 'spell',
      name: spell.name,
      source: clip(`${spell.source} · SRD 5.2`, 120),
      description: `${srd.level === 0 ? 'Truque' : `${srd.level}º círculo`} de ${spellSchoolLabels[srd.school].toLowerCase()}. ${spell.note}`.trim(),
      data: {
        circle: srd.level,
        school: srd.school,
        castingTime: srd.castingTime,
        range: srd.range,
        components: srd.components,
        duration: srd.duration,
        concentration: Boolean(srd.concentration),
        ritual: Boolean(srd.ritual),
        prepared: spell.prepared,
      },
      ...(spell.resource ? withResource(spell.resource.key) : {}),
      sortOrder: order++,
    });
  }

  // Ataques com as armas do equipamento inicial
  const masteries = new Set(selectionList(draft, 'class.weapon_mastery'));
  const martialBonus = extraMartial(draft);
  const seenWeapons = new Set<string>();
  for (const item of equipment.items) {
    const weapon = SRD_WEAPONS[item.catalogId];
    if (!weapon || seenWeapons.has(weapon.id) || !classDef) continue;
    seenWeapons.add(weapon.id);
    const monkWeapon = classDef.id === 'monk' && isMonkWeapon(weapon);
    const ability: Ability =
      weapon.kind === 'ranged' ? 'dex' : weapon.properties.includes('finesse') || monkWeapon ? (scores.dex > scores.str ? 'dex' : 'str') : 'str';
    let damage = weapon.damage;
    if (monkWeapon) {
      const art = `1${MONK_MARTIAL_ARTS_DIE[level - 1] ?? 'd6'}`;
      if (maxDamage(art) > maxDamage(damage)) damage = art;
    }
    const range =
      weapon.kind === 'ranged' && weapon.range
        ? `${formatDistance(weapon.range[0], UNIT).replace(' m', '')}/${formatDistance(weapon.range[1], UNIT)}`
        : weapon.range
          ? `${weapon.properties.includes('reach') ? '3 m' : '1,5 m'}; arremesso ${formatDistance(weapon.range[0], UNIT).replace(' m', '')}/${formatDistance(weapon.range[1], UNIT)}`
          : weapon.properties.includes('reach')
            ? '3 m'
            : '1,5 m';
    const properties = weapon.properties
      .map((property) => (property === 'versatile' && weapon.versatileDamage ? `Versátil (${weapon.versatileDamage})` : weaponPropertyLabels[property]))
      .join(', ');
    const mastery = weaponMasteryLabels[weapon.mastery];
    abilities.push({
      kind: 'attack',
      name: weapon.name,
      source: weapon.category === 'simple' ? 'Arma simples' : 'Arma marcial',
      description: [
        properties ? `Propriedades: ${properties}.` : '',
        masteries.has(weapon.id) ? `Maestria (${mastery.name}): ${mastery.description}` : `Maestria da arma: ${mastery.name} (você não a usa).`,
        isWeaponProficient(classDef, weapon, martialBonus) ? '' : 'Sem proficiência: não soma o bônus de proficiência.',
      ]
        .filter(Boolean)
        .join(' '),
      data: {
        ability,
        proficient: isWeaponProficient(classDef, weapon, martialBonus),
        bonus: weapon.kind === 'ranged' && featIds.includes('archery') ? 2 : 0,
        damage,
        damageType: damageTypeLabels[weapon.damageType],
        range,
      },
      sortOrder: order++,
    });
  }
  if (classDef?.id === 'monk') {
    abilities.push({
      kind: 'attack',
      name: 'Ataque desarmado',
      source: 'Artes Marciais',
      description: 'Soco, chute ou cabeçada. Pode ser feito como ação bônus (Artes Marciais).',
      data: {
        ability: scores.dex > scores.str ? 'dex' : 'str',
        proficient: true,
        bonus: 0,
        damage: `1${MONK_MARTIAL_ARTS_DIE[level - 1] ?? 'd6'}`,
        damageType: damageTypeLabels.bludgeoning,
        range: '1,5 m',
      },
      sortOrder: order++,
    });
  }

  // Inventário ------------------------------------------------------------------
  const items: ItemTemplate[] = equipment.items.map((item, index) => {
    const catalog = SRD_ITEMS[item.catalogId];
    const armor = SRD_ARMOR[item.catalogId];
    const tool = findTool(item.catalogId);
    return {
      name: clip(item.name, 120),
      category: catalog?.category ?? (tool ? 'tool' : 'gear'),
      quantity: item.quantity,
      weight: weightForUnit(catalog?.weightLb ?? tool?.weightLb ?? null, UNIT),
      description: catalog?.description ?? '',
      notes: '',
      isEquipped: Boolean(armor),
      sortOrder: index,
    };
  });

  return { name: draft.name.trim(), sheet, resources, abilities, items };
}

/** Prévia com os valores derivados, para a etapa de revisão. */
export function previewDnd5eCharacter(draft: Dnd5eDraft) {
  const built = buildDnd5eCharacterFromDraft(draft);
  return { ...built, derived: computeDnd5eDerived(built.sheet), combat: combatSummary(draft) };
}
