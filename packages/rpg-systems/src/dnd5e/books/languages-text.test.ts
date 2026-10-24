import { describe, expect, it } from 'vitest';
import { languagesFromText } from './languages-text';

describe('idiomas dos livros de 2014', () => {
  it('lê os idiomas fixos da raça', () => {
    expect(
      languagesFromText(
        'Você pode falar, ler e escrever Comum e Anão. O idioma Anão é repleto de consoantes duras.',
      ),
    ).toEqual({
      fixed: ['dwarvish'],
      choices: 0,
    });
    expect(languagesFromText('Você pode falar, ler e escrever Comum e Halfling.').fixed).toEqual([
      'halfling',
    ]);
  });

  it('conta os idiomas à escolha', () => {
    expect(
      languagesFromText(
        'Você pode falar, ler e escrever Comum e outro idioma adicional, à sua escolha.',
      ),
    ).toEqual({ fixed: [], choices: 1 });
    expect(languagesFromText('Comum, Élfico e um idioma adicional à sua escolha.')).toEqual({
      fixed: ['elvish'],
      choices: 1,
    });
    expect(languagesFromText('Dois à sua escolha')).toEqual({ fixed: [], choices: 2 });
    expect(languagesFromText('Um à sua escolha')).toEqual({ fixed: [], choices: 1 });
  });
});
