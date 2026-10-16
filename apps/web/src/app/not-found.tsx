import { Compass } from 'lucide-react';
import { Wordmark } from '@/components/brand/emblem';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { routes } from '@/lib/routes';

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-8 px-4">
      <Wordmark />
      <EmptyState
        icon={<Compass className="h-8 w-8" aria-hidden="true" />}
        title="Página perdida nas brumas"
        description="O endereço não existe ou o conteúdo não está disponível para você. Se recebeu este link de alguém, confira se ele está completo."
        action={
          <>
            <ButtonLink href={routes.dashboard}>Ir para o painel</ButtonLink>
            <ButtonLink href={routes.home} variant="secondary">
              Página inicial
            </ButtonLink>
          </>
        }
        className="w-full"
      />
    </main>
  );
}
