import { describe, expect, it } from 'vitest';
import {
  describeDnd5eConditionEffects,
  dnd5eConditionDurations,
  dnd5eConditionEffects,
  dnd5eConditions,
  dnd5eConditionsLeftAfter,
  dnd5eLongRestConditionChanges,
  dnd5eSelfConditionOptions,
  effectiveSpeed,
  formatDnd5eConditionRounds,
  netRollMode,
  passiveWithConditions,
} from './conditions';

const effectsOf = (...keys: (string | [string, number])[]) =>
  dnd5eConditionEffects(
    keys.map((entry) => (Array.isArray(entry) ? { key: entry[0], level: entry[1] } : { key: entry, level: null })),
  );

describe('condições do SRD 5.2.1', () => {
  it('traz as 15 condições do glossário, cada uma com regras', () => {
    expect(dnd5eConditions.map((condition) => condition.key)).toEqual([
      'blinded',
      'charmed',
      'deafened',
      'exhaustion',
      'frightened',
      'grappled',
      'incapacitated',
      'invisible',
      'paralyzed',
      'petrified',
      'poisoned',
      'prone',
      'restrained',
      'stunned',
      'unconscious',
    ]);
    for (const condition of dnd5eConditions) {
      expect(condition.rules.length).toBeGreaterThan(0);
      for (const included of 'includes' in condition ? condition.includes : []) {
        expect(dnd5eConditions.some((other) => other.key === included)).toBe(true);
      }
    }
  });

  it('Envenenado: desvantagem em ataques, testes de atributo e iniciativa', () => {
    const effects = effectsOf('poisoned');
    expect(netRollMode(effects.attackRolls)).toBe('disadvantage');
    expect(netRollMode(effects.abilityChecks)).toBe('disadvantage');
    expect(netRollMode(effects.initiative)).toBe('disadvantage');
    expect(netRollMode(effects.attacksAgainst)).toBeNull();
    expect(passiveWithConditions(14, effects)).toBe(9);
  });

  it('Paralisado impõe Incapacitado, zera o deslocamento e falha em FOR e DES', () => {
    const effects = effectsOf('paralyzed');
    expect(effects.conditions.map((condition) => [condition.key, condition.impliedBy])).toEqual([
      ['paralyzed', null],
      ['incapacitated', 'Paralisado'],
    ]);
    expect(effects.incapacitated).toEqual(['Incapacitado']);
    expect(effects.speedZero).toEqual(['Paralisado']);
    expect(effects.savingThrows.str.autoFail).toEqual(['Paralisado']);
    expect(effects.savingThrows.dex.autoFail).toEqual(['Paralisado']);
    expect(effects.savingThrows.con.autoFail).toEqual([]);
    expect(effects.autoCritWithin5ft).toEqual(['Paralisado']);
    expect(netRollMode(effects.attacksAgainst)).toBe('advantage');
    expect(netRollMode(effects.initiative)).toBe('disadvantage');
    expect(effectiveSpeed(9, 'm', effects)).toBe(0);
  });

  it('Inconsciente impõe Incapacitado e Caído; à distância, vantagem e desvantagem se anulam', () => {
    const effects = effectsOf('unconscious');
    expect(effects.conditions.map((condition) => condition.key)).toEqual(['unconscious', 'incapacitated', 'prone']);
    expect(netRollMode(effects.attacksAgainst)).toBe('advantage');
    const qualified = effects.attacksAgainst.filter((source) => source.qualifier);
    expect(qualified.map((source) => [source.mode, source.source])).toEqual([
      ['advantage', 'Caído'],
      ['disadvantage', 'Caído'],
    ]);
    expect(dnd5eConditionsLeftAfter(['unconscious'], [])).toEqual(['prone']);
    expect(dnd5eConditionsLeftAfter(['unconscious'], ['prone'])).toEqual([]);
  });

  it('uma condição aplicada diretamente não fica marcada como imposta', () => {
    const effects = effectsOf('paralyzed', 'incapacitated');
    expect(effects.conditions.find((condition) => condition.key === 'incapacitated')?.impliedBy).toBeNull();
  });

  it('Petrificado anula Envenenado (imunidade)', () => {
    const effects = effectsOf('petrified', 'poisoned');
    expect(effects.conditions.find((condition) => condition.key === 'poisoned')?.suppressedBy).toBe('Petrificado');
    expect(netRollMode(effects.attackRolls)).toBeNull();
    expect(effects.resistAllDamage).toEqual(['Petrificado']);
    expect(describeDnd5eConditionEffects(effects).some((line) => line.detail.includes('imunidade (Petrificado)'))).toBe(true);
  });

  it('Invisível e Envenenado: vantagem e desvantagem nos ataques se anulam', () => {
    const effects = effectsOf('invisible', 'poisoned');
    expect(netRollMode(effects.attackRolls)).toBe('cancelled');
    expect(netRollMode(effects.attacksAgainst)).toBe('disadvantage');
  });

  it('efeitos que só valem numa situação não entram no resultado direto', () => {
    const effects = effectsOf('frightened');
    expect(effects.attackRolls).toHaveLength(1);
    expect(netRollMode(effects.attackRolls)).toBeNull();
    expect(passiveWithConditions(12, effects)).toBe(12);
  });

  it('Exaustão: −2 por nível em testes de d20 e −1,5 m (ou −5 pés) por nível', () => {
    const effects = effectsOf(['exhaustion', 3]);
    expect(effects.exhaustionLevel).toBe(3);
    expect(effects.d20Penalty).toBe(6);
    expect(effectiveSpeed(9, 'm', effects)).toBe(4.5);
    expect(effectiveSpeed(30, 'ft', effects)).toBe(15);
    expect(effectiveSpeed(3, 'm', effects)).toBe(0);
    expect(effects.dead).toBe(false);
    expect(effectsOf(['exhaustion', 9]).exhaustionLevel).toBe(6);
    expect(effectsOf(['exhaustion', 6]).dead).toBe(true);
  });

  it('Contido: desvantagem só nas resistências de Destreza', () => {
    const effects = effectsOf('restrained');
    expect(effects.savingThrows.dex.rolls.map((roll) => roll.mode)).toEqual(['disadvantage']);
    expect(effects.savingThrows.str.rolls).toEqual([]);
    const saves = describeDnd5eConditionEffects(effects).find((line) => line.label === 'Testes de resistência');
    expect(saves?.detail).toBe('DES: Desvantagem (Contido)');
  });

  it('condições personalizadas aparecem sem efeitos mecânicos', () => {
    const effects = effectsOf('Abençoado');
    expect(effects.conditions).toMatchObject([{ key: 'Abençoado', label: 'Abençoado', definition: null }]);
    expect(describeDnd5eConditionEffects(effects)).toEqual([]);
  });

  it('o Descanso Longo remove 1 nível de Exaustão', () => {
    expect(
      dnd5eLongRestConditionChanges([
        { id: 'a', key: 'exhaustion', level: 2 },
        { id: 'b', key: 'poisoned', level: null },
      ]),
    ).toEqual({ update: [{ id: 'a', level: 1 }], remove: [] });
    expect(dnd5eLongRestConditionChanges([{ id: 'a', key: 'exhaustion', level: 1 }])).toEqual({ update: [], remove: ['a'] });
  });

  it('o jogador só aplica as condições das próprias habilidades', () => {
    expect(dnd5eSelfConditionOptions([]).map((option) => option.key)).toEqual(['invisible', 'prone', 'unconscious']);
    const ranger = dnd5eSelfConditionOptions(['Véu da Natureza', 'Ataque Extra', 'Contact Other Plane', 'Invisibility']);
    expect(ranger.map((option) => option.key)).toEqual(['incapacitated', 'invisible', 'prone', 'unconscious']);
    expect(ranger.find((option) => option.key === 'invisible')?.sources).toEqual(['Ação Esconder', 'Véu da Natureza', 'Invisibility']);
    expect(ranger.find((option) => option.key === 'incapacitated')).toMatchObject({ label: 'Incapacitado', sources: ['Contact Other Plane'] });
  });

  it('durações em rodadas', () => {
    expect(dnd5eConditionDurations[0]).toEqual({ rounds: null, label: 'Até ser removida' });
    expect(formatDnd5eConditionRounds(null)).toBe('até ser removida');
    expect(formatDnd5eConditionRounds(1)).toBe('1 rodada');
    expect(formatDnd5eConditionRounds(3)).toBe('3 rodadas');
    expect(formatDnd5eConditionRounds(10)).toBe('10 rodadas (1 min)');
    expect(formatDnd5eConditionRounds(1200)).toBe('1.200 rodadas (2 h)');
  });
});

