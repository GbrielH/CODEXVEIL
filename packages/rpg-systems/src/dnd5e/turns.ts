/**
 * Ações e turnos de D&D (SRD 5.2.1, "Playing the Game" e "Rules Glossary"), resumidos em
 * português pelo Codexveil para o painel de turnos do mestre e o lembrete dos jogadores.
 */
import type { TurnMode } from '@codexveil/domain';

export const DND5E_ACTIONS = [
  'attack',
  'dash',
  'disengage',
  'dodge',
  'help',
  'hide',
  'influence',
  'magic',
  'ready',
  'search',
  'study',
  'utilize',
] as const;
export type Dnd5eActionKey = (typeof DND5E_ACTIONS)[number];

export interface Dnd5eAction {
  key: Dnd5eActionKey;
  label: string;
  summary: string;
}

export const dnd5eActions: Record<Dnd5eActionKey, Dnd5eAction> = {
  attack: { key: 'attack', label: 'Atacar', summary: 'Ataque com uma arma ou um Ataque Desarmado.' },
  dash: { key: 'dash', label: 'Disparada', summary: 'Ganha movimento extra igual ao seu Deslocamento até o fim do turno.' },
  disengage: { key: 'disengage', label: 'Desengajar', summary: 'Seu movimento não provoca Ataques de Oportunidade até o fim do turno.' },
  dodge: {
    key: 'dodge',
    label: 'Esquivar',
    summary: 'Até o início do seu próximo turno, ataques contra você têm Desvantagem e seus testes de resistência de Destreza têm Vantagem.',
  },
  help: { key: 'help', label: 'Ajudar', summary: 'Ajuda o teste ou o ataque de um aliado (ele ganha Vantagem) ou estabiliza alguém com primeiros socorros.' },
  hide: { key: 'hide', label: 'Esconder', summary: 'Teste de Destreza (Furtividade) CD 15, fora da vista e com cobertura: com sucesso, você fica Invisível.' },
  influence: {
    key: 'influence',
    label: 'Influenciar',
    summary: 'Teste de Carisma (Enganação, Intimidação, Atuação ou Persuasão) ou de Sabedoria (Adestrar Animais) para mudar a atitude de alguém.',
  },
  magic: { key: 'magic', label: 'Magia', summary: 'Conjura uma magia, usa um item mágico ou uma habilidade mágica.' },
  ready: { key: 'ready', label: 'Preparar', summary: 'Escolhe um gatilho e uma ação; quando o gatilho acontece, você a faz com a sua Reação.' },
  search: {
    key: 'search',
    label: 'Procurar',
    summary: 'Teste de Sabedoria (Intuição, Medicina, Percepção ou Sobrevivência) para notar ou perceber algo.',
  },
  study: {
    key: 'study',
    label: 'Estudar',
    summary: 'Teste de Inteligência (Arcanismo, História, Investigação, Natureza ou Religião) para lembrar ou deduzir algo.',
  },
  utilize: { key: 'utilize', label: 'Usar objeto', summary: 'Usa um objeto não mágico (alavanca, poção comum, kit de ferramentas…).' },
};

export interface Dnd5eTurnGuide {
  /** Como a mesa conduz o modo. */
  intro: string;
  /** O que cada participante tem em um turno. */
  economy: string[];
  /** Ações mais comuns nesse modo, na ordem de destaque. */
  actions: Dnd5eActionKey[];
}

export const dnd5eTurnGuides: Record<TurnMode, Dnd5eTurnGuide> = {
  combat: {
    intro: 'Rodadas de 6 segundos na ordem dos turnos. Na sua vez, você se move e age; a Reação volta no início do seu turno.',
    economy: [
      'Movimento até o seu Deslocamento (pode dividir antes e depois da ação).',
      '1 Ação.',
      '1 Ação bônus, se uma habilidade ou magia der uma.',
      '1 interação com objeto de graça (sacar uma arma, abrir uma porta).',
      '1 Reação por rodada (ex.: Ataque de Oportunidade).',
    ],
    actions: ['attack', 'magic', 'dash', 'disengage', 'dodge', 'help', 'hide', 'ready', 'utilize', 'influence', 'search', 'study'],
  },
  exploration: {
    intro: 'Cada um descreve o que faz enquanto o grupo explora; o mestre pede testes quando o resultado é incerto.',
    economy: ['Uma ação ou atividade por turno.', 'Movimento livre pela área, conforme o mestre descrever.'],
    actions: ['search', 'study', 'hide', 'utilize', 'help', 'magic', 'dash'],
  },
  investigation: {
    intro: 'Pistas e perguntas em turnos: cada personagem examina, pesquisa ou interroga, um de cada vez.',
    economy: ['Uma ação de investigação por turno.', 'Ajudar um colega conta como a sua ação.'],
    actions: ['study', 'search', 'help', 'influence', 'utilize', 'magic'],
  },
  social: {
    intro: 'Conversas e negociações: cada personagem fala ou age, e o mestre decide como a atitude de quem ouve muda.',
    economy: ['Uma fala ou ação por turno.', 'A atitude de quem ouve (amistosa, indiferente ou hostil) define a dificuldade.'],
    actions: ['influence', 'help', 'search', 'study', 'magic'],
  },
};
