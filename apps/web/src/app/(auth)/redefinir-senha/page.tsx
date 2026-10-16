import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { getSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { ResetPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Redefinir senha' };
export const dynamic = 'force-dynamic';

/** Acessada pelo link do e-mail de recuperação, que abre uma sessão temporária. */
export default async function ResetPasswordPage() {
  const user = await getSessionUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Escolha uma nova senha</h1>
        <p className="mt-1 text-sm text-fg-muted">A senha antiga deixa de valer assim que você salvar.</p>
      </div>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <>
          <Alert tone="warning">
            Para redefinir a senha, abra o link enviado ao seu e-mail. Ele vale por uma hora e só pode
            ser usado uma vez.
          </Alert>
          <ButtonLink href={routes.forgotPassword} variant="secondary">
            Pedir um novo link
          </ButtonLink>
        </>
      )}
    </div>
  );
}
