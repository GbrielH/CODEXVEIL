import type { TriangleAgencySheet, TriangleQuality } from './sheet';

export const TRIANGLE_DICE_COUNT = 6;
export const TRIANGLE_TARGET = 3;

export interface TriangleRoll {
  dice: readonly number[];
  rawThrees: number;
  adjustedThrees: number;
  finalThrees: number;
  assurancesSpent: number;
  burnout: number;
  success: boolean;
  transcendence: boolean;
  stability: boolean;
  chaos: number;
}

export function qualityBurnout(sheet: TriangleAgencySheet, quality: TriangleQuality): number {
  return (
    (sheet.qualityAssurances.current[quality] === 0 ? 1 : 0) + sheet.additionalBurnout[quality]
  );
}

/** Resolve a jogada depois que o jogador decide quantas GQs transformarão dados em 3. */
export function resolveTriangleRoll(
  dice: readonly number[],
  assurancesSpent = 0,
  burnout = 0,
): TriangleRoll {
  if (
    dice.length !== TRIANGLE_DICE_COUNT ||
    dice.some((die) => !Number.isInteger(die) || die < 1 || die > 4)
  )
    throw new Error('Uma jogada de Triangle Agency precisa ter exatamente 6d4.');
  const rawThrees = dice.filter((die) => die === TRIANGLE_TARGET).length;
  const spent = Math.max(0, Math.min(assurancesSpent, TRIANGLE_DICE_COUNT - rawThrees));
  const adjustedThrees = rawThrees + spent;
  const appliedBurnout = Math.max(0, Math.trunc(burnout));
  const finalThrees = Math.max(0, adjustedThrees - appliedBurnout);
  const stability = finalThrees === 3;
  return {
    dice: [...dice],
    rawThrees,
    adjustedThrees,
    finalThrees,
    assurancesSpent: spent,
    burnout: appliedBurnout,
    success: finalThrees > 0,
    transcendence: rawThrees === 3,
    stability,
    chaos: stability ? 0 : TRIANGLE_DICE_COUNT - adjustedThrees + appliedBurnout,
  };
}

export function rollTriangleDice(
  random: (sides: number) => number = (sides) => 1 + Math.floor(Math.random() * sides),
): number[] {
  return Array.from({ length: TRIANGLE_DICE_COUNT }, () => random(4));
}

export interface AssuranceSpend {
  sheet: TriangleAgencySheet;
  spent: number;
}

export function spendQualityAssurances(
  sheet: TriangleAgencySheet,
  quality: TriangleQuality,
  requested: number,
): AssuranceSpend {
  const spent = Math.max(
    0,
    Math.min(Math.trunc(requested), sheet.qualityAssurances.current[quality]),
  );
  return {
    sheet: {
      ...sheet,
      qualityAssurances: {
        ...sheet.qualityAssurances,
        current: {
          ...sheet.qualityAssurances.current,
          [quality]: sheet.qualityAssurances.current[quality] - spent,
        },
      },
    },
    spent,
  };
}

export function rechargeQualityAssurances(sheet: TriangleAgencySheet): TriangleAgencySheet {
  return {
    ...sheet,
    qualityAssurances: {
      ...sheet.qualityAssurances,
      current: { ...sheet.qualityAssurances.maximum },
    },
  };
}

export function spendTime(
  sheet: TriangleAgencySheet,
  track: 'anomaly' | 'reality' | 'competency',
): TriangleAgencySheet {
  const other = (['anomaly', 'reality', 'competency'] as const).filter((entry) => entry !== track);
  const unavailableKey = {
    anomaly: 'unavailableAnomaly',
    reality: 'unavailableReality',
    competency: 'unavailableCompetency',
  } as const;
  const first = other[0]!;
  const second = other[1]!;
  return {
    ...sheet,
    time: {
      ...sheet.time,
      [track]: Math.min(30, sheet.time[track] + 1),
      [unavailableKey[first]]: Math.min(30, sheet.time[unavailableKey[first]] + 1),
      [unavailableKey[second]]: Math.min(30, sheet.time[unavailableKey[second]] + 1),
    },
  };
}

export function conflictWinner(totals: readonly number[]): number | null {
  if (totals.length < 2) return null;
  const highest = Math.max(...totals);
  if (highest < 6 || totals.filter((value) => value === highest).length !== 1) return null;
  return totals.indexOf(highest);
}

export function creationIssues(sheet: TriangleAgencySheet): string[] {
  const issues: string[] = [];
  if (!sheet.arc.anomaly) issues.push('Selecione a Anomalia.');
  if (!sheet.arc.reality) issues.push('Selecione a Realidade.');
  if (!sheet.arc.competency) issues.push('Selecione a Competência.');
  if (sheet.anomalousAbilities.length !== 3) issues.push('Registre as 3 Habilidades Anômalas.');
  if (sheet.relationships.length !== 3) issues.push('Registre os 3 Relacionamentos.');
  const maxima = Object.values(sheet.qualityAssurances.maximum);
  const selected = maxima.filter((value) => value > 0);
  if (selected.length !== 3 || maxima.reduce((sum, value) => sum + value, 0) !== 9)
    issues.push('Distribua 9 Garantias de Qualidade entre exatamente 3 Qualidades.');
  return issues;
}
