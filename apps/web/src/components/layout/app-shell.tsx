import { LayoutDashboard, LogOut, ScrollText, Swords, UserRound } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutAction } from '@/app/(auth)/actions';
import { Emblem, Wordmark } from '@/components/brand/emblem';
import { Avatar } from '@/components/ui/avatar';
import { routes } from '@/lib/routes';
import { NavLink } from './nav-link';

interface NavItem {
  href: Route;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { href: routes.dashboard, label: 'Painel', icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" /> },
  { href: routes.campaigns, label: 'Campanhas', icon: <ScrollText className="h-5 w-5" aria-hidden="true" /> },
  { href: routes.characters, label: 'Personagens', icon: <Swords className="h-5 w-5" aria-hidden="true" /> },
  { href: routes.profile, label: 'Perfil', icon: <UserRound className="h-5 w-5" aria-hidden="true" /> },
];

interface AppShellProps {
  displayName: string;
  avatarUrl: string | null;
  motion: 'system' | 'reduce';
  children: ReactNode;
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={
          compact
            ? 'flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg'
            : 'flex h-9 items-center gap-2 rounded-md px-2 text-sm text-fg-muted hover:bg-hover hover:text-fg'
        }
        aria-label={compact ? 'Sair da conta' : undefined}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {compact ? null : 'Sair'}
      </button>
    </form>
  );
}

/**
 * Estrutura das áreas autenticadas: barra lateral no desktop e navegação inferior no
 * celular (alvos de toque de 56 px), com o conteúdo principal ao centro.
 */
export function AppShell({ displayName, avatarUrl, motion, children }: AppShellProps) {
  return (
    <div data-motion={motion} className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-raised/80 backdrop-blur lg:flex">
        <div className="px-5 py-6">
          <Link href={routes.dashboard} aria-label="Codexveil — painel">
            <Wordmark size="sm" />
          </Link>
        </div>
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} variant="sidebar" />
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-line px-4 py-4">
          <Avatar name={displayName} src={avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
          <Link href={routes.dashboard} className="flex items-center gap-2" aria-label="Codexveil — painel">
            <Emblem className="h-7 w-7" />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-fg-accent">
              Codexveil
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Avatar name={displayName} src={avatarUrl} size="sm" />
            <SignOutButton compact />
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {children}
        </main>

        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} variant="bottom" />
          ))}
        </nav>
      </div>
    </div>
  );
}
