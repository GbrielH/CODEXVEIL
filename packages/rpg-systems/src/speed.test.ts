import { describe, expect, it } from 'vitest';
import { characterSpeedMeters, speedTextMeters } from './speed';

describe('deslocamento em metros', () => {
  it('personagens de D&D (metros ou pés) e de Tormenta20', () => {
    expect(characterSpeedMeters('dnd5e', { combat: { speed: 9, speedUnit: 'm' } })).toBe(9);
    expect(characterSpeedMeters('dnd5e', { combat: { speed: 30, speedUnit: 'ft' } })).toBe(9);
    expect(characterSpeedMeters('tormenta20', { identity: { speed: 6 } })).toBe(6);
  });

  it('texto de deslocamento das criaturas', () => {
    expect(speedTextMeters('12 m, voo 18 m')).toBe(12);
    expect(speedTextMeters('30 ft., fly 60 ft.')).toBe(9);
    expect(speedTextMeters('40 pés')).toBe(12);
    expect(speedTextMeters('')).toBeNull();
  });
});
