import { describe, expect, it } from 'vitest';
import { cellRect, fogCells, paintFog, pointInPolygon, rectsFromCells, visibilityPolygon } from './map-geometry';

const inside = pointInPolygon;

describe('névoa de guerra', () => {
  it('revela e cobre áreas e compacta em faixas', () => {
    let rects = paintFog([], [0, 0, 3, 2], true);
    expect(rects).toEqual([
      [0, 0, 3, 1],
      [0, 1, 3, 1],
    ]);
    rects = paintFog(rects, [1, 0, 1, 2], false);
    expect(fogCells(rects)).toEqual(new Set(['0,0', '2,0', '0,1', '2,1']));
    expect(rectsFromCells(new Set())).toEqual([]);
  });

  it('normaliza o retângulo entre duas células, dentro da grade', () => {
    expect(cellRect({ x: 5, y: 4 }, { x: 2, y: 9 }, 6, 8)).toEqual([2, 4, 4, 4]);
  });
});

describe('linha de visão', () => {
  it('sem paredes enxerga o mapa todo; uma parede esconde o que está atrás', () => {
    const open = visibilityPolygon({ x: 1.5, y: 1.5 }, [], 10, 10);
    expect(inside({ x: 8.5, y: 8.5 }, open)).toBe(true);
    // Parede vertical em x = 5, do topo ao fundo: o lado direito fica fora da visão.
    const walled = visibilityPolygon({ x: 1.5, y: 1.5 }, [[5, 0, 5, 10]], 10, 10);
    expect(inside({ x: 3.5, y: 6.5 }, walled)).toBe(true);
    expect(inside({ x: 8.5, y: 1.5 }, walled)).toBe(false);
  });

  it('limita pelo alcance da visão', () => {
    const near = visibilityPolygon({ x: 5, y: 5 }, [], 20, 20, 3);
    expect(inside({ x: 6, y: 6 }, near)).toBe(true);
    expect(inside({ x: 12, y: 5 }, near)).toBe(false);
  });
});
