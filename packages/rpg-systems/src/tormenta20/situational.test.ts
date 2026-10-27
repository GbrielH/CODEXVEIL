import { describe, expect, it } from 'vitest';
import { t20SituationalBonuses } from './bonuses';
import { computeT20Derived } from './derived';
import { parseT20Sheet } from './sheet';

describe('bônus de situação (T20)', () => {
  it('lista os do personagem e soma só os que o jogador ligou', () => {
    const sheet = parseT20Sheet({
      identity: { race: 'Anão', classes: [{ key: 'cavaleiro', name: 'Cavaleiro', level: 2 }] },
      powers: [{ key: 'combate-defensivo', name: 'Combate Defensivo', source: 'Poder geral' }],
    });
    const list = t20SituationalBonuses(sheet);
    expect(list.map((bonus) => bonus.source)).toEqual([
      'Anão: Conhecimento das Rochas',
      'Anão: Tradição de Heredrimm',
      'Baluarte',
      'Duelo',
      'Combate Defensivo',
    ]);
    const off = computeT20Derived(sheet);
    const rocks = list.find((bonus) => bonus.id === 'raca:conhecimento das rochas')!;
    const defensive = list.find((bonus) => bonus.id === 'poder:combate defensivo')!;
    const on = computeT20Derived(sheet, [], [rocks.effect, defensive.effect]);
    expect(on.skills.percepcao.total - off.skills.percepcao.total).toBe(2);
    expect(on.defense - off.defense).toBe(5);
    expect(defensive.effect.note).toContain('–2');
  });

  it('a Fúria cresce com o nível do bárbaro', () => {
    const at = (level: number) =>
      t20SituationalBonuses(parseT20Sheet({ identity: { classes: [{ key: 'barbaro', name: 'Bárbaro', level }] } }))[0]?.effect.note;
    expect(at(1)).toContain('até +2');
    expect(at(10)).toContain('até +4');
  });
});
