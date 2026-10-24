/**
 * Opções escolhidas dentro de habilidades de classe do SRD 5.2.1: Invocações Místicas do
 * bruxo, Metamagia do feiticeiro e as terras do Círculo da Terra.
 */

export interface InvocationDefinition {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  /** Outra invocação exigida. */
  requires?: string;
  /** Exige um truque de bruxo que cause dano (ou que use jogada de ataque). */
  requiresDamageCantrip?: 'damage' | 'attack';
  /** Concede um talento de origem à escolha. */
  grantsOriginFeat?: boolean;
}

export const SRD_INVOCATIONS: readonly InvocationDefinition[] = [
  {
    id: 'agonizing_blast',
    name: 'Explosão Agonizante',
    minLevel: 2,
    requiresDamageCantrip: 'damage',
    description: 'Soma o mod. de Carisma ao dano de um truque de bruxo que cause dano.',
  },
  {
    id: 'armor_of_shadows',
    name: 'Armadura de Sombras',
    minLevel: 1,
    description: 'Conjura Armadura Arcana em si mesmo sem gastar espaço de magia.',
  },
  {
    id: 'ascendant_step',
    name: 'Passo Ascendente',
    minLevel: 5,
    description: 'Conjura Levitação em si mesmo sem gastar espaço de magia.',
  },
  {
    id: 'devils_sight',
    name: 'Visão do Diabo',
    minLevel: 2,
    description: 'Enxerga normalmente na Penumbra e na Escuridão, mágica ou não, a até 36 m.',
  },
  {
    id: 'devouring_blade',
    name: 'Lâmina Devoradora',
    minLevel: 12,
    requires: 'thirsting_blade',
    description: 'O Ataque Extra da Lâmina Sedenta concede dois ataques extras em vez de um.',
  },
  {
    id: 'eldritch_mind',
    name: 'Mente Mística',
    minLevel: 1,
    description: 'Vantagem em testes de resistência de Constituição para manter a Concentração.',
  },
  {
    id: 'eldritch_smite',
    name: 'Destruição Mística',
    minLevel: 5,
    requires: 'pact_of_the_blade',
    description:
      'Uma vez por turno, ao acertar com a arma do pacto, gasta um espaço de pacto para causar 1d8 de energia + 1d8 por círculo e pode derrubar o alvo (Enorme ou menor).',
  },
  {
    id: 'eldritch_spear',
    name: 'Lança Mística',
    minLevel: 2,
    requiresDamageCantrip: 'damage',
    description:
      'Um truque de bruxo de dano com alcance de 3 m ou mais ganha 9 m de alcance por nível de bruxo.',
  },
  {
    id: 'fiendish_vigor',
    name: 'Vigor Ínfero',
    minLevel: 2,
    description:
      'Conjura Vida Falsa em si mesmo sem gastar espaço, recebendo o máximo de PV temporários.',
  },
  {
    id: 'gaze_of_two_minds',
    name: 'Olhar de Duas Mentes',
    minLevel: 5,
    description:
      'Com uma ação bônus, toca uma criatura disposta e percebe pelos sentidos dela até o fim do seu próximo turno, podendo conjurar a partir do espaço dela.',
  },
  {
    id: 'gift_of_the_depths',
    name: 'Dádiva das Profundezas',
    minLevel: 5,
    description:
      'Respira debaixo d’água, tem Deslocamento de natação igual ao Deslocamento e conjura Respirar na Água uma vez sem espaço por descanso longo.',
  },
  {
    id: 'gift_of_the_protectors',
    name: 'Dádiva dos Protetores',
    minLevel: 9,
    requires: 'pact_of_the_tome',
    description:
      'Criaturas que escrevem o nome no Livro das Sombras caem a 1 PV em vez de 0 (uma vez por descanso longo cada).',
  },
  {
    id: 'investment_of_the_chain_master',
    name: 'Investidura do Mestre da Corrente',
    minLevel: 5,
    requires: 'pact_of_the_chain',
    description:
      'O familiar ganha voo ou natação de 12 m, ataca com ação bônus, causa dano necrótico ou radiante, usa sua CD e pode receber Resistência a dano com a sua reação.',
  },
  {
    id: 'lessons_of_the_first_ones',
    name: 'Lições dos Primeiros',
    minLevel: 2,
    grantsOriginFeat: true,
    description: 'Ganha um talento de origem à escolha.',
  },
  {
    id: 'lifedrinker',
    name: 'Bebedor de Vida',
    minLevel: 9,
    requires: 'pact_of_the_blade',
    description:
      'Uma vez por turno, ao acertar com a arma do pacto, causa 1d6 extra de dano necrótico, psíquico ou radiante e pode gastar um Dado de Vida para se curar.',
  },
  {
    id: 'mask_of_many_faces',
    name: 'Máscara de Muitas Faces',
    minLevel: 2,
    description: 'Conjura Disfarçar-se sem gastar espaço de magia.',
  },
  {
    id: 'master_of_myriad_forms',
    name: 'Mestre de Miríades de Formas',
    minLevel: 5,
    description: 'Conjura Alterar-se sem gastar espaço de magia.',
  },
  {
    id: 'misty_visions',
    name: 'Visões Nebulosas',
    minLevel: 2,
    description: 'Conjura Imagem Silenciosa sem gastar espaço de magia.',
  },
  {
    id: 'one_with_shadows',
    name: 'Um com as Sombras',
    minLevel: 5,
    description:
      'Na Penumbra ou na Escuridão, conjura Invisibilidade em si mesmo sem gastar espaço.',
  },
  {
    id: 'otherworldly_leap',
    name: 'Salto Sobrenatural',
    minLevel: 2,
    description: 'Conjura Salto em si mesmo sem gastar espaço de magia.',
  },
  {
    id: 'pact_of_the_blade',
    name: 'Pacto da Lâmina',
    minLevel: 1,
    description:
      'Com uma ação bônus, conjura ou vincula uma arma corpo a corpo simples ou marcial: tem proficiência com ela, pode usá-la como foco e usar Carisma no ataque e no dano (dano necrótico, psíquico, radiante ou o normal).',
  },
  {
    id: 'pact_of_the_chain',
    name: 'Pacto da Corrente',
    minLevel: 1,
    description:
      'Aprende Convocar Familiar e pode conjurá-la como ação de Magia sem espaço, com formas especiais; ao atacar, pode trocar um ataque por um ataque do familiar.',
  },
  {
    id: 'pact_of_the_tome',
    name: 'Pacto do Tomo',
    minLevel: 1,
    description:
      'Conjura um Livro das Sombras com 3 truques e 2 rituais de 1º círculo de qualquer classe (sempre preparados enquanto estiver com ele); serve de foco.',
  },
  {
    id: 'repelling_blast',
    name: 'Explosão Repulsiva',
    minLevel: 2,
    requiresDamageCantrip: 'attack',
    description:
      'Ao acertar uma criatura Grande ou menor com um truque de bruxo de ataque, empurra-a até 3 m.',
  },
  {
    id: 'thirsting_blade',
    name: 'Lâmina Sedenta',
    minLevel: 5,
    requires: 'pact_of_the_blade',
    description: 'Ataque Extra com a arma do pacto: ataca duas vezes ao usar a ação de Ataque.',
  },
  {
    id: 'visions_of_distant_realms',
    name: 'Visões de Reinos Distantes',
    minLevel: 9,
    description: 'Conjura Olho Arcano sem gastar espaço de magia.',
  },
  {
    id: 'whispers_of_the_grave',
    name: 'Sussurros da Sepultura',
    minLevel: 7,
    description: 'Conjura Falar com os Mortos sem gastar espaço de magia.',
  },
  {
    id: 'witch_sight',
    name: 'Visão da Bruxa',
    minLevel: 15,
    description: 'Visão Verdadeira de 9 m.',
  },
];

