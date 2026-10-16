import Link from 'next/link';
import type { ReactNode } from 'react';
import { Emblem } from '@/components/brand/emblem';
import { routes } from '@/lib/routes';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href={routes.home} className="mb-8 flex flex-col items-center gap-3" aria-label="Codexveil — página inicial">
        <Emblem className="emblem-glow h-16 w-16" />
        <span className="font-display text-xl font-semibold uppercase tracking-[0.2em] text-fg-accent">
          Codexveil
        </span>
      </Link>
      <main id="conteudo" className="ornate w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-card sm:p-8">
        {children}
      </main>
    </div>
  );
}
