import { arcaneSceneDataUrl, type ArcaneSceneOptions } from '@codexveil/ui/scene';
import { cx } from '@/lib/cx';

/**
 * Paisagem arcana gerada pela semente (nome da campanha, do personagem…): cada uma tem a sua,
 * sempre no estilo do Codexveil. Ocupa o tamanho de `className` como `object-fit: cover`.
 */
export function ArcaneScene({ seed, className, options }: { seed: string; className?: string; options?: ArcaneSceneOptions }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG gerado no próprio app (data: URL), sem otimização a fazer.
    <img src={arcaneSceneDataUrl(seed, options)} alt="" aria-hidden="true" className={cx('block h-full w-full object-cover', className)} />
  );
}
