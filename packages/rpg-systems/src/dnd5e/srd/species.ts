/**
 * Espécies do SRD 5.2.1. Todas são do tipo Humanoide.
 */
import { activeDnd5eBookContent } from '../books/active';
import type { ResourceDefinition, SpeciesDefinition } from './types';
import { mergeWithoutRepeats } from '../books/dedupe';

const proficiencyUses = (
  key: string,
  label: string,
  recovery: 'short_rest' | 'long_rest' = 'long_rest',
): ResourceDefinition => ({
  key,
  label,
  recovery,
  display: 'pool',
  max: ({ proficiencyBonus }) => proficiencyBonus,
});

const oncePerLongRest = (key: string, label: string, minLevel = 1): ResourceDefinition => ({
  key,
  label,
  recovery: 'long_rest',
  display: 'checkboxes',
  max: ({ level }) => (level >= minLevel ? 1 : null),
});

export const SRD_SPECIES: readonly SpeciesDefinition[] = [
  {
    id: 'dragonborn',
    name: 'Draconato',
    summary: 'Descendentes de dragões, com sopro elemental e escamas resistentes.',
    sizes: ['medium'],
    sizeLabel: 'Médio (1,5 a 2,1 m)',
    speed: 30,
    lineage: {
      label: 'Ancestralidade dracônica',
      options: [
        {
          id: 'black',
          name: 'Preto (ácido)',
          description: 'Sopro e resistência de ácido.',
          damageType: 'acid',
        },
        {
          id: 'blue',
          name: 'Azul (elétrico)',
          description: 'Sopro e resistência elétricos.',
          damageType: 'lightning',
        },
        {
          id: 'brass',
          name: 'Latão (fogo)',
          description: 'Sopro e resistência de fogo.',
          damageType: 'fire',
        },
        {
          id: 'bronze',
          name: 'Bronze (elétrico)',
          description: 'Sopro e resistência elétricos.',
          damageType: 'lightning',
        },
        {
          id: 'copper',
          name: 'Cobre (ácido)',
          description: 'Sopro e resistência de ácido.',
          damageType: 'acid',
        },
        {
          id: 'gold',
          name: 'Ouro (fogo)',
          description: 'Sopro e resistência de fogo.',
          damageType: 'fire',
        },
        {
          id: 'green',
          name: 'Verde (veneno)',
          description: 'Sopro e resistência de veneno.',
          damageType: 'poison',
        },
        {
          id: 'red',
          name: 'Vermelho (fogo)',
          description: 'Sopro e resistência de fogo.',
          damageType: 'fire',
        },
        {
          id: 'silver',
          name: 'Prata (frio)',
          description: 'Sopro e resistência de frio.',
          damageType: 'cold',
        },
        {
          id: 'white',
          name: 'Branco (frio)',
          description: 'Sopro e resistência de frio.',
          damageType: 'cold',
        },
      ],
    },
    traits: [
      {
        level: 1,
        name: 'Arma de Sopro',
        description:
          'Ao usar a ação de Ataque, troca um ataque por um sopro em cone de 4,5 m ou linha de 9 m (1,5 m de largura). TR de Destreza (CD 8 + mod. de Constituição + bônus de proficiência): 1d10 de dano do tipo da ancestralidade, metade se passar. O dano sobe para 2d10 (5º nível), 3d10 (11º) e 4d10 (17º). Usos iguais ao bônus de proficiência por descanso longo.',
        resourceKey: 'species_breath_weapon',
      },
      {
        level: 1,
        name: 'Resistência a Dano',
        description: 'Resistência ao tipo de dano da sua ancestralidade dracônica.',
      },
      { level: 1, name: 'Visão no Escuro', description: 'Visão no escuro de 18 m.' },
      {
        level: 5,
        name: 'Voo Dracônico',
        description:
          'Com uma ação bônus, asas espectrais dão Deslocamento de voo igual ao seu Deslocamento por 10 minutos. Uma vez por descanso longo.',
        resourceKey: 'species_draconic_flight',
      },
    ],
    resources: [
      proficiencyUses('species_breath_weapon', 'Arma de Sopro'),
      oncePerLongRest('species_draconic_flight', 'Voo Dracônico', 5),
    ],
  },
  {
    id: 'dwarf',
    name: 'Anão',
    summary: 'Resistentes como a pedra, com visão no escuro aguçada e afinidade com a rocha.',
    sizes: ['medium'],
    sizeLabel: 'Médio (1,2 a 1,5 m)',
    speed: 30,
    traits: [
      { level: 1, name: 'Visão no Escuro', description: 'Visão no escuro de 36 m.' },
      {
        level: 1,
        name: 'Resiliência Anã',
        description:
          'Resistência a dano de veneno e Vantagem em testes de resistência para evitar ou encerrar a condição Envenenado.',
      },
      {
        level: 1,
        name: 'Robustez Anã',
        description: 'Seu máximo de pontos de vida aumenta em 1 por nível (já incluído).',
      },
      {
        level: 1,
        name: 'Conhecimento de Pedras',
        description:
          'Com uma ação bônus, ganha Sentido Sísmico de 18 m por 10 minutos, se estiver sobre ou tocando pedra. Usos iguais ao bônus de proficiência por descanso longo.',
        resourceKey: 'species_stonecunning',
      },
    ],
    resources: [proficiencyUses('species_stonecunning', 'Conhecimento de Pedras')],
  },
  {
    id: 'elf',
    name: 'Elfo',
    summary: 'Seres de origem feérica, de sentidos aguçados e magia inata.',
    sizes: ['medium'],
    sizeLabel: 'Médio (1,5 a 1,8 m)',
    speed: 30,
    spellcastingAbilityChoice: true,
    lineage: {
      label: 'Linhagem élfica',
      options: [
        {
          id: 'drow',
          name: 'Drow',
          description:
            'Visão no escuro de 36 m e o truque Globos de Luz. Fogo das Fadas no 3º nível e Escuridão no 5º.',
          cantrips: ['Dancing Lights'],
          spells: [
            { level: 3, spell: 'Faerie Fire' },
            { level: 5, spell: 'Darkness' },
          ],
        },
        {
          id: 'high_elf',
          name: 'Alto Elfo',
          description:
            'O truque Prestidigitação (pode trocá-lo por outro truque de mago a cada descanso longo). Detectar Magia no 3º nível e Passo Nebuloso no 5º.',
          cantrips: ['Prestidigitation'],
          spells: [
            { level: 3, spell: 'Detect Magic' },
            { level: 5, spell: 'Misty Step' },
          ],
        },
        {
          id: 'wood_elf',
          name: 'Elfo da Floresta',
          description:
            'Deslocamento de 10,5 m e o truque Arte Druídica. Passos Longos no 3º nível e Passos sem Pegadas no 5º.',
          cantrips: ['Druidcraft'],
          speed: 35,
          spells: [
            { level: 3, spell: 'Longstrider' },
            { level: 5, spell: 'Pass without Trace' },
          ],
        },
      ],
    },
    traits: [
      {
        level: 1,
        name: 'Visão no Escuro',
        description: 'Visão no escuro de 18 m (36 m para drow).',
      },
      {
        level: 1,
        name: 'Linhagem Élfica',
        description:
          'Concede um truque no 1º nível e magias no 3º e 5º níveis, sempre preparadas; cada magia pode ser conjurada 1 vez sem espaço de magia por descanso longo.',
      },
      {
        level: 1,
        name: 'Ancestralidade Feérica',
        description:
          'Vantagem em testes de resistência para evitar ou encerrar a condição Enfeitiçado.',
      },
      {
        level: 1,
        name: 'Sentidos Aguçados',
        description: 'Proficiência em Intuição, Percepção ou Sobrevivência.',
      },
      {
        level: 1,
        name: 'Transe',
        description:
          'Não precisa dormir, magia não o faz dormir e um descanso longo leva 4 horas de meditação consciente.',
      },
    ],
  },
  {
    id: 'gnome',
    name: 'Gnomo',
    summary: 'Pequenos, engenhosos e de mente resistente à magia.',
    sizes: ['small'],
    sizeLabel: 'Pequeno (0,9 a 1,2 m)',
    speed: 30,
    spellcastingAbilityChoice: true,
    lineage: {
      label: 'Linhagem gnômica',
      options: [
        {
          id: 'forest_gnome',
          name: 'Gnomo da Floresta',
          description:
            'O truque Ilusão Menor e Falar com Animais sempre preparada, conjurável sem espaço de magia (usos iguais ao bônus de proficiência por descanso longo).',
          cantrips: ['Minor Illusion'],
          spells: [{ level: 1, spell: 'Speak with Animals', uses: 'proficiency' }],
        },
        {
          id: 'rock_gnome',
          name: 'Gnomo das Rochas',
          description:
            'Os truques Consertar e Prestidigitação; em 10 minutos cria pequenos dispositivos mecânicos (até três ao mesmo tempo, duram 8 horas).',
          cantrips: ['Mending', 'Prestidigitation'],
        },
      ],
    },
    traits: [
      { level: 1, name: 'Visão no Escuro', description: 'Visão no escuro de 18 m.' },
      {
        level: 1,
        name: 'Astúcia Gnômica',
        description: 'Vantagem em testes de resistência de Inteligência, Sabedoria e Carisma.',
      },
      {
        level: 1,
        name: 'Linhagem Gnômica',
        description: 'Concede truques e magia conforme a linhagem escolhida.',
      },
    ],
  },
  {
    id: 'goliath',
    name: 'Golias',
    summary: 'Descendentes de gigantes, enormes e com dádivas sobrenaturais da ancestralidade.',
    sizes: ['medium'],
    sizeLabel: 'Médio (2,1 a 2,4 m)',
    speed: 35,
    lineage: {
      label: 'Ancestralidade gigante',
      options: [
        {
          id: 'cloud',
          name: 'Salto das Nuvens (Gigante das Nuvens)',
          description:
            'Com uma ação bônus, teletransporta-se até 9 m para um espaço visível desocupado.',
        },
        {
          id: 'fire',
          name: 'Queimadura do Fogo (Gigante do Fogo)',
          description: 'Ao acertar um ataque e causar dano, causa também 1d10 de dano de fogo.',
        },
        {
          id: 'frost',
          name: 'Frio do Gelo (Gigante do Gelo)',
          description:
            'Ao acertar um ataque e causar dano, causa 1d6 de frio e reduz o Deslocamento do alvo em 3 m até o seu próximo turno.',
        },
        {
          id: 'hill',
          name: 'Tombo da Colina (Gigante da Colina)',
          description:
            'Ao acertar uma criatura Grande ou menor e causar dano, pode deixá-la Caída.',
        },
        {
          id: 'stone',
          name: 'Resistência da Pedra (Gigante da Pedra)',
          description:
            'Ao sofrer dano, usa a reação para rolar 1d12 + mod. de Constituição e reduzir o dano nesse total.',
        },
        {
          id: 'storm',
          name: 'Trovão da Tempestade (Gigante da Tempestade)',
          description:
            'Ao sofrer dano de uma criatura a até 18 m, usa a reação para causar 1d8 de dano trovejante a ela.',
        },
      ],
    },
    traits: [
      {
        level: 1,
        name: 'Ancestralidade Gigante',
        description:
          'Dádiva sobrenatural da ancestralidade escolhida. Usos iguais ao bônus de proficiência por descanso longo.',
        resourceKey: 'species_giant_ancestry',
      },
      {
        level: 5,
        name: 'Forma Grande',
        description:
          'Com uma ação bônus, fica Grande por 10 minutos: Vantagem em testes de Força e +3 m de Deslocamento. Uma vez por descanso longo.',
        resourceKey: 'species_large_form',
      },
      {
        level: 1,
        name: 'Constituição Poderosa',
        description:
          'Vantagem em testes para encerrar a condição Agarrado e conta como um tamanho maior para a capacidade de carga.',
      },
    ],
    resources: [
      proficiencyUses('species_giant_ancestry', 'Ancestralidade Gigante'),
      oncePerLongRest('species_large_form', 'Forma Grande', 5),
    ],
  },
  {
    id: 'halfling',
    name: 'Pequenino',
    summary: 'Pequenos, corajosos e notoriamente sortudos.',
    sizes: ['small'],
    sizeLabel: 'Pequeno (0,6 a 0,9 m)',
    speed: 30,
    traits: [
      {
        level: 1,
        name: 'Corajoso',
        description:
          'Vantagem em testes de resistência para evitar ou encerrar a condição Amedrontado.',
      },
      {
        level: 1,
        name: 'Agilidade Pequenina',
        description:
          'Pode atravessar o espaço de criaturas um tamanho maior que você, mas não parar nele.',
      },
      {
        level: 1,
        name: 'Sorte',
        description: 'Ao tirar 1 no d20 de um Teste de D20, rola de novo e usa o novo resultado.',
      },
      {
        level: 1,
        name: 'Furtividade Natural',
        description:
          'Pode usar a ação Esconder mesmo quando só está encoberto por uma criatura pelo menos um tamanho maior.',
      },
    ],
  },
  {
    id: 'human',
    name: 'Humano',
    summary: 'Versáteis e ambiciosos, presentes em todos os cantos do multiverso.',
    sizes: ['medium', 'small'],
    sizeLabel: 'Médio (1,2 a 2,1 m) ou Pequeno (0,6 a 1,2 m)',
    speed: 30,
    traits: [
      {
        level: 1,
        name: 'Engenhoso',
        description: 'Ganha Inspiração Heroica sempre que termina um descanso longo.',
      },
      { level: 1, name: 'Hábil', description: 'Proficiência em uma perícia à escolha.' },
      {
        level: 1,
        name: 'Versátil',
        description: 'Ganha um talento de origem à escolha (Habilidoso é o recomendado).',
      },
    ],
  },
  {
    id: 'orc',
    name: 'Orc',
    summary: 'Fortes e incansáveis, movidos por uma energia que os mantém de pé.',
    sizes: ['medium'],
    sizeLabel: 'Médio (1,8 a 2,1 m)',
    speed: 30,
    traits: [
      {
        level: 1,
        name: 'Surto de Adrenalina',
        description:
          'Pode usar Disparada como ação bônus e ganha PV temporários iguais ao bônus de proficiência. Usos iguais ao bônus de proficiência por descanso curto ou longo.',
        resourceKey: 'species_adrenaline_rush',
      },
      { level: 1, name: 'Visão no Escuro', description: 'Visão no escuro de 36 m.' },
      {
        level: 1,
        name: 'Resistência Implacável',
        description:
          'Ao chegar a 0 PV sem morrer, pode ficar com 1 PV. Uma vez por descanso longo.',
        resourceKey: 'species_relentless_endurance',
      },
    ],
    resources: [
      proficiencyUses('species_adrenaline_rush', 'Surto de Adrenalina', 'short_rest'),
      oncePerLongRest('species_relentless_endurance', 'Resistência Implacável'),
    ],
  },
  {
    id: 'tiefling',
    name: 'Tiferino',
    summary: 'Marcados por um legado dos Planos Inferiores, com magia infernal no sangue.',
    sizes: ['medium', 'small'],
    sizeLabel: 'Médio (1,2 a 2,1 m) ou Pequeno (0,9 a 1,2 m)',
    speed: 30,
    spellcastingAbilityChoice: true,
    cantrips: ['Thaumaturgy'],
    lineage: {
      label: 'Legado ínfero',
      options: [
        {
          id: 'abyssal',
          name: 'Abissal',
          description:
            'Resistência a veneno e o truque Rajada de Veneno. Raio Nauseante no 3º nível e Imobilizar Pessoa no 5º.',
          damageType: 'poison',
          cantrips: ['Poison Spray'],
          spells: [
            { level: 3, spell: 'Ray of Sickness' },
            { level: 5, spell: 'Hold Person' },
          ],
        },
        {
          id: 'chthonic',
          name: 'Ctônico',
          description:
            'Resistência a necrótico e o truque Toque Arrepiante. Vida Falsa no 3º nível e Raio do Enfraquecimento no 5º.',
          damageType: 'necrotic',
          cantrips: ['Chill Touch'],
          spells: [
            { level: 3, spell: 'False Life' },
            { level: 5, spell: 'Ray of Enfeeblement' },
          ],
        },
        {
          id: 'infernal',
          name: 'Infernal',
          description:
            'Resistência a fogo e o truque Raio de Fogo. Repreensão Infernal no 3º nível e Escuridão no 5º.',
          damageType: 'fire',
          cantrips: ['Fire Bolt'],
          spells: [
            { level: 3, spell: 'Hellish Rebuke' },
            { level: 5, spell: 'Darkness' },
          ],
        },
      ],
    },
    traits: [
      { level: 1, name: 'Visão no Escuro', description: 'Visão no escuro de 18 m.' },
      {
        level: 1,
        name: 'Legado Ínfero',
        description:
          'Resistência e truque do legado escolhido; magias no 3º e 5º níveis, sempre preparadas, cada uma conjurável 1 vez sem espaço de magia por descanso longo.',
      },
      {
        level: 1,
        name: 'Presença de Outro Mundo',
        description:
          'Conhece o truque Taumaturgia, que usa o mesmo atributo de conjuração do legado.',
      },
    ],
  },
];

export function findSpecies(id: string): SpeciesDefinition | undefined {
  return (
    SRD_SPECIES.find((species) => species.id === id) ??
    activeDnd5eBookContent().species.find((species) => species.id === id)
  );
}

/** Espécies do SRD e dos livros liberados. */
export function listSpecies(): readonly SpeciesDefinition[] {
  const books = activeDnd5eBookContent().species;
  return books.length ? mergeWithoutRepeats(SRD_SPECIES, books) : SRD_SPECIES;
}

export const sizeLabels = { small: 'Pequeno', medium: 'Médio' } as const;

/** Nomes para a lista de espécies da ficha ("Draconato (Preto (ácido))" para cada linhagem). */
export function speciesOptionNames(): string[] {
  return SRD_SPECIES.flatMap((species) =>
    species.lineage
      ? species.lineage.options.map((option) => `${species.name} (${option.name})`)
      : [species.name],
  );
}
