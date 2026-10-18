import { describe, expect, it } from 'vitest';
import { ABILITIES, type Ability } from '../abilities';
import { parseDnd5eCampaignRules } from '../campaign-rules';
import { computeDnd5eDerived } from '../derived';
import { findClass } from '../srd/classes';
import { buildDnd5eCharacterFromDraft, combatSummary } from './build';
import {
  PERSONAL_SHEET_CONTEXT,
  finalAbilityScores,
  listDnd5eChoices,
  validateDnd5eDraft,
  type ChoiceSpec,
  type Dnd5eCreationContext,
} from './choices';
import { STANDARD_ARRAY, createDnd5eDraft, pointBuyCost, rollAbilityScore, type Dnd5eDraft, type Dnd5eDraftInput } from './draft';

/** Responde automaticamente as escolhas pendentes com as primeiras opções válidas. */
function complete(input: Dnd5eDraftInput, fixed: Dnd5eDraftInput['selections'] = {}): Dnd5eDraft {
  const classDef = input.classId ? findClass(input.classId) : undefined;
  let draft = createDnd5eDraft({
    name: 'Teste',
    alignment: 'neutral_good',
    abilityMethod: 'standard_array',
    baseScores: classDef?.standardArray ?? { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    ...input,
    selections: { ...input.selections, ...fixed },
  });
  // Responde uma escolha por vez, como uma pessoa faria, até não restar pendência.
  const answered = new Set<string>();
  for (let round = 0; round < 400; round++) {
    const specs = listDnd5eChoices(draft);
    const issues = new Set(validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT).map((issue) => issue.path));
    const pending = specs.find(
      (spec) => !(fixed && spec.id in fixed) && (draft.selections[spec.id] === undefined || (issues.has(spec.id) && !answered.has(`${spec.id}:${round}`))),
    );
    if (!pending) break;
    // As preparadas do mago vêm do grimório: não contam como repetição.
    const ignore = pending.id === 'spells.prepared' ? ['spells.spellbook', 'subclass.evocation_savant'] : [];
    const usedSpells = new Set(
      specs
        .filter((spec) => spec.kind === 'spells' && spec.id !== pending.id && !ignore.includes(spec.id))
        .flatMap((spec) => (Array.isArray(draft.selections[spec.id]) ? (draft.selections[spec.id] as string[]) : [])),
    );
    answered.add(`${pending.id}:${round}`);
    draft = createDnd5eDraft({ ...draft, selections: { ...draft.selections, [pending.id]: answer(pending, usedSpells, draft) } });
  }
  return draft;
}

function answer(spec: ChoiceSpec, usedSpells: Set<string>, draft: Dnd5eDraft) {
  switch (spec.kind) {
    case 'option':
      return spec.options.find((option) => !option.disabledReason)?.id ?? '';
    case 'multi':
      return spec.options.filter((option) => !option.disabledReason).slice(0, spec.count).map((option) => option.id);
    case 'spells': {
      const picks = spec.options.filter((option) => !option.disabledReason && !usedSpells.has(option.id)).slice(0, spec.count);
      for (const pick of picks) usedSpells.add(pick.id);
      return picks.map((option) => option.id);
    }
    case 'ability_increase': {
      const scores = finalAbilityScores({ ...draft, selections: { ...draft.selections, [spec.id]: {} } });
      const sorted = [...spec.abilities].sort((a, b) => (scores?.[a] ?? 10) - (scores?.[b] ?? 10));
      return spec.mode === 'background' ? { [sorted[0]!]: 2, [sorted[1]!]: 1 } : { [sorted[0]!]: 1, [sorted[1]!]: 1 };
    }
  }
}

const CAMPAIGN: Dnd5eCreationContext = { lockedLevel: 1, abilityScoreMethods: ['standard_array', 'point_buy', 'random'], allowEvilAlignments: false };

