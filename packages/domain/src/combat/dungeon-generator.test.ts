import { describe, expect, it } from 'vitest';
import { generateDungeon } from './dungeon-generator';

describe('gerador próprio de masmorra', () => {
  it('é determinístico para a mesma semente e cria salas, corredores, portas e números', () => {
    const first = generateDungeon('cripta-azul', 'medium');
    const second = generateDungeon('cripta-azul', 'medium');
    expect(second).toEqual(first);
    expect(first.labels.length).toBeGreaterThanOrEqual(5);
    expect(first.stats.rects).toBeGreaterThan(first.labels.length);
    expect(first.doors.length).toBeGreaterThan(0);
    expect(first.walls.length).toBeGreaterThan(0);
  });

  it('aumenta a quantidade de salas conforme o tamanho', () => {
    const small = generateDungeon('torre', 'small');
    const large = generateDungeon('torre', 'large');
    expect(large.labels.length).toBeGreaterThan(small.labels.length);
    expect(large.cols * large.rows).toBeGreaterThan(small.cols * small.rows);
  });
});
