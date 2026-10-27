import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand/emblem';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Termos de Uso' };

/** Termos de Uso públicos (pedidos pelo Google para o login com Google). */
export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href={routes.home} className="inline-flex">
        <Wordmark size="sm" />
      </Link>
      <main id="conteudo" className="mt-10 flex flex-col gap-6">
        <PageHeader eyebrow="Transparência" title="Termos de Uso" description="Atualizados em 27 de outubro de 2026." />
        <Card ornate>
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-fg-secondary [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-fg">
            <p>Ao usar o Codexveil (site e aplicativo), você concorda com estes termos.</p>

            <h2>O serviço</h2>
            <p>
              Plataforma gratuita para organizar e jogar RPG de mesa: campanhas, fichas, sessões, mapas, dados e um assistente de
              IA. O serviço é oferecido como está, pode mudar ou ficar fora do ar, e não garantimos que funcione sem falhas.
            </p>

            <h2>Sua conta</h2>
            <p>
              Você é responsável pelo que faz com a sua conta e por manter a senha em segurança. Você pode excluir a conta quando
              quiser, em Perfil.
            </p>

            <h2>Conteúdo</h2>
            <p>
              O que você cria continua seu. Não envie conteúdo ilegal, ofensivo ou que viole direitos de terceiros, inclusive
              textos de livros comerciais que você não tenha direito de usar. Livros importados ficam só na sua conta e nas
              campanhas em que você os liberar. O conteúdo de regras incluído segue as licenças descritas em{' '}
              <Link href={routes.licenses} className="underline underline-offset-4">
                Licenças e atribuições
              </Link>
              .
            </p>

            <h2>Assistente de IA</h2>
            <p>
              As respostas do Tomo são geradas por IA e podem conter erros. A palavra final sobre as regras é de quem mestra a
              campanha.
            </p>

            <h2>Privacidade</h2>
            <p>
              Como tratamos seus dados está na{' '}
              <Link href={routes.privacy} className="underline underline-offset-4">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