describe('método de atributos', () => {
  it('compra de pontos usa a tabela de custos do SRD', () => {
    expect(pointBuyCost({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(27);
    expect(pointBuyCost({ str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 })).toBe(27);
    expect(pointBuyCost({ str: 16 })).toBeNull();
  });

  it('rolagem de 4d6 descarta o menor dado', () => {
    const dice = [0.99, 0, 0.5, 0.99];
    let index = 0;
    // 6, 1, 4, 6 → descarta o 1 → 16
    expect(rollAbilityScore(() => dice[index++]!)).toBe(16);
  });

  it('o conjunto padrão soma 72 pontos', () => {
    expect(STANDARD_ARRAY.reduce((sum, value) => sum + value, 0)).toBe(72);
  });

  it('recusa conjunto padrão com valores repetidos e compra acima de 27 pontos', () => {
    const repeated = complete({ classId: 'fighter', backgroundId: 'soldier', speciesId: 'human', baseScores: { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 } });
    expect(validateDnd5eDraft(repeated, PERSONAL_SHEET_CONTEXT).map((issue) => issue.path)).toContain('baseScores');
    const expensive = complete({
      classId: 'fighter',
      backgroundId: 'soldier',
      speciesId: 'human',
      abilityMethod: 'point_buy',
      baseScores: { str: 15, dex: 15, con: 15, int: 10, wis: 8, cha: 8 },
    });
    const issue = validateDnd5eDraft(expensive, PERSONAL_SHEET_CONTEXT).find((entry) => entry.path === 'baseScores');
    expect(issue?.message).toContain('29 pontos');
  });

  it('respeita os métodos permitidos pelo mestre', () => {
    const draft = complete({ classId: 'fighter', backgroundId: 'soldier', speciesId: 'human', abilityMethod: 'random', baseScores: { str: 16, dex: 12, con: 14, int: 9, wis: 11, cha: 10 } });
    const issues = validateDnd5eDraft(draft, { ...CAMPAIGN, abilityScoreMethods: ['standard_array'] });
    expect(issues.find((issue) => issue.path === 'abilityMethod')?.step).toBe('abilities');
  });
});

describe('criação de um guerreiro humano soldado (1º nível)', () => {
  const draft = complete(
    { classId: 'fighter', backgroundId: 'soldier', speciesId: 'human', level: 1 },
    { 'class.fighting_style': 'defense', 'equipment.class': 'A', 'equipment.background': 'A', 'background.abilities': { str: 2, con: 1 } },
  );

  it('fica sem pendências', () => {
    expect(validateDnd5eDraft(draft, CAMPAIGN)).toEqual([]);
  });

  it('aplica atributos, perícias, salvaguardas e equipamento do SRD', () => {
    const built = buildDnd5eCharacterFromDraft(draft);
    expect(built.sheet.abilities).toMatchObject({ str: 17, con: 14 });
    expect(built.sheet.savingThrows.str.proficient).toBe(true);
    expect(built.sheet.savingThrows.con.proficient).toBe(true);
    expect(built.sheet.skills.athletics.proficiency).toBe('proficient');
    expect(built.sheet.skills.intimidation.proficiency).toBe('proficient');
    // Cota de malha (16) + Defesa (+1); sem Destreza em armadura pesada.
    expect(built.sheet.combat.armorClass).toBe(17);
    expect(built.sheet.combat.speed).toBe(9);
    // 10 (d10) + 2 (Constituição 14)
    expect(built.resources.find((resource) => resource.key === 'hp')).toMatchObject({ current: 12, max: 12 });
    expect(built.resources.find((resource) => resource.key === 'class_second_wind')).toMatchObject({ max: 2 });
    // 4 PO do guerreiro + 14 PO do soldado
    expect(built.resources.find((resource) => resource.key === 'currency_gp')?.current).toBe(18);
    expect(built.resources.find((resource) => resource.key === 'heroic_inspiration')?.current).toBe(1);
    expect(built.items.find((item) => item.name === 'Cota de malha')).toMatchObject({ isEquipped: true, weight: 27.5 });
    expect(built.items.find((item) => item.name === 'Azagaia')?.quantity).toBe(8);
  });

  it('cria ataques com proficiência e maestria', () => {
    const built = buildDnd5eCharacterFromDraft(draft);
    const greatsword = built.abilities.find((entry) => entry.kind === 'attack' && entry.name === 'Espada grande');
    expect(greatsword?.data).toMatchObject({ ability: 'str', proficient: true, damage: '2d6', damageType: 'Cortante', range: '1,5 m' });
    const longbow = built.abilities.find((entry) => entry.kind === 'attack' && entry.name === 'Arco curto');
    expect(longbow?.data).toMatchObject({ ability: 'dex', range: '24/96 m' });
  });

  it('cria habilidades de classe, de espécie e talentos com as escolhas', () => {
    const built = buildDnd5eCharacterFromDraft(draft);
    const names = built.abilities.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining(['Estilo de Luta', 'Retomar o Fôlego', 'Maestria em Armas', 'Engenhoso', 'Atacante Selvagem', 'Defesa']));
    expect(built.abilities.find((entry) => entry.name === 'Retomar o Fôlego')?.resourceKey).toBe('class_second_wind');
    expect(names).not.toContain('Surto de Ação');
  });
});

describe('regras que cruzam passos', () => {
  it('não deixa repetir uma perícia já concedida pelo antecedente', () => {
    const draft = complete({ classId: 'rogue', backgroundId: 'criminal', speciesId: 'halfling' }, { 'class.skills': ['stealth', 'acrobatics', 'athletics', 'deception'] });
    const issue = validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT).find((entry) => entry.path === 'class.skills');
    expect(issue?.message).toContain('Furtividade');
  });

  it('Especialização exige proficiência na perícia', () => {
    const draft = complete({ classId: 'rogue', backgroundId: 'criminal', speciesId: 'halfling' }, { 'class.expertise.1': ['arcana', 'stealth'] });
    expect(validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT).map((issue) => issue.path)).toContain('class.expertise.1');
  });

  it('Alerta não pode ser obtido duas vezes', () => {
    const draft = complete({ classId: 'rogue', backgroundId: 'criminal', speciesId: 'human' }, { 'species.versatile': 'alert' });
    const issue = validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT).find((entry) => entry.path === 'species.versatile');
    expect(issue?.message).toContain('já tem este talento');
  });

  it('aumentos do antecedente seguem +2/+1 ou +1/+1/+1, sem passar de 20', () => {
    const wrong = complete({ classId: 'wizard', backgroundId: 'sage', speciesId: 'gnome' }, { 'background.abilities': { int: 3 } });
    expect(validateDnd5eDraft(wrong, PERSONAL_SHEET_CONTEXT).map((issue) => issue.path)).toContain('background.abilities');
    const even = complete({ classId: 'wizard', backgroundId: 'sage', speciesId: 'gnome' }, { 'background.abilities': { con: 1, int: 1, wis: 1 } });
    expect(validateDnd5eDraft(even, PERSONAL_SHEET_CONTEXT)).toEqual([]);
  });

  it('nível e alinhamento seguem as regras da campanha', () => {
    const draft = complete({ classId: 'cleric', backgroundId: 'acolyte', speciesId: 'dwarf', level: 3, alignment: 'neutral_evil' });
    const paths = validateDnd5eDraft(draft, CAMPAIGN).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['level', 'alignment']));
  });

  it('exige subclasse e as escolhas dela a partir do 3º nível', () => {
    const level1 = listDnd5eChoices(createDnd5eDraft({ classId: 'druid', level: 1 })).map((spec) => spec.id);
    expect(level1).not.toContain('subclass.land');
    const level3 = listDnd5eChoices(createDnd5eDraft({ classId: 'druid', level: 3 })).map((spec) => spec.id);
    expect(level3).toContain('subclass.land');
  });
});

