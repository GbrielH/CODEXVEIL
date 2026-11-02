import { describe, expect, it } from 'vitest';
import { mapLightCells, parseMapLights } from './map-lighting';

describe('luz do mapa', () => {
  it('lê somente fontes válidas', () => {
    expect(parseMapLights([{ id: 'a', kind: 'torch', x: 2, y: 2, brightRadius: 2, dimRadius: 4 }, { id: 'b', kind: 'sun', x: 0, y: 0, brightRadius: 1, dimRadius: 2 }])).toHaveLength(1);
  });

  it('separa luz plena, penumbra e escuridão e respeita parede', () => {
    const cells = mapLightCells({ illumination: 'dark', cols: 6, rows: 3, walls: [[3, 0, 3, 3, 'stone']], lights: [{ id: 'a', kind: 'torch', x: 1.5, y: 1.5, brightRadius: 0.9, dimRadius: 5 }] });
    expect(cells.get('1,1')).toBe('bright');
    expect(cells.get('2,1')).toBe('dim');
    expect(cells.get('4,1')).toBe('dark');
  });

  it('visão no escuro transforma escuridão em penumbra', () => {
    const cells = mapLightCells({ illumination: 'dark', cols: 4, rows: 2, walls: [], lights: [], darkvision: { x: 0.5, y: 0.5, radius: 2 } });
    expect(cells.get('1,0')).toBe('dim');
    expect(cells.get('3,0')).toBe('dark');
  });
});
