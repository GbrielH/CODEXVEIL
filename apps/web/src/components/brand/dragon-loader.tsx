import { cx } from '@/lib/cx';

/**
 * Carregamento temático: o dragão em pixel art animado em loop (`public/mestre/carregando.webp`,
 * convertido do GIF do responsável para WebP sem perdas: 1,3 MB em vez de 4 MB). A arte é
 * desenhada com `pixelated` para não borrar. Um WebP animado não pode ser pausado pelo CSS; por
 * isso, para quem prefere movimento reduzido, a imagem some e fica só o texto.
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
      {/* eslint-disable-next-line @next/next/no-img-element -- WebP animado: a otimização do next/image congelaria a animação. */}
      <img
        src="/mestre/carregando.webp"
        alt=""
        aria-hidden="true"
        width={260}
        height={313}
        decoding="async"
        className={cx('h-auto [image-rendering:pixelated] motion-reduce:hidden [[data-motion=reduce]_&]:hidden', size === 'sm' ? 'w-24' : size === 'lg' ? 'w-64' : 'w-40')}
      />
      <span className="font-display text-sm tracking-[0.2em] uppercase">{label}</span>
    </div>
  );
}
