import { describe, expect, it } from 'vitest';
import { t20AutomaticBonuses } from './bonuses';
import { computeT20Derived } from './derived';
import { parseT20Sheet } from './sheet';

const power = (name: string) => ({ key: name, name, source: 'Poder geral' });

describe('bônus automáticos (T20)', () => {
  it('raça e poderes somam nas perícias, Defesa e deslocamento, com a origem', () => {
    const sheet = parseT20Sheet({
      identity: { race: 'Elfo', classes: [{ key: 'guerreiro', name: 'Guerreiro', level: 1 }], speed: 9 },
      powers: [power('Esquiva'), power('Atlético')],
    });
    const plain = computeT20Derived(parseT20Sheet({ identity: { classes: [{ key: 'guerreiro', name: 'Guerreiro', level: 1 }], speed: 9 } }));
    const derived = computeT20Derived(sheet);
    expect(derived.skills.percepcao.total - plain.skills.percepcao.total).toBe(2);
    expect(derived.skills.misticismo.total - plain.skills.misticismo.total).toBe(2);
    expect(derived.skills.reflexos.total - plain.skills.reflexos.total).toBe(2);
    expect(derived.defense - plain.defense).toBe(2);
    expect(derived.speed).toBe(12);
    expect(derived.automaticBonuses.map((bonus) => bonus.source)).toEqual(['Elfo: Sentidos Élficos', 'Esquiva', 'Atlético']);
  });

  it('escala com o nível, a classe e os poderes da Tormenta; respeita armadura pesada', () => {
    const barbaro = (level: number) =>
      t20AutomaticBonuses(parseT20Sheet({ identity: { classes: [{ key: 'barbaro', name: 'Bárbaro', level }] } }));
    expect(barbaro(2)).toEqual([]);
    expect(barbaro(3)[0]?.effect.skills).toEqual({ percepcao: 1, reflexos: 1 });
    expect(barbaro(9)[0]?.effect.skills).toEqual({ percepcao: 2, reflexos: 2 });

    const tormenta = t20AutomaticBonuses(parseT20Sheet({ powers: [power('Carapaça'), power('Antenas'), power('Olhos Vermelhos')] }));
    expect(tormenta.find((bonus) => bonus.source === 'Carapaça')?.effect.defense).toBe(2);

    const heavy = (useDexterity: boolean) =>
      t20AutomaticBonuses(parseT20Sheet({ powers: [power('Pele de Ferro'), power('Encouraçado')], defense: { useDexterity } }));
    expect(heavy(true).map((bonus) => bonus.source)).toEqual(['Pele de Ferro']);
    expect(heavy(false).map((bonus) => bonus.source)).toEqual(['Encouraçado']);
  });

  it('PV e PM por nível de poderes', () => {
    const sheet = parseT20Sheet({
      identity: { classes: [{ key: 'arcanista', name: 'Arcanista', level: 6 }] },
      powers: [power('Vitalidade'), power('Vontade de Ferro'), power('Poder Mágico')],
    });
    const derived = computeT20Derived(sheet);
    expect(derived.abilityHitPoints).toBe(6);
    expect(derived.abilityManaPoints).toBe(3 + 6);
  });
});
