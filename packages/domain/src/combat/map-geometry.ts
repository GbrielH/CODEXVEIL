/**
 * Geometria da grade da sessão (docs/GRID.md): névoa de guerra por células e linha de visão por
 * raios contra as paredes. Coordenadas em quadrados (1 quadrado = 1,5 m).
 */

/** [x, y, largura, altura] em quadrados. */
export type GridRect = [number, number, number, number];
/** [x1, y1, x2, y2] em quadrados (pontos nas interseções da grade). */
export type GridWall = [number, number, number, number];
export interface Point {
  x: number;
  y: number;
}

const key = (x: number, y: number) => `${x},${y}`;

/** Células reveladas a partir dos retângulos guardados. */
export function fogCells(rects: readonly GridRect[]): Set<string> {
  const cells = new Set<string>();
  for (const [x, y, w, h] of rects) {
    for (let cy = y; cy < y + h; cy += 1) for (let cx = x; cx < x + w; cx += 1) cells.add(key(cx, cy));
  }
  return cells;
}

/** Compacta células em faixas horizontais ([x, y, largura, 1]) para guardar no banco. */
export function rectsFromCells(cells: ReadonlySet<string>): GridRect[] {
  const byRow = new Map<number, number[]>();
  for (const cell of cells) {
    const [x, y] = cell.split(',').map(Number) as [number, number];
    const row = byRow.get(y) ?? [];
    row.push(x);
    byRow.set(y, row);
  }
  const rects: GridRect[] = [];
  for (const [y, xs] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    let start = xs[0]!;
    let previous = start;
    for (const x of xs.slice(1)) {
      if (x === previous + 1) {
        previous = x;
        continue;
      }
      rects.push([start, y, previous - start + 1, 1]);
      start = x;
      previous = x;
    }
    rects.push([start, y, previous - start + 1, 1]);
  }
  return rects;
}

/** Revela (ou volta a cobrir) um retângulo de células e devolve as áreas reveladas compactadas. */
export function paintFog(rects: readonly GridRect[], area: GridRect, reveal: boolean): GridRect[] {
  const cells = fogCells(rects);
  const [x, y, w, h] = area;
  for (let cy = y; cy < y + h; cy += 1) {
    for (let cx = x; cx < x + w; cx += 1) {
      if (reveal) cells.add(key(cx, cy));
      else cells.delete(key(cx, cy));
    }
  }
  return rectsFromCells(cells);
}

/** Retângulo normalizado entre duas células (inclusive), dentro da grade. */
export function cellRect(a: Point, b: Point, cols: number, rows: number): GridRect {
  const x1 = Math.max(0, Math.min(a.x, b.x));
  const y1 = Math.max(0, Math.min(a.y, b.y));
  const x2 = Math.min(cols - 1, Math.max(a.x, b.x));
  const y2 = Math.min(rows - 1, Math.max(a.y, b.y));
  return [x1, y1, x2 - x1 + 1, y2 - y1 + 1];
}

function raySegment(origin: Point, angle: number, wall: GridWall): number | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const [x1, y1, x2, y2] = wall;
  const sx = x2 - x1;
  const sy = y2 - y1;
  const denominator = dx * sy - dy * sx;
  if (Math.abs(denominator) < 1e-12) return null;
  const t = ((x1 - origin.x) * sy - (y1 - origin.y) * sx) / denominator;
  const u = ((x1 - origin.x) * dy - (y1 - origin.y) * dx) / denominator;
  return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
}

/**
 * Polígono de visão a partir de `origin` (centro do token), bloqueado pelas paredes e pelas
 * bordas do mapa. `radius` em quadrados (0 = sem limite).
 */
export function visibilityPolygon(origin: Point, walls: readonly GridWall[], cols: number, rows: number, radius = 0): Point[] {
  const borders: GridWall[] = [
    [0, 0, cols, 0],
    [cols, 0, cols, rows],
    [cols, rows, 0, rows],
    [0, rows, 0, 0],
  ];
  const segments = [...walls, ...borders];
  const angles = new Set<number>();
  for (const [x1, y1, x2, y2] of segments) {
    for (const [px, py] of [
      [x1, y1],
      [x2, y2],
    ] as const) {
      const angle = Math.atan2(py - origin.y, px - origin.x);
      angles.add(angle - 0.0001).add(angle).add(angle + 0.0001);
    }
  }
  // Raios extras em volta para o limite circular ficar redondo.
  const steps = radius > 0 ? 96 : 0;
  for (let index = 0; index < steps; index += 1) angles.add((index / steps) * Math.PI * 2 - Math.PI);

  const points: (Point & { angle: number })[] = [];
  for (const angle of angles) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const segment of segments) {
      const distance = raySegment(origin, angle, segment);
      if (distance !== null && distance < nearest) nearest = distance;
    }
    if (radius > 0) nearest = Math.min(nearest, radius);
    if (!Number.isFinite(nearest)) continue;
    points.push({ x: origin.x + Math.cos(angle) * nearest, y: origin.y + Math.sin(angle) * nearest, angle });
  }
  return points.sort((a, b) => a.angle - b.angle).map(({ x, y }) => ({ x, y }));
}

/** O ponto está dentro do polígono? (para esconder tokens fora da linha de visão) */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
