import { describe, expect, it } from 'vitest';
import { characterImagePrompt } from './image-prompt';

describe('characterImagePrompt', () => {
  it('monta o prompt com raça, classe, atributos, equipamento e história', () => {
    const prompt = characterImagePrompt({
      system: 'D&D 5e',
      name: 'Thorin',
      species: 'Anão',
      className: 'Guerreiro',
      level: 3,
      background: 'Soldado',
      strengths: ['Força', 'Constituição'],
      equipment: ['Machado de batalha', 'Cota de malha'],
      personality: 'Teimoso e leal',
      backstory: 'Veterano de uma guerra antiga.',
    });
    expect(prompt).toContain('Thorin, Anão Guerreiro de nível 3');
    expect(prompt).toContain('físico forte e musculoso');
    expect(prompt).toContain('Machado de batalha');
    expect(prompt).toContain('Teimoso e leal');
    expect(prompt).toContain('Veterano');
  });

  it('funciona só com o sistema e corta textos longos', () => {
    expect(characterImagePrompt({ system: 'Tormenta20' })).toContain('Tormenta20');
    expect(characterImagePrompt({ system: 'X', backstory: 'a'.repeat(2000) }).length).toBeLessThan(800);
  });
});
