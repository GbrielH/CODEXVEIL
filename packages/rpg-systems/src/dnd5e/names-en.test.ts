import { describe, expect, it } from 'vitest';
import { englishName, matchesNameSearch } from './names-en';

describe('nomes em inglês de classes e raças', () => {
  it('mostra o original quando difere do português', () => {
    expect(englishName('Golias')).toBe('Goliath');
    expect(englishName('Pequenino')).toBe('Halfling');
    expect(englishName('Tiferino')).toBe('Tiefling');
    expect(englishName('Guerreiro')).toBe('Fighter');
    expect(englishName('Artífice')).toBe('Artificer');
    expect(englishName('Meio-Orc')).toBe('Half-Orc');
  });

  it('não repete quando o nome já é o mesmo', () => {
    expect(englishName('Halfling')).toBeUndefined();
    expect(englishName('Tabaxi')).toBeUndefined();
    expect(englishName('Nome desconhecido')).toBeUndefined();
  });

  it('busca nos dois idiomas, sem acento', () => {
    expect(matchesNameSearch('Golias', 'goliath')).toBe(true);
    expect(matchesNameSearch('Golias', 'gol')).toBe(true);
    expect(matchesNameSearch('Anão', 'anao')).toBe(true);
    expect(matchesNameSearch('Anão', 'dwarf')).toBe(true);
    expect(matchesNameSearch('Patrulheiro', 'ranger')).toBe(true);
    expect(matchesNameSearch('Mago', 'fighter')).toBe(false);
    expect(matchesNameSearch('Mago', '')).toBe(true);
  });
});
