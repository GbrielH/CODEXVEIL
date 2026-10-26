import { describe, expect, it } from 'vitest';
import { edgePoint, parseBoardItems } from './board-items';

describe('quadro livre', () => {
  it('descarta blocos desconhecidos e setas soltas', () => {
    const items = parseBoardItems([
      { id: 'a', type: 'note', x: 0, y: 0, w: 10, h: 10, color: 'neon', text: 'Oi' },
      { id: 'b', type: 'frame', x: 300, y: 0, w: 200, h: 200, title: 'Ato 1' },
      { id: 'c', type: 'arrow', from: 'a', to: 'b' },
      { id: 'd', type: 'arrow', from: 'a', to: 'sumiu' },
      { id: 'e', type: 'video' },
      'lixo',
      { id: 'f', type: 'image', path: '../segredo.png' },
    ]);
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(items[0]).toMatchObject({ w: 60, h: 60, color: 'amber' });
  });

  it('aceita imagens só da pasta de quadros', () => {
    const path = 'campaigns/00000000-0000-4000-8000-000000000000/boards/abc.webp';
    expect(parseBoardItems([{ id: 'i', type: 'image', path, x: 0, y: 0, w: 300, h: 200 }])).toEqual([
      { id: 'i', type: 'image', path, x: 0, y: 0, w: 300, h: 200 },
    ]);
  });

  it('a seta encosta na borda do bloco', () => {
    expect(edgePoint({ id: 'a', x: 0, y: 0, w: 100, h: 50 }, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(edgePoint({ id: 'a', x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: -300 })).toEqual({ x: 50, y: 0 });
  });
});