describe('conjuradores', () => {
  it('mago alto elfo sábio de 3º nível: grimório, preparadas, evocação e Iniciado em Magia', () => {
    const draft = complete({ classId: 'wizard', backgroundId: 'sage', speciesId: 'elf', level: 3 }, { 'species.lineage': 'high_elf' });
    expect(validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT)).toEqual([]);
    const specs = Object.fromEntries(listDnd5eChoices(draft).map((spec) => [spec.id, spec]));
    expect(specs['spells.cantrips']).toMatchObject({ count: 3 });
    expect(specs['spells.spellbook']).toMatchObject({ count: 10 });
    expect(specs['spells.prepared']).toMatchObject({ count: 6 });
    expect(specs['subclass.evocation_savant']).toMatchObject({ count: 2 });
    expect(specs['background.feat.cantrips']).toMatchObject({ count: 2 });

    const built = buildDnd5eCharacterFromDraft(draft);
    const spells = built.abilities.filter((entry) => entry.kind === 'spell');
    expect(spells.find((entry) => entry.name === 'Prestidigitation')?.source).toContain('Elfo');
    expect(spells.find((entry) => entry.name === 'Detect Magic')).toBeDefined();
    expect(built.resources.filter((resource) => resource.key.startsWith('spell_slot_')).map((resource) => resource.max)).toEqual([4, 2]);
    expect(built.sheet.spellcasting.ability).toBe('int');
    expect(built.sheet.identity.classes[0]).toMatchObject({ name: 'Mago', subclass: 'Evocador', level: 3, hitDie: 'd6' });
    expect(built.sheet.identity.experience).toBe(900);
  });

  it('magia escolhida numa lista fica indisponível nas outras, mas o mago prepara do grimório', () => {
    const draft = createDnd5eDraft({
      classId: 'wizard',
      backgroundId: 'sage',
      speciesId: 'human',
      selections: { 'spells.cantrips': ['Fire Bolt'], 'spells.spellbook': ['Magic Missile'] },
    });
    const specs = Object.fromEntries(listDnd5eChoices(draft).map((spec) => [spec.id, spec]));
    const initiateCantrips = specs['background.feat.cantrips'];
    const prepared = specs['spells.prepared'];
    if (initiateCantrips?.kind !== 'spells' || prepared?.kind !== 'spells') throw new Error('escolhas de magia ausentes');
    expect(initiateCantrips.options.find((option) => option.id === 'Fire Bolt')?.disabledReason).toContain('Truques de Mago');
    expect(prepared.options.find((option) => option.id === 'Magic Missile')?.disabledReason).toBeUndefined();
  });

  it('clérigo taumaturgo ganha um truque extra e bônus em Arcanismo e Religião', () => {
    const draft = complete({ classId: 'cleric', backgroundId: 'acolyte', speciesId: 'dwarf' }, { 'class.divine_order': 'thaumaturge' });
    const cantrips = listDnd5eChoices(draft).find((spec) => spec.id === 'spells.cantrips');
    expect(cantrips).toMatchObject({ count: 4 });
    const built = buildDnd5eCharacterFromDraft(draft);
    expect(built.sheet.skills.arcana.bonus).toBeGreaterThanOrEqual(1);
    expect(built.sheet.skills.religion.bonus).toBe(built.sheet.skills.arcana.bonus);
    // Anão: +1 PV por nível (Robustez Anã)
    const hp = built.resources.find((resource) => resource.key === 'hp');
    const con = Math.floor((built.sheet.abilities.con - 10) / 2);
    expect(hp?.max).toBe(8 + con + 1);
  });

  it('paladino com Guerreiro Abençoado escolhe dois truques de clérigo', () => {
    const draft = complete({ classId: 'paladin', backgroundId: 'soldier', speciesId: 'dragonborn', level: 2 }, { 'class.fighting_style': 'blessed_warrior' });
    const spec = listDnd5eChoices(draft).find((entry) => entry.id === 'class.fighting_style.cantrips');
    expect(spec).toMatchObject({ count: 2 });
    expect(validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT)).toEqual([]);
    const built = buildDnd5eCharacterFromDraft(draft);
    expect(built.abilities.some((entry) => entry.kind === 'spell' && entry.name === 'Divine Smite')).toBe(true);
    expect(built.resources.find((resource) => resource.key === 'class_lay_on_hands')?.max).toBe(10);
    expect(built.resources.find((resource) => resource.key === 'species_breath_weapon')?.max).toBe(2);
  });

  it('bruxo usa espaços de pacto que voltam no descanso curto', () => {
    const draft = complete({ classId: 'warlock', backgroundId: 'sage', speciesId: 'tiefling', level: 5 }, { 'species.lineage': 'infernal' });
    expect(validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT)).toEqual([]);
    const built = buildDnd5eCharacterFromDraft(draft);
    expect(built.resources.find((resource) => resource.key === 'pact_slots')).toMatchObject({ max: 2, recovery: 'short_rest', label: 'Espaços de pacto (3º círculo)' });
    expect(listDnd5eChoices(draft).find((spec) => spec.id === 'class.invocations')).toMatchObject({ count: 5 });
  });
});

