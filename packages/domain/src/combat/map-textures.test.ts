import { describe, expect, it } from 'vitest';
import { paintMapTexture, textureRectsFromCells, type MapDrawing } from './map-areas';

describe('texturas compactas do mapa', () => {
  it('une quadrados vizinhos em retângulos por textura', () => {
    const cells = new Map([
      ['0,0', 'stone' as const],
      ['1,0', 'stone' as const],
      ['0,1', 'stone' as const],
      ['1,1', 'stone' as const],
      ['2,0', 'water' as const],
    ]);
    expect(textureRectsFromCells(cells)).toEqual([
      { type: 'texture', x: 0, y: 0, width: 2, height: 2, texture: 'stone' },
      { type: 'texture', x: 2, y: 0, width: 1, height: 1, texture: 'water' },
    ]);
  });

  it('substitui a textura pintada e preserva os outros elementos', () => {
    const note: MapDrawing = { type: 'note', x: 1, y: 1, text: '1', color: '#fff' };
    const result = paintMapTexture(
      [note, { type: 'texture', x: 0, y: 0, width: 3, height: 2, texture: 'dirt' }],
      { x: 1, y: 0, width: 1, height: 2 },
      'water',
    );
    expect(result[0]).toBe(note);
    expect(result.filter((drawing) => drawing.type === 'texture')).toEqual([
      { type: 'texture', x: 0, y: 0, width: 1, height: 2, texture: 'dirt' },
      { type: 'texture', x: 1, y: 0, width: 1, height: 2, texture: 'water' },
      { type: 'texture', x: 2, y: 0, width: 1, height: 2, texture: 'dirt' },
    ]);
  });
});
