'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { routes } from '@/lib/routes';

/** Fronteira de erro das páginas: registra a causa e oferece nova tentativa. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="conteudo" className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-col justify-center px-4">
      <ErrorState
        title="Algo deu errado"
        description={
          <>
            Não foi possível exibir esta página. Tente novamente; se o problema continuar, informe o
            código abaixo ao suporte.
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs text-fg-subtle">Código: {error.digest}</span>
            ) : null}
          </>
        }
        action={
          <>
            <Button onClick={reset}>Tentar novamente</Button>
            <ButtonLink href={routes.dashboard} variant="secondary">
              Voltar ao painel
            </ButtonLink>
          </>
        }
      />
    </main>
  );
}
