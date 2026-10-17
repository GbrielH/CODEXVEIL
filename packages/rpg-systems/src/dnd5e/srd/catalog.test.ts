import { describe, expect, it } from 'vitest';
import {
  describeSrdMagicItem,
  feetToMeters,
  loadSrdMagicItems,
  loadSrdMonsters,
  loadSrdSpellTexts,
  srdAttunementLabel,
  srdMonsterToStatBlock,
  srdRarityLabel,
  srdSlug,
  summarizeSrdSpell,
  translateSrdLanguages,
  translateSrdSenses,
  translateSrdSpeed,
  translateSrdTraitList,
} from './catalog';
import { SRD_SPELLS } from './spells';

async function monster(name: string) {
  const found = (await loadSrdMonsters()).find((entry) => entry.name === name);
  if (!found) throw new Error(`Monstro ausente: ${name}`);
  return found;
}

async function spellText(name: string) {
  const texts = await loadSrdSpellTexts();
  const text = texts[name];
  if (!text) throw new Error(`Magia ausente: ${name}`);
  return text;
}

describe('catálogo do SRD 5.2.1', () => {
  it('traz todas as magias, monstros, animais e itens mágicos do documento', async () => {
    const [texts, monsters, items] = await Promise.all([loadSrdSpellTexts(), loadSrdMonsters(), loadSrdMagicItems()]);
    expect(Object.keys(texts)).toHaveLength(339);
    expect(monsters).toHaveLength(330);
    expect(monsters.filter((entry) => entry.animal)).toHaveLength(95);
    expect(items).toHaveLength(258);
    // Toda magia da lista da criação de personagem tem descrição.
    expect(SRD_SPELLS.filter((spell) => !texts[spell.name]).map((spell) => spell.name)).toEqual([]);
    // Os endereços (slugs) não se repetem.
    expect(new Set(monsters.map((entry) => srdSlug(entry.name))).size).toBe(monsters.length);
    expect(new Set(items.map((entry) => srdSlug(entry.name))).size).toBe(items.length);
  });

  it('todo monstro vira um bloco de estatísticas válido', async () => {
    for (const entry of await loadSrdMonsters()) {
      expect(() => srdMonsterToStatBlock(entry), entry.name).not.toThrow();
    }
  });

  it('traduz os campos estruturados do bloco de estatísticas', async () => {
    const dragon = srdMonsterToStatBlock(await monster('Adult Red Dragon'));
    expect(dragon).toMatchObject({
      size: 'huge',
      creatureType: 'Dragão (Cromático)',
      alignment: 'Caótico e Mau',
      armorClass: 19,
      hitPoints: 256,
      hitPointFormula: '19d12 + 133',
      speed: '12 m, escalada 12 m, voo 24 m',
      abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 23 },
      savingThrows: 'DES +6, SAB +7',
      skills: 'Percepção +13, Furtividade +6',
      damageImmunities: 'Fogo',
      senses: 'Percepção às Cegas 18 m, Visão no Escuro 36 m; Percepção passiva 23',
      languages: 'Comum, Dracônico',
      challengeRating: '17',
    });
    expect(dragon.actions.map((action) => action.name)).toContain('Multiattack');
    expect(dragon.legendaryActions[0]?.name).toBe('Usos de Ações Lendárias');

    const cube = srdMonsterToStatBlock(await monster('Gelatinous Cube'));
    expect(cube.abilities).toEqual({ str: 14, dex: 3, con: 20, int: 1, wis: 6, cha: 1 });
    expect(cube.damageImmunities).toBe('Ácido');
    expect(cube.conditionImmunities).toBe('Cego, Enfeitiçado, Surdo, Exaustão, Amedrontado, Caído');
  });

  it('converte distâncias e textos de deslocamento, sentidos e idiomas', () => {
    expect(feetToMeters(5)).toBe('1,5 m');
    expect(feetToMeters(120)).toBe('36 m');
    expect(translateSrdSpeed('30 ft., Fly 60 ft. (hover)')).toBe('9 m, voo 18 m (pairar)');
    expect(translateSrdSpeed('40 ft. (bear form only)')).toBe('12 m (só na forma de urso)');
    expect(translateSrdSenses('Darkvision 60 ft. (unimpeded by magical Darkness); Passive Perception 12')).toBe(
      'Visão no Escuro 18 m (não é impedida por Escuridão mágica); Percepção passiva 12',
    );
    expect(translateSrdLanguages('Deep Speech; telepathy 120 ft.')).toBe('Dialeto das Profundezas; telepatia 36 m');
    expect(translateSrdLanguages('Common plus one other language')).toBe('Comum mais um idioma');
    expect(translateSrdLanguages('Understands Common but can’t speak')).toBe('entende Comum, mas não fala');
    expect(translateSrdLanguages('Primordial (Ignan)')).toBe('Primordial (Ignano)');
    expect(translateSrdTraitList('Acid, Poison; Charmed, Poisoned')).toBe('Ácido, Veneno; Enfeitiçado, Envenenado');
  });

  it('resume as especificações das magias em português', async () => {
    expect(summarizeSrdSpell(await spellText('Fireball'))).toEqual([
      { label: 'Resistência', value: 'Destreza' },
      { label: 'Dano', value: '8d6 de Fogo' },
      { label: 'Área', value: 'Esfera de 6 m de raio' },
      { label: 'Círculo maior', value: '+1d6 de dano por círculo acima do 3º' },
    ]);
    expect(summarizeSrdSpell(await spellText('Fire Bolt'))).toEqual([
      { label: 'Ataque', value: 'Jogada de ataque mágico à distância' },
      { label: 'Dano', value: '1d10 de Fogo' },
      { label: 'Evolução', value: 'Nível 5: 2d10; nível 11: 3d10; nível 17: 4d10' },
    ]);
    expect(summarizeSrdSpell(await spellText('Cure Wounds'))).toEqual([
      { label: 'Cura', value: '2d8 + modificador de conjuração PV' },
      { label: 'Círculo maior', value: '+2d8 de cura por círculo acima do 1º' },
    ]);
    const hold = summarizeSrdSpell(await spellText('Hold Person'));
    expect(hold).toContainEqual({ label: 'Condições', value: 'Paralisado' });
    expect(hold).toContainEqual({ label: 'Resistência', value: 'Sabedoria' });
  });

  it('descreve os itens mágicos em português', async () => {
    const items = await loadSrdMagicItems();
    const bag = items.find((item) => item.name === 'Bag of Holding');
    expect(bag && describeSrdMagicItem(bag)).toBe('Item maravilhoso, Incomum');
    expect(srdRarityLabel('Very Rare')).toBe('Muito raro');
    expect(srdAttunementLabel('Requires Attunement by a Wizard')).toBe('Exige sintonia (Mago)');
    expect(srdAttunementLabel('Requires Attunement')).toBe('Exige sintonia');
  });
});
