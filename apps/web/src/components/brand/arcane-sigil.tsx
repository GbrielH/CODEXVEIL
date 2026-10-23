import { cx } from '@/lib/cx';

/** Runas (glifos geométricos simples) distribuídas nos anéis do círculo. */
const RUNES = ['M-4 -6 L4 6 M4 -6 L-4 6', 'M0 -7 V7 M-5 -2 L0 -7 L5 -2', 'M-5 -6 H5 L-5 6 H5', 'M0 -7 L5 0 L0 7 L-5 0 Z', 'M-5 -6 V6 M-5 0 H4 M4 -6 V6', 'M0 -7 V7 M-5 4 L0 -1 L5 4'];

function runeRing(count: number, radius: number, size: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * 360;
    return (
      <g key={index} transform={`rotate(${angle}) translate(0 ${-radius}) scale(${size})`}>
        <path d={RUNES[index % RUNES.length]} />
      </g>
    );
  });
}

/**
 * Círculo arcano animado (encantamento): anéis com runas girando em sentidos opostos, um
 * triângulo e a estrela de quatro pontas no centro. Decorativo; para com movimento reduzido.
 */
export function ArcaneSigil({ className }: { className?: string }) {
  return (
    <svg viewBox="-200 -200 400 400" className={cx('arcane-sigil pointer-events-none text-wine-400', className)} aria-hidden="true">
      <defs>
        <radialGradient id="sigil-glow">
          <stop offset="0" stopColor="#6B3BC6" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#6B3BC6" stopOpacity="0.12" />
          <stop offset="1" stopColor="#6B3BC6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="200" fill="url(#sigil-glow)" />
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Anel externo: runas, gira no sentido horário */}
        <g className="sigil-spin-slow" opacity="0.85">
          <circle r="186" strokeWidth="1.2" />
          <circle r="166" strokeWidth="0.8" strokeDasharray="2 6" />
          <g strokeWidth="1.4">{runeRing(18, 176, 0.9)}</g>
        </g>
        {/* Anel do meio: triângulos entrelaçados, gira ao contrário */}
        <g className="sigil-spin-reverse" opacity="0.7">
          <circle r="140" strokeWidth="1" />
          <path d="M0 -140 L121 70 L-121 70 Z" strokeWidth="1" />
          <path d="M0 140 L121 -70 L-121 -70 Z" strokeWidth="1" />
          <g strokeWidth="1.2">{runeRing(6, 112, 0.75)}</g>
        </g>
        {/* Anel interno com marcas, gira rápido */}
        <g className="sigil-spin-fast" opacity="0.6">
          <circle r="78" strokeWidth="1" strokeDasharray="10 5 2 5" />
          <circle r="62" strokeWidth="0.8" />
        </g>
      </g>
      {/* Estrela de quatro pontas pulsando no centro */}
      <path className="sigil-pulse" d="M0 -34 L7 -7 L34 0 L7 7 L0 34 L-7 7 L-34 0 L-7 -7 Z" fill="#DCD0FF" />
    </svg>
  );
}
