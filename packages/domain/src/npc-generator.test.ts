import { describe, expect, it } from 'vitest';
import {
  generateQuickMonster,
  generateQuickNpc,
  quickMonsterDescription,
  quickNpcDescription,
} from './npc-generator';

describe('generateQuickNpc', () => {
  it('a mesma semente gera o mesmo NPC', () => {
    expect(generateQuickNpc('taverna')).toEqual(generateQuickNpc('taverna'));
  });

  it('sementes diferentes variam o resultado', () => {
    const names = new Set(
      Array.from({ length: 20 }, (_, index) => generateQuickNpc(`s${index}`).name),
    );
    expect(names.size).toBeGreaterThan(10);
  });

  it('preenche todos os campos e cabe no limite da biblioteca', () => {
    const npc = generateQuickNpc('');
    expect(npc.name.length).toBeLessThanOrEqual(80);
    expect(Object.values(npc).every((value: string) => value.length > 0)).toBe(true);
    expect(quickNpcDescription(npc).length).toBeLessThan(4000);
  });
});

describe('generateQuickMonster', () => {
  it('a mesma semente gera o mesmo monstro e tem porte válido', () => {
    const monster = generateQuickMonster('cripta');
    expect(monster).toEqual(generateQuickMonster('cripta'));
    expect(['small', 'medium', 'large', 'huge']).toContain(monster.size);
    expect(quickMonsterDescription(monster).length).toBeLessThan(4000);
  });
});
