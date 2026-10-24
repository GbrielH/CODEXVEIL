import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { computeDnd5eDerived } from './derived';
import { attackRollBonus, dnd5eAttackDataSchema } from './entries';
import {
  currencyFromResourceKey,
  currencyResourceKey,
  dnd5eDefaultResources,
  isDedicatedResourceKey,
  spellSlotResources,
  suggestHitPointMax,
  totalInGold,
} from './resources';
import {
  createDefaultDnd5eSheet,
  parseDnd5eSheet,
  totalLevel,
  type Dnd5eSheetInput,
} from './sheet';
import { createDefaultDnd5eStatBlock, parseDnd5eStatBlock } from './stat-block';
import { dnd5eSystem, formatSpeciesName } from './index';
import { summarizeSheet } from '../registry';

function sheet(input: Dnd5eSheetInput) {
  return parseDnd5eSheet(input);
}

describe('ficha D&D 5e — estrutura', () => {
  it('cria uma ficha padrão válida', () => {
    const defaults = createDefaultDnd5eSheet();
    expect(defaults.schemaVersion).toBe(1);
    expect(defaults.abilities).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    expect(defaults.skills.stealth).toEqual({ proficiency: 'none', bonus: 0 });
    expect(defaults.identity.classes).toHaveLength(1);
  });

  it('completa dados parciais com valores padrão', () => {
    const parsed = sheet({ abilities: { str: 16 } });
    expect(parsed.abilities.str).toBe(16);
    expect(parsed.abilities.dex).toBe(10);
  });

  it('trata ficha ausente como ficha padrão', () => {
    expect(parseDnd5eSheet(null)).toEqual(createDefaultDnd5eSheet());
  });

  it('remove campos desconhecidos', () => {
    const parsed = parseDnd5eSheet({ hacked: true, abilities: { str: 12, evil: 99 } });
    expect(parsed).not.toHaveProperty('hacked');
    expect(parsed.abilities).not.toHaveProperty('evil');
  });

  it('rejeita valores fora das regras', () => {
    expect(() => sheet({ abilities: { str: 31 } })).toThrow(ZodError);
    expect(() => sheet({ abilities: { dex: 12.5 } })).toThrow(ZodError);
    expect(() => sheet({ identity: { classes: [] } })).toThrow(ZodError);
    expect(() =>
      sheet({ identity: { classes: [{ name: 'Guerreiro', level: 21, hitDie: 'd10' }] } }),
    ).toThrow(ZodError);
  });

  it('rejeita versões desconhecidas e formatos inválidos', () => {
    expect(() => parseDnd5eSheet({ schemaVersion: 99 })).toThrow(RangeError);
    expect(() => parseDnd5eSheet('texto')).toThrow(TypeError);
    expect(() => parseDnd5eSheet([1, 2])).toThrow(TypeError);
  });

  it('soma níveis de multiclasse', () => {
    const multiclass = sheet({
      identity: {
        classes: [
          { name: 'Guerreiro', level: 3, hitDie: 'd10' },
          { name: 'Mago', level: 2, hitDie: 'd6' },
        ],
      },
    });
    expect(totalLevel(multiclass)).toBe(5);
  });
});