describe('combate calculado pelas regras', () => {
  it('bárbaro sem armadura usa Defesa sem Armadura', () => {
    const draft = complete({ classId: 'barbarian', backgroundId: 'soldier', speciesId: 'orc' }, { 'equipment.class': 'B', 'equipment.background': 'B' });
    const scores = finalAbilityScores(draft)!;
    const mod = (ability: Ability) => Math.floor((scores[ability] - 10) / 2);
    expect(combatSummary(draft)).toMatchObject({ armorClass: 10 + mod('dex') + mod('con'), armorClassSource: 'Defesa sem Armadura' });
  });

  it('monge de 2º nível ganha +3 m sem armadura', () => {
    const draft = complete({ classId: 'monk', backgroundId: 'criminal', speciesId: 'human', level: 2 });
    expect(buildDnd5eCharacterFromDraft(draft).sheet.combat.speed).toBe(12);
  });

  it('Alerta soma a proficiência à Iniciativa; bardo usa meia proficiência', () => {
    const alert = buildDnd5eCharacterFromDraft(complete({ classId: 'rogue', backgroundId: 'criminal', speciesId: 'halfling' }));
    const derived = computeDnd5eDerived(alert.sheet);
    expect(alert.sheet.combat.initiativeProficiency).toBe('proficient');
    expect(derived.initiative).toBe(derived.abilityModifiers.dex + 2);

    const bard = buildDnd5eCharacterFromDraft(
      complete({ classId: 'bard', backgroundId: 'acolyte', speciesId: 'human', level: 2 }, { 'species.versatile': 'skilled' }),
    );
    expect(bard.sheet.combat.initiativeProficiency).toBe('half');
    const nonProficient = Object.values(bard.sheet.skills).filter((skill) => skill.proficiency === 'half');
    expect(nonProficient.length).toBeGreaterThan(0);
  });

  it('Campeão Primitivo soma +4 em Força e Constituição, até 25', () => {
    const draft = complete(
      { classId: 'barbarian', backgroundId: 'soldier', speciesId: 'goliath', level: 20 },
      {
        'background.abilities': { str: 2, con: 1 },
        'asi.4': 'ability_score_improvement',
        'asi.4.increase': { str: 2 },
        'asi.8': 'ability_score_improvement',
        'asi.8.increase': { str: 1, con: 1 },
        'epic.19': 'boon_of_combat_prowess',
        'epic.19.ability': 'dex',
      },
    );
    expect(validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT)).toEqual([]);
    const scores = buildDnd5eCharacterFromDraft(draft).sheet.abilities;
    for (const ability of ABILITIES) {
      expect(scores[ability]).toBeGreaterThanOrEqual(1);
      expect(scores[ability]).toBeLessThanOrEqual(30);
    }
    // Força: 15 + 2 + 2 + 1 = 20 → 24; Constituição: 14 + 1 + 1 = 16 → 20
    expect(scores.str).toBe(24);
    expect(scores.con).toBeGreaterThanOrEqual(20);
  });
});

