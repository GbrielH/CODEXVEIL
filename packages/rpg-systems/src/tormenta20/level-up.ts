/**
 * Subida de nível do Tormenta20 (numa classe que o personagem já tem): PV e PM do nível,
 * habilidades novas da tabela da classe, poder de classe (quando a tabela diz "Poder de…") e
 * magias novas. A tela mostra o plano; `applyT20LevelUp` monta a ficha e as entradas novas.
 */
import type { AbilityEntryTemplate } from '../types';
import {
  findT20Class,
  isT20AttributeIncrease,
  plainT20,
  t20ChoiceOnlyPowers,
  t20FeatureChoicesAt,
  t20PowerRepeatable,
  t20PowerSkillPick,
  type T20Content,
  type T20FeatureChoice,
  type T20Item,
} from './content';
import { t20MaxCircle, t20PrerequisiteProblems } from './creation';
import { T20_ATTRIBUTES, type T20Attribute } from './attributes';
import { t20Tier } from './progression';
import type { T20Sheet } from './sheet';
import { T20_SKILLS, T20_SKILL_IDS, type T20Skill } from './skills';

export interface T20LevelUpPlan {
  classIndex: number;
  classDef: T20Item<'class'> | null;
  newClassLevel: number;
  newTotalLevel: number;
  hitPointsGained: number;
  manaPointsGained: number;
  abilities: T20Item<'class'>['abilities'];
  /** O nível dá um poder (da classe ou geral). */
  powerChoice: boolean;
  powerOptions: (T20Item<'feat'> & { problems: string[] })[];
  newSpells: number;
  spellOptions: T20Item<'spell'>[];
  /** Habilidades do nível com escolha ("escolha entre égide sagrada e montaria sagrada"). */
  featureChoices: T20FeatureChoice[];
  /** Atributos que já receberam "Aumento de Atributo" neste patamar (não podem repetir). */
  blockedAttributes: T20Attribute[];
  /** Linha da tabela da classe neste nível (ex.: "Fúria +3, poder de bárbaro"). */
  tableText: string;
}

function classFor(content: T20Content, sheet: T20Sheet, index: number) {
  const entry = sheet.identity.classes[index];
  if (!entry) return null;
  return (
    findT20Class(content, entry.key) ??
    content.classes.find((klass) => plainT20(klass.name) === plainT20(entry.name)) ??
    null
  );
}

function spellsKnownAt(klass: T20Item<'class'>, level: number): number {
  if (!klass.spellcasting) return 0;
  let total = klass.spellcasting.initial;
  for (let current = 2; current <= level; current += 1)
    if (current % klass.spellcasting.learnEvery === 0) total += 1;
  return total;
}

export function planT20LevelUp(
  content: T20Content,
  sheet: T20Sheet,
  classIndex = 0,
): T20LevelUpPlan {
  const entry = sheet.identity.classes[classIndex];
  const klass = classFor(content, sheet, classIndex);
  const oldLevel = entry?.level ?? 0;
  const newClassLevel = Math.min(20, oldLevel + 1);
  const newTotalLevel = Math.min(
    20,
    sheet.identity.classes.reduce((sum, item) => sum + item.level, 0) + 1,
  );
  const con = sheet.attributes.con;
  const knownPowers = sheet.powers.map((power) => power.name);
  const trained = sheet.skills.trained.filter((skill) =>
    (T20_SKILL_IDS as readonly string[]).includes(skill),
  );
  const powerChoice = Boolean(klass && /poder de /i.test(klass.table[String(newClassLevel)] ?? ''));
  const choiceOnly = t20ChoiceOnlyPowers(klass);
  const powerOptions =
    powerChoice && klass
      ? content.powers
          .filter(
            (power) =>
              power.owners.some((owner) => plainT20(owner) === plainT20(klass.name)) ||
              ['combate', 'destino', 'magia', 'tormenta'].includes(power.group),
          )
          .filter((power) => !choiceOnly.has(plainT20(power.name)))
          // Poderes repetíveis ("Aumento de Atributo", "Treinamento em Perícia"…) aparecem uma vez na lista; os outros, só se ainda não os tiver.
          .filter(
            (power) =>
              t20PowerRepeatable(power) ||
              !knownPowers.some(
                (name) => plainT20(name.replace(/\s*\(.*\)$/, '')) === plainT20(power.name),
              ),
          )
          .filter(
            (power, index, list) =>
              !t20PowerRepeatable(power) ||
              list.findIndex((entry) => plainT20(entry.name) === plainT20(power.name)) === index,
          )
          .map((power) => ({
            ...power,
            problems: t20PrerequisiteProblems(power.prerequisite, {
              attributes: sheet.attributes,
              skills: trained,
              level: newTotalLevel,
              powers: knownPowers,
              content,
            }),
          }))
      : [];
  const newSpells = klass
    ? Math.max(0, spellsKnownAt(klass, newClassLevel) - spellsKnownAt(klass, oldLevel))
    : 0;
  const known = new Set(sheet.spells.known.map((spell) => plainT20(spell.name)));
  const spellOptions =
    klass?.spellcasting && newSpells > 0
      ? content.spells.filter(
          (spell) =>
            spell.circle <= t20MaxCircle(klass, newClassLevel) &&
            (spell.type === klass.spellcasting!.type || spell.type === 'universal') &&
            !known.has(plainT20(spell.name)),
        )
      : [];
  const levelAbilities = klass
    ? klass.abilities.filter(
        (ability) => ability.level === newClassLevel && !/^poder de /i.test(ability.name),
      )
    : [];
  const tableText = klass?.table[String(newClassLevel)] ?? '';
  const featureChoices = t20FeatureChoicesAt(content, klass, newClassLevel);
  const tier = t20Tier(newTotalLevel);
  const blockedAttributes = T20_ATTRIBUTES.filter((attribute) =>
    sheet.powers.some(
      (power) =>
        isT20AttributeIncrease(power.name) &&
        power.attribute === attribute &&
        t20Tier(power.level) === tier,
    ),
  );
  return {
    classIndex,
    classDef: klass,
    newClassLevel,
    newTotalLevel,
    hitPointsGained: klass ? Math.max(1, klass.pvPerLevel + con) : Math.max(1, 3 + con),
    manaPointsGained: klass?.pmPerLevel ?? 0,
    abilities: levelAbilities,
    powerChoice,
    powerOptions,
    newSpells,
    spellOptions,
    featureChoices,
    blockedAttributes,
    tableText,
  };
}

