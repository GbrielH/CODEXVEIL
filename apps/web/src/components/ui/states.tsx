import { CircleAlert, Lock } from 'lucide-react';
import { DragonLoader } from '@/components/brand/dragon-loader';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface StateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

function StateFrame({ icon, title, description, action, className }: StateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-fg-secondary">{icon}</div> : null}
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="max-w-md text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Nenhum registro encontrado: explica o porquê e oferece o próximo passo. */
export function EmptyState(props: StateProps) {
  return <StateFrame {...props} />;
}

export function ErrorState({ title = 'Algo deu errado', ...props }: Partial<StateProps>) {
  return (
    <StateFrame
      icon={props.icon ?? <CircleAlert className="h-8 w-8 text-danger" aria-hidden="true" />}
      title={title}
      {...props}
      className={cx('border-ember-400/40', props.className)}
    />
  );
}

export function ForbiddenState({ title = 'Acesso restrito', ...props }: Partial<StateProps>) {
  return (
    <StateFrame
      icon={props.icon ?? <Lock className="h-8 w-8" aria-hidden="true" />}
      title={title}
      description={
        props.description ??
        'Você não tem permissão para ver este conteúdo. Se acha que isso é um engano, fale com o mestre da campanha.'
      }
      {...props}
    />
  );
}

export function LoadingState({
  label = 'Carregando…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return <DragonLoader label={label} size="sm" className={className} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-md bg-hover', className)} />;
}
