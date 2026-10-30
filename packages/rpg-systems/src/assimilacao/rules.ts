/**
 * Regras numéricas do Assimilação RPG: pilha de dados de um teste, Cabo de Guerra, Saúde e
 * limites da criação de Infectados.
 */
import type { DicePool } from './dice';
import {
  INSTINCTS,
  KNOWLEDGES,
  PRACTICES,
  aptitudeLabels,
  type Aptitude,
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

export function aptitudeValue(sheet: AssimilacaoSheet, key: Aptitude): number {
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
}

export function tugOfWar(sheet: AssimilacaoSheet): TugOfWar {
  const { determinationLevel } = sheet.tugOfWar;
  return { determinationLevel, assimilationLevel: 10 - determinationLevel };
}

/** Resultado de uma perda de Determinação: pontos, Nível e o ponto de Assimilação ganho. */
export interface DeterminationLoss {
  determinationLevel: number;
  determinationPoints: number;
  /** Níveis perdidos (cada um sobe a Assimilação e dá 1 ponto de Assimilação). */
  levelsLost: number;
}

/**
 * Perda de Determinação: gasta os pontos; com a reserva zerada (Estado Suscetível), cada perda
 * derruba um Nível. O novo Nível começa cheio, mas bloqueado até a Assimilação se completar.
 */
export function loseDetermination(
  level: number,
  points: number,
  amount: number,
): DeterminationLoss {
  let determinationLevel = level;
  let determinationPoints = points;
  let levelsLost = 0;
  for (let index = 0; index < amount; index += 1) {
    if (determinationPoints > 0) {
      determinationPoints -= 1;
    } else if (determinationLevel > 0) {
      determinationLevel -= 1;
      levelsLost += 1;
      determinationPoints = determinationLevel;
    }
  }
  return { determinationLevel, determinationPoints, levelsLost };
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

/** Estado de Saúde a partir dos pontos restantes (trilha `saude`). */
export function healthState(sheet: AssimilacaoSheet, remainingPoints: number): HealthState {
  const perLevel = healthPerLevel(sheet);
  const total = perLevel * 6;
  const remaining = Math.max(0, Math.min(total, remainingPoints));
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
export function creationIssues(
  sheet: AssimilacaoSheet,
  experience: number = CREATION.experience,
): string[] {
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
  if (spentXp > experience)
    issues.push(`Experiência: ${spentXp} pontos usados (máximo ${experience}).`);
  return issues;
}

/** Experiência gasta para levar Conhecimentos/Práticas acima de 2 (cada nível custa o dobro). */
export function learnedXp(sheet: AssimilacaoSheet): number {
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

function plainName(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const APTITUDE_BY_NAME: Record<string, Aptitude> = Object.fromEntries(
  (Object.keys(aptitudeLabels) as Aptitude[]).map((key) => [plainName(aptitudeLabels[key]), key]),
);

/**
 * Confere um requisito do livro ("Potência 2+ e Resolução 2+", "Geografia ou Sobrevivência 2+",
 * "Assimilação 2+"). Partes que não reconhece não bloqueiam (o mestre arbitra).
 */
export function requirementMet(sheet: AssimilacaoSheet, requirement: string): boolean {
  const text = requirement.trim();
  if (!text) return true;
  return text.split(/\s+e\s+/i).every((clause) => {
    const match = /^(.*?)\s*(\d+)\+?$/.exec(clause.trim());
    if (!match) return true;
    const minimum = Number(match[2]);
    const options = match[1]!.split(/\s+ou\s+/i).map(plainName);
    return options.some((name) => {
      if (name === 'assimilacao') return tugOfWar(sheet).assimilationLevel >= minimum;
      if (name === 'determinacao') return sheet.tugOfWar.determinationLevel >= minimum;
      const key = APTITUDE_BY_NAME[name];
      return key ? aptitudeValue(sheet, key) >= minimum : true;
    });
  });
}