export interface T20LevelUpResult {
  sheet: T20Sheet;
  abilities: AbilityEntryTemplate[];
  issues: string[];
  summary: string;
}

export interface T20LevelUpChoices {
  powerId: string;
  spellIds: readonly string[];
  /** Atributo do "Aumento de Atributo". */
  attribute?: T20Attribute | '';
  /** Habilidade com escolha → id da opção escolhida. */
  featureChoices?: Record<string, string>;
  /** Perícias escolhidas para um poder como "Treinamento em Perícia". */
  skills?: readonly T20Skill[];
}

export function applyT20LevelUp(
  sheet: T20Sheet,
  plan: T20LevelUpPlan,
  choices: T20LevelUpChoices,
): T20LevelUpResult {
  const issues: string[] = [];
  const power = plan.powerOptions.find((option) => option.id === choices.powerId);
  if (plan.powerChoice && !power) issues.push('Escolha o poder do nível.');
  if (power && power.problems.length)
    issues.push(`${power.name}: falta ${power.problems.join(', ')}.`);
  const increase = power && isT20AttributeIncrease(power.name) ? choices.attribute || null : null;
  if (power && isT20AttributeIncrease(power.name)) {
    if (!increase) issues.push('Escolha o atributo que vai aumentar.');
    else if (plan.blockedAttributes.includes(increase))
      issues.push('Este atributo já recebeu um aumento neste patamar.');
  }
  const skillPick = power ? t20PowerSkillPick(power) : null;
  const pickedSkills = skillPick ? [...new Set(choices.skills ?? [])] : [];
  if (skillPick) {
    if (pickedSkills.length !== skillPick.count)
      issues.push(`Escolha ${skillPick.count} perícia(s) para ${power!.name}.`);
    if (skillPick.trains && pickedSkills.some((skill) => sheet.skills.trained.includes(skill)))
      issues.push('Escolha perícias em que ainda não é treinado.');
  }
  const picked = plan.featureChoices.map((choice) => ({
    choice,
    option: choice.options.find((option) => option.id === choices.featureChoices?.[choice.ability]),
  }));
  for (const { choice, option } of picked)
    if (!option) issues.push(`${choice.ability}: escolha uma opção.`);
  const spells = plan.spellOptions.filter((spell) => choices.spellIds.includes(spell.id));
  if (spells.length !== plan.newSpells) issues.push(`Escolha ${plan.newSpells} magia(s).`);

  const className = plan.classDef?.name ?? sheet.identity.classes[plan.classIndex]?.name ?? '';
  const source = `${className} ${plan.newClassLevel}º nível`;
  const classes = sheet.identity.classes.map((entry, index) =>
    index === plan.classIndex ? { ...entry, level: plan.newClassLevel } : entry,
  );
  const attributeNames: Record<T20Attribute, string> = {
    for: 'Força',
    des: 'Destreza',
    con: 'Constituição',
    int: 'Inteligência',
    sab: 'Sabedoria',
    car: 'Carisma',
  };
  const skillLabel = pickedSkills.map((skill) => T20_SKILLS[skill].label).join(', ');
  const powerName = power
    ? increase
      ? `${power.name} (${attributeNames[increase]})`
      : skillLabel
        ? `${power.name} (${skillLabel})`
        : power.name
    : '';
  // +1 em Constituição vale para todos os níveis: +1 PV por nível de personagem.
  const conBonus = increase === 'con' ? plan.newTotalLevel : 0;
  const featurePowers = picked.flatMap(({ option }) =>
    option && !option.id.startsWith('opcao:')
      ? [{ key: option.id, name: option.name, source, level: plan.newTotalLevel }]
      : [],
  );
  const next: T20Sheet = {
    ...sheet,
    identity: { ...sheet.identity, classes },
    attributes: increase
      ? { ...sheet.attributes, [increase]: sheet.attributes[increase] + 1 }
      : sheet.attributes,
    skills:
      skillPick?.trains && pickedSkills.length
        ? { ...sheet.skills, trained: [...new Set([...sheet.skills.trained, ...pickedSkills])] }
        : sheet.skills,
    hitPoints: { ...sheet.hitPoints, max: sheet.hitPoints.max + plan.hitPointsGained + conBonus },
    manaPoints: { ...sheet.manaPoints, max: sheet.manaPoints.max + plan.manaPointsGained },
    powers: [
      ...sheet.powers,
      ...(power
        ? [
            {
              key: power.id,
              name: powerName,
              source,
              level: plan.newTotalLevel,
              ...(increase ? { attribute: increase } : {}),
            },
          ]
        : []),
      ...featurePowers,
    ],
    spells: {
      ...sheet.spells,
      known: [
        ...sheet.spells.known,
        ...spells.map((spell) => ({
          key: spell.id,
          name: spell.name,
          source: className,
          circle: spell.circle,
          type: spell.type,
        })),
      ],
    },
  };
  const abilities: AbilityEntryTemplate[] = [];
  const add = (entry: Omit<AbilityEntryTemplate, 'sortOrder'>) =>
    abilities.push({ ...entry, sortOrder: 500 + abilities.length });
  for (const ability of plan.abilities)
    add({
      kind: 'class_feature',
      name: ability.name,
      source,
      description: ability.text,
      data: { level: ability.level },
    });
  for (const { choice, option } of picked)
    if (option)
      add({
        kind: 'class_feature',
        name: option.name,
        source: `${source} (${choice.ability})`,
        description: option.text,
        data: { level: plan.newClassLevel },
      });
  if (power)
    add({
      kind: 'feat',
      name: powerName,
      source,
      description: power.text,
      data: { prerequisite: power.prerequisite, ...(increase ? { attribute: increase } : {}) },
    });
  for (const spell of spells) {
    add({
      kind: 'spell',
      name: spell.name,
      source: className,
      description: [`${spell.type} ${spell.circle} (${spell.school})`, spell.text]
        .join('\n\n')
        .slice(0, 12000),
      data: {
        circle: spell.circle,
        type: spell.type,
        school: spell.school,
        cost: [1, 3, 6, 10, 15][spell.circle - 1] ?? 1,
      },
    });
  }
  const parts = [
    `${className} ${plan.newClassLevel} (nível ${plan.newTotalLevel})`,
    `+${plan.hitPointsGained} PV`,
    `+${plan.manaPointsGained} PM`,
  ];
  if (power) parts.push(`poder ${powerName}`);
  for (const { option } of picked) if (option) parts.push(option.name);
  if (spells.length) parts.push(`${spells.length} magia(s)`);
  return {
    sheet: next,
    abilities,
    issues,
    summary: `Subiu de nível: ${parts.join(' · ')}.`.slice(0, 300),
  };
}

