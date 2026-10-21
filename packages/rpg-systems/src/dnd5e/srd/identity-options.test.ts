import { describe, expect, it } from 'vitest';
import { ALIGNMENTS, withCurrentOption } from './languages';
import { speciesOptionNames } from './species';

describe('opções de identidade da ficha', () => {
  it('lista cada linhagem do Draconato e mantém a escolha atual fora da lista', () => {
    const species = speciesOptionNames();
    expect(species).toContain('Draconato (Preto (ácido))');
    expect(species).not.toContain('Draconato');
    expect(withCurrentOption(species, 'Aasimar de livro')[0]).toBe('Aasimar de livro');
    expect(withCurrentOption(ALIGNMENTS.map((a) => a.name), 'Caótico e Bom')).toHaveLength(9);
    expect(withCurrentOption(['A'], '')).toEqual(['A']);
  });
});
