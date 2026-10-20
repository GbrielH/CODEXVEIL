/**
 * Criação de personagem do Tormenta20 (passo a passo): atributos, raça, classe, origem,
 * divindade, perícias, poderes, magias, equipamento e detalhes. As regras de cálculo ficam aqui;
 * o conteúdo (raças, classes…) vem de `T20Content`, montado dos livros importados.
 */
import { z } from 'zod';
import type { AbilityEntryTemplate, ItemTemplate, ResourceTemplate } from '../types';
import {
  T20_ATTRIBUTES,
  T20_POINT_BUY_BUDGET,
  T20_POINT_BUY_MAX,
  T20_POINT_BUY_MIN,
  T20_ROLL_MINIMUM_SUM,
  t20AttributeFromRoll,
  t20AttributeLabels,
  t20PointsSpent,
  type T20Attribute,
} from './attributes';
import {
  findT20Class,
  findT20Deity,
  findT20Origin,
  findT20PowerByName,
  findT20Race,
  plainT20,
  t20ChoiceOnlyPowers,
  t20ClassPowers,
  t20GeneralPowers,
  t20GrantedPowers,
  type T20Content,
  type T20Item,
} from './content';
import { t20HitPointsFor, t20ManaPointsFor } from './derived';
import { T20_STARTING_MONEY } from './progression';
import { t20DefaultResources } from './resources';
import { parseT20Sheet, type T20Sheet } from './sheet';
import { T20_SKILLS, T20_SKILL_IDS, t20SkillFromName, type T20Skill } from './skills';

export const T20_STEPS = ['inicio', 'atributos', 'raca', 'classe', 'origem', 'divindade', 'pericias', 'poderes', 'magias', 'equipamento', 'detalhes', 'revisao'] as const;
export type T20Step = (typeof T20_STEPS)[number];

export const t20StepLabels: Record<T20Step, string> = {
  inicio: 'Início',
  atributos: 'Atributos',
  raca: 'Raça',
  classe: 'Classe',
  origem: 'Origem',
  divindade: 'Divindade',
  pericias: 'Perícias',
  poderes: 'Poderes',
  magias: 'Magias',
  equipamento: 'Equipamento',
  detalhes: 'Detalhes',
  revisao: 'Revisão',
};

export type T20AttributeMethodChoice = 'pontos' | 'rolagem';
export type T20ArcanistPath = 'bruxo' | 'feiticeiro' | 'mago';

export interface T20Draft {
  name: string;
  level: number;
  attributeMethod: T20AttributeMethodChoice;
  /** Compra por pontos: valores de –1 a 4. */
  points: Record<T20Attribute, number>;
  /** Rolagens: seis totais (4d6, descarta o menor) e qual total vai em cada atributo (índice). */
  rolls: number[];
  rollAssignment: Record<T20Attribute, number | null>;
  raceId: string;
  /** Atributos escolhidos para o "+1 em três atributos diferentes". */
  raceAttributeChoices: T20Attribute[];
  raceVariant: string;
  /** Humano (Versátil): duas perícias; a segunda pode virar um poder geral. */
  raceSkills: T20Skill[];
  raceSkillPower: string;
  classId: string;
  /** Uma perícia de cada grupo "X ou Y" da classe. */
  classFixedChoices: T20Skill[];
  classSkills: T20Skill[];
  intSkills: T20Skill[];
  arcanistPath: T20ArcanistPath | '';
  /** Feiticeiro: linhagem escolhida (Dracônica, Feérica, Rubra…). */
  lineage: string;
  spellSchools: string[];
  originId: string;
  /** Dois benefícios da origem: `skill:<id>` ou `power:<nome>`. */
  originBenefits: string[];
  /** Benefício genérico ("um poder de combate à sua escolha") → id do poder escolhido. */
  originPowerChoices: Record<string, string>;
  deityId: string;
  grantedPowerId: string;
  /** Poder escolhido em cada nível com "Poder de <classe>" (id do poder). */
  levelPowers: Record<string, string>;
  spellIds: string[];
  equipment: { simple: string; martial: string; armor: string; shield: boolean };
  /** Dinheiro inicial (4d6 rolado no 1º nível). */
  money: number | null;
  appearance: string;
  personality: string;
  history: string;
  /** Ficha pessoal: livros escolhidos (ids dos livros importados). Na campanha valem os do mestre. */
  sourcebooks: string[];
}

export function createT20Draft(level = 1, method: T20AttributeMethodChoice = 'pontos'): T20Draft {
  const zero = Object.fromEntries(T20_ATTRIBUTES.map((key) => [key, 0])) as Record<T20Attribute, number>;
  const none = Object.fromEntries(T20_ATTRIBUTES.map((key) => [key, null])) as Record<T20Attribute, number | null>;
  return {
    name: '',
    level,
    attributeMethod: method,
    points: zero,
    rolls: [],
    rollAssignment: none,
    raceId: '',
    raceAttributeChoices: [],
    raceVariant: '',
    raceSkills: [],
    raceSkillPower: '',
    classId: '',
    classFixedChoices: [],
    classSkills: [],
    intSkills: [],
    arcanistPath: '',
    lineage: '',
    spellSchools: [],
    originId: '',
    originBenefits: [],
    originPowerChoices: {},
    deityId: '',
    grantedPowerId: '',
    levelPowers: {},
    spellIds: [],
    equipment: { simple: '', martial: '', armor: '', shield: false },
    money: null,
    appearance: '',
    personality: '',
    history: '',
    sourcebooks: [],
  };
}

