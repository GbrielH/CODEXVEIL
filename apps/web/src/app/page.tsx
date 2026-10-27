import { listSystems } from '@codexveil/rpg-systems';
import { BookOpenText, Crown, EyeOff, ScrollText, Smartphone, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArcaneScene } from '@/components/brand/arcane-scene';
import { ArcaneSigil } from '@/components/brand/arcane-sigil';
import { Wordmark } from '@/components/brand/emblem';
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
    <div className="relative isolate flex min-h-dvh flex-col">
      {/* Paisagem arcana atrás do cabeçalho e do destaque, esmaecida à esquerda para o texto. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] overflow-hidden" aria-hidden="true">
        <ArcaneScene seed="Sua campanha, seu mundo" options={{ noMoon: true }} />
        <span className="absolute inset-0 bg-gradient-to-r from-charcoal-950 via-charcoal-950/80 to-charcoal-950/20" />
        <span className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-canvas to-transparent" />
      </div>
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
            <p className="eyebrow text-wine-300">O grimório digital de RPG de mesa</p>
            <h1 className="mt-4 text-4xl leading-[1.1] [text-shadow:0_2px_24px_rgb(0_0_0/0.8)] sm:text-6xl">
              Sua campanha.
              <br />
              Seu mundo.
              <br />
              <span className="text-wine-300">Seus segredos.</span>
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

          {/* Tomo, o grimório mestre (mascote do redesign "Grimório Arcano"). */}
          <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center" aria-hidden="true">
            <div className="absolute inset-6 rounded-full bg-wine-700/25 blur-3xl" />
            {/* Encantamento: círculo arcano girando em volta do Tomo. */}
            <ArcaneSigil className="absolute -inset-[12%] h-[124%] w-[124%]" />
            <Image src="/mestre/heroi.webp" alt="" width={640} height={598} priority className="relative h-auto w-[74%] [mask-image:radial-gradient(closest-side,black_58%,transparent)]" />
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
          <p>© {new Date().getFullYear()} Codexveil. Conteúdo de regras sob CC-BY-4.0 (SRD 5.2.1).</p>
          <nav className="flex flex-wrap gap-4" aria-label="Transparência">
            <a href={routes.privacy} className="underline decoration-line-strong underline-offset-4 hover:text-fg">
              Privacidade
            </a>
            <a href={routes.terms} className="underline decoration-line-strong underline-offset-4 hover:text-fg">
              Termos de Uso
            </a>
            <a href={routes.licenses} className="underline decoration-line-strong underline-offset-4 hover:text-fg">
              Licenças e atribuições
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
