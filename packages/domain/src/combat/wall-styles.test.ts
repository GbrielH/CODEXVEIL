import { describe, expect, it } from 'vitest';
import { isWallStyle, wallBlocksSight } from './wall-styles';

describe('estilos de parede', () => {
  it('a grade de ferro deixa ver; as outras bloqueiam', () => {
    expect(wallBlocksSight('iron')).toBe(false);
    expect(wallBlocksSight('brick')).toBe(true);
    expect(wallBlocksSight('invisible')).toBe(true);
    expect(isWallStyle('ruin')).toBe(true);
    expect(isWallStyle('lava')).toBe(false);
  });
});
