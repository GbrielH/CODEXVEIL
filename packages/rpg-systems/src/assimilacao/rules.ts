/**
 * Regras numéricas do Assimilação RPG: pilha de dados de um teste, Cabo de Guerra, Saúde e
 * limites da criação de Infectados.
 */
import type { DicePool } from './dice';
import {
  INSTINCTS,
  KNOWLEDGES,
  PRACTICES,
  type AssimilacaoSheet,
  type Instinct,
  type Knowledge,
  type Practice,
} from './sheet';

/** Regra geral: mantém-se de 1 a 4 dados. */
export const MAX_KEPT_DICE = 4;

export interface TestOptions {
  instinct: Instinct;
  /** Conhecimento ou Prática; com `assimilated`, é o segundo Instinto que entra no lugar. */
  aptitude: Knowledge | Practice | Instinct;
  /** Agir por Instinto (Rolagem Assimilada): custa 1 ponto de Assimilação (ou 2 de Determinação). */
  assimilated?: boolean;
  /** Origens ativadas nesta rolagem (cada uma +1 dado mantido, uma vez por sessão). */
  origins?: number;
  /** Empenho: 1 ponto de Determinação para manter +1 dado (uma vez por rodada). */
  effort?: boolean;
}

export interface TestPlan {
  pool: DicePool;
  keep: number;
}

function aptitudeValue(sheet: AssimilacaoSheet, key: Knowledge | Practice | Instinct): number {
  if ((INSTINCTS as readonly string[]).includes(key)) return sheet.instincts[key as Instinct];
  if ((KNOWLEDGES as readonly string[]).includes(key)) return sheet.knowledges[key as Knowledge];
  return sheet.practices[key as Practice];
}

/**
 * Dados de um teste: d6 por ponto de Instinto e d10 por ponto de Conhecimento/Prática.
 * Na Rolagem Assimilada o segundo Instinto substitui o Conhecimento/Prática, todos os d6 viram
 * d12 e mantém-se um dado a mais.
 */
export function planTest(sheet: AssimilacaoSheet, options: TestOptions): TestPlan {
  const instinct = sheet.instincts[options.instinct];
  const second = aptitudeValue(sheet, options.aptitude);
  const keep =
    1 + (options.origins ?? 0) + (options.effort ? 1 : 0) + (options.assimilated ? 1 : 0);
  const pool: DicePool = options.assimilated
    ? { d6: 0, d10: 0, d12: instinct + second }
    : { d6: instinct, d10: second, d12: 0 };
  return { pool, keep: Math.min(MAX_KEPT_DICE, keep) };
}

export interface TugOfWar {
  determinationLevel: number;
  assimilationLevel: number;
  determinationPoints: number;
  assimilationPoints: number;
  /** Sem pontos de Determinação: não pode gastá-los, e qualquer perda derruba um Nível. */
  susceptible: boolean;
}

export function tugOfWar(sheet: AssimilacaoSheet): TugOfWar {
  const { determinationLevel, determinationPoints, assimilationPoints } = sheet.tugOfWar;
  const assimilationLevel = 10 - determinationLevel;
  return {
    determinationLevel,
    assimilationLevel,
    determinationPoints: Math.min(determinationPoints, determinationLevel),
    assimilationPoints: Math.min(assimilationPoints, assimilationLevel),
    susceptible: determinationPoints <= 0,
  };
}

/**
 * Perda de Determinação: gasta os pontos; com a reserva zerada, cada perda derruba um Nível
 * (a Assimilação sobe um Nível e ganha um ponto que já pode ser usado). O novo Nível começa
 * cheio, mas fica bloqueado até a Assimilação se completar — a ficha guarda os pontos em zero
 * até lá, e quem destrava é o mestre.
 */
export function loseDetermination(
  sheet: AssimilacaoSheet,
  amount: number,
): AssimilacaoSheet['tugOfWar'] {
  let { determinationLevel, determinationPoints, assimilationPoints } = sheet.tugOfWar;
  for (let index = 0; index < amount; index += 1) {
    if (determinationPoints > 0) {
      determinationPoints -= 1;
    } else if (determinationLevel > 0) {
      determinationLevel -= 1;
      assimilationPoints = Math.min(10 - determinationLevel, assimilationPoints + 1);
    }
  }
  return { determinationLevel, determinationPoints, assimilationPoints };
}

