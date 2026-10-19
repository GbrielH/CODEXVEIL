/**
 * Condições do Tormenta20 (Apêndice: Lista de Condições). Os resumos são do Codexveil; os
 * efeitos numéricos ficam em `mechanics` para a ficha aplicá-los sozinha. As regras de jogo do
 * Tormenta20 são Conteúdo Open Game (OGL 1.0a); veja `license.ts`.
 */
import type { ConditionDefinition, ConditionDurationPreset } from '../types';

export type T20ConditionTag = 'medo' | 'mental' | 'movimento' | 'sentidos' | 'metabolismo' | 'cansaco' | 'veneno' | 'metamorfose';

export interface T20ConditionMechanics {
  /** Penalidade em todos os testes de perícia. */
  readonly skills?: number;
  /** Penalidade em testes de For, Des, Con e perícias baseadas neles. */
  readonly physical?: number;
  /** Penalidade em testes de Int, Sab, Car e perícias baseadas neles. */
  readonly mental?: number;
  readonly defense?: number;
  readonly reflexes?: number;
  readonly attacks?: number;
  readonly perception?: number;
  readonly initiative?: number;
  readonly speed?: 'half' | 'zero';
  /** Não pode fazer ações. */
  readonly noActions?: boolean;
  /** Custo em PM das habilidades aumenta. */
  readonly manaCost?: number;
  /** Penalidade de armadura extra. */
  readonly armorPenalty?: number;
}

export interface T20ConditionDefinition extends ConditionDefinition {
  readonly tags: readonly T20ConditionTag[];
  readonly mechanics: T20ConditionMechanics;
  /** Se a condição for aplicada de novo, vira esta outra. */
  readonly escalatesTo?: string;
}

function condition(definition: T20ConditionDefinition): T20ConditionDefinition {
  return definition;
}

