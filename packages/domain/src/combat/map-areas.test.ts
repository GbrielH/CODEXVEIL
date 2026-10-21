import { describe, expect, it } from 'vitest';
import { areaCells, isMapArea, snapMeters } from './map-areas';

describe('áreas de magia', () => {
  it('círculo de 1,5 m num canto de quadrado pega os 4 quadrados em volta', () => {
    expect(areaCells({ kind: 'circle', x: 5, y: 5, meters: 1.5 }, 10, 10)).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ]);
  });

  it('linha de 9 m para a direita pega 6 quadrados', () => {
    const cells = areaCells({ kind: 'line', x: 2, y: 3.5, angle: 0, meters: 9 }, 20, 10);
    expect(cells).toHaveLength(6);
    expect(cells.every((cell) => cell.y === 3)).toBe(true);
  });

  it('cone de 4,5 m abre conforme se afasta', () => {
    const cells = areaCells({ kind: 'cone', x: 0, y: 5, angle: 0, meters: 4.5 }, 10, 10);
    const perColumn = [0, 1, 2].map((column) => cells.filter((cell) => cell.x === column).length);
    expect(perColumn[0]).toBeLessThanOrEqual(perColumn[2]!);
    expect(cells.some((cell) => cell.x === 3)).toBe(false);
  });

  it('arredonda a medida para múltiplos de 1,5 m e valida o formato', () => {
    expect(snapMeters(4)).toBe(4.5);
    expect(snapMeters(0.2)).toBe(1.5);
    expect(isMapArea({ kind: 'cone', x: 1, y: 1, meters: 4.5, angle: 90 })).toBe(true);
    expect(isMapArea({ kind: 'cone', x: 1, y: 1, meters: 4.5 })).toBe(false);
  });
});
