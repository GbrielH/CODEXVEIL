import type { AssimilacaoDie, RolledDie } from '@codexveil/rpg-systems/assimilacao';
import { useId } from 'react';
import { cx } from '@/lib/cx';

type Mark = 'sucesso' | 'adaptacao' | 'pressao';

const MARK_LABELS: Record<Mark, string> = {
  sucesso: 'Sucesso',
  adaptacao: 'Adaptação',
  pressao: 'Pressão',
};

/** Contorno de cada dado no espaço 0–100 (d6 quadrado, d10 em pipa, d12 pentágono). */
const SHAPES: Record<AssimilacaoDie, string> = {
  d6: 'M14 8 H86 Q92 8 92 14 V86 Q92 92 86 92 H14 Q8 92 8 86 V14 Q8 8 14 8 Z',
  d10: 'M50 4 L96 46 L84 84 L50 96 L16 84 L4 46 Z',
  d12: 'M50 4 L95 37 L78 92 L22 92 L5 37 Z',
};
/** Arestas internas (dão o volume do dado). */
const EDGES: Record<AssimilacaoDie, string> = {
  d6: '',
  d10: 'M50 4 L22 74 L50 96 M50 4 L78 74 L50 96 M22 74 L78 74 M4 46 L22 74 M96 46 L78 74',
  d12: 'M50 18 L80 40 L69 76 L31 76 L20 40 Z M50 4 L50 18 M95 37 L80 40 M78 92 L69 76 M22 92 L31 76 M5 37 L20 40',
};

/** Símbolos desenhados para o Codexveil (não são a arte do livro). */
function MarkGlyph({ mark, x, y, size }: { mark: Mark; x: number; y: number; size: number }) {
  const s = size / 24;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}>
      {mark === 'sucesso' ? (
        // Estrela de quatro pontas.
        <path
          d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z"
          fill="currentColor"
        />
      ) : mark === 'adaptacao' ? (
        // Espiral que se fecha: o corpo se adaptando.
        <path
          d="M12 3 A9 9 0 1 1 3.5 9 M12 7.5 A4.5 4.5 0 1 0 16.5 12 M3.5 9 L2 4.5 M3.5 9 L8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      ) : (
        // Garras: a pressão do ambiente.
        <path
          d="M5 3 L9 21 M12 2 L12 22 M19 3 L15 21"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

/** Posições dos símbolos conforme a quantidade (1 a 3) dentro do dado. */
const LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 52]],
  2: [
    [36, 54],
    [64, 54],
  ],
  3: [
    [50, 36],
    [34, 64],
    [66, 64],
  ],
};

/**
 * Face de um dado do Assimilação: azul-escuro com os símbolos brilhando. O dado mantido ganha
 * contorno dourado.
 */
export function AssimDieFace({
  die,
  kept = false,
  size = 64,
  className,
}: {
  die: RolledDie;
  kept?: boolean;
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const marks: Mark[] = [
    ...Array<Mark>(die.result.sucesso).fill('sucesso'),
    ...Array<Mark>(die.result.adaptacao).fill('adaptacao'),
    ...Array<Mark>(die.result.pressao).fill('pressao'),
  ].slice(0, 3);
  const label = marks.length
    ? `${die.die}: ${marks.map((mark) => MARK_LABELS[mark]).join(', ')}`
    : `${die.die}: face vazia`;
  const glyph = marks.length === 1 ? 34 : marks.length === 2 ? 26 : 22;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cx('overflow-visible text-parchment-50', className)}
    >
      <defs>
        <radialGradient id={`fundo-${id}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#1d4f86" />
          <stop offset="60%" stopColor="#0d2b52" />
          <stop offset="100%" stopColor="#050f1f" />
        </radialGradient>
        <filter id={`brilho-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={SHAPES[die.die]}
        fill={`url(#fundo-${id})`}
        stroke={kept ? '#e8c872' : '#02060d'}
        strokeWidth={kept ? 5 : 3}
        strokeLinejoin="round"
      />
      {EDGES[die.die] ? (
        <path
          d={EDGES[die.die]}
          fill="none"
          stroke="#5f8fc4"
          strokeOpacity={0.35}
          strokeWidth={1.2}
        />
      ) : (
        <path
          d="M22 78 L78 22"
          stroke="#7fb0e6"
          strokeOpacity={0.18}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      <g filter={`url(#brilho-${id})`}>
        {marks.map((mark, index) => {
          const [x, y] = LAYOUTS[marks.length]![index]!;
          return <MarkGlyph key={index} mark={mark} x={x} y={y} size={glyph} />;
        })}
      </g>
    </svg>
  );
}

/** Símbolo solto (legenda do resultado), no mesmo desenho dos dados. */
export function AssimMarkIcon({ mark, className }: { mark: Mark; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx('h-4 w-4', className)}
      role="img"
      aria-label={MARK_LABELS[mark]}
    >
      <MarkGlyph mark={mark} x={12} y={12} size={22} />
    </svg>
  );
}
