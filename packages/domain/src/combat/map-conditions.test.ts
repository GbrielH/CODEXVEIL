import { describe, expect, it } from 'vitest';
import { MAP_CONDITIONS, mapConditionLabel, parseMapTokenConditions } from './map-conditions';

describe('condições dos tokens do mapa', () => {
  it('mantém o catálogo estático completo e sem chaves repetidas', () => {
    expect(MAP_CONDITIONS).toHaveLength(17);
    expect(new Set(MAP_CONDITIONS.map((condition) => condition.key)).size).toBe(17);
    expect(MAP_CONDITIONS.find((condition) => condition.key === 'exhaustion')?.maxLevel).toBe(6);
  });

  it('lê somente chaves e durações válidas', () => {
    expect(parseMapTokenConditions([{ key: 'poisoned', rounds: 3 }, { key: 'invalid' }, { key: 'exhaustion', level: 9 }])).toEqual([
      { key: 'poisoned', rounds: 3 },
      { key: 'exhaustion' },
    ]);
    expect(mapConditionLabel({ key: 'exhaustion', level: 2, rounds: 4 })).toBe('Exausto 2 · 4 rod.');
  });
});
