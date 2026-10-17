import { describe, expect, it } from 'vitest';
import { d20Expression, describeDiceRoll, naturalD20, parseDiceExpression, rollDiceLocally, withBonus } from './dice';

/** Sequência fixa de valores aleatórios (0 ≤ x < 1). */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe('expressões de dados', () => {
  it('aceita as formas comuns e recusa o resto', () => {
    expect(parseDiceExpression('1d20+5')).toEqual([
      { sign: 1, count: 1, sides: 20, value: 0 },
      { sign: 1, count: null, sides: null, value: 5 },
    ]);
    expect(parseDiceExpression(' 2D6 + 1d4 - 1 ')).toHaveLength(3);
    expect(parseDiceExpression('d100')).toEqual([{ sign: 1, count: 1, sides: 100, value: 0 }]);
    for (const invalid of ['', '5', 'abc', '1d1', '101d6', '1d20;', '1d6+'.repeat(11) + '1']) {
      expect(parseDiceExpression(invalid), invalid).toBeNull();
    }
  });

  it('monta testes e danos com bônus', () => {
    expect(d20Expression(5)).toBe('1d20+5');
    expect(d20Expression(-1)).toBe('1d20-1');
    expect(d20Expression(0)).toBe('1d20');
    expect(withBonus('1d8', 3)).toBe('1d8+3');
    expect(withBonus('2d6', -1)).toBe('2d6-1');
    expect(withBonus('texto', 2)).toBeNull();
  });

  it('rola no aparelho com vantagem e desvantagem', () => {
    // 0,5 → 11; 0,9 → 19 no d20.
    const advantage = rollDiceLocally('1d20+2', 'advantage', sequence(0.5, 0.9));
    expect(advantage).toMatchObject({ mode: 'advantage', modifier: 2, total: 21 });
    expect(advantage?.dice[0]).toMatchObject({ values: [11, 19], kept: [19] });

    const disadvantage = rollDiceLocally('1d20', 'disadvantage', sequence(0.5, 0.9));
    expect(disadvantage?.total).toBe(11);

    const damage = rollDiceLocally('2d6-1', 'advantage', sequence(0, 0.99));
    expect(damage).toMatchObject({ mode: 'normal', total: 1 + 6 - 1 });
  });

  it('descreve o resultado e destaca o 20 natural', () => {
    const roll = rollDiceLocally('1d20+3', 'advantage', sequence(0.99, 0.1));
    expect(roll && describeDiceRoll(roll)).toBe('1d20 (20 | descartado: 3) + 3');
    expect(roll && naturalD20(roll)).toBe(20);
    const two = rollDiceLocally('2d6-1d4', 'normal', sequence(0, 0.5, 0.75));
    expect(two && describeDiceRoll(two)).toBe('2d6 (1, 4) − 1d4 (4)');
  });
});
