import { describe, expect, it } from 'vitest';
import { characterTokenPrompt } from './image-prompt';

describe('prompt do token', () => {
  it('pede para usar a imagem anexada e gerar um token redondo', () => {
    const prompt = characterTokenPrompt({ system: 'Tormenta20', name: 'Gambiarra', species: 'Goblin', className: 'Inventor' });
    expect(prompt).toContain('imagem anexada');
    expect(prompt).toContain('Gambiarra (Goblin Inventor, Tormenta20)');
    expect(prompt).toContain('token redondo');
  });
});