export interface T20Issue {
  step: T20Step;
  path: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------

/** Valores antes da raça (pontos ou rolagens); `null` se ainda não definidos. */
export function t20BaseAttributes(draft: T20Draft): Record<T20Attribute, number | null> {
  if (draft.attributeMethod === 'pontos') return { ...draft.points };
  return Object.fromEntries(
    T20_ATTRIBUTES.map((key) => {
      const index = draft.rollAssignment[key];
      return [key, index === null || draft.rolls[index] === undefined ? null : t20AttributeFromRoll(draft.rolls[index])];
    }),
  ) as Record<T20Attribute, number | null>;
}

/** Modificadores da raça (fixos, variante e os +1 escolhidos). */
export function t20RaceModifiers(content: T20Content, draft: T20Draft): Record<T20Attribute, number> {
  const mods = Object.fromEntries(T20_ATTRIBUTES.map((key) => [key, 0])) as Record<T20Attribute, number>;
  const race = findT20Race(content, draft.raceId);
  if (!race) return mods;
  for (const [key, value] of Object.entries(race.attributes)) mods[key as T20Attribute] += value;
  const variant = race.variants.find((entry) => entry.name === draft.raceVariant);
  for (const [key, value] of Object.entries(variant?.attributes ?? {})) mods[key as T20Attribute] += value;
  if (race.attributeChoice) for (const key of draft.raceAttributeChoices.slice(0, race.attributeChoice.count)) mods[key] += race.attributeChoice.value;
  return mods;
}

/** Atributos finais (base + raça); atributos indefinidos contam como 0. */
export function t20FinalAttributes(content: T20Content, draft: T20Draft): Record<T20Attribute, number> {
  const base = t20BaseAttributes(draft);
  const race = t20RaceModifiers(content, draft);
  return Object.fromEntries(T20_ATTRIBUTES.map((key) => [key, (base[key] ?? 0) + race[key]])) as Record<T20Attribute, number>;
}

/** Rola 4d6 descartando o menor, seis vezes; repete o menor até a soma dos atributos ser ≥ 6. */
export function rollT20Attributes(random: () => number = Math.random): number[] {
  const d6 = () => 1 + Math.floor(random() * 6);
  const roll = () => {
    const dice = [d6(), d6(), d6(), d6()].sort((a, b) => a - b);
    return dice[1]! + dice[2]! + dice[3]!;
  };
  const rolls = Array.from({ length: 6 }, roll);
  for (let guard = 0; guard < 50 && rolls.reduce((sum, value) => sum + t20AttributeFromRoll(value), 0) < T20_ROLL_MINIMUM_SUM; guard += 1) {
    const lowest = rolls.indexOf(Math.min(...rolls));
    rolls[lowest] = roll();
  }
  return rolls;
}

// ---------------------------------------------------------------------------
// Classe: perícias, magias, poderes por nível
// ---------------------------------------------------------------------------

const DEVOTED_CLASSES = ['clerigo', 'druida', 'paladino'];

export function t20ClassOf(content: T20Content, draft: T20Draft) {
  return findT20Class(content, draft.classId);
}

function isArcanist(klass: T20Item<'class'> | undefined) {
  return Boolean(klass && plainT20(klass.name) === 'arcanista');
}

/** Atributo-chave das magias: o da classe; arcanista pelo caminho (feiticeiro usa Carisma). */
export function t20SpellAttribute(content: T20Content, draft: T20Draft): T20Attribute | null {
  const klass = t20ClassOf(content, draft);
  if (!klass?.spellcasting) return null;
  if (isArcanist(klass)) return draft.arcanistPath === 'feiticeiro' ? 'car' : 'int';
  return klass.spellcasting.attribute;
}

/** Maior círculo de magia no nível de classe. */
export function t20MaxCircle(klass: T20Item<'class'>, level: number): number {
  const circles = Object.entries(klass.spellcasting?.circles ?? {}).filter(([, from]) => from <= level);
  return circles.reduce((max, [circle]) => Math.max(max, Number(circle)), 0);
}

/** Quantas magias o personagem conhece no nível (iniciais + aprendidas por nível). */
export function t20SpellCount(content: T20Content, draft: T20Draft): number {
  const klass = t20ClassOf(content, draft);
  if (!klass?.spellcasting) return 0;
  const { initial, learnEvery } = klass.spellcasting;
  let learned = 0;
  for (let level = 2; level <= draft.level; level += 1) {
    if (isArcanist(klass) && draft.arcanistPath === 'feiticeiro') learned += level % 2 === 1 ? 1 : 0;
    else if (level % learnEvery === 0) learned += 1;
  }
  return initial + learned;
}

/** Magias que a classe pode aprender no nível (tipo, círculo e escolas escolhidas). */
export function t20AvailableSpells(content: T20Content, draft: T20Draft): T20Item<'spell'>[] {
  const klass = t20ClassOf(content, draft);
  if (!klass?.spellcasting) return [];
  const maxCircle = t20MaxCircle(klass, draft.level);
  const type = klass.spellcasting.type;
  const schools = new Set(draft.spellSchools.map(plainT20));
  return content.spells.filter(
    (spell) =>
      spell.circle <= maxCircle &&
      (spell.type === type || spell.type === 'universal') &&
      (klass.spellcasting!.schoolsChoice === 0 || schools.size === 0 || schools.has(plainT20(spell.school))),
  );
}

export const T20_SPELL_SCHOOLS = ['Abjuração', 'Adivinhação', 'Convocação', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação'] as const;

/** Níveis em que a classe ganha um poder (a tabela cita "Poder de <classe>"). */
export function t20PowerLevels(klass: T20Item<'class'>, level: number): number[] {
  const levels: number[] = [];
  for (let current = 2; current <= level; current += 1) {
    if (/poder de /i.test(klass.table[String(current)] ?? '')) levels.push(current);
  }
  return levels;
}

/** Linhagens do feiticeiro (seção "Linhagens Sobrenaturais" do arcanista). */
export function t20Lineages(klass: T20Item<'class'> | undefined): string[] {
  const section = klass?.sections.find((entry) => /linhage/i.test(entry.title));
  if (!section) return [];
  const names = new Set<string>();
  for (const match of section.text.matchAll(/Linhagem [A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõç]+/g)) names.add(match[0]);
  return [...names];
}

// ---------------------------------------------------------------------------
// Perícias
// ---------------------------------------------------------------------------

function originSkills(draft: T20Draft): T20Skill[] {
  return draft.originBenefits.filter((entry) => entry.startsWith('skill:')).map((entry) => entry.slice(6) as T20Skill);
}

/** Perícias treinadas que vêm de graça (fixas da classe, escolhas "X ou Y" e origem). */
export function t20GrantedSkills(content: T20Content, draft: T20Draft): T20Skill[] {
  const klass = t20ClassOf(content, draft);
  return [...new Set([...(klass?.skillsFixed ?? []), ...draft.classFixedChoices, ...originSkills(draft)])];
}

/** Todas as perícias treinadas do rascunho. */
export function t20TrainedSkills(content: T20Content, draft: T20Draft): T20Skill[] {
  return [...new Set([...t20GrantedSkills(content, draft), ...draft.classSkills, ...draft.intSkills, ...draft.raceSkills])];
}

function raceIsVersatile(race: T20Item<'species'> | undefined) {
  return Boolean(race?.abilities.some((ability) => plainT20(ability.name) === 'versatil'));
}

// ---------------------------------------------------------------------------
// Divindade
// ---------------------------------------------------------------------------

export function t20MustBeDevoted(content: T20Content, draft: T20Draft): boolean {
  const klass = t20ClassOf(content, draft);
  return Boolean(klass && DEVOTED_CLASSES.includes(plainT20(klass.name)));
}

/** Divindades que aceitam a raça ou a classe (humanos e clérigos podem qualquer uma). */
export function t20EligibleDeities(content: T20Content, draft: T20Draft): T20Item<'deity'>[] {
  const race = findT20Race(content, draft.raceId);
  const klass = t20ClassOf(content, draft);
  const raceName = plainT20(race?.name ?? '');
  const className = plainT20(klass?.name ?? '');
  if (raceName === 'humano' || className === 'clerigo') return content.deities;
  return content.deities.filter((deity) => {
    const devotos = plainT20(deity.details['Devotos'] ?? '');
    if (!devotos || devotos.startsWith('quaisquer')) return true;
    const stem = (word: string) => word.slice(0, Math.max(4, word.length - 2));
    return (raceName && devotos.includes(stem(raceName.split(/[/ ]/)[0]!))) || (className && devotos.includes(stem(className)));
  });
}

// ---------------------------------------------------------------------------
// Poderes
// ---------------------------------------------------------------------------

/** Pré-requisitos que o Codexveil confere: atributos, perícias treinadas, nível e poderes. */
export function t20PrerequisiteProblems(
  prerequisite: string,
  context: { attributes: Record<T20Attribute, number>; skills: readonly T20Skill[]; level: number; powers: readonly string[]; content: T20Content },
): string[] {
  const problems: string[] = [];
  if (!prerequisite) return problems;
  for (const raw of prerequisite.split(/,|\be\b(?=\s+[A-ZÁÉ])/)) {
    const part = raw.trim().replace(/\.$/, '');
    if (!part) continue;
    const attr = /^(For|Des|Con|Int|Sab|Car)\s+(-?\d+)/i.exec(part);
    if (attr) {
      const key = attr[1]!.toLowerCase() as T20Attribute;
      if (context.attributes[key] < Number(attr[2])) problems.push(`${t20AttributeLabels[key].abbreviation} ${attr[2]}`);
      continue;
    }
    const trained = /treinado em ([^,]+)/i.exec(part);
    if (trained) {
      const skill = t20SkillFromName(trained[1]!);
      if (skill && !context.skills.includes(skill)) problems.push(`treinado em ${T20_SKILLS[skill].label}`);
      continue;
    }
    const level = /(\d+)º nível/i.exec(part);
    if (level) {
      if (context.level < Number(level[1])) problems.push(`${level[1]}º nível`);
      continue;
    }
    const power = findT20PowerByName(context.content, part);
    if (power && !context.powers.some((name) => plainT20(name) === plainT20(power.name))) problems.push(power.name);
  }
  return problems;
}

/** Poderes que podem ser escolhidos num nível da classe (da classe ou gerais). */
export function t20PowerOptions(content: T20Content, draft: T20Draft): T20Item<'feat'>[] {
  const klass = t20ClassOf(content, draft);
  // Poderes que só vêm de uma habilidade com escolha (ex.: Égide Sagrada) não entram na lista.
  const choiceOnly = t20ChoiceOnlyPowers(klass ?? null);
  return [...(klass ? t20ClassPowers(content, klass.name) : []), ...t20GeneralPowers(content)].filter((power) => !choiceOnly.has(plainT20(power.name)));
}

/**
 * Benefício de origem genérico ("um poder de combate a sua escolha", "um poder geral…"): grupos de
 * poderes de onde a escolha sai. `null` quando o benefício já é um poder com nome.
 */
export function t20GenericPowerGroups(benefitName: string): string[] | null {
  const text = plainT20(benefitName);
  if (!text.includes('a sua escolha') && !text.startsWith('um poder')) return null;
  for (const group of ['combate', 'destino', 'magia', 'tormenta']) if (text.includes(group)) return [group];
  return ['combate', 'destino', 'magia', 'tormenta'];
}

/** Poderes que podem ser escolhidos num benefício genérico da origem. */
export function t20GenericPowerOptions(content: T20Content, benefitName: string): T20Item<'feat'>[] {
  const groups = t20GenericPowerGroups(benefitName) ?? [];
  return content.powers.filter((power) => groups.includes(power.group));
}

/** Poder efetivo de um benefício de origem `power:<nome>` (o escolhido, se for genérico). */
function originBenefitPower(content: T20Content, draft: T20Draft, name: string, originName?: string): T20Item<'feat'> | undefined {
  if (t20GenericPowerGroups(name)) return content.powers.find((power) => power.id === draft.originPowerChoices[name]);
  return findT20PowerByName(content, name, originName);
}

/** Nomes dos poderes que o personagem tem no rascunho (origem, concedido, níveis, humano). */
export function t20DraftPowerNames(content: T20Content, draft: T20Draft): string[] {
  const names: string[] = [];
  for (const benefit of draft.originBenefits) {
    if (!benefit.startsWith('power:')) continue;
    const name = benefit.slice(6);
    const chosen = t20GenericPowerGroups(name) ? originBenefitPower(content, draft, name)?.name : name;
    if (chosen) names.push(chosen);
  }
  const granted = content.powers.find((power) => power.id === draft.grantedPowerId);
  if (granted) names.push(granted.name);
  const raceSkillPower = content.powers.find((power) => power.id === draft.raceSkillPower);
  if (raceSkillPower) names.push(raceSkillPower.name);
  for (const id of Object.values(draft.levelPowers)) {
    const power = content.powers.find((entry) => entry.id === id);
    if (power) names.push(power.name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Equipamento
// ---------------------------------------------------------------------------

const STARTING_LIGHT_ARMORS = ['armadura de couro', 'couro batido', 'gibao de peles'];

export function t20EquipmentOptions(content: T20Content, draft: T20Draft) {
  const klass = t20ClassOf(content, draft);
  const weapons = content.equipment.filter((item) => item.group === 'arma' && item.damage && item.damage !== '—');
  const armors = content.equipment.filter((item) => item.group === 'armadura');
  const proficiency = klass?.proficiencies ?? { weapons: ['simples'], armors: ['leves'], text: '' };
  const noArmor = isArcanist(klass);
  return {
    simple: weapons.filter((item) => item.category === 'simples'),
    martial: proficiency.weapons.includes('marciais') ? weapons.filter((item) => item.category === 'marciais') : [],
    armors: noArmor
      ? []
      : armors.filter(
          (item) => STARTING_LIGHT_ARMORS.includes(plainT20(item.name)) || (proficiency.armors.includes('pesadas') && plainT20(item.name) === 'brunea'),
        ),
    shield: !noArmor && proficiency.armors.includes('escudos') ? armors.find((item) => plainT20(item.name) === 'escudo leve') : undefined,
  };
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export function t20DraftIssues(content: T20Content, draft: T20Draft, context: { allowedMethods?: readonly T20AttributeMethodChoice[] } = {}): T20Issue[] {
  const issues: T20Issue[] = [];
  const add = (step: T20Step, path: string, message: string) => issues.push({ step, path, message });

  if (!draft.name.trim()) add('inicio', 'name', 'Dê um nome ao personagem.');
  if (context.allowedMethods && !context.allowedMethods.includes(draft.attributeMethod)) add('atributos', 'attributeMethod', 'O mestre não liberou este método de atributos.');

  // Atributos
  if (draft.attributeMethod === 'pontos') {
    const spent = t20PointsSpent(draft.points);
    if (T20_ATTRIBUTES.some((key) => draft.points[key] < T20_POINT_BUY_MIN || draft.points[key] > T20_POINT_BUY_MAX)) add('atributos', 'points', 'Na compra por pontos, os valores vão de –1 a 4.');
    if (spent > T20_POINT_BUY_BUDGET) add('atributos', 'points', `Você gastou ${spent} pontos; o limite é ${T20_POINT_BUY_BUDGET}.`);
  } else {
    if (draft.rolls.length !== 6) add('atributos', 'rolls', 'Role os atributos.');
    const used = T20_ATTRIBUTES.map((key) => draft.rollAssignment[key]);
    if (used.some((value) => value === null)) add('atributos', 'rollAssignment', 'Distribua um resultado em cada atributo.');
    else if (new Set(used).size !== 6) add('atributos', 'rollAssignment', 'Cada resultado só pode ir em um atributo.');
  }

  // Raça
  const race = findT20Race(content, draft.raceId);
  if (!race) add('raca', 'raceId', 'Escolha uma raça.');
  else {
    if (race.attributeChoice) {
      const picks = new Set(draft.raceAttributeChoices);
      if (picks.size !== race.attributeChoice.count || draft.raceAttributeChoices.length !== race.attributeChoice.count) {
        add('raca', 'raceAttributeChoices', `Escolha ${race.attributeChoice.count} atributos diferentes para o bônus da raça.`);
      }
      if (draft.raceAttributeChoices.some((key) => race.attributeChoice!.exclude.includes(key))) add('raca', 'raceAttributeChoices', 'Um dos atributos escolhidos não pode receber o bônus desta raça.');
    }
    if (race.variants.length > 0 && !race.variants.some((variant) => variant.name === draft.raceVariant)) add('raca', 'raceVariant', 'Escolha a variante da raça.');
    if (raceIsVersatile(race)) {
      const wanted = draft.raceSkillPower ? 1 : 2;
      if (draft.raceSkills.length !== wanted) add('pericias', 'raceSkills', `Versátil: escolha ${wanted === 2 ? 'duas perícias' : 'uma perícia'}${draft.raceSkillPower ? ' (a outra virou um poder)' : ''}.`);
    }
  }

  // Classe
  const klass = t20ClassOf(content, draft);
  if (!klass) add('classe', 'classId', 'Escolha uma classe.');
  else {
    if (draft.classFixedChoices.length !== klass.skillsFixedChoices.length) add('pericias', 'classFixedChoices', 'Escolha as perícias de classe com opção ("Luta ou Pontaria").');
    if (draft.classSkills.length !== klass.skillsChoice.count) add('pericias', 'classSkills', `Escolha ${klass.skillsChoice.count} perícias da classe.`);
    if (draft.classSkills.some((skill) => !klass.skillsChoice.options.includes(skill))) add('pericias', 'classSkills', 'Uma das perícias escolhidas não é da lista da classe.');
    if (isArcanist(klass) && !draft.arcanistPath) add('classe', 'arcanistPath', 'Escolha o caminho do arcanista.');
    if (isArcanist(klass) && draft.arcanistPath === 'feiticeiro' && t20Lineages(klass).length > 0 && !draft.lineage) add('classe', 'lineage', 'Escolha a linhagem do feiticeiro.');
    if (klass.spellcasting && klass.spellcasting.schoolsChoice > 0 && draft.spellSchools.length !== klass.spellcasting.schoolsChoice) {
      add('magias', 'spellSchools', `Escolha ${klass.spellcasting.schoolsChoice} escolas de magia.`);
    }
  }

  // Perícias por Inteligência
  const finalAttributes = t20FinalAttributes(content, draft);
  const intCount = Math.max(0, finalAttributes.int);
  if (draft.intSkills.length !== intCount) add('pericias', 'intSkills', intCount ? `Escolha ${intCount} perícia(s) pela Inteligência.` : 'Sem perícias extras pela Inteligência.');
  const allTrained = [...t20GrantedSkills(content, draft), ...draft.classSkills, ...draft.intSkills, ...draft.raceSkills];
  if (new Set(allTrained).size !== allTrained.length) add('pericias', 'skills', 'Há perícias repetidas: troque as que já vêm treinadas.');

  // Origem
  const origin = findT20Origin(content, draft.originId);
  if (!origin) add('origem', 'originId', 'Escolha uma origem.');
  else if (origin.benefitSkills.length + origin.benefitPowers.length > 0 && draft.originBenefits.length !== 2) add('origem', 'originBenefits', 'Escolha dois benefícios da origem.');
  for (const benefit of draft.originBenefits) {
    const name = benefit.startsWith('power:') ? benefit.slice(6) : '';
    if (name && t20GenericPowerGroups(name) && !originBenefitPower(content, draft, name)) add('origem', 'originPowerChoices', `Escolha o poder de "${name}".`);
  }

  // Divindade
  if (t20MustBeDevoted(content, draft) && !draft.deityId) add('divindade', 'deityId', 'Sua classe exige ser devoto de uma divindade.');
  if (draft.deityId) {
    const deity = findT20Deity(content, draft.deityId);
    if (!deity) add('divindade', 'deityId', 'Divindade inválida.');
    else {
      if (!t20EligibleDeities(content, draft).some((entry) => entry.id === deity.id)) add('divindade', 'deityId', 'Sua raça ou classe não pode ser devota desta divindade.');
      if (!t20GrantedPowers(content, deity.name).some((power) => power.id === draft.grantedPowerId)) add('divindade', 'grantedPowerId', 'Escolha um poder concedido da divindade.');
    }
  }

  // Poderes por nível
  if (klass) {
    const powers = t20DraftPowerNames(content, draft);
    for (const level of t20PowerLevels(klass, draft.level)) {
      const chosen = content.powers.find((power) => power.id === draft.levelPowers[String(level)]);
      if (!chosen) {
        add('poderes', `levelPowers.${level}`, `Escolha o poder do ${level}º nível.`);
        continue;
      }
      const problems = t20PrerequisiteProblems(chosen.prerequisite, {
        attributes: finalAttributes,
        skills: t20TrainedSkills(content, draft),
        level,
        powers: powers.filter((name) => plainT20(name) !== plainT20(chosen.name)),
        content,
      });
      if (problems.length) add('poderes', `levelPowers.${level}`, `${chosen.name}: falta ${problems.join(', ')}.`);
    }
    const repeated = Object.values(draft.levelPowers).filter((id, index, all) => all.indexOf(id) !== index);
    if (repeated.length) add('poderes', 'levelPowers', 'O mesmo poder foi escolhido mais de uma vez.');
  }

  // Magias
  if (klass?.spellcasting) {
    const wanted = t20SpellCount(content, draft);
    const available = new Set(t20AvailableSpells(content, draft).map((spell) => spell.id));
    if (draft.spellIds.length !== wanted) add('magias', 'spellIds', `Escolha ${wanted} magias.`);
    if (draft.spellIds.some((id) => !available.has(id))) add('magias', 'spellIds', 'Uma das magias não pode ser aprendida pela sua classe neste nível.');
  }

  // Equipamento
  const options = t20EquipmentOptions(content, draft);
  if (options.simple.length && !draft.equipment.simple) add('equipamento', 'equipment.simple', 'Escolha uma arma simples.');
  if (options.martial.length && !draft.equipment.martial) add('equipamento', 'equipment.martial', 'Escolha uma arma marcial.');
  if (options.armors.length && !draft.equipment.armor) add('equipamento', 'equipment.armor', 'Escolha a armadura.');
  if (draft.level === 1 && draft.money === null) add('equipamento', 'money', 'Role o dinheiro inicial (4d6 T$).');

  return issues;
}

// ---------------------------------------------------------------------------
// Montagem da ficha
// ---------------------------------------------------------------------------

/** PV extras de habilidades de raça ("+3 pontos de vida no 1º nível e +1 por nível seguinte"). */
function raceHitPointBonus(race: T20Item<'species'> | undefined, level: number): number {
  for (const ability of race?.abilities ?? []) {
    const match = /\+(\d+) pontos de vida no 1º nível e \+(\d+) por nível/i.exec(ability.text);
    if (match) return Number(match[1]) + Number(match[2]) * (level - 1);
  }
  return 0;
}

export function t20StartingMoney(draft: T20Draft): number {
  const value = T20_STARTING_MONEY[draft.level];
  return value === '4d6' || value === undefined ? (draft.money ?? 0) : value;
}

export interface T20BuiltCharacter {
  name: string;
  sheet: T20Sheet;
  resources: ResourceTemplate[];
  items: ItemTemplate[];
  abilities: AbilityEntryTemplate[];
}

export function buildT20Character(content: T20Content, draft: T20Draft, sourcebooks: readonly string[] = []): T20BuiltCharacter {
  const race = findT20Race(content, draft.raceId);
  const klass = t20ClassOf(content, draft);
  const origin = findT20Origin(content, draft.originId);
  const deity = findT20Deity(content, draft.deityId);
  const attributes = t20FinalAttributes(content, draft);
  const spellAttribute = t20SpellAttribute(content, draft);
  const trained = t20TrainedSkills(content, draft).filter((skill) => (T20_SKILL_IDS as readonly string[]).includes(skill));

  const hitPoints = klass ? t20HitPointsFor([{ pvInitial: klass.pvInitial, pvPerLevel: klass.pvPerLevel, level: draft.level }], attributes.con, raceHitPointBonus(race, draft.level)) : 1;
  const manaPoints = klass
    ? t20ManaPointsFor([{ pmPerLevel: klass.pmPerLevel, level: draft.level }], klass.spellcasting?.addsAttributeToPm && spellAttribute ? attributes[spellAttribute] : 0)
    : 0;

  const options = t20EquipmentOptions(content, draft);
  const armor = options.armors.find((item) => item.id === draft.equipment.armor);
  const shield = draft.equipment.shield ? options.shield : undefined;
  const heavy = armor?.category === 'armaduras pesadas';

  const powerRefs: { key: string; name: string; source: string; level: number }[] = [];
  const pushPower = (power: T20Item<'feat'> | undefined, source: string, level: number) => {
    if (power) powerRefs.push({ key: power.id, name: power.name, source, level });
  };
  for (const benefit of draft.originBenefits) {
    if (benefit.startsWith('power:')) pushPower(originBenefitPower(content, draft, benefit.slice(6), origin?.name), `Origem: ${origin?.name ?? ''}`, 1);
  }
  pushPower(content.powers.find((power) => power.id === draft.grantedPowerId), `Devoto de ${deity?.name ?? ''}`, 1);
  pushPower(content.powers.find((power) => power.id === draft.raceSkillPower), `Raça: ${race?.name ?? ''} (Versátil)`, 1);
  for (const [level, id] of Object.entries(draft.levelPowers)) {
    if (klass && t20PowerLevels(klass, draft.level).includes(Number(level))) pushPower(content.powers.find((power) => power.id === id), `${klass.name} ${level}º nível`, Number(level));
  }

  const spells = draft.spellIds
    .map((id) => content.spells.find((spell) => spell.id === id))
    .filter((spell): spell is T20Item<'spell'> => Boolean(spell));

  const sheet = parseT20Sheet({
    identity: {
      race: race?.name ?? '',
      raceKey: race?.id ?? '',
      raceVariant: draft.raceVariant,
      origin: origin?.name ?? '',
      originKey: origin?.id ?? '',
      deity: deity?.name ?? '',
      deityKey: deity?.id ?? '',
      classes: klass ? [{ key: klass.id, name: klass.name, level: draft.level }] : [],
      size: race?.size ?? 'medio',
      speed: Math.max(0, (race?.speed ?? 9) - (heavy ? 3 : 0)),
      appearance: draft.appearance,
      personality: draft.personality,
      history: draft.history,
      sourcebooks: [...sourcebooks],
    },
    attributes,
    skills: { trained, bonuses: {}, crafts: [] },
    hitPoints: { max: hitPoints },
    manaPoints: { max: manaPoints },
    defense: {
      armor: armor?.defense ?? 0,
      shield: shield?.defense ?? 0,
      other: 0,
      useDexterity: !heavy,
      armorPenalty: (armor?.penalty ?? 0) + (shield?.penalty ?? 0),
    },
    proficiencies: { weapons: klass?.proficiencies.weapons ?? ['simples'], armors: klass?.proficiencies.armors ?? ['leves'], other: klass?.proficiencies.text ?? '' },
    powers: powerRefs,
    spells: { attribute: spellAttribute, known: spells.map((spell) => ({ key: spell.id, name: spell.name, source: klass?.name ?? '', circle: spell.circle, type: spell.type })) },
  });

  // Inventário: kit de todo aventureiro, armas, armadura, escudo e os itens da origem.
  const items: ItemTemplate[] = [];
  // `weight` guarda os espaços do item (Tormenta20), lidos do livro quando houver.
  const spacesOf = (item: T20Item<'equipment'> | undefined) => {
    const value = Number.parseFloat((item?.spaces ?? '').replace(',', '.'));
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const addItem = (name: string, category: ItemTemplate['category'], description = '', equipped = false, spaces: number | null = null) =>
    items.push({ name: name.slice(0, 120), category, quantity: 1, weight: spaces, description: description.slice(0, 4000), notes: '', isEquipped: equipped, sortOrder: items.length });
  addItem('Mochila', 'gear');
  addItem('Saco de dormir', 'gear');
  addItem('Traje de viajante', 'gear');
  const weaponText = (item: T20Item<'equipment'> | undefined) =>
    item ? [`Dano ${item.damage}`, `crítico ${item.critical}`, item.range && item.range !== '—' ? `alcance ${item.range}` : '', item.damageType].filter(Boolean).join(', ') : '';
  const simple = options.simple.find((item) => item.id === draft.equipment.simple);
  const martial = options.martial.find((item) => item.id === draft.equipment.martial);
  if (simple) addItem(simple.name, 'weapon', weaponText(simple), true, spacesOf(simple));
  if (martial) addItem(martial.name, 'weapon', weaponText(martial), true, spacesOf(martial));
  if (armor) addItem(armor.name, 'armor', `Defesa +${armor.defense ?? 0}, penalidade ${armor.penalty ?? 0}`, true, spacesOf(armor));
  if (shield) addItem(shield.name, 'armor', `Defesa +${shield.defense ?? 0}, penalidade ${shield.penalty ?? 0}`, true, spacesOf(shield));
  if (origin?.items) addItem(`Itens da origem (${origin.name})`, 'gear', origin.items);

  // Habilidades: raça, classe até o nível, poderes e magias.
  const abilities: AbilityEntryTemplate[] = [];
  const addAbility = (entry: Omit<AbilityEntryTemplate, 'sortOrder'>) => abilities.push({ ...entry, sortOrder: abilities.length });
  for (const ability of race?.abilities ?? []) addAbility({ kind: 'species_trait', name: ability.name, source: race!.name, description: ability.text, data: {} });
  for (const ability of klass?.abilities ?? []) {
    if (ability.level > draft.level || /^poder de /i.test(ability.name)) continue;
    const description = ability.options.length ? `${ability.text}\n\n${ability.options.map((option) => `• ${option.name}. ${option.text}`).join('\n')}` : ability.text;
    addAbility({ kind: 'class_feature', name: ability.name, source: `${klass!.name} ${ability.level}º nível`, description, data: { level: ability.level } });
  }
  if (isArcanist(klass) && draft.arcanistPath) {
    const path = klass!.abilities.flatMap((ability) => ability.options).find((option) => plainT20(option.name) === draft.arcanistPath);
    if (path) addAbility({ kind: 'class_feature', name: `Caminho: ${path.name}`, source: klass!.name, description: path.text, data: {} });
  }
  if (draft.lineage) {
    const section = klass?.sections.find((entry) => /linhage/i.test(entry.title));
    addAbility({ kind: 'class_feature', name: draft.lineage, source: 'Feiticeiro', description: section?.text ?? '', data: {} });
  }
  for (const power of origin?.uniquePowers ?? []) {
    if (powerRefs.some((ref) => plainT20(ref.name) === plainT20(power.name))) continue;
    if (draft.originBenefits.some((benefit) => benefit === `power:${power.name}`)) addAbility({ kind: 'background_feature', name: power.name, source: origin!.name, description: power.text, data: {} });
  }
  for (const ref of powerRefs) {
    const power = content.powers.find((entry) => entry.id === ref.key);
    addAbility({ kind: 'feat', name: ref.name, source: ref.source, description: power?.text ?? '', data: { prerequisite: power?.prerequisite ?? '' } });
  }
  for (const spell of spells) {
    const header = [`${spell.type} ${spell.circle} (${spell.school})`, spell.execution && `Execução: ${spell.execution}`, spell.range && `Alcance: ${spell.range}`, spell.duration && `Duração: ${spell.duration}`]
      .filter(Boolean)
      .join(' · ');
    const upgrades = spell.upgrades.map((upgrade) => `+${upgrade.cost} PM: ${upgrade.text}`).join('\n');
    addAbility({
      kind: 'spell',
      name: spell.name,
      source: klass?.name ?? '',
      description: [header, spell.text, upgrades].filter(Boolean).join('\n\n').slice(0, 12000),
      data: { circle: spell.circle, type: spell.type, school: spell.school, cost: [1, 3, 6, 10, 15][spell.circle - 1] ?? 1 },
    });
  }

  return {
    name: draft.name.trim(),
    sheet,
    resources: t20DefaultResources(sheet, t20StartingMoney(draft)),
    items,
    abilities,
  };
}

// ---------------------------------------------------------------------------
// Leitura do rascunho recebido do navegador (servidor)
// ---------------------------------------------------------------------------

const shortText = (max: number) => z.string().trim().max(max).catch('');
const idList = (max: number) => z.array(z.string().trim().min(1).max(160)).max(max).catch([]);
const attributeNumbers = (min: number, max: number) =>
  z.object(Object.fromEntries(T20_ATTRIBUTES.map((key) => [key, z.number().int().min(min).max(max).catch(0)])) as Record<T20Attribute, z.ZodCatch<z.ZodNumber>>);

const t20DraftSchema = z.object({
  name: shortText(80),
  level: z.number().int().min(1).max(20).catch(1),
  attributeMethod: z.enum(['pontos', 'rolagem']).catch('pontos'),
  points: attributeNumbers(-1, 4).catch(createT20Draft().points),
  rolls: z.array(z.number().int().min(3).max(18)).max(6).catch([]),
  rollAssignment: z
    .object(Object.fromEntries(T20_ATTRIBUTES.map((key) => [key, z.number().int().min(0).max(5).nullable().catch(null)])) as Record<T20Attribute, z.ZodCatch<z.ZodNullable<z.ZodNumber>>>)
    .catch(createT20Draft().rollAssignment),
  raceId: shortText(160),
  raceAttributeChoices: z.array(z.enum(T20_ATTRIBUTES)).max(6).catch([]),
  raceVariant: shortText(80),
  raceSkills: z.array(z.enum(T20_SKILL_IDS as [T20Skill, ...T20Skill[]])).max(4).catch([]),
  raceSkillPower: shortText(160),
  classId: shortText(160),
  classFixedChoices: z.array(z.enum(T20_SKILL_IDS as [T20Skill, ...T20Skill[]])).max(4).catch([]),
  classSkills: z.array(z.enum(T20_SKILL_IDS as [T20Skill, ...T20Skill[]])).max(12).catch([]),
  intSkills: z.array(z.enum(T20_SKILL_IDS as [T20Skill, ...T20Skill[]])).max(12).catch([]),
  arcanistPath: z.enum(['bruxo', 'feiticeiro', 'mago', '']).catch(''),
  lineage: shortText(80),
  spellSchools: z.array(z.string().trim().max(40)).max(8).catch([]),
  originId: shortText(160),
  originBenefits: z.array(z.string().trim().max(160)).max(4).catch([]),
  originPowerChoices: z.record(z.string().max(160), z.string().trim().max(160)).catch({}),
  deityId: shortText(160),
  grantedPowerId: shortText(160),
  levelPowers: z.record(z.string().max(4), z.string().trim().max(160)).catch({}),
  spellIds: idList(60),
  equipment: z
    .object({ simple: shortText(160), martial: shortText(160), armor: shortText(160), shield: z.boolean().catch(false) })
    .catch({ simple: '', martial: '', armor: '', shield: false }),
  money: z.number().int().min(4).max(24).nullable().catch(null),
  appearance: shortText(4000),
  personality: shortText(4000),
  history: shortText(20000),
  sourcebooks: z.array(z.string().trim().min(1).max(80)).max(60).catch([]),
});

/** Rascunho vindo de fora (navegador): campos inválidos voltam ao padrão em vez de lançar. */
export function parseT20Draft(input: unknown): T20Draft {
  return t20DraftSchema.parse(input && typeof input === 'object' ? input : {});
}
