import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand/emblem';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Política de Privacidade' };

const UPDATED = '27 de outubro de 2026';

/** Política de Privacidade pública (exigida pelo Google para o login com Google). */
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href={routes.home} className="inline-flex">
        <Wordmark size="sm" />
      </Link>
      <main id="conteudo" className="mt-10 flex flex-col gap-6">
        <PageHeader eyebrow="Transparência" title="Política de Privacidade" description={`Atualizada em ${UPDATED}.`} />
        <Card ornate>
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-fg-secondary [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-fg">
            <p>
              O Codexveil é uma plataforma para jogar RPG de mesa (site e aplicativo). Esta página explica quais dados guardamos,
              para quê e como você pode apagá-los.
            </p>

            <h2>O que guardamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Conta: e-mail, nome de exibição, retrato escolhido, bio e preferências.</li>
              <li>
                Login com Google: recebemos do Google apenas seu nome, e-mail e foto de perfil (escopos <code>openid</code>,{' '}
                <code>email</code> e <code>profile</code>). Não acessamos Gmail, Drive, contatos ou outros dados.
              </li>
              <li>O que você cria: campanhas, fichas, anotações, sessões, mapas, quadros, rolagens de dados e imagens enviadas.</li>
              <li>Amigos e pedidos de amizade, convites e respostas às perguntas do mestre.</li>
              <li>No aplicativo: o identificador do aparelho para enviar notificações de sessão, se você permitir.</li>
            </ul>

            <h2>Para que usamos</h2>
            <p>
              Só para o funcionamento da plataforma: entrar na conta, mostrar suas campanhas e fichas às pessoas com quem você joga
              (conforme as regras de cada campanha) e avisar sobre sessões. Não vendemos dados, não mostramos anúncios e não usamos
              seus dados para publicidade.
            </p>

            <h2>Quem vê o quê</h2>
            <p>
              O acesso é controlado pelo banco de dados: cada pessoa só lê o que pode ver (por exemplo, segredos do mestre não
              chegam aos jogadores, e fichas compartilhadas só aparecem para os amigos escolhidos). Seu e-mail não é mostrado a
              outros usuários.
            </p>

            <h2>Assistente Tomo (IA)</h2>
            <p>
              Ao usar o Tomo, sua pergunta, as imagens que você anexar e o contexto da tela (campanha, seu papel e a ficha aberta)
              são enviados ao Google Gemini para gerar a resposta. No plano gratuito, o Google pode usar esse conteúdo para
              melhorar os modelos dele. Não enviamos seu e-mail nem dados de outras pessoas. As conversas não ficam gravadas nos
              nossos servidores (só no seu navegador, até fechar a aba).
            </p>

            <h2>Onde os dados ficam</h2>
            <p>
              Banco de dados, arquivos e login no Supabase; o site é hospedado na Vercel; as notificações do aplicativo passam pelo
              serviço da Expo e do Google (Firebase). A comunicação é sempre criptografada (HTTPS).
            </p>

            <h2>Apagar seus dados</h2>
            <p>
              Em <strong>Perfil → Excluir minha conta</strong> você apaga a conta e tudo o que é só seu (fichas, campanhas em que é
              dono, imagens). Arquivos que ficarem sem uso são limpos automaticamente toda semana. Você também pode remover o
              acesso do Codexveil à sua conta Google em{' '}
              <a href="https://myaccount.google.com/permissions" className="underline underline-offset-4">
                myaccount.google.com/permissions
              </a>
              .
            </p>

            <h2>Contato</h2>
            <p>
              Dúvidas sobre seus dados: escreva para o e-mail de contato do desenvolvedor exibido na tela de permissão do Google ao
              entrar com Google.
            </p>
            <p>
              Veja também os{' '}
              <Link href={routes.terms} className="underline underline-offset-4">
                Termos de Uso
              </Link>
              .
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
