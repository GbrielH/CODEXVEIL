import { GAME_ICONS_VIEWBOX, findBackgroundIcon, findCharacterIcon } from '@codexveil/ui/character-icons';
import { cx } from '@/lib/cx';

/** Ícone da classe ou espécie (game-icons.net, CC BY 3.0), na cor do texto. */
export function CharacterIcon({ kind, id, className }: { kind: 'class' | 'species' | 'background'; id: string; className?: string }) {
  // Antecedente: `id` é o nome ("Acólito"); sem ícone próprio, usa o genérico.
  const icon = kind === 'background' ? findBackgroundIcon(id) : findCharacterIcon(kind, id);
  if (!icon) return null;
  return (
    <svg viewBox={GAME_ICONS_VIEWBOX} className={cx('h-10 w-10 shrink-0 fill-current', className)} aria-hidden="true">
      <path d={icon.d} />
    </svg>
  );
}