describe('ficha D&D 5e — valores derivados', () => {
  const wizard = sheet({
    identity: { species: 'Elfo', classes: [{ name: 'Mago', level: 5, hitDie: 'd6' }] },
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    savingThrows: { int: { proficient: true }, wis: { proficient: true } },
    skills: {
      arcana: { proficiency: 'proficient' },
      investigation: { proficiency: 'proficient' },
      perception: { proficiency: 'none', bonus: 1 },
    },
    combat: { initiativeBonus: 0 },
    spellcasting: { ability: 'int' },
  });
  const derived = computeDnd5eDerived(wizard);

  it('calcula proficiência, modificadores e resistências', () => {
    expect(derived.level).toBe(5);
    expect(derived.proficiencyBonus).toBe(3);
    expect(derived.abilityModifiers).toEqual({ str: -1, dex: 2, con: 1, int: 3, wis: 1, cha: 0 });
    expect(derived.savingThrows.int).toBe(6);
    expect(derived.savingThrows.wis).toBe(4);
    expect(derived.savingThrows.str).toBe(-1);
  });

  it('calcula perícias com o atributo correto e bônus manuais', () => {
    expect(derived.skills.arcana).toEqual({ ability: 'int', proficiency: 'proficient', bonus: 6 });
    expect(derived.skills.stealth.bonus).toBe(2);
    expect(derived.skills.athletics.bonus).toBe(-1);
    expect(derived.skills.perception.bonus).toBe(2);
    expect(derived.passivePerception).toBe(12);
    expect(derived.passiveInvestigation).toBe(16);
  });

  it('calcula iniciativa e conjuração', () => {
    expect(derived.initiative).toBe(2);
    expect(derived.spellcasting).toEqual({ ability: 'int', saveDc: 14, attackBonus: 6 });
  });

  it('aplica meia proficiência e especialização', () => {
    const bard = computeDnd5eDerived(
      sheet({
        identity: { classes: [{ name: 'Bardo', level: 3, hitDie: 'd8' }] },
        abilities: { cha: 16, wis: 10 },
        skills: {
          persuasion: { proficiency: 'expertise' },
          medicine: { proficiency: 'half' },
        },
      }),
    );
    expect(bard.skills.persuasion.bonus).toBe(7);
    expect(bard.skills.medicine.bonus).toBe(1);
  });

  it('não há conjuração sem atributo definido', () => {
    expect(computeDnd5eDerived(createDefaultDnd5eSheet()).spellcasting).toBeNull();
  });

  it('calcula bônus de ataque', () => {
    const attack = dnd5eAttackDataSchema.parse({ ability: 'dex', proficient: true, bonus: 1 });
    expect(attackRollBonus(attack, derived)).toBe(2 + 3 + 1);
  });
});

describe('ficha D&D 5e — recursos', () => {
  it('sugere vida máxima pelo dado de vida e Constituição', () => {
    expect(
      suggestHitPointMax(
        sheet({
          identity: { classes: [{ name: 'Guerreiro', level: 1, hitDie: 'd10' }] },
          abilities: { con: 14 },
        }),
      ),
    ).toBe(12);
    expect(
      suggestHitPointMax(
        sheet({
          identity: { classes: [{ name: 'Guerreiro', level: 3, hitDie: 'd10' }] },
          abilities: { con: 14 },
        }),
      ),
    ).toBe(28);
    expect(
      suggestHitPointMax(
        sheet({
          identity: { classes: [{ name: 'Mago', level: 2, hitDie: 'd6' }] },
          abilities: { con: 8 },
        }),
      ),
    ).toBe(8);
  });

  it('cria vida, dados de vida por tipo, testes contra a morte e inspiração', () => {
    const resources = dnd5eDefaultResources(
      sheet({
        identity: {
          classes: [
            { name: 'Guerreiro', level: 2, hitDie: 'd10' },
            { name: 'Mago', level: 1, hitDie: 'd6' },
          ],
        },
      }),
    );
    const byKey = Object.fromEntries(resources.map((r) => [r.key, r]));
    expect(byKey.hp?.display).toBe('health');
    expect(byKey.hit_dice_d10?.max).toBe(2);
    expect(byKey.hit_dice_d6?.max).toBe(1);
    expect(byKey.hit_dice_d8).toBeUndefined();
    expect(byKey.death_save_failures).toMatchObject({ current: 0, max: 3, recovery: 'manual' });
    expect(byKey.currency_gp).toMatchObject({ current: 0, max: null, recovery: 'manual' });
    expect(new Set(resources.map((r) => r.key)).size).toBe(resources.length);
  });

  it('moedas são trilhas de recurso, fora da ficha', () => {
    expect(createDefaultDnd5eSheet()).not.toHaveProperty('currency');
    expect(currencyResourceKey('pp')).toBe('currency_pp');
    expect(currencyFromResourceKey('currency_ep')).toBe('ep');
    expect(currencyFromResourceKey('currency_xx')).toBeNull();
    expect(currencyFromResourceKey('hp')).toBeNull();
    expect(totalInGold({ pp: 1, gp: 2, ep: 2, sp: 5, cp: 7 })).toBe(13.57);
    expect(isDedicatedResourceKey('hp')).toBe(true);
    expect(isDedicatedResourceKey('currency_cp')).toBe(true);
    expect(isDedicatedResourceKey('hit_dice_d8')).toBe(false);
    expect(isDedicatedResourceKey('spell_slot_1')).toBe(false);
  });

  it('gera espaços de magia por círculo', () => {
    expect(spellSlotResources(3).map((r) => [r.key, r.max])).toEqual([
      ['spell_slot_1', 4],
      ['spell_slot_2', 2],
    ]);
  });
});

