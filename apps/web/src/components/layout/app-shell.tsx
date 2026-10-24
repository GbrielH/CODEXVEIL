import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  Puzzle,
  ScrollText,
  Swords,
  UserRound,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutAction } from '@/app/(auth)/actions';
import { Emblem, Wordmark } from '@/components/brand/emblem';
import { EmberField } from '@/components/brand/ember-field';
import { Avatar } from '@/components/ui/avatar';
import { routes } from '@/lib/routes';
import { AssistantCard } from './assistant-card';
import { NavLink } from './nav-link';
import { ShellFrame, SidebarToggle } from './shell-frame';
import { TopBar, type SearchEntry } from './top-bar';

interface NavItem {
  href: Route;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    href: routes.dashboard,
    label: 'Painel',
    icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: routes.campaigns,
    label: 'Campanhas',
    icon: <ScrollText className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: routes.characters,
    label: 'Personagens',
    icon: <Swords className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: routes.books,
    label: 'Meus livros',
    icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: routes.community,
    label: 'Comunidade',
    icon: <Puzzle className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: routes.profile,
    label: 'Perfil',
    icon: <UserRound className="h-5 w-5" aria-hidden="true" />,
  },
];

interface AppShellProps {
  displayName: string;
  /** Mostra o card do assistente de IA (só com a chave configurada no servidor). */
  assistant?: boolean;
  /** Campanhas e personagens para a busca da barra superior. */
  search?: SearchEntry[];
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
export function AppShell({
  displayName,
  assistant = false,
  search = [],
  motion,
  children,
}: AppShellProps) {
  return (
    <ShellFrame motion={motion}>
      <EmberField />
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-raised/80 backdrop-blur lg:flex">
        <div className="flex items-center justify-between gap-2 px-5 py-6 group-data-[collapsed=true]/shell:flex-col group-data-[collapsed=true]/shell:px-2">
          <Link href={routes.dashboard} aria-label="Codexveil — painel">
            <span className="group-data-[collapsed=true]/shell:hidden">
              <Wordmark size="sm" />
            </span>
            <Emblem className="hidden h-8 w-8 group-data-[collapsed=true]/shell:block" />
          </Link>
          <SidebarToggle />
        </div>
        <nav
          aria-label="Navegação principal"
          className="flex flex-1 flex-col gap-1 px-3 group-data-[collapsed=true]/shell:px-2"
        >
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} variant="sidebar" />
          ))}
        </nav>
        {assistant ? (
          <div className="px-3 pb-3 group-data-[collapsed=true]/shell:px-2">
            <span className="group-data-[collapsed=true]/shell:hidden">
              <AssistantCard />
            </span>
            <span className="hidden group-data-[collapsed=true]/shell:block">
              <AssistantCard compact />
            </span>
          </div>
        ) : null}
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-line bg-card/70 px-3 py-3 group-data-[collapsed=true]/shell:mx-2 group-data-[collapsed=true]/shell:flex-col group-data-[collapsed=true]/shell:px-1">
          <span className="relative shrink-0">
            <Avatar name={displayName} size="sm" />
            <span
              className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400"
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0 flex-1 group-data-[collapsed=true]/shell:hidden">
            <p className="truncate text-sm font-medium text-fg">{displayName}</p>
            <p className="text-[11px] text-emerald-300/90">Online</p>
          </div>
          {/* Só o ícone de sair: o nome cabe inteiro no rodapé. */}
          <SignOutButton compact />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar entries={search} />
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
          <Link
            href={routes.dashboard}
            className="flex items-center gap-2"
            aria-label="Codexveil — painel"
          >
            <Emblem className="h-7 w-7" />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-fg-accent">
              Codexveil
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {assistant ? <AssistantCard compact /> : null}
            <Avatar name={displayName} size="sm" />
            <SignOutButton compact />
          </div>
        </header>

        <main
          id="conteudo"
          className="animate-fade-up w-full min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12 2xl:px-14"
        >
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
    </ShellFrame>
  );
}
