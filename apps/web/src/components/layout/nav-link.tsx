'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface NavLinkProps {
  href: Route;
  icon: ReactNode;
  label: string;
  variant: 'sidebar' | 'bottom';
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Link de navegação principal com estado ativo acessível (`aria-current`). */
export function NavLink({ href, icon, label, variant }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  if (variant === 'bottom') {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
          active ? 'text-fg-accent' : 'text-fg-muted hover:text-fg',
        )}
      >
        <span
          className={cx(
            'rounded-full px-4 py-1 transition-colors',
            active && 'bg-wine-700 text-parchment-50 shadow-[0_0_16px_-4px_rgb(107_59_198/0.9)]',
          )}
        >
          {icon}
        </span>
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={cx(
        'group relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors group-data-[collapsed=true]/shell:justify-center group-data-[collapsed=true]/shell:px-0',
        // Item ativo: pílula violeta com brilho suave (redesign "Grimório Arcano").
        active
          ? 'bg-gradient-to-r from-wine-700 to-wine-800 text-parchment-50 shadow-[0_0_20px_-6px_rgb(107_59_198/0.9)]'
          : 'text-fg-secondary hover:bg-hover hover:text-fg',
      )}
    >
      <span className={active ? 'text-parchment-50' : 'text-fg-muted group-hover:text-wine-300'}>
        {icon}
      </span>
      <span className="truncate group-data-[collapsed=true]/shell:sr-only">{label}</span>
    </Link>
  );
}
