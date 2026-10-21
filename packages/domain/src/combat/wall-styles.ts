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
