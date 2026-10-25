/**
 * Áreas de magia na grade (docs/GRID.md): círculo, cone e linha, medidas em metros
 * (1 quadrado = 1,5 m). Um quadrado é atingido quando o centro dele está dentro da forma.
 */
import { METERS_PER_SQUARE, type Point } from './map-geometry';

/** Área no mapa; `by` = jogador que a colocou (as do mestre não têm). */
export type MapArea = MapAreaShape & { by?: string };

type MapAreaShape =
  /** Círculo: centro numa interseção da grade e raio em metros. */
  | { kind: 'circle'; x: number; y: number; meters: number; color?: string }
  /** Cone: vértice, direção (graus) e comprimento; a largura no fim é igual ao comprimento. */
  | { kind: 'cone'; x: number; y: number; angle: number; meters: number; color?: string }
  /** Linha: origem, direção (graus), comprimento e 1,5 m de largura. */
  | { kind: 'line'; x: number; y: number; angle: number; meters: number; color?: string };

export const MAP_AREA_KINDS = [
  { kind: 'circle', label: 'Círculo' },
  { kind: 'cone', label: 'Cone' },
  { kind: 'line', label: 'Linha' },
] as const;

/** Meia abertura do cone: largura no fim = comprimento (≈ 53° no total). */
const CONE_HALF_ANGLE = Math.atan(0.5);

/** Arredonda para múltiplos de 1,5 m (mínimo 1,5 m). */
export function snapMeters(meters: number): number {
  return Math.max(METERS_PER_SQUARE, Math.round(meters / METERS_PER_SQUARE) * METERS_PER_SQUARE);
}

function insideArea(area: MapArea, point: Point): boolean {
  const reach = area.meters / METERS_PER_SQUARE;
  const dx = point.x - area.x;
  const dy = point.y - area.y;
  if (area.kind === 'circle') return dx * dx + dy * dy <= reach * reach + 1e-9;
  const angle = (area.angle * Math.PI) / 180;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  const across = -dx * Math.sin(angle) + dy * Math.cos(angle);
  if (along < 0 || along > reach + 1e-9) return false;
  if (area.kind === 'line') return Math.abs(across) <= 0.5 + 1e-9;
  return Math.abs(Math.atan2(across, along)) <= CONE_HALF_ANGLE + 1e-9;
}

/** Quadrados atingidos (por coluna e linha), dentro da grade. */
export function areaCells(area: MapArea, cols: number, rows: number): Point[] {
  const cells: Point[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) if (insideArea(area, { x: x + 0.5, y: y + 0.5 })) cells.push({ x, y });
  }
  return cells;
}

/** Contorno da forma (para desenhar): pontos do polígono em quadrados. */
export function areaOutline(area: MapArea): Point[] {
  const reach = area.meters / METERS_PER_SQUARE;
  if (area.kind === 'circle') {
    return Array.from({ length: 48 }, (_, index) => {
      const angle = (index / 48) * Math.PI * 2;
      return { x: area.x + Math.cos(angle) * reach, y: area.y + Math.sin(angle) * reach };
    });
  }
  const angle = (area.angle * Math.PI) / 180;
  const point = (along: number, across: number): Point => ({
    x: area.x + along * Math.cos(angle) - across * Math.sin(angle),
    y: area.y + along * Math.sin(angle) + across * Math.cos(angle),
  });
  if (area.kind === 'line') return [point(0, -0.5), point(reach, -0.5), point(reach, 0.5), point(0, 0.5)];
  return [point(0, 0), point(reach, -reach / 2), point(reach, reach / 2)];
}

export function isMapArea(value: unknown): value is MapArea {
  if (!value || typeof value !== 'object') return false;
  const area = value as Record<string, unknown>;
  const numbers = ['x', 'y', 'meters'].every((key) => typeof area[key] === 'number');
  if (!numbers) return false;
  if (area.kind === 'circle') return true;
  return (area.kind === 'cone' || area.kind === 'line') && typeof area.angle === 'number';
}

/** Desenho livre (traço) ou anotação de texto no mapa, em quadrados. */
export type MapDrawing =
  | { type: 'path'; points: [number, number][]; color: string }
  | { type: 'note'; x: number; y: number; text: string; color: string };

export const DRAWING_COLORS = ['#f3e2b3', '#e04040', '#4fc3d9', '#9bbf3a', '#e8862a', '#a46bd6'] as const;

export function isMapDrawing(value: unknown): value is MapDrawing {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (typeof item.color !== 'string') return false;
  if (item.type === 'note') return typeof item.x === 'number' && typeof item.y === 'number' && typeof item.text === 'string';
  return item.type === 'path' && Array.isArray(item.points) && item.points.every((point) => Array.isArray(point) && point.length === 2 && point.every((n) => typeof n === 'number'));
}