export const t20Conditions: readonly T20ConditionDefinition[] = [
  condition({ key: 'abalado', label: 'Abalado', summary: '–2 em testes de perícia.', tags: ['medo'], mechanics: { skills: -2 }, escalatesTo: 'apavorado' }),
  condition({
    key: 'agarrado',
    label: 'Agarrado',
    summary: 'Desprevenido e imóvel, –2 em ataques, só ataca com armas leves.',
    tags: ['movimento'],
    mechanics: { attacks: -2 },
    includes: ['desprevenido', 'imovel'],
  }),
  condition({ key: 'alquebrado', label: 'Alquebrado', summary: 'Habilidades custam +1 PM.', tags: ['mental'], mechanics: { manaCost: 1 } }),
  condition({
    key: 'apavorado',
    label: 'Apavorado',
    summary: '–5 em testes de perícia e não se aproxima da fonte do medo.',
    tags: ['medo'],
    mechanics: { skills: -5 },
  }),
  condition({
    key: 'atordoado',
    label: 'Atordoado',
    summary: 'Desprevenido e sem ações.',
    tags: ['mental'],
    mechanics: { noActions: true },
    includes: ['desprevenido'],
  }),
  condition({
    key: 'caido',
    label: 'Caído',
    summary: '–5 na Defesa e em ataques corpo a corpo, +5 na Defesa contra ataques à distância; deslocamento 1,5 m.',
    tags: [],
    mechanics: {},
  }),
  condition({
    key: 'cego',
    label: 'Cego',
    summary: 'Desprevenido e lento, sem Percepção pela visão, –5 em perícias de For e Des; alvos têm camuflagem total.',
    tags: ['sentidos'],
    mechanics: {},
    includes: ['desprevenido', 'lento'],
  }),
  condition({ key: 'confuso', label: 'Confuso', summary: 'Age ao acaso: role 1d6 no início de cada turno.', tags: ['mental'], mechanics: {} }),
  condition({
    key: 'debilitado',
    label: 'Debilitado',
    summary: '–5 em testes de For, Des, Con e perícias baseadas neles.',
    tags: [],
    mechanics: { physical: -5 },
    escalatesTo: 'inconsciente',
  }),
  condition({ key: 'desprevenido', label: 'Desprevenido', summary: '–5 na Defesa e em Reflexos.', tags: [], mechanics: { defense: -5, reflexes: -5 } }),
  condition({ key: 'doente', label: 'Doente', summary: 'Sob efeito de uma doença.', tags: ['metabolismo'], mechanics: {} }),
  condition({ key: 'em_chamas', label: 'Em Chamas', summary: '1d6 de dano de fogo no início de cada turno até apagar o fogo.', tags: [], mechanics: {} }),
  condition({ key: 'enfeiticado', label: 'Enfeitiçado', summary: 'Prestativo com a fonte, que recebe +10 em Diplomacia com você.', tags: ['mental'], mechanics: {} }),
  condition({ key: 'enjoado', label: 'Enjoado', summary: 'Só uma ação padrão ou de movimento por rodada.', tags: ['metabolismo'], mechanics: {} }),
  condition({
    key: 'enredado',
    label: 'Enredado',
    summary: 'Lento, vulnerável e –2 em ataques.',
    tags: ['movimento'],
    mechanics: { attacks: -2 },
    includes: ['lento', 'vulneravel'],
  }),
  condition({ key: 'envenenado', label: 'Envenenado', summary: 'Efeito conforme o veneno.', tags: ['veneno'], mechanics: {} }),
  condition({
    key: 'esmorecido',
    label: 'Esmorecido',
    summary: '–5 em testes de Int, Sab, Car e perícias baseadas neles.',
    tags: ['mental'],
    mechanics: { mental: -5 },
  }),
  condition({
    key: 'exausto',
    label: 'Exausto',
    summary: 'Debilitado, lento e vulnerável.',
    tags: ['cansaco'],
    mechanics: {},
    includes: ['debilitado', 'lento', 'vulneravel'],
    escalatesTo: 'inconsciente',
  }),
  condition({
    key: 'fascinado',
    label: 'Fascinado',
    summary: '–5 em Percepção e só observa o que o fascinou; ações hostis anulam.',
    tags: ['mental'],
    mechanics: { perception: -5 },
  }),
  condition({
    key: 'fatigado',
    label: 'Fatigado',
    summary: 'Fraco e vulnerável.',
    tags: ['cansaco'],
    mechanics: {},
    includes: ['fraco', 'vulneravel'],
    escalatesTo: 'exausto',
  }),
  condition({
    key: 'fraco',
    label: 'Fraco',
    summary: '–2 em testes de For, Des, Con e perícias baseadas neles.',
    tags: [],
    mechanics: { physical: -2 },
    escalatesTo: 'debilitado',
  }),
  condition({
    key: 'frustrado',
    label: 'Frustrado',
    summary: '–2 em testes de Int, Sab, Car e perícias baseadas neles.',
    tags: ['mental'],
    mechanics: { mental: -2 },
    escalatesTo: 'esmorecido',
  }),
  condition({ key: 'imovel', label: 'Imóvel', summary: 'Deslocamento 0.', tags: ['movimento'], mechanics: { speed: 'zero' } }),
  condition({
    key: 'inconsciente',
    label: 'Inconsciente',
    summary: 'Indefeso e sem ações nem reações.',
    tags: [],
    mechanics: { noActions: true },
    includes: ['indefeso'],
  }),
  condition({
    key: 'indefeso',
    label: 'Indefeso',
    summary: 'Desprevenido, –10 na Defesa, falha em Reflexos e pode sofrer golpe de misericórdia.',
    tags: [],
    mechanics: { defense: -10 },
    includes: ['desprevenido'],
  }),
  condition({ key: 'lento', label: 'Lento', summary: 'Deslocamento pela metade; não corre nem faz investidas.', tags: ['movimento'], mechanics: { speed: 'half' } }),
  condition({ key: 'ofuscado', label: 'Ofuscado', summary: '–2 em ataques e Percepção.', tags: ['sentidos'], mechanics: { attacks: -2, perception: -2 } }),
  condition({
    key: 'paralisado',
    label: 'Paralisado',
    summary: 'Imóvel e indefeso; só ações puramente mentais.',
    tags: ['movimento'],
    mechanics: {},
    includes: ['imovel', 'indefeso'],
  }),
  condition({ key: 'pasmo', label: 'Pasmo', summary: 'Sem ações.', tags: ['mental'], mechanics: { noActions: true } }),
  condition({
    key: 'petrificado',
    label: 'Petrificado',
    summary: 'Inconsciente, com redução de dano 8.',
    tags: ['metamorfose'],
    mechanics: {},
    includes: ['inconsciente'],
  }),
  condition({
    key: 'sangrando',
    label: 'Sangrando',
    summary: 'Teste de Constituição (CD 15) no início do turno: se falhar, perde 1d6 PV; se passar, a condição termina.',
    tags: ['metabolismo'],
    mechanics: {},
  }),
  condition({
    key: 'sobrecarregado',
    label: 'Sobrecarregado',
    summary: 'Penalidade de armadura –5 e deslocamento reduzido.',
    tags: [],
    mechanics: { armorPenalty: -5 },
  }),
  condition({
    key: 'surdo',
    label: 'Surdo',
    summary: 'Sem Percepção pela audição, –5 em Iniciativa e condição ruim para lançar magias.',
    tags: ['sentidos'],
    mechanics: { initiative: -5 },
  }),
  condition({
    key: 'surpreendido',
    label: 'Surpreendido',
    summary: 'Desprevenido e sem ações.',
    tags: [],
    mechanics: { noActions: true },
    includes: ['desprevenido'],
  }),
  condition({ key: 'vulneravel', label: 'Vulnerável', summary: '–2 na Defesa.', tags: [], mechanics: { defense: -2 } }),
];