/** Pontos de Saúde por Nível: 1 + Potência + Resolução. */
export function healthPerLevel(sheet: AssimilacaoSheet): number {
  return 1 + sheet.instincts.potencia + sheet.instincts.resolucao;
}

export interface HealthState {
  perLevel: number;
  total: number;
  remaining: number;
  /** Nível de Saúde atual (6 = saudável, 0 = morte). */
  level: number;
  /** Pontos que sobram no Nível atual. */
  pointsInLevel: number;
  /** Sucessos perdidos em todo teste pelo Nível de Saúde. */
  penalty: number;
  /** Nos Níveis 2 e 1, agir custa 1 ponto de Determinação. */
  actionCostsDetermination: boolean;
  recovery: 'repouso' | 'semanal' | 'tratamento' | 'nenhuma';
}

export function healthState(sheet: AssimilacaoSheet): HealthState {
  const perLevel = healthPerLevel(sheet);
  const total = perLevel * 6;
  const remaining = Math.max(0, total - sheet.healthDamage);
  const level = Math.ceil(remaining / perLevel);
  const pointsInLevel = level === 0 ? 0 : remaining - (level - 1) * perLevel;
  const penalty = level >= 5 ? 0 : level >= 3 ? 1 : level >= 1 ? 2 : 0;
  return {
    perLevel,
    total,
    remaining,
    level,
    pointsInLevel,
    penalty,
    actionCostsDetermination: level === 2 || level === 1,
    recovery:
      level >= 5 ? 'repouso' : level >= 3 ? 'semanal' : level >= 1 ? 'tratamento' : 'nenhuma',
  };
}

/** Pontos de Saúde de cada Recuperação: Potência + 1. */
export function recoveryAmount(sheet: AssimilacaoSheet): number {
  return sheet.instincts.potencia + 1;
}

/** Determinação recuperada num repouso completo em boas condições: 1 + Resolução. */
export function restDetermination(sheet: AssimilacaoSheet): number {
  return 1 + sheet.instincts.resolucao;
}

/** Custo em Experiência para subir um Conhecimento ou Prática: o dobro do nível desejado. */
export function aptitudeUpgradeCost(targetLevel: number): number {
  return targetLevel * 2;
}

export const CREATION = {
  instinctFreePoints: 3,
  instinctMax: 3,
  learnedPoints: 7,
  learnedMax: 2,
  experience: 7,
} as const;

/** Problemas de uma ficha recém-criada em relação às regras de criação (lista vazia = ok). */
export function creationIssues(sheet: AssimilacaoSheet): string[] {
  const issues: string[] = [];
  const instincts = INSTINCTS.map((key) => sheet.instincts[key]);
  const spentInstincts = instincts.reduce((sum, value) => sum + value - 1, 0);
  if (spentInstincts > CREATION.instinctFreePoints)
    issues.push(
      `Instintos: ${spentInstincts} pontos livres usados (máximo ${CREATION.instinctFreePoints}).`,
    );
  if (instincts.some((value) => value > CREATION.instinctMax))
    issues.push(`Nenhum Instinto pode passar de ${CREATION.instinctMax} na criação.`);
  const learned = [
    ...KNOWLEDGES.map((key) => sheet.knowledges[key]),
    ...PRACTICES.map((key) => sheet.practices[key]),
  ];
  const spentLearned = learned.reduce(
    (sum, value) => sum + Math.min(value, CREATION.learnedMax),
    0,
  );
  if (spentLearned > CREATION.learnedPoints)
    issues.push(
      `Conhecimentos e Práticas: ${spentLearned} pontos usados (máximo ${CREATION.learnedPoints}).`,
    );
  const spentXp =
    sheet.characteristics.reduce((sum, entry) => sum + entry.cost, 0) + learnedXp(sheet);
  if (spentXp > CREATION.experience)
    issues.push(`Experiência: ${spentXp} pontos usados (máximo ${CREATION.experience}).`);
  return issues;
}

/** Experiência gasta para levar Conhecimentos/Práticas acima de 2 (cada nível custa o dobro). */
function learnedXp(sheet: AssimilacaoSheet): number {
  const values = [
    ...KNOWLEDGES.map((key) => sheet.knowledges[key]),
    ...PRACTICES.map((key) => sheet.practices[key]),
  ];
  let total = 0;
  for (const value of values) {
    for (let level = CREATION.learnedMax + 1; level <= value; level += 1)
      total += aptitudeUpgradeCost(level);
  }
  return total;
}
