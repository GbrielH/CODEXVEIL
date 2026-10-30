import { describeDiceRoll, type DiceRollResult } from '@codexveil/domain';
import { assimilacaoRollText, isAssimilacaoRoll } from '@codexveil/rpg-systems/assimilacao';

type Roll = Pick<DiceRollResult, 'dice' | 'modifier' | 'total' | 'mode' | 'expression'> & {
  label?: string | null;
};

/**
 * Texto dos dados de uma rolagem. Testes do Assimilação RPG (rótulo "Assimilação · …") mostram os
 * símbolos de cada dado em vez dos números; os demais sistemas seguem com a descrição numérica.
 */
export function describeRoll(roll: Roll): string {
  return isAssimilacaoRoll(roll.label) ? assimilacaoRollText(roll.dice) : describeDiceRoll(roll);
}

/** Destaque da rolagem: o total, ou "✦" nos testes do Assimilação (a soma não tem sentido lá). */
export function rollHeadline(roll: Roll): string {
  return isAssimilacaoRoll(roll.label) ? '✦' : String(roll.total);
}
