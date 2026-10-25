/** Estilos de parede da grade da sessão (desenho e se bloqueiam a linha de visão). */
export const WALL_STYLES = [
  { id: 'stone', label: 'Pedra', blocksSight: true },
  { id: 'brick', label: 'Tijolo', blocksSight: true },
  { id: 'ruin', label: 'Ruína', blocksSight: true },
  { id: 'wood', label: 'Madeira', blocksSight: true },
  { id: 'sandstone', label: 'Deserto (arenito)', blocksSight: true },
  { id: 'hedge', label: 'Cerca viva', blocksSight: true },
  { id: 'iron', label: 'Grade de ferro', blocksSight: false },
  { id: 'invisible', label: 'Invisível (só bloqueia a visão)', blocksSight: true },
] as const;

export type WallStyle = (typeof WALL_STYLES)[number]['id'];

export function isWallStyle(value: unknown): value is WallStyle {
  return typeof value === 'string' && WALL_STYLES.some((style) => style.id === value);
}

export function wallBlocksSight(style: WallStyle): boolean {
  return WALL_STYLES.find((entry) => entry.id === style)?.blocksSight ?? true;
}

/** Paredes impedem a passagem dos tokens, menos a invisível (que só bloqueia a visão). */
export function wallBlocksMovement(style: WallStyle): boolean {
  return style !== 'invisible';
}

type Pt = { x: number; y: number };

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** `p` (já alinhado com `s–e`) está dentro do segmento. */
function onSegment(s: Pt, e: Pt, p: Pt): boolean {
  return (
    Math.min(s.x, e.x) <= p.x &&
    p.x <= Math.max(s.x, e.x) &&
    Math.min(s.y, e.y) <= p.y &&
    p.y <= Math.max(s.y, e.y)
  );
}

/** Os segmentos `a1–a2` e `b1–b2` se cruzam ou se tocam (passar pela ponta da parede conta). */
function segmentsCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true;
  return (
    (d1 === 0 && onSegment(b1, b2, a1)) ||
    (d2 === 0 && onSegment(b1, b2, a2)) ||
    (d3 === 0 && onSegment(a1, a2, b1)) ||
    (d4 === 0 && onSegment(a1, a2, b2))
  );
}

/**
 * Um movimento em linha reta de `from` a `to` (centros, em quadrados) atravessa alguma parede
 * que impede a passagem? Paredes são `[x1, y1, x2, y2, estilo]` nas quinas da grade.
 */
export function movementCrossesWall(
  walls: readonly (readonly [number, number, number, number, WallStyle])[],
  from: Pt,
  to: Pt,
): boolean {
  return walls.some(
    ([x1, y1, x2, y2, style]) =>
      wallBlocksMovement(style) && segmentsCross(from, to, { x: x1, y: y1 }, { x: x2, y: y2 }),
  );
}
