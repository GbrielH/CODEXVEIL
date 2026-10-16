'use client';

import type { AutosaveStatus } from '@codexveil/database';
import { CircleAlert, CircleCheck, CloudOff, LoaderCircle, PencilLine } from 'lucide-react';
import { cx } from '@/lib/cx';

const labels: Record<AutosaveStatus, string> = {
  saved: 'Salvo',
  pending: 'Alterações não salvas',
  saving: 'Salvando…',
  error: 'Não salvo',
  conflict: 'Conflito de edição',
  invalid: 'Corrija para salvar',
};

/** Indicador discreto do salvamento automático (anunciado a leitores de tela). */
export function SaveStatus({ status, className }: { status: AutosaveStatus; className?: string }) {
  const icon =
    status === 'saved' ? (
      <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" />
    ) : status === 'saving' ? (
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
    ) : status === 'pending' ? (
      <PencilLine className="h-4 w-4" aria-hidden="true" />
    ) : status === 'error' ? (
      <CloudOff className="h-4 w-4 text-danger" aria-hidden="true" />
    ) : (
      <CircleAlert className="h-4 w-4 text-warning" aria-hidden="true" />
    );

  return (
    <span
      role="status"
      aria-live="polite"
      className={cx(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        status === 'error' ? 'text-danger' : status === 'saved' ? 'text-fg-muted' : 'text-fg-secondary',
        className,
      )}
    >
      {icon}
      {labels[status]}
    </span>
  );
}

/** Selo de conexão em tempo real. */
export function LiveBadge({ status }: { status: 'connecting' | 'live' | 'offline' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted" role="status" aria-live="polite">
      <span
        className={cx(
          'h-2 w-2 rounded-full',
          status === 'live' ? 'bg-success' : status === 'connecting' ? 'bg-warning' : 'bg-danger',
        )}
        aria-hidden="true"
      />
      {status === 'live' ? 'Ao vivo' : status === 'connecting' ? 'Conectando…' : 'Reconectando…'}
    </span>
  );
}
