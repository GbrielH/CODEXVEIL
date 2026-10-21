import { describe, expect, it } from 'vitest';
import { cellRect, fogCells, formatMeters, gridDistance, paintFog, pointInPolygon, rectsFromCells, visibilityPolygon } from './map-geometry';

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

describe('distância percorrida', () => {
  it('em linha reta conta 1,5 m por quadrado nos dois sistemas', () => {
    expect(gridDistance({ x: 0, y: 0 }, { x: 4, y: 0 }, 'dnd5e')).toEqual({ squares: 4, meters: 6 });
    expect(gridDistance({ x: 2, y: 5 }, { x: 2, y: 1 }, 'tormenta20')).toEqual({ squares: 4, meters: 6 });
  });

  it('D&D: diagonal custa 1 quadrado', () => {
    expect(gridDistance({ x: 0, y: 0 }, { x: 3, y: 3 }, 'dnd5e')).toEqual({ squares: 3, meters: 4.5 });
    expect(gridDistance({ x: 0, y: 0 }, { x: 5, y: 2 }, 'dnd5e')).toEqual({ squares: 5, meters: 7.5 });
  });

  it('Tormenta20: diagonais alternam 1,5 m e 3 m', () => {
    expect(gridDistance({ x: 0, y: 0 }, { x: 1, y: 1 }, 'tormenta20').meters).toBe(1.5);
    expect(gridDistance({ x: 0, y: 0 }, { x: 2, y: 2 }, 'tormenta20').meters).toBe(4.5);
    expect(gridDistance({ x: 0, y: 0 }, { x: 3, y: 3 }, 'tormenta20').meters).toBe(6);
    expect(gridDistance({ x: 0, y: 0 }, { x: 4, y: 4 }, 'tormenta20').meters).toBe(9);
    // 2 diagonais (1,5 + 3) + 3 retos (4,5) = 9 m.
    expect(gridDistance({ x: 0, y: 0 }, { x: 5, y: 2 }, 'tormenta20').meters).toBe(9);
    expect(gridDistance({ x: 3, y: 3 }, { x: 3, y: 3 }, 'tormenta20').meters).toBe(0);
  });

  it('formata em metros', () => {
    expect(formatMeters(9)).toBe('9 m');
    expect(formatMeters(10.5)).toBe('10,5 m');
  });
});
