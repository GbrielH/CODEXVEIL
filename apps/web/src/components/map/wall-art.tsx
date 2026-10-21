import type { Wall } from '@codexveil/database';
import type { WallStyle } from '@codexveil/domain';

/** Espessura da parede em quadrados. */
const THICKNESS: Record<WallStyle, number> = {
  stone: 0.32,
  brick: 0.3,
  ruin: 0.3,
  wood: 0.22,
  sandstone: 0.34,
  hedge: 0.36,
  iron: 0.12,
  invisible: 0.08,
};

/** Texturas das paredes (em quadrados; acompanham a direção de cada parede). */
export function WallPatterns({ uid }: { uid: string }) {
  return (
    <>
      <pattern id={`parede-stone-${uid}`} width="0.5" height="0.32" patternUnits="userSpaceOnUse">
        <rect width="0.5" height="0.32" fill="#77736b" />
        <path d="M0 0.16H0.5M0.25 0V0.16M0 0.16V0.32M0.5 0.16V0.32" stroke="#4a4740" strokeWidth="0.025" />
        <rect x="0.04" y="0.03" width="0.17" height="0.1" fill="#8a867d" opacity="0.6" />
      </pattern>
      <pattern id={`parede-brick-${uid}`} width="0.4" height="0.3" patternUnits="userSpaceOnUse">
        <rect width="0.4" height="0.3" fill="#9b4a32" />
        <path d="M0 0.15H0.4M0.2 0V0.15M0.1 0.15V0.3M0.3 0.15V0.3" stroke="#d8c7a8" strokeWidth="0.025" />
      </pattern>
      <pattern id={`parede-ruin-${uid}`} width="0.6" height="0.3" patternUnits="userSpaceOnUse">
        <rect width="0.6" height="0.3" fill="#6b675f" />
        <path d="M0 0.12L0.2 0.18L0.35 0.08L0.6 0.2" stroke="#3d3a34" strokeWidth="0.03" fill="none" />
        <circle cx="0.45" cy="0.24" r="0.04" fill="#4f6b3a" />
        <circle cx="0.1" cy="0.05" r="0.03" fill="#4f6b3a" />
      </pattern>
      <pattern id={`parede-wood-${uid}`} width="0.6" height="0.22" patternUnits="userSpaceOnUse">
        <rect width="0.6" height="0.22" fill="#7a4f2c" />
        <path d="M0 0.07H0.6M0 0.15H0.6" stroke="#5a3820" strokeWidth="0.018" />
        <path d="M0.3 0V0.22" stroke="#3f2715" strokeWidth="0.025" />
      </pattern>
      <pattern id={`parede-sandstone-${uid}`} width="0.5" height="0.34" patternUnits="userSpaceOnUse">
        <rect width="0.5" height="0.34" fill="#c9a66b" />
        <path d="M0 0.12H0.5M0 0.24H0.5" stroke="#a9844d" strokeWidth="0.02" />
        <circle cx="0.12" cy="0.06" r="0.015" fill="#8f6c3a" />
        <circle cx="0.37" cy="0.19" r="0.015" fill="#8f6c3a" />
        <circle cx="0.22" cy="0.29" r="0.012" fill="#8f6c3a" />
      </pattern>
      <pattern id={`parede-hedge-${uid}`} width="0.36" height="0.36" patternUnits="userSpaceOnUse">
        <rect width="0.36" height="0.36" fill="#2f5a2a" />
        <circle cx="0.09" cy="0.1" r="0.09" fill="#3f7536" />
        <circle cx="0.27" cy="0.22" r="0.1" fill="#3a6c32" />
        <circle cx="0.12" cy="0.3" r="0.06" fill="#4b8541" />
      </pattern>
    </>
  );
}

/**
 * Uma parede desenhada no estilo escolhido. Invisível só aparece para o mestre (tracejada);
 * a grade de ferro é desenhada como barras (não bloqueia a visão).
 */
export function WallShape({ wall, uid, isGm }: { wall: Wall; uid: string; isGm: boolean }) {
  const [x1, y1, x2, y2, style] = wall;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const thickness = THICKNESS[style];
  if (style === 'invisible') {
    return isGm ? <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9fd3ff" strokeWidth={0.07} strokeDasharray="0.18 0.12" opacity={0.8} /> : null;
  }
  return (
    <g transform={`translate(${x1} ${y1}) rotate(${angle})`}>
      {style === 'iron' ? (
        <>
          <rect x={0} y={-thickness / 2} width={length} height={thickness} fill="none" stroke="#3a3d42" strokeWidth={0.04} />
          {Array.from({ length: Math.max(2, Math.round(length / 0.25)) + 1 }, (_, index) => {
            const bars = Math.max(2, Math.round(length / 0.25));
            const bx = (index / bars) * length;
            return <line key={index} x1={bx} y1={-0.18} x2={bx} y2={0.18} stroke="#55595f" strokeWidth={0.05} strokeLinecap="round" />;
          })}
        </>
      ) : (
        <rect
          x={-thickness / 4}
          y={-thickness / 2}
          width={length + thickness / 2}
          height={thickness}
          rx={style === 'hedge' ? thickness / 2 : 0.03}
          fill={`url(#parede-${style}-${uid})`}
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={0.03}
          strokeDasharray={style === 'ruin' ? `${Math.max(0.4, length / 3)} 0.18` : undefined}
        />
      )}
    </g>
  );
}
