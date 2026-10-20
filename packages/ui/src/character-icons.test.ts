import { describe, expect, it } from 'vitest';
import { characterIcons, findCharacterIcon } from './character-icons';

// Chaves das raças dos livros importados (PHB 2014, Monstros do Multiverso e Tormenta20).
const BOOK_SPECIES = [
  'anao', 'elfo', 'halfling', 'draconato', 'gnomo', 'meio-elfo', 'meio-orc', 'tiefling',
  'aarakocra', 'aasimar', 'bugurso', 'centauro', 'duergar', 'duplicantes', 'eladrin', 'elfo-marinho', 'fada', 'firbolg',
  'genasi-da-agua', 'genasi-do-ar', 'genasi-do-fogo', 'genasi-da-terra', 'githyanki', 'githzerai', 'gnomo-das-profundezas',
  'goblin', 'golias', 'hobgoblin', 'kenku', 'kobold', 'laparlonj', 'minotauro', 'morfos', 'orc', 'reptante', 'satiro',
  'shadar-kai', 'tabaxi', 'tortuga', 'tritao', 'yuan-ti',
  'dahllan', 'lefou', 'qareen', 'golem', 'hynne', 'kliren', 'medusa', 'osteon', 'sereia-tritao', 'silfide', 'suraggel', 'trog',
];

describe('ícones de raça', () => {
  it('nenhuma raça dos livros cai no ícone genérico de humano', () => {
    const human = characterIcons.species.human;
    for (const key of BOOK_SPECIES) {
      expect(findCharacterIcon('species', `livro:${key}`), key).not.toBe(human);
    }
    expect(findCharacterIcon('species', 'livro:humano')).toBe(human);
  });
});
