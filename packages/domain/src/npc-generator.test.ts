import { describe, expect, it } from 'vitest';
import { generateQuickNpc, quickNpcDescription } from './npc-generator';

describe('generateQuickNpc', () => {
  it('a mesma semente gera o mesmo NPC', () => {
    expect(generateQuickNpc('taverna')).toEqual(generateQuickNpc('taverna'));
  });

  it('sementes diferentes variam o resultado', () => {
    const names = new Set(Array.from({ length: 20 }, (_, index) => generateQuickNpc(`s${index}`).name));
    expect(names.size).toBeGreaterThan(10);
  });

  it('preenche todos os campos e cabe no limite da biblioteca', () => {
    const npc = generateQuickNpc('');
    expect(npc.name.length).toBeLessThanOrEqual(80);
    expect(Object.values(npc).every((value) => value.length > 0)).toBe(true);
    expect(quickNpcDescription(npc).length).toBeLessThan(4000);
  });
});
