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
    expect(tugOfWar(sheet)).toMatchObject({
      determinationLevel: 9,
      assimilationLevel: 1,
      susceptible: false,
    });
    const after = loseDetermination(sheet, 10);
    expect(after).toEqual({ determinationLevel: 8, determinationPoints: 0, assimilationPoints: 2 });
  });

  it('Saúde: 1 + Potência + Resolução por Nível e penalidades', () => {
    const sheet = parseAssimilacaoSheet({
      instincts: { potencia: 2, resolucao: 3 },
      healthDamage: 13,
    });
    const health = healthState(sheet);
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
