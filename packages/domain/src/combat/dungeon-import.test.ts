import { describe, expect, it } from 'vitest';
import { importOnePageDungeon } from './dungeon-import';

describe('importação do One Page Dungeon', () => {
  const dungeon = {
    title: 'Cripta do Rei',
    rects: [
      { x: 0, y: 0, w: 3, h: 3 },
      { x: 3, y: 1, w: 2, h: 1 },
      { x: 5, y: 0, w: 3, h: 3 },
    ],
    doors: [{ x: 3, y: 1, dir: { x: 1, y: 0 }, type: 1 }],
    notes: [
      { text: 'Sarcófago com armadilha.', ref: '1', pos: { x: 1.5, y: 1.5 } },
      { text: 'Sala do tesouro.', ref: '2', pos: { x: 6.5, y: 1.5 } },
    ],
  };

  it('monta a grade com margem e paredes só em volta do chão', () => {
    const result = importOnePageDungeon(dungeon);
    expect(result.title).toBe('Cripta do Rei');
    expect([result.cols, result.rows]).toEqual([12, 7]);
    // O corredor liga as duas salas: a borda entre a sala 1 e o corredor fica aberta.
    const blocksPassage = result.walls.some(
      ([x1, y1, x2, y2]) => x1 === 5 && x2 === 5 && y1 <= 3 && y2 >= 4,
    );
    expect(blocksPassage).toBe(false);
    // Contorno fechado: perímetro total de 3×3 + 2×1 + 3×3 menos as 2 passagens.
    const length = result.walls.reduce(
      (sum, [x1, y1, x2, y2]) => sum + Math.abs(x2 - x1) + Math.abs(y2 - y1),
      0,
    );
    expect(length).toBe(12 + 6 + 12 - 4);
  });

  it('põe os números no mapa e a legenda à parte', () => {
    const result = importOnePageDungeon(dungeon);
    expect(result.labels).toEqual([
      { ref: '1', x: 3.5, y: 3.5 },
      { ref: '2', x: 8.5, y: 3.5 },
    ]);
    expect(result.legend[1]).toEqual({ ref: '2', text: 'Sala do tesouro.' });
    expect(result.stats).toEqual({ rects: 3, doors: 1, notes: 2 });
  });

  it('recusa arquivos que não são masmorras', () => {
    expect(() => importOnePageDungeon({ foo: 1 })).toThrow(/salas/);
    expect(() => importOnePageDungeon(null)).toThrow();
  });
});
