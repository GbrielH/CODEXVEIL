import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  applyHealing,
  applyTrackOperation,
  healthStatus,
  recoversOn,
  setCurrent,
  setTemporary,
  type TrackValue,
} from './resources';

const hp: TrackValue = { current: 20, max: 30, temp: 5 };

describe('dano e cura', () => {
  it('o dano consome primeiro os pontos temporários', () => {
    expect(applyDamage(hp, 3)).toEqual({ current: 20, max: 30, temp: 2 });
    expect(applyDamage(hp, 8)).toEqual({ current: 17, max: 30, temp: 0 });
  });

  it('a vida não fica negativa', () => {
    expect(applyDamage(hp, 100)).toEqual({ current: 0, max: 30, temp: 0 });
  });

  it('a cura respeita o máximo e não altera temporários', () => {
    expect(applyHealing(hp, 50)).toEqual({ current: 30, max: 30, temp: 5 });
    expect(applyHealing({ current: 0, max: 30, temp: 0 }, 4).current).toBe(4);
  });

  it('trilhas sem máximo crescem livremente', () => {
    expect(applyHealing({ current: 3, max: null, temp: 0 }, 10).current).toBe(13);
  });

  it('rejeita quantidades negativas ou fracionárias', () => {
    expect(() => applyDamage(hp, -1)).toThrow(RangeError);
    expect(() => applyHealing(hp, 1.5)).toThrow(RangeError);
    expect(() => setTemporary(hp, -2)).toThrow(RangeError);
  });

  it('define valores diretamente dentro dos limites', () => {
    expect(setCurrent(hp, 99).current).toBe(30);
    expect(setCurrent(hp, -5).current).toBe(0);
    expect(setTemporary(hp, 10).temp).toBe(10);
  });
});

describe('applyTrackOperation', () => {
  it('reproduz cada operação da função do banco', () => {
    expect(applyTrackOperation(hp, 'damage', 8)).toEqual({ current: 17, max: 30, temp: 0 });
    expect(applyTrackOperation(hp, 'heal', 50)).toEqual({ current: 30, max: 30, temp: 5 });
    expect(applyTrackOperation(hp, 'spend', 25)).toEqual({ current: 0, max: 30, temp: 5 });
    expect(applyTrackOperation(hp, 'set_current', 40)).toEqual({ current: 30, max: 30, temp: 5 });
    expect(applyTrackOperation(hp, 'set_temp', 2)).toEqual({ current: 20, max: 30, temp: 2 });
    expect(applyTrackOperation(hp, 'set_max', 12)).toEqual({ current: 12, max: 12, temp: 5 });
  });

  it('rejeita quantidades inválidas como o banco', () => {
    expect(() => applyTrackOperation(hp, 'damage', -1)).toThrow(RangeError);
    expect(() => applyTrackOperation(hp, 'heal', 1.5)).toThrow(RangeError);
  });
});

describe('descansos', () => {
  it('descanso longo restaura recursos de descanso curto e longo', () => {
    expect(recoversOn('long_rest', 'long_rest')).toBe(true);
    expect(recoversOn('short_rest', 'long_rest')).toBe(true);
    expect(recoversOn('manual', 'long_rest')).toBe(false);
  });

  it('descanso curto restaura apenas recursos de descanso curto', () => {
    expect(recoversOn('short_rest', 'short_rest')).toBe(true);
    expect(recoversOn('long_rest', 'short_rest')).toBe(false);
  });
});

describe('healthStatus', () => {
  it.each([
    [30, 30, 'healthy'],
    [16, 30, 'healthy'],
    [15, 30, 'bloodied'],
    [7, 30, 'critical'],
    [0, 30, 'down'],
    [5, null, 'unknown'],
    [5, 0, 'unknown'],
  ] as const)('%i/%s → %s', (current, max, expected) => {
    expect(healthStatus(current, max)).toBe(expected);
  });
});
