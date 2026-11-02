import { describe, expect, it } from 'vitest';
import { replaceableAiHighlightIds } from './highlights';

describe('Melhores Momentos', () => {
  it('substitui só cartões automáticos sem imagem e nunca editados', () => {
    expect(
      replaceableAiHighlightIds([
        {
          id: 'intacto',
          imagePath: null,
          createdAt: '2026-11-02T12:00:00.000Z',
          updatedAt: '2026-11-02T12:00:00.000Z',
        },
        {
          id: 'com-imagem',
          imagePath: 'campanha/sessao/momento.webp',
          createdAt: '2026-11-02T12:00:00.000Z',
          updatedAt: '2026-11-02T12:00:00.000Z',
        },
        {
          id: 'editado',
          imagePath: null,
          createdAt: '2026-11-02T12:00:00.000Z',
          updatedAt: '2026-11-02T12:01:00.000Z',
        },
        {
          id: 'data-inválida',
          imagePath: null,
          createdAt: 'inválida',
          updatedAt: 'inválida',
        },
      ]),
    ).toEqual(['intacto']);
  });
});
