import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigNotice } from '@/components/setup/config-notice';
import { routes } from '@/lib/routes';
import { SignUpForm } from '../forms';

export const metadata: Metadata = { title: 'Criar conta' };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Criar conta</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Uma conta serve para mestrar e para jogar: o papel é definido em cada campanha.
        </p>
      </div>
      <ConfigNotice />
      <SignUpForm />
      <p className="text-center text-sm text-fg-muted">
        Já tem conta?{' '}
        <Link href={routes.signIn} className="font-medium text-fg-accent underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </div>
  );
}
