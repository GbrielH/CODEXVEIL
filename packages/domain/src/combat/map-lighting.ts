import { pointInPolygon, visibilityPolygon } from './map-geometry';
import { wallBlocksSight, type WallStyle } from './wall-styles';

export const MAP_ILLUMINATIONS = ['bright', 'dim', 'dark'] as const;
export type MapIllumination = (typeof MAP_ILLUMINATIONS)[number];
export const mapIlluminationLabels: Record<MapIllumination, string> = { bright: 'Clara', dim: 'Penumbra', dark: 'Escura' };

export const MAP_LIGHT_KINDS = ['torch', 'lantern'] as const;
export type MapLightKind = (typeof MAP_LIGHT_KINDS)[number];
export const mapLightLabels: Record<MapLightKind, string> = { torch: 'Tocha', lantern: 'Lanterna' };

export interface MapLight {
  id: string;
  kind: MapLightKind;
  x: number;
  y: number;
  brightRadius: number;
  dimRadius: number;
}

export type MapLightLevel = 'bright' | 'dim' | 'dark';
type Wall = [number, number, number, number, WallStyle];

export function parseMapLights(value: unknown): MapLight[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): MapLight[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || (row.kind !== 'torch' && row.kind !== 'lantern') || typeof row.x !== 'number' || typeof row.y !== 'number' || typeof row.brightRadius !== 'number' || typeof row.dimRadius !== 'number') return [];
    if (![row.x, row.y, row.brightRadius, row.dimRadius].every(Number.isFinite) || row.brightRadius < 0 || row.dimRadius < row.brightRadius) return [];
    return [{ id: row.id, kind: row.kind, x: row.x, y: row.y, brightRadius: row.brightRadius, dimRadius: row.dimRadius }];
  });
}

/** Iluminação de cada célula, incluindo fontes e visão no escuro do personagem. */
export function mapLightCells(input: {
  illumination: MapIllumination;
  cols: number;
  rows: number;
  walls: readonly Wall[];
  lights: readonly MapLight[];
  darkvision?: { x: number; y: number; radius: number } | null;
}): Map<string, MapLightLevel> {
  const result = new Map<string, MapLightLevel>();
  const blocking = input.walls.filter((wall) => wallBlocksSight(wall[4])).map(([x1, y1, x2, y2]) => [x1, y1, x2, y2] as [number, number, number, number]);
  const sources = input.lights.map((light) => ({ ...light, sight: visibilityPolygon({ x: light.x, y: light.y }, blocking, input.cols, input.rows, light.dimRadius) }));
  const darkvision = input.darkvision && input.darkvision.radius > 0
    ? { ...input.darkvision, sight: visibilityPolygon({ x: input.darkvision.x, y: input.darkvision.y }, blocking, input.cols, input.rows, input.darkvision.radius) }
    : null;
  for (let y = 0; y < input.rows; y += 1) for (let x = 0; x < input.cols; x += 1) {
    const key = `${x},${y}`;
    if (input.illumination === 'bright') { result.set(key, 'bright'); continue; }
    const point = { x: x + 0.5, y: y + 0.5 };
    let level: MapLightLevel = input.illumination === 'dim' ? 'dim' : 'dark';
    for (const source of sources) {
      if (!pointInPolygon(point, source.sight)) continue;
      const distance = Math.hypot(point.x - source.x, point.y - source.y);
      if (distance <= source.brightRadius) { level = 'bright'; break; }
      if (distance <= source.dimRadius) level = 'dim';
    }
    if (level === 'dark' && darkvision && pointInPolygon(point, darkvision.sight) && Math.hypot(point.x - darkvision.x, point.y - darkvision.y) <= darkvision.radius) level = 'dim';
    result.set(key, level);
  }
  return result;
}
