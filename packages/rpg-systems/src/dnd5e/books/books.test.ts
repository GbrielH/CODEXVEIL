import { afterEach, describe, expect, it } from 'vitest';
import { buildDnd5eCharacterFromDraft } from '../creation/build';
import {
  PERSONAL_SHEET_CONTEXT,
  draftSubclass,
  listDnd5eChoices,
  validateDnd5eDraft,
} from '../creation/choices';
import { createDnd5eDraft } from '../creation/draft';
import { applyDnd5eLevelUp, findClassByName, planDnd5eLevelUp } from '../level-up';
import { parseDnd5eSheet } from '../sheet';
import { findSpecies, listSpecies } from '../srd/species';
import { findSpell } from '../srd/spells';
import { setActiveDnd5eBookContent, withDnd5eBookContent } from './active';
import { buildDnd5eBookContent, srdSpellNameFor } from './content';
import { BOOK_PACK_EXAMPLE } from './example';
import {
  bookChallengeRating,
  bookCreatureSize,
  bookMagicItemToCampaignItem,
  bookMonsterToStatBlock,
} from './library';
import {
  BOOK_ENTRY_KINDS,
  BOOK_PACK_FORMAT,
  BOOK_PACK_VERSION,
  parseBookEntryData,
  parseBookPack,
  visibleBookKinds,
} from './pack';

const BOOK = { id: 'livro-teste', name: 'Livro de Teste' };

const entries = [
  {
    kind: 'subclass',
    key: 'escola-teste',
    name: 'Escola de Teste',
    data: {
      classId: 'wizard',
      summary: 'Magos que estudam testes.',
      features: [
        { level: 2, name: 'Erudição de Teste', description: 'Você aprende a testar.' },
        { level: 6, name: 'Teste Avançado', description: 'Você testa melhor.' },
      ],
      alwaysPrepared: [{ level: 1, spells: ['Bola de Fogo'] }],
    },
  },
  {
    kind: 'species',
    key: 'povo-teste',
    name: 'Povo de Teste',
    data: {
      summary: 'Um povo inventado.',
      sizes: ['small', 'medium'],
      speed: 35,
      traits: [{ name: 'Pele de Teste', description: 'Resistência a testes.' }],
    },
  },
  {
    kind: 'background',
    key: 'testador',
    name: 'Testador',
    data: {
      summary: 'Você testava coisas.',
      skills: ['investigation', 'insight'],
      tools: 'Ferramentas de testador',
      feature: { name: 'Olho Clínico', description: 'Acha erros.' },
    },
  },
  {
    kind: 'feat',
    key: 'testador-nato',
    name: 'Testador Nato',
    data: {
      category: 'general',
      description: 'Você é bom em testes.',
      abilityIncrease: ['int', 'wis'],
    },
  },
  {
    kind: 'spell',
    key: 'raio-de-teste',
    name: 'Raio de Teste',
    data: {
      level: 1,
      school: 'evocation',
      classes: ['wizard', 'sorcerer'],
      castingTime: '1 ação',
      range: '18 metros',
      components: 'V, S',
      duration: 'Instantânea',
      description: ['Um raio que testa o alvo.'],
    },
  },
  // Repete uma magia do SRD (Bola de Fogo): não entra de novo, mas a lista nova vale.
  {
    kind: 'spell',
    key: 'bola-de-fogo',
    name: 'Bola de Fogo',
    data: {
      level: 3,
      school: 'evocation',
      classes: ['wizard', 'artificer'],
      original: 'Fireball',
      description: ['Repetida.'],
    },
  },
  {
    kind: 'spell_list',
    key: 'artifice',
    name: 'Magias de Artífice',
    data: {
      list: 'artificer',
      spells: [
        { name: 'Raio de Teste', level: 1 },
        { name: 'Cure Wounds', level: 1 },
      ],
    },
  },
  {
    kind: 'section',
    key: 'introducao',
    name: 'Introdução',
    data: { chapter: 'Introdução', order: 0, body: 'Texto.' },
  },
];

const pack = {
  format: BOOK_PACK_FORMAT,
  version: BOOK_PACK_VERSION,
  book: { ...BOOK, category: 'player' },
  entries,
};
const content = buildDnd5eBookContent([{ book: BOOK, entries }]);

afterEach(() => setActiveDnd5eBookContent(null));

