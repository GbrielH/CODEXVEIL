import { describe, expect, it } from 'vitest';
import { conditionLabel, findSystem, getSystem, isSystemId, listSystems } from './registry';

describe('registro de sistemas', () => {
  it('disponibiliza o D&D 5e', () => {
    expect(getSystem('dnd5e').shortName).toBe('D&D 5e');
    expect(isSystemId('dnd5e')).toBe(true);
  });

  it('ignora sistemas desconhecidos', () => {
    expect(findSystem('gurps')).toBeUndefined();
    expect(isSystemId('')).toBe(false);
  });

  it.each(listSystems().map((system) => [system.id, system] as const))(
    '%s cumpre o contrato básico',
    (_id, system) => {
      expect(system.license.attribution.length).toBeGreaterThan(50);
      expect(system.license.licenseUrl).toMatch(/^https:\/\//);

      const keys = system.conditions.map((condition) => condition.key);
      expect(new Set(keys).size).toBe(keys.length);

      const sheet = system.createDefaultSheet();
      expect(system.parseSheet(sheet)).toEqual(sheet);
      expect(system.defaultResources(sheet).length).toBeGreaterThan(0);
      expect(system.summarize(sheet).subtitle.length).toBeGreaterThan(0);

      const statBlock = system.createDefaultStatBlock();
      expect(system.parseStatBlock(statBlock)).toEqual(statBlock);

      const defaults = system.combatDefaults(statBlock);
      expect(Number.isInteger(defaults.initiativeBonus)).toBe(true);
      expect(Number.isInteger(system.initiativeBonus(sheet))).toBe(true);
    },
  );
});

describe('conditionLabel', () => {
  it('traduz condições conhecidas e preserva as personalizadas', () => {
    expect(conditionLabel('dnd5e', 'poisoned')).toBe('Envenenado');
    expect(conditionLabel('dnd5e', 'exhaustion', 2)).toBe('Exaustão 2');
    expect(conditionLabel('dnd5e', 'Abençoado')).toBe('Abençoado');
    expect(conditionLabel('desconhecido', 'prone')).toBe('prone');
  });
});

describe('valores de combate do D&D 5e', () => {
  it('usam vida, CA e Destreza do bloco de estatísticas', () => {
    const system = getSystem('dnd5e');
    const statBlock = system.parseStatBlock({ hitPoints: 22, armorClass: 13, abilities: { dex: 15 } });
    expect(system.combatDefaults(statBlock)).toEqual({ hitPoints: 22, armorClass: 13, initiativeBonus: 2 });
  });

  it('a iniciativa do personagem soma Destreza e bônus', () => {
    const system = getSystem('dnd5e');
    const sheet = system.parseSheet({ abilities: { dex: 8 }, combat: { initiativeBonus: 5 } });
    expect(system.initiativeBonus(sheet)).toBe(4);
  });
});