describe('ataques de armas do inventário', () => {
  it('acha a arma pelo nome do item e monta o ataque', async () => {
    const { findSrdWeaponByName, weaponAttackEntry, createDefaultDnd5eSheet } = await import('./index');
    expect(findSrdWeaponByName('Adaga')?.id).toBe('dagger');
    expect(findSrdWeaponByName('Machadinhas (2)')?.id ?? findSrdWeaponByName('Machadinha')?.id).toBe('handaxe');
    expect(findSrdWeaponByName('Pedra da sorte')).toBeUndefined();
    const sheet = createDefaultDnd5eSheet();
    sheet.abilities.dex = 16;
    sheet.proficiencies.weapons = 'Armas simples';
    const dagger = findSrdWeaponByName('Adaga');
    expect(dagger && weaponAttackEntry(dagger, sheet).data).toMatchObject({ ability: 'dex', proficient: true, damage: '1d4' });
  });
});

describe('personagem entrando numa campanha', () => {
  it('lista o que impede a entrada', async () => {
    const { dnd5eCampaignIssues, defaultDnd5eCampaignRules } = await import('./index');
    const ok = { name: 'Lyra', sheet: { identity: { species: 'Elfo', background: 'Sábio', alignment: 'Neutro e Bom', classes: [{ name: 'Mago', level: 1 }] } } };
    expect(dnd5eCampaignIssues(ok, defaultDnd5eCampaignRules())).toEqual([]);
    const bad = { name: 'Vex', sheet: { identity: { species: '', background: 'Sábio', alignment: 'Caótico e Mau', classes: [{ name: 'Ladino', level: 3 }] } } };
    const issues = dnd5eCampaignIssues(bad, defaultDnd5eCampaignRules());
    expect(issues).toHaveLength(3);
    expect(issues.join(' ')).toContain('3º nível');
  });
});