describe('pacote de livro', () => {
  it('lê as entradas válidas e aponta as inválidas sem derrubar o pacote', () => {
    const { pack: parsed, issues } = parseBookPack({
      ...pack,
      entries: [
        ...entries,
        { kind: 'spell', key: 'sem-escola', name: 'Sem Escola', data: { level: 1 } },
        entries[0],
      ],
    });
    expect(parsed.entries).toHaveLength(entries.length);
    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining('school'),
      'Entrada repetida.',
    ]);
  });

  it('recusa arquivos que não são pacotes', () => {
    expect(() =>
      parseBookPack({ format: 'outro', version: 1, book: pack.book, entries: [] }),
    ).toThrow();
  });

  it('o pacote-modelo é válido e traz um exemplo de cada tipo', () => {
    const { pack: parsed, issues } = parseBookPack(BOOK_PACK_EXAMPLE);
    expect(issues).toEqual([]);
    expect(new Set(parsed.entries.map((entry) => entry.kind))).toEqual(new Set(BOOK_ENTRY_KINDS));
    const example = buildDnd5eBookContent([{ book: parsed.book, entries: parsed.entries }]);
    // A classe do livro tem lista própria; a lista acrescenta uma magia do SRD (pelo nome em português).
    expect(example.classes[0]?.spellcasting?.list).toBe('arcanista');
    expect(example.srdSpellLists).toEqual({ 'Detect Magic': ['arcanista'], Shield: ['arcanista'] });
    expect(example.spells[0]?.classes).toEqual(['wizard', 'arcanista']);
  });

  it('jogadores leem só o conteúdo de personagem e o texto dos livros de jogador', () => {
    expect(visibleBookKinds('adventure', true)).toEqual([...BOOK_ENTRY_KINDS]);
    expect(visibleBookKinds('player', false)).toEqual([
      'section',
      'class',
      'subclass',
      'species',
      'background',
      'feat',
      'spell',
      'spell_list',
    ]);
    expect(visibleBookKinds('adventure', false)).not.toContain('section');
    expect(visibleBookKinds('monsters', false)).not.toContain('monster');
  });

  it('converte monstros para o bloco de estatísticas', () => {
    expect(bookCreatureSize('Médio ou Pequeno')).toBe('medium');
    expect(bookCreatureSize('Gargantuan')).toBe('gargantuan');
    expect(bookChallengeRating('½ (100 XP)')).toBe('1/2');
    expect(bookChallengeRating('??')).toBe('0');
    const data = parseBookEntryData(
      'monster',
      BOOK_PACK_EXAMPLE.entries.find((entry) => entry.kind === 'monster')!.data,
    );
    const block = bookMonsterToStatBlock({ ...data, vulnerabilities: 'Fogo' });
    expect(block).toMatchObject({
      size: 'medium',
      armorClass: 8,
      hitPoints: 22,
      challengeRating: '1/2',
      damageResistances: 'Vulnerável: Fogo',
    });
    expect(block.abilities.con).toBe(16);
    expect(block.actions[0]?.name).toBe('Pseudópode');
  });

  it('converte itens mágicos para os itens da campanha', () => {
    const item = bookMagicItemToCampaignItem(
      'Lâmina de Teste',
      parseBookEntryData('magic_item', {
        type: 'Arma (espada longa)',
        rarity: 'Rara',
        attunement: 'requer sintonização',
        description: ['Corta testes.'],
      }),
      'Livro de Teste',
    );
    expect(item).toMatchObject({
      category: 'weapon',
      rarity: 'Arma (espada longa), Rara',
      requiresAttunement: true,
      visibility: 'gm',
    });
    expect(item.description).toBe(
      'Sintonização: requer sintonização\n\nCorta testes.\n\nFonte: Livro de Teste.',
    );
  });
});

