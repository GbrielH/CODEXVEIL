import { describe, expect, it } from 'vitest';
import { resolveT20Attack } from './attacks';
import { t20AutomaticBonuses } from './bonuses';
import { buildT20Content } from './content';
import { computeT20Derived } from './derived';
import { applyT20LabelGrant, listT20Grants, listT20LabelGrants } from './grants';
import { planT20LevelUp } from './level-up';
import { parseT20Sheet } from './sheet';

const content = buildT20Content([
  {
    book: { id: 't20', name: 'Tormenta20' },
    entries: [
      { kind: 'spell', key: 'orientacao', name: 'Orientação', data: { type: 'divina', circle: 1, school: 'Adivinhação', text: '…' } },
      { kind: 'feat', key: 'esquiva', name: 'Esquiva', data: { group: 'combate', text: '+2 na Defesa e Reflexos.' } },
      { kind: 'class', key: 'guerreiro', name: 'Guerreiro', data: { pvInitial: 20, pvPerLevel: 5, pmPerLevel: 3, abilities: [], table: {} } },
      {
        kind: 'species',
        key: 'anao',
        name: 'Anão',
        data: { abilities: [{ name: 'Duro como Pedra', text: 'Você recebe +3 pontos de vida no 1º nível e +1 por nível seguinte.' }] },
      },
    ],
  },
]);

const stats = { damage: '1d8', damageType: 'corte', critMargin: 19, critMultiplier: 2, kind: 'melee' as const, range: '', grip: 'uma' as const };

describe('pendências da automação (T20)', () => {
  it('Foco em Arma soma só com a arma escolhida; armas anãs; lembretes vão para as notas', () => {
    const sheet = parseT20Sheet({
      identity: { race: 'Anão', classes: [{ key: 'guerreiro', name: 'Guerreiro', level: 1 }] },
      powers: [{ key: 'foco', name: 'Foco em Arma (Machado de batalha)', source: 'Poder geral' }],
    });
    const derived = computeT20Derived(sheet);
    const axe = resolveT20Attack(stats, sheet, derived, { rage: 0, weaponName: 'Machado de batalha', reminders: ['Combate Defensivo: –2'] });
    const sword = resolveT20Attack(stats, sheet, derived, { rage: 0, weaponName: 'Espada longa' });
    expect(axe.toHit - sword.toHit).toBe(4);
    expect(axe.notes).toContain('Combate Defensivo: –2');
  });

  it('Etiqueta dá +2 na perícia escolhida; Osteon pode escolher um poder', () => {
    const sheet = parseT20Sheet({});
    const [etiqueta, osteon] = listT20LabelGrants(content, sheet, [
      { id: 'e', name: 'Etiqueta' },
      { id: 'o', name: 'Memória Póstuma' },
    ]);
    expect(etiqueta!.options.map((option) => option.id)).toEqual(['diplomacia', 'nobreza']);
    const applied = applyT20LabelGrant(sheet, etiqueta!, ['nobreza'], 'Etiqueta');
    expect('sheet' in applied && applied.sheet.skills.bonuses.nobreza).toBe(2);

    const power = osteon!.options.find((option) => option.name === 'Poder: Esquiva')!;
    const asPower = applyT20LabelGrant(sheet, osteon!, [power.id], 'Memória Póstuma');
    expect('sheet' in asPower && asPower.sheet.powers.map((entry) => entry.name)).toEqual(['Esquiva']);
    expect('abilities' in asPower && asPower.abilities[0]?.name).toBe('Esquiva');
  });

  it('Totem Espiritual: magia do animal e Sabedoria nos PM; Familiar (Gato) +2 Furtividade', () => {
    const sheet = parseT20Sheet({
      attributes: { sab: 3 },
      powers: [
        { key: 'totem', name: 'Totem Espiritual (Coruja)', source: 'Bárbaro' },
        { key: 'familiar', name: 'Familiar (Gato)', source: 'Arcanista' },
      ],
    });
    expect(listT20Grants(content, sheet)[0]?.options.map((option) => option.name)).toEqual(['Orientação']);
    const bonuses = t20AutomaticBonuses(sheet);
    expect(bonuses.find((bonus) => bonus.source.startsWith('Totem'))?.effect.manaPoints).toBe(3);
    expect(bonuses.find((bonus) => bonus.source === 'Familiar (Gato)')?.effect.skills).toEqual({ furtividade: 2 });
  });

  it('Anão ganha +1 PV por nível na subida', () => {
    const sheet = parseT20Sheet({ identity: { race: 'Anão', raceKey: 't20:anao', classes: [{ key: 't20:guerreiro', name: 'Guerreiro', level: 1 }] } });
    const human = parseT20Sheet({ identity: { race: 'Humano', classes: [{ key: 't20:guerreiro', name: 'Guerreiro', level: 1 }] } });
    expect(planT20LevelUp(content, sheet).hitPointsGained - planT20LevelUp(content, human).hitPointsGained).toBe(1);
  });
});
