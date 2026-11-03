import { describe, expect, it } from 'vitest';
import { parseTriangleBookPack } from './pack';

describe('pacote do livro Triangle Agency', () => {
  it('valida entradas e separa as inválidas', () => {
    const result = parseTriangleBookPack({
      format: 'codexveil.triangle-agency.book',
      version: 1,
      book: {
        id: 'triangle-agency',
        name: 'Triangle Agency',
        category: 'core',
        edition: 'Primeira edição',
        origin: 'PDF do usuário',
      },
      entries: [
        {
          kind: 'section',
          key: 'pagina-1',
          name: 'Página 1',
          data: { chapter: 'O RPG', order: 0, page: 1, body: 'Texto' },
        },
        { kind: 'requisition', key: 'x', name: 'X', data: { page: -1, body: '' } },
      ],
    });
    expect(result.pack.entries).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
  });
});
