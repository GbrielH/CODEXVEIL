import { ArcaneScene } from '@/components/brand/arcane-scene';
import { cx } from '@/lib/cx';

/**
 * Capa da campanha (URL assinada de curta duração do Storage privado) ou, sem imagem, uma
 * paisagem arcana gerada pelo nome (cada campanha tem a sua). O tamanho vem de `className`.
 */
export function CampaignCover({
  url,
  name,
  className,
  natural = false,
}: {
  url: string | null;
  name: string;
  className?: string;
  /**
   * A altura segue a proporção da imagem enviada (na largura toda): uma cópia invisível dá o
   * tamanho e a visível cobre por cima, recortando só se passar dos limites de `className`.
   */
  natural?: boolean;
}) {
  if (url && natural) {
    return (
      <span className={cx('relative block overflow-hidden bg-wine-950', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" aria-hidden="true" className="invisible block h-auto w-full" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </span>
    );
  }
  // Quem passa `absolute` (fundo de banner/cartão) não pode receber `relative`: no CSS do
  // Tailwind o `relative` vence e a capa voltava ao fluxo, esticando o banner.
  const position = className?.split(/\s+/).includes('absolute') ? '' : 'relative';
  if (url) {
    return (
      <span className={cx(position, 'block overflow-hidden bg-wine-950', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  // Sem capa: a paisagem arcana da própria campanha (gerada pelo nome).
  return (
    <span
      className={cx(position, 'block overflow-hidden bg-wine-950', className)}
      aria-hidden="true"
    >
      <ArcaneScene seed={name} />
    </span>
  );
}
