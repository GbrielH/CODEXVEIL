import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Emblem } from '@/components/brand/emblem';
import { routes } from '@/lib/routes';

/** Entrar, cadastro e senha: o Tomo à esquerda (telas largas) e o formulário à direita. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-[radial-gradient(90%_70%_at_40%_45%,rgb(107_59_198/0.35),transparent_70%),var(--color-charcoal-950)] lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-6 lg:p-12">
        <Image src="/mestre/heroi.webp" alt="Tomo, o grimório mestre do Codexveil" width={640} height={598} priority className="h-auto w-full max-w-lg [mask-image:radial-gradient(closest-side,black_62%,transparent)]" />
        <p className="text-center font-display text-sm tracking-[0.35em] text-parchment-300 uppercase">
          Suas campanhas,
          <br />
          sem limites
        </p>
      </aside>
      <div className="flex min-w-0 flex-col items-center justify-center px-4 py-10">
        <Link href={routes.home} className="mb-8 flex flex-col items-center gap-3" aria-label="Codexveil — página inicial">
          <Emblem className="emblem-glow h-16 w-16" />
          <span className="font-display text-xl font-semibold tracking-[0.2em] text-fg-accent uppercase">Codexveil</span>
        </Link>
        <main id="conteudo" className="ornate w-full max-w-md rounded-xl border border-line bg-card/90 p-6 shadow-card backdrop-blur sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
