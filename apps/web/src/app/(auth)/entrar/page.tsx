import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigNotice } from '@/components/setup/config-notice';
import { routes } from '@/lib/routes';
import { SignInForm } from '../forms';

export const metadata: Metadata = { title: 'Entrar' };

export default async function SignInPage({ searchParams }: PageProps<'/entrar'>) {
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : undefined;
  const sessionExpired = params.motivo === 'sessao-expirada';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Entrar</h1>
        <p className="mt-1 text-sm text-fg-muted">Bem-vindo de volta ao seu grimório.</p>
      </div>
      <ConfigNotice />
      <SignInForm next={next} sessionExpired={sessionExpired} />
      <p className="text-center text-sm text-fg-muted">
        Ainda não tem conta?{' '}
        <Link href={routes.signUp} className="font-medium text-fg-accent underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
