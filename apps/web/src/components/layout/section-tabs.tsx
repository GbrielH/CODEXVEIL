'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/cx';

export interface SectionTab {
  href: Route;
  label: string;
  /** Marca como ativa apenas na rota exata (para a aba "visão geral"). */
  exact?: boolean;
}

/** Abas de navegação entre seções de uma página (rolam horizontalmente no celular). */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  '-mb-px flex h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors',
                  active
                    ? 'border-parchment-300 text-fg-accent'
                    : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
