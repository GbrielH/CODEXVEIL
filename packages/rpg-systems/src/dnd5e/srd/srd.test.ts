import { describe, expect, it } from 'vitest';
import { SKILLS } from '../skills';
import { STANDARD_ARRAY } from '../creation/draft';
import { SRD_BACKGROUNDS } from './backgrounds';
import { CIRCLE_OF_THE_LAND, SRD_INVOCATIONS } from './class-options';
import { listClasses } from './classes';
import { SRD_ITEMS, findTool } from './equipment';
import { SRD_FEATS } from './feats';
import { SRD_SPECIES } from './species';
import { SRD_SPELL_NAMES_PT, spellNameEn, spellNamePt } from './spell-names-pt';
import { SRD_SPELLS } from './spells';

const spellNames = new Set(SRD_SPELLS.map((spell) => spell.name));
const RESOURCE_KEY = /^[a-z0-9_:-]{1,64}$/;

describe('magias do SRD 5.2.1', () => {
  it('tem as 339 magias, sem nomes repetidos', () => {
    expect(SRD_SPELLS).toHaveLength(339);
    expect(spellNames.size).toBe(339);
  });

  it('distribui as magias pelos círculos do SRD', () => {
    const byLevel = SRD_SPELLS.reduce<Record<number, number>>((count, spell) => ({ ...count, [spell.level]: (count[spell.level] ?? 0) + 1 }), {});
    expect(byLevel).toEqual({ 0: 27, 1: 57, 2: 57, 3: 42, 4: 34, 5: 38, 6: 31, 7: 20, 8: 17, 9: 16 });
  });

  it('cabeçalhos cabem nos campos da ficha', () => {
    for (const spell of SRD_SPELLS) {
      expect(spell.classes.length, spell.name).toBeGreaterThan(0);
      expect(spell.castingTime.length, spell.name).toBeLessThanOrEqual(60);
      expect(spell.range.length, spell.name).toBeLessThanOrEqual(60);
      expect(spell.duration.length, spell.name).toBeLessThanOrEqual(60);
    }
  });

  it('marca concentração e ritual a partir do cabeçalho', () => {
    expect(SRD_SPELLS.find((spell) => spell.name === 'Bless')).toMatchObject({ level: 1, concentration: true });
    expect(SRD_SPELLS.find((spell) => spell.name === 'Detect Magic')).toMatchObject({ ritual: true, concentration: true });
    expect(SRD_SPELLS.find((spell) => spell.name === 'Fireball')).toMatchObject({ level: 3, range: '45 m', castingTime: 'Ação' });
  });
});

describe('nomes das magias em português', () => {
  it('toda magia do SRD tem nome em português, sem repetição', () => {
    const missing = SRD_SPELLS.filter((spell) => !SRD_SPELL_NAMES_PT[spell.name]).map((spell) => spell.name);
    expect(missing).toEqual([]);
    const names = Object.values(SRD_SPELL_NAMES_PT);
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(SRD_SPELL_NAMES_PT).every((name) => spellNames.has(name))).toBe(true);
  });

  it('converte nos dois sentidos e mantém nomes fora do SRD', () => {
    expect(spellNamePt('Fireball')).toBe('Bola de Fogo');
    expect(spellNamePt('Hunter’s Mark')).toBe('Marca do Caçador');
    expect(spellNameEn('bola de fogo')).toBe('Fireball');
    expect(spellNamePt('Magia da Casa')).toBe('Magia da Casa');
  });
});

describe('classes do SRD 5.2.1', () => {
  const classes = listClasses();

  it('tem as 12 classes, cada uma com sua subclasse do SRD', () => {
    expect(classes.map((entry) => entry.id)).toHaveLength(12);
    for (const entry of classes) expect(entry.subclass.features.length, entry.id).toBeGreaterThan(0);
  });

  it('tabelas por nível têm 20 posições', () => {
    for (const entry of classes) {
      const tables = [entry.weaponMastery, entry.spellcasting?.cantrips, entry.spellcasting?.prepared].filter(Boolean);
      for (const table of tables) expect(table, entry.id).toHaveLength(20);
    }
  });

  it('o conjunto padrão sugerido usa cada valor uma vez', () => {
    for (const entry of classes) {
      expect(Object.values(entry.standardArray).sort((a, b) => b - a), entry.id).toEqual([...STANDARD_ARRAY]);
    }
  });

  it('perícias, equipamento e recursos referem dados existentes', () => {
    for (const entry of classes) {
      if (entry.skillChoices.options !== 'any') for (const skill of entry.skillChoices.options) expect(SKILLS).toContain(skill);
      for (const option of entry.equipment) {
        for (const grant of option.items) expect(SRD_ITEMS[grant.item] ?? findTool(grant.item), `${entry.id}: ${grant.item}`).toBeDefined();
      }
      for (const resource of [...entry.resources, ...(entry.subclass.resources ?? [])]) {
        expect(resource.key).toMatch(RESOURCE_KEY);
        expect(resource.label.length).toBeLessThanOrEqual(60);
      }
      for (const feature of [...entry.features, ...entry.subclass.features]) {
        expect(feature.level).toBeGreaterThanOrEqual(1);
        expect(feature.level).toBeLessThanOrEqual(20);
        expect(feature.name.length).toBeLessThanOrEqual(120);
      }
      for (const feature of entry.subclass.features) expect(feature.level, feature.name).toBeGreaterThanOrEqual(3);
    }
  });

  it('magias sempre preparadas existem no SRD', () => {
    const named = [
      ...classes.flatMap((entry) => (entry.alwaysPrepared ?? []).flatMap((group) => group.spells)),
      ...classes.flatMap((entry) => (entry.subclass.alwaysPrepared ?? []).flatMap((group) => group.spells)),
      ...CIRCLE_OF_THE_LAND.flatMap((land) => land.spells.flatMap((group) => group.spells)),
      ...SRD_SPECIES.flatMap((species) => [
        ...(species.cantrips ?? []),
        ...(species.lineage?.options ?? []).flatMap((option) => [...(option.cantrips ?? []), ...(option.spells ?? []).map((spell) => spell.spell)]),
      ]),
    ];
    for (const name of named) expect(spellNames.has(name), name).toBe(true);
  });
});

describe('origens e talentos do SRD 5.2.1', () => {
  it('antecedentes têm três atributos e duas perícias distintos', () => {
    expect(SRD_BACKGROUNDS.map((background) => background.id)).toEqual(['acolyte', 'criminal', 'sage', 'soldier']);
    for (const background of SRD_BACKGROUNDS) {
      expect(new Set(background.abilities).size).toBe(3);
      expect(new Set(background.skills).size).toBe(2);
      expect(SRD_FEATS.some((feat) => feat.id === background.feat && feat.category === 'origin')).toBe(true);
    }
  });

  it('tem as nove espécies do SRD', () => {
    expect(SRD_SPECIES.map((species) => species.id)).toEqual([
      'dragonborn',
      'dwarf',
      'elf',
      'gnome',
      'goliath',
      'halfling',
      'human',
      'orc',
      'tiefling',
    ]);
  });

  it('invocações com pré-requisito apontam para invocações existentes', () => {
    const ids = new Set(SRD_INVOCATIONS.map((invocation) => invocation.id));
    for (const invocation of SRD_INVOCATIONS) if (invocation.requires) expect(ids.has(invocation.requires), invocation.id).toBe(true);
  });
});