/** Algo que uma atualização do Codexveil (ou do livro) acrescentou e a ficha ainda não tem. */
export interface T20PendingUpdate {
  id: string;
  title: string;
  description: string;
  abilities: AbilityEntryTemplate[];
}

/**
 * Pendências da ficha do Tormenta20: habilidades de classe do nível atual que não estão na ficha
 * (ex.: o livro foi corrigido depois da criação). Habilidades com escolha ficam para a subida de
 * nível, onde há a escolha.
 */
export function listT20PendingUpdates(
  content: T20Content,
  sheet: T20Sheet,
  abilityNames: readonly string[],
): T20PendingUpdate[] {
  const owned = abilityNames.map(plainT20);
  const missing: AbilityEntryTemplate[] = [];
  sheet.identity.classes.forEach((entry, index) => {
    const klass = classFor(content, sheet, index);
    if (!klass) return;
    for (const ability of klass.abilities) {
      if (ability.level > entry.level || /^poder de /i.test(ability.name) || ability.options.length)
        continue;
      const name = plainT20(ability.name);
      if (owned.some((have) => have === name || have.startsWith(`${name} (`))) continue;
      owned.push(name);
      missing.push({
        kind: 'class_feature',
        name: ability.name.slice(0, 120),
        source: `${klass.name} ${ability.level}º nível`.slice(0, 120),
        description: ability.text.slice(0, 8000),
        data: { level: ability.level },
        sortOrder: 9000 + missing.length,
      });
    }
  });
  return missing.length
    ? [
        {
          id: `t20-habilidades-de-classe:${missing.map((entry) => plainT20(entry.name)).join('|')}`.slice(
            0,
            200,
          ),
          title: 'Habilidades de classe',
          description: `Estas habilidades do seu nível ainda não estão na ficha: ${missing.map((entry) => entry.name).join(', ')}.`,
          abilities: missing,
        },
      ]
    : [];
}
