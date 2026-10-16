import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigNotice } from '@/components/setup/config-notice';
import { routes } from '@/lib/routes';
import { ForgotPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Recuperar senha' };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Recuperar senha</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Informe o e-mail da sua conta para receber um link de redefinição.
        </p>
      </div>
      <ConfigNotice />
      <ForgotPasswordForm />
      <p className="text-center text-sm text-fg-muted">
        Lembrou?{' '}
        <Link href={routes.signIn} className="font-medium text-fg-accent underline underline-offset-4">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
