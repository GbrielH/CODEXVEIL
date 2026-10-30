import { isAvatarPhoto, type AvatarIcon } from '@codexveil/validation';
import { cx } from '@/lib/cx';
import { AvatarIconArt } from './avatar-icons';

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
  /** Retrato escolhido no perfil; sem ele, as iniciais. */
  icon?: AvatarIcon | null | undefined;
}

/** Retrato, foto da conta Google (opcional) ou as iniciais sobre o vinho da identidade. */
export function Avatar({ name, size = 'md', className, icon }: AvatarProps) {
  const classes = cx(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong',
    sizes[size],
    className,
  );
  if (isAvatarPhoto(icon)) {
    return (
      <span className={cx(classes, 'border-transparent')} title={name}>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto da conta Google */}
        <img
          src={icon}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  if (icon) {
    return (
      <span className={cx(classes, 'border-transparent')} title={name}>
        <AvatarIconArt icon={icon} className="h-full w-full" />
      </span>
    );
  }
  return (
    <span
      className={cx(classes, 'bg-wine-900 font-display font-semibold text-wine-200')}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
