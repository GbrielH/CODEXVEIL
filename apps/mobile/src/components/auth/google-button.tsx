import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { googleAuthEnabled, startGoogleSignIn } from '@/lib/google-auth';
import { failureMessage } from '@/lib/errors';

/** "Entrar com Google": abre o navegador e volta ao app já com a sessão aberta. */
export function GoogleSignInButton({ label = 'Entrar com Google' }: { label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!googleAuthEnabled) return null;
  return (
    <Button
      label={label}
      variant="secondary"
      loading={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await startGoogleSignIn();
        } catch (cause) {
          toast({ tone: 'danger', title: 'Não foi possível abrir o login do Google', description: failureMessage(cause) });
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
