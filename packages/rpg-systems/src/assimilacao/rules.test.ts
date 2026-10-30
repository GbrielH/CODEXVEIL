import { describe, expect, it } from 'vitest';
import { ASSIMILACAO_FACES, damageFromDice, rollPool, suggestKeep, sumFaces } from './dice';
import { creationIssues, healthState, loseDetermination, planTest, tugOfWar } from './rules';
import { createDefaultAssimilacaoSheet, parseAssimilacaoSheet } from './sheet';

describe('dados do Assimilação', () => {
  it('têm as quantidades de símbolos descritas no livro', () => {
    expect(sumFaces(ASSIMILACAO_FACES.d6)).toEqual({ sucesso: 1, adaptacao: 1, pressao: 3 });
    expect(sumFaces(ASSIMILACAO_FACES.d10)).toEqual({ sucesso: 7, adaptacao: 3, pressao: 5 });
    expect(sumFaces(ASSIMILACAO_FACES.d12)).toEqual({ sucesso: 8, adaptacao: 5, pressao: 8 });
  });

  it('rola a pilha e sugere manter o melhor dado', () => {
    const values = [1, 6, 9];
    const dice = rollPool({ d6: 2, d10: 1, d12: 0 }, () => values.shift() ?? 1);
    expect(dice.map((die) => die.value)).toEqual([1, 6, 9]);
    // d6 face 6 = Sucesso limpo (preferido); d10 face 9 = Sucesso + Adaptação + Pressão.
    expect(suggestKeep(dice, 1)).toEqual([1]);
    expect(suggestKeep(dice, 2)).toEqual([1, 2]);
    expect(damageFromDice([dice[2]!])).toBe(3);
  });
});

describe('regras do Infectado', () => {
  it('monta a pilha do teste e a Rolagem Assimilada', () => {
    const sheet = parseAssimilacaoSheet({
      instincts: { percepcao: 2 },
      knowledges: { erudicao: 1 },
    });
    expect(planTest(sheet, { instinct: 'percepcao', aptitude: 'erudicao' })).toEqual({
      pool: { d6: 2, d10: 1, d12: 0 },
      keep: 1,
    });
    expect(
      planTest(sheet, {
        instinct: 'percepcao',
        aptitude: 'percepcao',
        assimilated: true,
        origins: 2,
        effort: true,
      }),
    ).toEqual({
      pool: { d6: 0, d10: 0, d12: 4 },
      keep: 4,
    });
  });

  it('Cabo de Guerra: perda com a reserva zerada derruba um Nível', () => {
    const sheet = createDefaultAssimilacaoSheet();
    expect(tugOfWar(sheet)).toEqual({ determinationLevel: 9, assimilationLevel: 1 });
    expect(loseDetermination(9, 9, 10)).toEqual({
      determinationLevel: 8,
      determinationPoints: 8,
      levelsLost: 1,
    });
    expect(loseDetermination(9, 2, 1)).toEqual({
      determinationLevel: 9,
      determinationPoints: 1,
      levelsLost: 0,
    });
  });

  it('Saúde: 1 + Potência + Resolução por Nível e penalidades', () => {
    const sheet = parseAssimilacaoSheet({ instincts: { potencia: 2, resolucao: 3 } });
    const health = healthState(sheet, 36 - 13);
    expect(health.perLevel).toBe(6);
    expect(health.level).toBe(4);
    expect(health.penalty).toBe(1);
    expect(health.recovery).toBe('semanal');
  });

  it('valida os limites da criação', () => {
    expect(creationIssues(createDefaultAssimilacaoSheet())).toEqual([]);
    const over = parseAssimilacaoSheet({
      instincts: { potencia: 4, reacao: 2 },
      knowledges: { biologia: 2, medicina: 2 },
      practices: { armas: 2, atletismo: 2 },
    });
    expect(creationIssues(over)).toHaveLength(3);
  });
});

describe('rolagem pelo servidor', () => {
  it('monta a expressão e converte os valores em símbolos', async () => {
    const { poolExpression, diceFromGroups } = await import('./dice');
    expect(poolExpression({ d6: 2, d10: 1, d12: 0 })).toBe('2d6+1d10');
    const dice = diceFromGroups([{ sides: 12, values: [11, 12] }]);
    expect(dice.map((die) => die.result)).toEqual([
      { sucesso: 1, adaptacao: 2, pressao: 1 },
      { sucesso: 0, adaptacao: 0, pressao: 2 },
    ]);
  });
});

describe('requisitos de Características', () => {
  it('confere "e", "ou" e Assimilação', async () => {
    const { requirementMet } = await import('./rules');
    const sheet = parseAssimilacaoSheet({
      instincts: { potencia: 2, resolucao: 1 },
      practices: { sobrevivencia: 2 },
    });
    expect(requirementMet(sheet, 'Potência 2+')).toBe(true);
    expect(requirementMet(sheet, 'Potência 2+ e Resolução 2+')).toBe(false);
    expect(requirementMet(sheet, 'Geografia ou Sobrevivência 2+')).toBe(true);
    expect(requirementMet(sheet, 'Assimilação 2+')).toBe(false);
    expect(requirementMet(sheet, '')).toBe(true);
  });
});

describe('histórico de rolagens', () => {
  it('reconhece a rolagem e descreve as faces', async () => {
    const { isAssimilacaoRoll, assimilacaoRollText } = await import('./dice');
    expect(isAssimilacaoRoll('Assimilação · Percepção + Erudição · mantém 1')).toBe(true);
    expect(isAssimilacaoRoll('Ataque')).toBe(false);
    expect(
      assimilacaoRollText([
        { sides: 6, values: [6, 1] },
        { sides: 10, values: [9] },
      ]),
    ).toBe('d6 ✦ · d6 — · d10 ✦⟳✖');
  });
});
