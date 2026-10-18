import { ScrollText } from 'lucide-react';
import { initialsOf } from '@/components/ui/avatar';
import { cx } from '@/lib/cx';

/**
 * Capa da campanha (URL assinada de curta duração do Storage privado) ou, sem imagem, um
 * fundo com as iniciais no visual do Codexveil. O tamanho vem de `className`.
 */
export function CampaignCover({ url, name, className }: { url: string | null; name: string; className?: string }) {
  if (url) {
    return (
      <span className={cx('relative block overflow-hidden bg-wine-950', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className={cx(
        'relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgb(120_36_52/0.55),transparent_60%),linear-gradient(135deg,rgb(40_14_22),rgb(18_14_20))]',
        className,
      )}
      aria-hidden="true"
    >
      <ScrollText className="absolute right-3 bottom-3 h-6 w-6 text-parchment-300/25" />
      <span className="font-display text-4xl font-semibold text-parchment-300/70">{name.trim() ? initialsOf(name) : '?'}</span>
    </span>
  );
}