describe('conteúdo dos livros nas regras', () => {
  it('converte as entradas e evita repetir magias do SRD', () => {
    expect(srdSpellNameFor('Bola de Fogo')).toBe('Fireball');
    expect(content.spells.map((spell) => spell.name)).toEqual(['Raio de Teste']);
    expect(content.spells[0]?.classes).toEqual(['wizard', 'sorcerer', 'artificer']);
    expect(content.srdSpellLists).toEqual({
      Fireball: ['artificer'],
      'Cure Wounds': ['artificer'],
    });
    // Subclasse de 2014: habilidades de 2º nível chegam no 3º; magias pelo nome original.
    const subclass = content.subclasses[0]!;
    expect(subclass.id).toBe('livro-teste:escola-teste');
    expect(subclass.features.map((feature) => feature.level)).toEqual([3, 6]);
    expect(subclass.alwaysPrepared).toEqual([{ level: 3, spells: ['Fireball'] }]);
    // Antecedente antigo: qualquer atributo e talento de origem à escolha.
    expect(content.backgrounds[0]).toMatchObject({
      feat: '',
      abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    });
    // Talento geral exige o 4º nível.
    expect(content.feats[0]).toMatchObject({ minLevel: 4, abilityIncrease: ['int', 'wis'] });
  });

  it('só vale enquanto o conteúdo estiver ativo', () => {
    expect(findSpecies('livro-teste:povo-teste')).toBeUndefined();
    withDnd5eBookContent(content, () => {
      expect(findSpecies('livro-teste:povo-teste')?.name).toBe('Povo de Teste');
      expect(listSpecies().length).toBeGreaterThan(9);
      expect(findSpell('Raio de Teste')?.book?.name).toBe('Livro de Teste');
      expect(findSpell('Fireball')?.classes).toContain('artificer');
    });
    expect(findSpell('Raio de Teste')).toBeUndefined();
  });

  it('cria um mago com subclasse, espécie, antecedente, talento e magia do livro', () => {
    setActiveDnd5eBookContent(content);
    const draft = createDnd5eDraft({
      name: 'Testadora',
      level: 4,
      classId: 'wizard',
      speciesId: 'livro-teste:povo-teste',
      backgroundId: 'livro-teste:testador',
      alignment: 'neutral_good',
      abilityMethod: 'standard_array',
      baseScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
      selections: {
        'class.subclass': 'livro-teste:escola-teste',
        'class.skills': ['arcana', 'history'],
        'background.origin_feat': 'alert',
        'background.abilities': { int: 2, con: 1 },
        'species.size': 'small',
        'origin.languages': ['elvish', 'dwarvish'],
        'class.expertise.2': ['arcana'],
        'asi.4': 'livro-teste:testador-nato',
        'asi.4.ability': 'int',
        'spells.cantrips': ['Fire Bolt', 'Light', 'Mage Hand', 'Prestidigitation'],
        'spells.spellbook': [
          'Raio de Teste',
          'Magic Missile',
          'Shield',
          'Sleep',
          'Detect Magic',
          'Mage Armor',
          'Misty Step',
          'Web',
          'Invisibility',
          'Hold Person',
          'Scorching Ray',
          'Knock',
        ],
        'spells.prepared': [
          'Raio de Teste',
          'Magic Missile',
          'Shield',
          'Sleep',
          'Misty Step',
          'Web',
          'Invisibility',
        ],
        'equipment.class': 'A',
        'equipment.background': 'A',
      },
    });
    const specs = listDnd5eChoices(draft);
    expect(specs.find((spec) => spec.id === 'class.subclass')?.kind).toBe('option');
    expect(draftSubclass(draft)?.name).toBe('Escola de Teste');
    expect(validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT)).toEqual([]);

    const built = buildDnd5eCharacterFromDraft(draft);
    expect(built.sheet.identity.classes[0]?.subclass).toBe('Escola de Teste');
    expect(built.sheet.identity.species).toBe('Povo de Teste');
    expect(built.sheet.abilities.int).toBe(15 + 2 + 1);
    const names = built.abilities.map((ability) => ability.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Erudição de Teste',
        'Pele de Teste',
        'Testador Nato',
        'Alerta',
        'Raio de Teste',
        'Fireball',
      ]),
    );
    expect(names).not.toContain('Teste Avançado');
    const spell = built.abilities.find((ability) => ability.name === 'Raio de Teste');
    expect(spell?.source).toContain('Livro de Teste');
    expect(spell?.description).toContain('Um raio que testa o alvo.');
  });

  it('exige a escolha da subclasse e do talento de origem', () => {
    setActiveDnd5eBookContent(content);
    const draft = createDnd5eDraft({
      level: 3,
      classId: 'wizard',
      backgroundId: 'livro-teste:testador',
    });
    const paths = validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['class.subclass', 'background.origin_feat']));
  });

  it('oferece as subclasses dos livros na subida para o 3º nível', () => {
    setActiveDnd5eBookContent(content);
    const sheet = parseDnd5eSheet({
      identity: { classes: [{ name: 'Mago', subclass: '', level: 2, hitDie: 'd6' }] },
      abilities: { int: 16 },
    });
    const plan = planDnd5eLevelUp(sheet, 0);
    expect(plan.subclass).toBeNull();
    expect(plan.subclassOptions.map((option) => option.name)).toEqual([
      'Evocador',
      'Escola de Teste',
    ]);
    const missing = applyDnd5eLevelUp(sheet, plan, {
      hitPoints: { method: 'average' },
      improvement: null,
      cantrips: [],
      spells: ['Raio de Teste', 'Shield'],
      invocations: [],
      metamagic: [],
    });
    expect(missing.issues).toContain('Escolha a subclasse.');
    const result = applyDnd5eLevelUp(sheet, plan, {
      hitPoints: { method: 'average' },
      improvement: null,
      cantrips: [],
      spells: ['Raio de Teste', 'Shield'],
      invocations: [],
      metamagic: [],
      subclassId: 'livro-teste:escola-teste',
    });
    expect(result.issues).toEqual([]);
    expect(result.sheet.identity.classes[0]?.subclass).toBe('Escola de Teste');
    expect(result.abilities.map((ability) => ability.name)).toEqual(
      expect.arrayContaining(['Erudição de Teste', 'Raio de Teste', 'Fireball']),
    );
    expect(findClassByName('Mago')?.id).toBe('wizard');
  });
});

describe('nomes de magias das traduções de 2014', () => {
  it('ligam as tabelas de subclasse à magia do SRD', () => {
    expect(srdSpellNameFor('Auxílio Divino')).toBe('Aid');
    expect(srdSpellNameFor('Remeter')).toBe('Sending');
    expect(srdSpellNameFor('Pequena Cabana de Leomund')).toBe('Tiny Hut');
    expect(srdSpellNameFor('Proteção contra o Bem e Mal')).toBe(srdSpellNameFor('Proteção contra o Bem e o Mal'));
  });
});
