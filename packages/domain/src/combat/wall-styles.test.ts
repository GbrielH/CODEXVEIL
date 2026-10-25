import { describe, expect, it } from 'vitest';
import {
  isWallStyle,
  movementCrossesWall,
  wallBlocksMovement,
  wallBlocksSight,
} from './wall-styles';

describe('estilos de parede', () => {
  it('a grade de ferro deixa ver; as outras bloqueiam', () => {
    expect(wallBlocksSight('iron')).toBe(false);
    expect(wallBlocksSight('brick')).toBe(true);
    expect(wallBlocksSight('invisible')).toBe(true);
    expect(isWallStyle('ruin')).toBe(true);
    expect(isWallStyle('lava')).toBe(false);
  });

  it('paredes impedem atravessar; a invisível não, e contornar a ponta é permitido', () => {
    const wall = [3, 0, 3, 5, 'brick'] as const;
    // Do quadrado (1,1) ao (5,1): cruza a parede vertical em x = 3.
    expect(movementCrossesWall([wall], { x: 1.5, y: 1.5 }, { x: 5.5, y: 1.5 })).toBe(true);
    // Do mesmo lado: não cruza.
    expect(movementCrossesWall([wall], { x: 1.5, y: 1.5 }, { x: 2.5, y: 4.5 })).toBe(false);
    // Passando por baixo da ponta (y = 5): livre.
    expect(movementCrossesWall([wall], { x: 1.5, y: 5.5 }, { x: 5.5, y: 5.5 })).toBe(false);
    expect(
      movementCrossesWall([[3, 0, 3, 5, 'invisible']], { x: 1.5, y: 1.5 }, { x: 5.5, y: 1.5 }),
    ).toBe(false);
    expect(wallBlocksMovement('iron')).toBe(true);
  });
});
