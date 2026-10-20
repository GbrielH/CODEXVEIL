import { describe, expect, it } from 'vitest';
import {
  POSITION_STEP,
  SESSION_BLOCK_TYPES,
  createBlockContent,
  defaultVisibilityFor,
  moveItem,
  needsRenumbering,
  positionBetween,
} from './blocks';

describe('blocos de roteiro', () => {
  it('cria conteúdo inicial coerente para todos os tipos', () => {
    for (const type of SESSION_BLOCK_TYPES) {
      expect(createBlockContent(type).type).toBe(type);
    }
  });

  it('notas privadas nascem visíveis apenas ao mestre', () => {
    expect(defaultVisibilityFor('gm_note')).toBe('gm');
    expect(defaultVisibilityFor('paragraph')).toBe('gm');
  });
});

describe('posições fracionárias', () => {
  it('insere no início, no meio e no fim', () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween(1024, null)).toBe(2048);
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it('rejeita vizinhos fora de ordem', () => {
    expect(() => positionBetween(10, 10)).toThrow(RangeError);
  });

  it('detecta quando é preciso renumerar', () => {
    expect(needsRenumbering([1, 2, 3])).toBe(false);
    expect(needsRenumbering([1, 1 + 1e-9, 3])).toBe(true);
  });

  it('move itens sem mutar a lista original', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(items).toEqual(['a', 'b', 'c']);
    expect(() => moveItem(items, 0, 3)).toThrow(RangeError);
  });
});