export interface MetamagicDefinition {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export const SRD_METAMAGIC: readonly MetamagicDefinition[] = [
  {
    id: 'careful',
    name: 'Magia Cuidadosa',
    cost: 1,
    description:
      'Criaturas à escolha (até o mod. de Carisma, mín. 1) passam automaticamente no TR da magia e não sofrem dano se sofreriam metade.',
  },
  {
    id: 'distant',
    name: 'Magia Distante',
    cost: 1,
    description: 'Dobra o alcance da magia, ou dá 9 m de alcance a uma magia de toque.',
  },
  {
    id: 'empowered',
    name: 'Magia Potencializada',
    cost: 1,
    description:
      'Rola de novo dados de dano até o mod. de Carisma (mín. 1). Pode ser combinada com outra Metamagia.',
  },
  {
    id: 'extended',
    name: 'Magia Estendida',
    cost: 1,
    description:
      'Dobra a duração de uma magia de 1 minuto ou mais (máximo 24 horas) e dá Vantagem para manter a Concentração nela.',
  },
  {
    id: 'heightened',
    name: 'Magia Elevada',
    cost: 2,
    description: 'Um alvo tem Desvantagem nos testes de resistência contra a magia.',
  },
  {
    id: 'quickened',
    name: 'Magia Acelerada',
    cost: 2,
    description:
      'Conjura com ação bônus uma magia de uma ação (não se já conjurou magia de 1º círculo ou maior no turno).',
  },
  {
    id: 'seeking',
    name: 'Magia Teleguiada',
    cost: 1,
    description:
      'Ao errar um ataque de magia, rola o d20 de novo. Pode ser combinada com outra Metamagia.',
  },
  {
    id: 'subtle',
    name: 'Magia Sutil',
    cost: 1,
    description:
      'Conjura sem componentes verbais, somáticos ou materiais (exceto os consumidos ou com custo).',
  },
  {
    id: 'transmuted',
    name: 'Magia Transmutada',
    cost: 1,
    description: 'Troca o tipo de dano entre ácido, frio, fogo, elétrico, veneno e trovejante.',
  },
  {
    id: 'twinned',
    name: 'Magia Gêmea',
    cost: 1,
    description:
      'Aumenta em 1 o círculo efetivo de uma magia que afeta mais alvos em círculos maiores.',
  },
];

/** Magias do Círculo da Terra por tipo de terra e nível de druida. */
export const CIRCLE_OF_THE_LAND = [
  {
    id: 'arid',
    name: 'Árida',
    resistance: 'fogo',
    spells: [
      { level: 3, spells: ['Blur', 'Burning Hands', 'Fire Bolt'] },
      { level: 5, spells: ['Fireball'] },
      { level: 7, spells: ['Blight'] },
      { level: 9, spells: ['Wall of Stone'] },
    ],
  },
  {
    id: 'polar',
    name: 'Polar',
    resistance: 'frio',
    spells: [
      { level: 3, spells: ['Fog Cloud', 'Hold Person', 'Ray of Frost'] },
      { level: 5, spells: ['Sleet Storm'] },
      { level: 7, spells: ['Ice Storm'] },
      { level: 9, spells: ['Cone of Cold'] },
    ],
  },
  {
    id: 'temperate',
    name: 'Temperada',
    resistance: 'elétrico',
    spells: [
      { level: 3, spells: ['Misty Step', 'Shocking Grasp', 'Sleep'] },
      { level: 5, spells: ['Lightning Bolt'] },
      { level: 7, spells: ['Freedom of Movement'] },
      { level: 9, spells: ['Tree Stride'] },
    ],
  },
  {
    id: 'tropical',
    name: 'Tropical',
    resistance: 'veneno',
    spells: [
      { level: 3, spells: ['Acid Splash', 'Ray of Sickness', 'Web'] },
      { level: 5, spells: ['Stinking Cloud'] },
      { level: 7, spells: ['Polymorph'] },
      { level: 9, spells: ['Insect Plague'] },
    ],
  },
] as const;

/** Terrenos do Círculo da Terra de uma subclasse: os do SRD ou os do livro (2014). */
export function landOptionsFor(
  subclass: { id: string; landOptions?: readonly { id: string; name: string; spells: readonly { level: number; spells: readonly string[] }[] }[] } | undefined | null,
): readonly { id: string; name: string; spells: readonly { level: number; spells: readonly string[] }[] }[] {
  if (!subclass) return [];
  if (subclass.id === 'land') return CIRCLE_OF_THE_LAND;
  return subclass.landOptions ?? [];
}
