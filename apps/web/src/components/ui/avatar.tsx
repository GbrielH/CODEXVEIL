import { cx } from '@/lib/cx';

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg' } as const;

export function initialsOf(name: string): string {
  const parts = name
    .replace(/\[[^\]]*\]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}

/** Iniciais do usuário sobre o vinho da identidade (o Codexveil não usa foto de perfil). */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const classes = cx(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong',
    sizes[size],
    className,
  );
  return (
    <span
      className={cx(classes, 'bg-wine-900 font-display font-semibold text-wine-200')}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
