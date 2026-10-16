import { listSystems } from '@codexveil/rpg-systems';
import { BookOpenText, Crown, EyeOff, ScrollText, Smartphone, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Emblem, Wordmark } from '@/components/brand/emblem';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { Glyph } from '@/components/ui/glyph';
import { getSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
  status: 'available' | 'building';
}

const features: Feature[] = [
  {
    icon: <Users className="h-6 w-6" aria-hidden="true" />,
    title: 'Campanhas e convites',
    description:
      'Crie campanhas, convide jogadores por código ou link e defina quem é mestre e quem é jogador em cada mesa.',
    status: 'available',
  },
  {
    icon: <Glyph name="d20" className="h-6 w-6" />,
    title: 'Fichas de D&D 5e',
    description:
      'Atributos, perícias, vida e recursos calculados pelas regras do SRD 5.2, com alterações salvas com segurança.',
    status: 'building',
  },
  {
    icon: <Crown className="h-6 w-6" aria-hidden="true" />,
    title: 'Painel do mestre',
    description:
      'Estado do grupo, NPCs e monstros da cena e uma ordem de iniciativa para conduzir a sessão sem trocar de tela.',
    status: 'building',
  },
  {
    icon: <EyeOff className="h-6 w-6" aria-hidden="true" />,
    title: 'Roteiros com segredos protegidos',
    description:
      'Prepare sessões em blocos e marque notas como privadas: o banco de dados nunca as envia aos jogadores.',
    status: 'building',
  },
];

const steps = [
  {
    icon: <ScrollText className="h-5 w-5" aria-hidden="true" />,
    title: 'Abra o grimório',
    text: 'Crie sua conta e uma campanha com o sistema de RPG da mesa.',
  },
  {
    icon: <Users className="h-5 w-5" aria-hidden="true" />,
    title: 'Reúna o grupo',
    text: 'Compartilhe um convite; cada jogador entra com a própria conta.',
  },
  {
    icon: <BookOpenText className="h-5 w-5" aria-hidden="true" />,
    title: 'Conduza a história',
    text: 'Fichas, notas e roteiros organizados num só lugar, no navegador ou no celular.',
  },
];

export default async function HomePage() {
  const user = await getSessionUser();
  const systems = listSystems();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Wordmark size="sm" />
        <nav aria-label="Acesso" className="flex items-center gap-2">
          {user ? (
            <ButtonLink href={routes.dashboard} size="sm">
              Abrir painel
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href={routes.signIn} variant="ghost" size="sm">
                Entrar
              </ButtonLink>
              <ButtonLink href={routes.signUp} size="sm">
                Criar conta
              </ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main id="conteudo" className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div className="animate-fade-up">
            <p className="eyebrow">Gerenciador de campanhas de RPG de mesa</p>
            <h1 className="mt-4 text-4xl leading-[1.1] sm:text-5xl">
              Campanhas, fichas e segredos do mestre num só grimório.
            </h1>
            <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-fg-secondary">
              O Codexveil reúne o que hoje fica espalhado entre documentos, planilhas e mensagens:
              quem está na mesa, como estão os personagens e o que o mestre ainda não revelou.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <ButtonLink href={routes.dashboard} size="lg">
                  Continuar de onde parei
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href={routes.signUp} size="lg">
                    Criar conta gratuita
                  </ButtonLink>
                  <ButtonLink href={routes.signIn} variant="secondary" size="lg">
                    Já tenho conta
                  </ButtonLink>
                </>
              )}
            </div>
            <p className="mt-6 text-sm text-fg-muted">
              Sistemas suportados: {systems.map((system) => system.name).join(', ')}.
            </p>
          </div>

          <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center" aria-hidden="true">
            <div className="absolute inset-0 rounded-full border border-parchment-400/15" />
            <div className="absolute inset-8 rounded-full border border-dashed border-wine-400/25" />
            <div className="absolute inset-16 rounded-full bg-wine-900/40 blur-2xl" />
            <Emblem className="emblem-glow relative h-48 w-48 sm:h-56 sm:w-56" />
          </div>
        </section>

        <section aria-labelledby="recursos" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <Divider label="O que há no códex" className="mb-10" />
          <h2 id="recursos" className="sr-only">
            Recursos
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature.title} className="ornate rounded-lg border border-line bg-card p-6 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-fg-brand">{feature.icon}</span>
                  {feature.status === 'building' ? <Badge tone="parchment">Em construção</Badge> : null}
                </div>
                <h3 className="mt-4 text-lg">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="como-funciona" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <h2 id="como-funciona" className="text-center text-2xl">
            Como funciona
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-parchment-400/40 font-display text-fg-accent">
                  {index + 1}
                </span>
                <div>
                  <p className="flex items-center gap-2 font-semibold text-fg">
                    <span className="text-fg-brand">{step.icon}</span>
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm text-fg-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-10 flex items-center justify-center gap-2 text-sm text-fg-muted">
            <Smartphone className="h-4 w-4" aria-hidden="true" />O site funciona no celular e pode ser
            instalado como aplicativo; há também um app Android em desenvolvimento.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Codexveil. Conteúdo de regras sob CC-BY-4.0 (SRD 5.2).</p>
          <a href={routes.licenses} className="underline decoration-line-strong underline-offset-4 hover:text-fg">
            Licenças e atribuições
          </a>
        </div>
      </footer>
    </div>
  );
}