export function findT20Condition(key: string): T20ConditionDefinition | undefined {
  return t20Conditions.find((entry) => entry.key === key);
}

/** A condição e todas as que ela inclui (Exausto → Debilitado, Lento, Vulnerável). */
export function expandT20Conditions(keys: readonly string[]): T20ConditionDefinition[] {
  const result = new Map<string, T20ConditionDefinition>();
  const visit = (key: string) => {
    const definition = findT20Condition(key);
    if (!definition || result.has(key)) return;
    result.set(key, definition);
    for (const included of definition.includes ?? []) visit(included);
  };
  for (const key of keys) visit(key);
  return [...result.values()];
}

/** Efeitos somados das condições ativas (penalidades não se acumulam: vale a maior de cada tipo). */
export function t20ConditionEffects(keys: readonly string[]): Required<Omit<T20ConditionMechanics, 'speed' | 'noActions'>> & {
  speed: 'normal' | 'half' | 'zero';
  noActions: boolean;
} {
  const worst = (values: (number | undefined)[]) => Math.min(0, ...values.filter((value): value is number => value !== undefined));
  const active = expandT20Conditions(keys).map((entry) => entry.mechanics);
  const speeds = active.map((entry) => entry.speed);
  return {
    skills: worst(active.map((entry) => entry.skills)),
    physical: worst(active.map((entry) => entry.physical)),
    mental: worst(active.map((entry) => entry.mental)),
    defense: active.reduce((sum, entry) => sum + (entry.defense ?? 0), 0),
    reflexes: worst(active.map((entry) => entry.reflexes)),
    attacks: worst(active.map((entry) => entry.attacks)),
    perception: worst(active.map((entry) => entry.perception)),
    initiative: worst(active.map((entry) => entry.initiative)),
    manaCost: active.reduce((sum, entry) => sum + (entry.manaCost ?? 0), 0),
    armorPenalty: worst(active.map((entry) => entry.armorPenalty)),
    speed: speeds.includes('zero') ? 'zero' : speeds.includes('half') ? 'half' : 'normal',
    noActions: active.some((entry) => entry.noActions),
  };
}

/** Uma rodada de Tormenta20 equivale a 6 segundos; uma cena dura até o fim do encontro. */
export const t20ConditionDurations: readonly ConditionDurationPreset[] = [
  { rounds: 1, label: '1 rodada' },
  { rounds: 2, label: '2 rodadas' },
  { rounds: 3, label: '3 rodadas' },
  { rounds: 5, label: '5 rodadas' },
  { rounds: 10, label: '10 rodadas (1 min)' },
  { rounds: null, label: 'Até ser removida (cena)' },
];

export function formatT20ConditionRounds(rounds: number | null): string {
  if (rounds === null) return 'Até ser removida';
  return rounds === 1 ? '1 rodada' : `${rounds} rodadas`;
}