describe('bloco de estatísticas', () => {
  it('cria um bloco padrão válido e rejeita nível de desafio inválido', () => {
    expect(createDefaultDnd5eStatBlock().challengeRating).toBe('1');
    expect(parseDnd5eStatBlock({ challengeRating: '1/2' }).challengeRating).toBe('1/2');
    expect(() => parseDnd5eStatBlock({ challengeRating: '1/3' })).toThrow(ZodError);
  });
});

describe('resumo do personagem', () => {
  it('descreve espécie e classes', () => {
    const summary = dnd5eSystem.summarize(
      sheet({
        identity: { species: 'Elfo', classes: [{ name: 'Mago', level: 5, hitDie: 'd6' }] },
      }),
    );
    expect(summary).toEqual({ subtitle: 'Elfo · Mago 5', level: 5 });
  });

  it('usa o nível quando não há espécie nem classe', () => {
    expect(dnd5eSystem.summarize(createDefaultDnd5eSheet()).subtitle).toBe('Nível 1');
    expect(formatSpeciesName('Draconato (Preto (ácido))')).toBe('Draconato Preto (ácido)');
    expect(formatSpeciesName('Humano (Humano variante)')).toBe('Humano variante');
    expect(formatSpeciesName('Elfo (Alto Elfo)')).toBe('Elfo (Alto Elfo)');
  });
});

describe('resumo seguro de fichas', () => {
  it('nunca lança, mesmo com dados inválidos ou sistema desconhecido', () => {
    expect(
      summarizeSheet('dnd5e', { identity: { classes: [{ name: 'Bardo', level: 2 }] } }),
    ).toEqual({
      subtitle: 'Bardo 2',
      level: 2,
    });
    expect(summarizeSheet('dnd5e', { abilities: { str: 99 } }).subtitle).toBe(
      'Ficha com dados inválidos',
    );
    expect(summarizeSheet('outro', {}).level).toBeNull();
  });
});

describe('dano e crítico do ataque', () => {
  it('soma modificador e bônus, dobra os dados no crítico e põe o extra', async () => {
    const { attackDamageFormula, critRangeLabel, dnd5eAttackDataSchema } =
      await import('./entries');
    const scores = { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const attack = dnd5eAttackDataSchema.parse({
      ability: 'str',
      damage: '1d8',
      damageType: 'cortante',
      damageBonus: 1,
      extraDamage: '1d6',
      extraDamageType: 'fogo',
      critRange: 19,
      critExtra: '1d8',
    });
    expect(attackDamageFormula(attack, scores)).toBe('1d8+1d6+4');
    expect(attackDamageFormula(attack, scores, true)).toBe('2d8+2d6+1d8+4');
    expect(critRangeLabel(attack.critRange)).toBe('19–20');
    expect(critRangeLabel(20)).toBe('20');
    expect(attackDamageFormula(dnd5eAttackDataSchema.parse({ damage: '' }), scores)).toBeNull();
  });
});
