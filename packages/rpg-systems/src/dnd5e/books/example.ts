/**
 * Pacote-modelo: um livro inventado pelo Codexveil com uma entrada de cada tipo. É o arquivo
 * que a página "Meus livros" oferece para baixar, como ponto de partida do pacote de um livro.
 * Nada aqui vem de livros comerciais.
 */
import { BOOK_PACK_FORMAT, BOOK_PACK_VERSION } from './pack';

const prepared = [2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];

export const BOOK_PACK_EXAMPLE = {
  format: BOOK_PACK_FORMAT,
  version: BOOK_PACK_VERSION,
  book: {
    id: 'compendio-de-exemplo',
    name: 'Compêndio de Exemplo',
    category: 'player',
    edition: '2014',
    origin: 'Modelo do Codexveil (conteúdo inventado).',
  },
  entries: [
    {
      kind: 'section',
      key: 'introducao',
      name: 'Introdução',
      data: {
        chapter: 'Introdução',
        path: ['Introdução'],
        order: 0,
        page: 1,
        body: [
          'Cada capítulo do livro vira uma ou mais entradas `section`, em ordem (`order`).',
          '',
          '### Como o texto é exibido',
          '',
          '- Parágrafos separados por uma linha em branco.',
          '- Listas com "- " no começo da linha.',
          '- **Negrito** e *itálico* com asteriscos.',
          '',
          '| Coluna | Outra coluna |',
          '| --- | --- |',
          '| Tabelas | com barras verticais |',
        ].join('\n'),
      },
    },
    {
      kind: 'class',
      key: 'arcanista',
      name: 'Arcanista',
      data: {
        summary: 'Estudiosa de runas que conjura magias com a Inteligência.',
        hitDie: 'd8',
        primaryAbilities: ['int'],
        savingThrows: ['int', 'wis'],
        skillChoices: { count: 2, options: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
        armor: ['light'],
        weapons: { simple: true, martial: 'none' },
        tools: 'Ferramentas de caligrafia',
        equipment: 'Bordão, livro de runas, pacote de estudioso e 10 PO.',
        startingGold: 60,
        subclassLevel: 3,
        subclassLabel: 'Tradição Rúnica',
        spellcasting: {
          ability: 'int',
          list: 'arcanista',
          progression: 'half',
          cantrips: [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
          prepared,
        },
        features: [
          { level: 1, name: 'Runas Gravadas', description: 'Você grava runas em objetos para conjurar as magias da lista do arcanista.' },
          { level: 2, name: 'Leitura Rápida', description: 'Você faz testes de Inteligência (Investigação) como ação bônus.' },
          { level: 5, name: 'Runa Dupla', description: 'Uma vez por descanso longo, conjura duas magias de 1º círculo na mesma ação.' },
        ],
      },
    },
    {
      kind: 'subclass',
      key: 'guardiao-do-farol',
      name: 'Guardião do Farol',
      data: {
        classId: 'fighter',
        summary: 'Guerreiros que vigiam as costas e guiam aliados no escuro.',
        features: [
          { level: 3, name: 'Luz de Vigia', description: 'Como ação bônus, você emite luz plena num raio de 6 metros por 1 minuto.' },
          { level: 7, name: 'Olhar do Farol', description: 'Você tem vantagem em testes de Sabedoria (Percepção) feitos à noite.' },
        ],
      },
    },
    {
      kind: 'species',
      key: 'povo-do-musgo',
      name: 'Povo do Musgo',
      data: {
        summary: 'Pequenos guardiões das florestas úmidas.',
        creatureType: 'Humanoide',
        sizes: ['small'],
        speed: 30,
        traits: [
          { level: 1, name: 'Camuflagem Verde', description: 'Você tem vantagem em testes de Destreza (Furtividade) em vegetação densa.' },
          { level: 3, name: 'Esporos Calmantes', description: 'Uma vez por descanso longo, criaturas a 3 metros recuperam 1d6 pontos de vida.' },
        ],
        cantrips: ['Druidcraft'],
      },
    },
    {
      kind: 'background',
      key: 'cartografo',
      name: 'Cartógrafo',
      data: {
        summary: 'Você passou anos desenhando mapas de terras pouco conhecidas.',
        skills: ['survival', 'investigation'],
        tools: 'Ferramentas de cartógrafo',
        languages: 'Um idioma à escolha',
        equipment: 'Ferramentas de cartógrafo, estojo de mapas, roupas de viajante e 10 PO.',
        feature: { name: 'Olho para Atalhos', description: 'Você sempre encontra um caminho mais curto entre dois pontos que já visitou.' },
      },
    },
    {
      kind: 'feat',
      key: 'maos-firmes',
      name: 'Mãos Firmes',
      data: {
        category: 'general',
        description: 'Você tem vantagem em testes para manter a concentração ao sofrer dano de quedas e empurrões.',
        prerequisite: '4º nível',
        abilityIncrease: ['dex', 'con'],
      },
    },
    {
      kind: 'spell',
      key: 'lanterna-espectral',
      name: 'Lanterna Espectral',
      data: {
        level: 1,
        school: 'evocation',
        classes: ['wizard', 'arcanista'],
        castingTime: '1 ação bônus',
        range: '9 metros',
        components: 'V, S',
        duration: 'Concentração, até 10 minutos',
        concentration: true,
        description: ['Uma lanterna de luz fantasmagórica flutua até um ponto à sua escolha e ilumina 6 metros ao redor.'],
      },
    },
    {
      kind: 'spell_list',
      key: 'lista-do-arcanista',
      name: 'Magias de Arcanista',
      data: {
        list: 'arcanista',
        spells: [
          { name: 'Detect Magic', level: 1 },
          { name: 'Escudo Arcano', level: 1 },
          { name: 'Lanterna Espectral', level: 1 },
        ],
      },
    },
    {
      kind: 'monster',
      key: 'lodo-faminto',
      name: 'Lodo Faminto',
      data: {
        size: 'Médio',
        type: 'Limo',
        alignment: 'Sem alinhamento',
        ac: 8,
        hp: 22,
        hpFormula: '3d8 + 9',
        speed: '3 m, escalada 3 m',
        abilities: { str: 12, dex: 6, con: 16, int: 1, wis: 6, cha: 2 },
        conditionImmunities: 'Cego, Enfeitiçado, Exausto',
        senses: 'Percepção às cegas 18 m, Percepção passiva 8',
        cr: '1/2',
        xp: '100',
        traits: [{ name: 'Amorfo', description: 'O lodo passa por frestas de 2,5 centímetros.' }],
        actions: [{ name: 'Pseudópode', description: 'Ataque corpo a corpo: +3 para atingir, alcance 1,5 m. Acerto: 6 (1d6 + 1) de dano de ácido.' }],
        lore: ['Lodos famintos se escondem no teto de cavernas úmidas.'],
      },
    },
    {
      kind: 'magic_item',
      key: 'bussola-do-retorno',
      name: 'Bússola do Retorno',
      data: {
        type: 'Item maravilhoso',
        rarity: 'Incomum',
        attunement: '',
        description: ['A agulha desta bússola sempre aponta para o último lugar em que você fez um descanso longo.'],
      },
    },
  ],
} as const;
