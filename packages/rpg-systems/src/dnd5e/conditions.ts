import type { ConditionDefinition } from '../types';

/**
 * Condições do SRD 5.2. Os resumos foram escritos pelo Codexveil para consulta rápida
 * e não substituem o texto completo das regras.
 */
export const dnd5eConditions = [
  {
    key: 'blinded',
    label: 'Cego',
    summary: 'Não enxerga. Ataques contra ele têm vantagem; os ataques dele têm desvantagem.',
  },
  {
    key: 'charmed',
    label: 'Enfeitiçado',
    summary:
      'Não pode atacar quem o enfeitiçou; essa criatura tem vantagem em interações sociais com ele.',
  },
  {
    key: 'deafened',
    label: 'Surdo',
    summary: 'Não ouve e falha em testes que dependem de audição.',
  },
  {
    key: 'exhaustion',
    label: 'Exaustão',
    summary:
      'Cada nível impõe −2 em testes de d20 e reduz o deslocamento em 1,5 m. No nível 6, a criatura morre.',
    maxLevel: 6,
  },
  {
    key: 'frightened',
    label: 'Amedrontado',
    summary:
      'Desvantagem em testes e ataques enquanto vê a fonte do medo; não se aproxima dela por vontade própria.',
  },
  {
    key: 'grappled',
    label: 'Agarrado',
    summary: 'Deslocamento 0. Desvantagem em ataques contra alvos que não sejam quem o agarra.',
  },
  {
    key: 'incapacitated',
    label: 'Incapacitado',
    summary: 'Não realiza ações, ações bônus nem reações; perde a concentração e não pode falar.',
  },
  {
    key: 'invisible',
    label: 'Invisível',
    summary: 'Não pode ser visto. Ataques contra ele têm desvantagem; os ataques dele têm vantagem.',
  },
  {
    key: 'paralyzed',
    label: 'Paralisado',
    summary:
      'Incapacitado e sem deslocamento. Falha em resistências de FOR e DES; acertos a até 1,5 m são críticos.',
  },
  {
    key: 'petrified',
    label: 'Petrificado',
    summary: 'Transformado em matéria inanimada: incapacitado, com resistência a todo dano.',
  },
  {
    key: 'poisoned',
    label: 'Envenenado',
    summary: 'Desvantagem em jogadas de ataque e testes de atributo.',
  },
  {
    key: 'prone',
    label: 'Caído',
    summary:
      'Só rasteja e tem desvantagem em ataques. Ataques corpo a corpo próximos contra ele têm vantagem.',
  },
  {
    key: 'restrained',
    label: 'Contido',
    summary:
      'Deslocamento 0. Ataques contra ele têm vantagem; os dele e suas resistências de DES têm desvantagem.',
  },
  {
    key: 'stunned',
    label: 'Atordoado',
    summary: 'Incapacitado. Falha em resistências de FOR e DES; ataques contra ele têm vantagem.',
  },
  {
    key: 'unconscious',
    label: 'Inconsciente',
    summary:
      'Incapacitado e caído, solta o que segura. Ataques contra ele têm vantagem; acertos próximos são críticos.',
  },
] as const satisfies readonly ConditionDefinition[];

export type Dnd5eConditionKey = (typeof dnd5eConditions)[number]['key'];
