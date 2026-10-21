import { describe, expect, it } from 'vitest';
import { TOKEN_SIZES, isTokenSize, tokenSizeLabels, tokenSizeSquares } from './token-size';

describe('tamanho do token', () => {
  it('ocupa 1, 2, 3 ou 4 quadrados conforme o porte', () => {
    expect(TOKEN_SIZES.map((size) => tokenSizeSquares[size])).toEqual([1, 1, 1, 2, 3, 4]);
  });

  it('usa os nomes de cada sistema', () => {
    expect(tokenSizeLabels('tormenta20').gargantuan).toBe('Colossal');
    expect(tokenSizeLabels('dnd5e').gargantuan).toBe('Imenso');
    expect(isTokenSize('large')).toBe(true);
    expect(isTokenSize('enorme')).toBe(false);
  });
});
