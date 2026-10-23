import { cx } from '@/lib/cx';

/** Montanha rochosa (viewBox 0 0 140 200): a encosta esquerda esconde o corte da arte do dragão. */
const MOUNTAIN =
  'M0 200 L3 168 L9 150 L5 128 L13 110 L9 92 L17 74 L14 58 L22 44 L20 32 L29 20 L36 6 L41 0 L47 9 L53 5 L60 18 L66 16 L74 32 L84 30 L92 48 L104 54 L112 72 L126 80 L140 96 L140 200 Z';
const RIM = 'M3 168 L9 150 L5 128 L13 110 L9 92 L17 74 L14 58 L22 44 L20 32 L29 20 L36 6 L41 0 L47 9';
const SNOW = 'M29 20 L36 6 L41 0 L47 9 L53 5 L60 18 L54 15 L49 21 L43 13 L37 22 L33 18 Z';
const CRACKS = 'M30 40 L38 62 L34 80 M52 30 L60 58 M44 90 L58 120 L54 150 M78 70 L86 100 M24 120 L32 146';

/**
 * Carregamento temático: o dragão em pixel art animado em loop (`public/mestre/carregando.webp`,
 * convertido do GIF do responsável para WebP sem perdas: 1,3 MB em vez de 4 MB), espiando de
 * trás de uma montanha (a arte original termina cortada na direita). A arte é desenhada com
 * `pixelated` para não borrar. Um WebP animado não pode ser pausado pelo CSS; por isso, para quem
 * prefere movimento reduzido, a imagem some e fica só o texto.
 */
export function DragonLoader({
  label = 'Carregando…',
  size = 'md',
  className,
}: {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div role="status" className={cx('flex flex-col items-center justify-center gap-3 py-10 text-fg-secondary', className)}>
      {/* A margem direita reserva espaço para a montanha (~56% da largura do dragão). */}
      <div
        aria-hidden="true"
        className={cx(
          'relative motion-reduce:hidden [[data-motion=reduce]_&]:hidden',
          size === 'sm' ? 'mr-14 w-24' : size === 'lg' ? 'mr-36 w-64' : 'mr-24 w-40',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- WebP animado: a otimização do next/image congelaria a animação. */}
        <img src="/mestre/carregando.webp" alt="" width={260} height={313} decoding="async" className="block h-auto w-full [image-rendering:pixelated]" />
        <svg viewBox="0 0 140 200" preserveAspectRatio="none" className="absolute" style={{ left: '84%', top: '-8%', width: '72%', height: '116%' }}>
          <defs>
            <linearGradient id="dragon-rock" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#2C1760" />
              <stop offset="0.35" stopColor="#1D0F3D" />
              <stop offset="1" stopColor="var(--color-canvas)" />
            </linearGradient>
            <linearGradient id="dragon-rock-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.6" stopColor="var(--color-canvas)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--color-canvas)" />
            </linearGradient>
          </defs>
          <path d={MOUNTAIN} fill="url(#dragon-rock)" />
          <path d={CRACKS} fill="none" stroke="#07070A" strokeWidth="1.4" opacity="0.7" />
          <path d={SNOW} fill="#E4D7CC" opacity="0.9" />
          <path d={RIM} fill="none" stroke="#A88BFF" strokeWidth="1.6" strokeLinejoin="round" opacity="0.85" vectorEffect="non-scaling-stroke" />
          <rect width="140" height="200" fill="url(#dragon-rock-fade)" />
        </svg>
      </div>
      <span className="font-display text-sm tracking-[0.2em] uppercase">{label}</span>
    </div>
  );
}