describe('todas as classes em todos os níveis', () => {
  it('geram personagens válidos e dentro dos limites do banco', () => {
    for (const classId of ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'] as const) {
      for (const level of [1, 3, 5, 11, 20]) {
        const draft = complete({ classId, backgroundId: 'sage', speciesId: 'human', level });
        const issues = validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT);
        expect(issues, `${classId} ${level}`).toEqual([]);
        const built = buildDnd5eCharacterFromDraft(draft);
        expect(built.abilities.length).toBeLessThanOrEqual(300);
        expect(built.resources.length).toBeLessThanOrEqual(100);
        for (const resource of built.resources) expect(resource.key).toMatch(/^[a-z0-9_:-]{1,64}$/);
        for (const entry of built.abilities) {
          expect(entry.name.length).toBeLessThanOrEqual(120);
          expect(entry.source.length).toBeLessThanOrEqual(120);
          expect(entry.description.length).toBeLessThanOrEqual(8000);
        }
      }
    }
  });
});

describe('regras da campanha', () => {
  it('usa o padrão quando não há dados e corrige campos inválidos', () => {
    expect(parseDnd5eCampaignRules(null)).toEqual({ startingLevel: 1, abilityScoreMethods: ['standard_array', 'point_buy', 'random'], allowEvilAlignments: false, sourcebooks: [] });
    expect(parseDnd5eCampaignRules({ startingLevel: 3, abilityScoreMethods: [], allowEvilAlignments: 'sim' })).toEqual({
      startingLevel: 3,
      abilityScoreMethods: ['standard_array', 'point_buy', 'random'],
      allowEvilAlignments: false,
      sourcebooks: [],
    });
    expect(parseDnd5eCampaignRules({ startingLevel: 99 }).startingLevel).toBe(1);
    // Livros: ids desconhecidos invalidam a lista; os válidos ficam.
    expect(parseDnd5eCampaignRules({ sourcebooks: ['xgte', 'tcoe'] }).sourcebooks).toEqual(['xgte', 'tcoe']);
    expect(parseDnd5eCampaignRules({ sourcebooks: ['livro-falso'] }).sourcebooks).toEqual([]);
  });
});
