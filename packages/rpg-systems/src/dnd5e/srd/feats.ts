/**
 * Talentos do SRD 5.2.1: de origem, gerais, de estilo de luta e dádivas épicas.
 */
import { activeDnd5eBookContent } from '../books/active';
import type { FeatCategory, FeatDefinition } from './types';

export const featCategoryLabels: Record<FeatCategory, string> = {
  origin: 'Talento de origem',
  general: 'Talento geral',
  fighting_style: 'Talento de estilo de luta',
  epic: 'Dádiva épica',
};

export const SRD_FEATS: readonly FeatDefinition[] = [
  // Origem
  {
    id: 'alert',
    name: 'Alerta',
    category: 'origin',
    description:
      'Proficiência em Iniciativa: soma o bônus de proficiência às jogadas de Iniciativa. Troca de Iniciativa: logo após rolar a Iniciativa, pode trocá-la com a de um aliado disposto no mesmo combate (nenhum dos dois pode estar Incapacitado).',
  },
  {
    id: 'magic_initiate',
    name: 'Iniciado em Magia',
    category: 'origin',
    repeatable: true,
    description:
      'Aprende 2 truques e 1 magia de 1º círculo da lista escolhida (Clérigo, Druida ou Mago). A magia fica sempre preparada e pode ser conjurada 1 vez sem espaço de magia por descanso longo (ou com espaços que você tenha). A cada novo nível, pode trocar uma das magias por outra do mesmo círculo da mesma lista. Repetível com listas diferentes.',
  },
  {
    id: 'savage_attacker',
    name: 'Atacante Selvagem',
    category: 'origin',
    description: 'Uma vez por turno, ao acertar um alvo com uma arma, rola os dados de dano da arma duas vezes e usa o resultado que preferir.',
  },
  {
    id: 'skilled',
    name: 'Habilidoso',
    category: 'origin',
    repeatable: true,
    description: 'Proficiência em qualquer combinação de três perícias ou ferramentas. Repetível.',
  },
  // Gerais
  {
    id: 'ability_score_improvement',
    name: 'Aumento no Valor de Atributo',
    category: 'general',
    repeatable: true,
    minLevel: 4,
    description: 'Aumenta um valor de atributo em 2, ou dois valores em 1. Não pode passar de 20. Repetível.',
  },
  {
    id: 'grappler',
    name: 'Agarrador',
    category: 'general',
    minLevel: 4,
    minScore: { abilities: ['str', 'dex'], value: 13 },
    description:
      'Força ou Destreza +1 (máximo 20). Socar e Agarrar: uma vez por turno, ao acertar um Ataque Desarmado na ação de Ataque, usa as opções de Dano e Agarrar. Vantagem em ataques contra criaturas agarradas por você. Não gasta deslocamento extra para mover criaturas agarradas do seu tamanho ou menores.',
  },
  // Estilos de luta (exigem a habilidade Estilo de Luta)
  {
    id: 'archery',
    name: 'Arquearia',
    category: 'fighting_style',
    description: '+2 nas jogadas de ataque com armas à distância.',
  },
  {
    id: 'defense',
    name: 'Defesa',
    category: 'fighting_style',
    description: '+1 na Classe de Armadura enquanto usa armadura leve, média ou pesada.',
  },
  {
    id: 'great_weapon_fighting',
    name: 'Combate com Armas Grandes',
    category: 'fighting_style',
    description:
      'Ao rolar dano de um ataque com arma corpo a corpo empunhada com as duas mãos (propriedade Duas Mãos ou Versátil), trata qualquer 1 ou 2 nos dados de dano como 3.',
  },
  {
    id: 'two_weapon_fighting',
    name: 'Combate com Duas Armas',
    category: 'fighting_style',
    description: 'No ataque extra da propriedade Leve, soma o modificador de atributo ao dano, se ainda não somava.',
  },
  // Dádivas épicas (19º nível)
  {
    id: 'boon_of_combat_prowess',
    name: 'Dádiva da Proeza em Combate',
    category: 'epic',
    minLevel: 19,
    description: 'Um atributo à escolha +1 (máximo 30). Mira Impecável: ao errar uma jogada de ataque, pode acertar; recupera o uso no início do seu próximo turno.',
  },
  {
    id: 'boon_of_dimensional_travel',
    name: 'Dádiva da Viagem Dimensional',
    category: 'epic',
    minLevel: 19,
    description: 'Um atributo à escolha +1 (máximo 30). Passos Cintilantes: logo após a ação de Ataque ou de Magia, teletransporta-se até 9 m para um espaço visível desocupado.',
  },
  {
    id: 'boon_of_fate',
    name: 'Dádiva do Destino',
    category: 'epic',
    minLevel: 19,
    description:
      'Um atributo à escolha +1 (máximo 30). Melhorar o Destino: quando você ou uma criatura a até 18 m acerta ou falha um Teste de D20, rola 2d4 e aplica como bônus ou penalidade; recupera ao rolar Iniciativa ou após um descanso curto ou longo.',
  },
  {
    id: 'boon_of_irresistible_offense',
    name: 'Dádiva da Ofensiva Irresistível',
    category: 'epic',
    minLevel: 19,
    description:
      'Força ou Destreza +1 (máximo 30). Seu dano de Concussão, Perfurante e Cortante ignora Resistência. Golpe Esmagador: ao tirar 20 no d20 de um ataque, causa dano extra igual ao valor do atributo aumentado por esta dádiva.',
  },
  {
    id: 'boon_of_spell_recall',
    name: 'Dádiva da Recuperação de Magia',
    category: 'epic',
    minLevel: 19,
    description:
      'Inteligência, Sabedoria ou Carisma +1 (máximo 30). Conjuração Livre: ao conjurar com um espaço de 1º a 4º círculo, rola 1d4; se o resultado for igual ao círculo do espaço, ele não é gasto. Exige a habilidade Conjuração.',
  },
  {
    id: 'boon_of_the_night_spirit',
    name: 'Dádiva do Espírito da Noite',
    category: 'epic',
    minLevel: 19,
    description:
      'Um atributo à escolha +1 (máximo 30). Na Penumbra ou na Escuridão, pode ficar Invisível com uma ação bônus (termina ao agir) e tem Resistência a todo dano, exceto Psíquico e Radiante.',
  },
  {
    id: 'boon_of_truesight',
    name: 'Dádiva da Visão Verdadeira',
    category: 'epic',
    minLevel: 19,
    description: 'Um atributo à escolha +1 (máximo 30). Visão Verdadeira com alcance de 18 m.',
  },
];

export function findFeat(id: string): FeatDefinition | undefined {
  return SRD_FEATS.find((feat) => feat.id === id) ?? activeDnd5eBookContent().feats.find((feat) => feat.id === id);
}

/** Talentos do SRD e dos livros liberados. */
export function listFeats(): readonly FeatDefinition[] {
  const books = activeDnd5eBookContent().feats;
  return books.length ? [...SRD_FEATS, ...books] : SRD_FEATS;
}

/** Atributos que uma dádiva épica pode aumentar. */
export function epicBoonAbilities(featId: string): readonly ('str' | 'dex' | 'con' | 'int' | 'wis' | 'cha')[] {
  if (featId === 'boon_of_irresistible_offense') return ['str', 'dex'];
  if (featId === 'boon_of_spell_recall') return ['int', 'wis', 'cha'];
  return ['str', 'dex', 'con', 'int', 'wis', 'cha'];
}
