import type { Metadata } from 'next';
import Link from 'next/link';
import { Emblem } from '@/components/brand/emblem';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Não foi possível continuar' };

const reasons: Record<string, string> = {
  'link-invalido': 'O link expirou ou já foi usado. Links de e-mail valem por uma hora e funcionam uma única vez.',
  'link-incompleto': 'O link está incompleto. Abra-o diretamente a partir do e-mail, sem copiar só uma parte.',
  configuracao: 'O backend ainda não foi configurado neste ambiente.',
};

export default async function AuthErrorPage({ searchParams }: PageProps<'/auth/erro'>) {
  const { motivo } = await searchParams;
  const message =
    (typeof motivo === 'string' ? reasons[motivo] : undefined) ??
    'Não foi possível concluir a autenticação. Tente novamente.';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <main id="conteudo" className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Link href={routes.home} aria-label="Codexveil — página inicial">
          <Emblem className="h-14 w-14" />
        </Link>
        <h1 className="text-2xl">Não foi possível continuar</h1>
        <Alert tone="warning" className="text-left">
          {message}
        </Alert>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href={routes.signIn}>Ir para o login</ButtonLink>
          <ButtonLink href={routes.forgotPassword} variant="secondary">
            Pedir novo link de senha
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
