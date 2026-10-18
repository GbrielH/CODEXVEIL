import type { Route } from 'next';
import Link from 'next/link';
import { cx } from '@/lib/cx';
import { formatRelative } from '@/lib/format';
import { Portrait } from './portrait';

interface CharacterCardProps {
  href: Route;
  name: string;
  subtitle: string;
  portraitUrl: string | null;
  meta?: string | null;
  updatedAt?: string;
  className?: string;
}

export function CharacterCard({ href, name, subtitle, portraitUrl, meta, updatedAt, className }: CharacterCardProps) {
  return (
    <Link
      href={href}
      className={cx(
        'group flex h-full items-center gap-4 rounded-lg border border-line bg-card p-4 shadow-card transition-[transform,background-color,border-color,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:border-parchment-400/40 hover:bg-raised hover:shadow-glow',
        className,
      )}
    >
      <Portrait name={name} url={portraitUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg leading-tight text-fg-accent group-hover:text-parchment-100">
          {name}
        </p>
        <p className="truncate text-sm text-fg-secondary">{subtitle}</p>
        <p className="mt-1 truncate text-xs text-fg-muted">
          {meta}
          {meta && updatedAt ? ' · ' : null}
          {updatedAt ? `atualizado ${formatRelative(updatedAt)}` : null}
        </p>
      </div>
    </Link>
  );
}
