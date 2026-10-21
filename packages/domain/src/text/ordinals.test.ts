import { describe, expect, it } from 'vitest';
import { fixBookOrdinals, fixBookOrdinalsDeep } from './ordinals';

describe('ordinais dos livros importados', () => {
  it('conserta o texto do Legado Infernal', () => {
    expect(
      fixBookOrdinals(
        'Quando você atingir 0 30 nível, você poderá conjurar a magia repreensão infernal como uma magia de 20 nível. Quando você atingir 0 50 nível',
      ),
    ).toBe(
      'Quando você atingir o 3º nível, você poderá conjurar a magia repreensão infernal como uma magia de 2º nível. Quando você atingir o 5º nível',
    );
  });

  it('cobre níveis de dois dígitos e círculos, sem mexer no que já está certo', () => {
    expect(fixBookOrdinals('ao chegar ao 110 nível')).toBe('ao chegar ao 11º nível');
    expect(fixBookOrdinals('magia de 30 círculo')).toBe('magia de 3º círculo');
    expect(fixBookOrdinals('a partir do 3º nível; 30 metros; 10 níveis')).toBe('a partir do 3º nível; 30 metros; 10 níveis');
  });

  it('percorre objetos e listas', () => {
    expect(fixBookOrdinalsDeep({ name: 'Legado', traits: [{ text: 'atingir 0 30 nível' }], level: 3 })).toEqual({
      name: 'Legado',
      traits: [{ text: 'atingir o 3º nível' }],
      level: 3,
    });
  });
});
