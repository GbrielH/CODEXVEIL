'use client';

import { Check, Wand2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { runTomoAction } from '@/app/(app)/tomo-actions';
import { describeTomoAction, type TomoAction } from '@/lib/tomo-actions';

/** Resultado guardado na conversa, para o cartão não oferecer gravar duas vezes. */
export interface TomoActionDone {
  message: string;
  href: string;
}

/** Prévia de uma ação proposta pelo Tomo: nada é gravado até a pessoa confirmar. */
export function TomoActionCard({
  scope,
  action,
  done,
  onDone,
}: {
  scope: { campaignId?: string | undefined; characterId?: string | undefined };
  action: TomoAction;
  done?: TomoActionDone | undefined;
  onDone: (result: TomoActionDone) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { title, detail } = describeTomoAction(action);
  if (dismissed) return null;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await runTomoAction(scope, action).catch(() => ({ ok: false as const, message: 'Não foi possível gravar. Tente de novo.' }));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone({ message: result.message, href: result.href });
    router.refresh();
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-fg-brand/40 bg-surface p-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-fg">
        <Wand2 className="h-3.5 w-3.5 text-fg-brand" aria-hidden="true" /> {title}
      </p>
      {detail ? <p className="line-clamp-4 whitespace-pre-wrap text-fg-secondary">{detail}</p> : null}
      {done ? (
        <p className="flex items-center gap-1.5 text-success">
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> {done.message}{' '}
          <Link href={done.href as Route} className="underline underline-offset-2">
            Abrir
          </Link>
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="rounded-md bg-fg-brand px-2.5 py-1 font-medium text-bg hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Gravando…' : 'Confirmar'}
          </button>
          <button type="button" disabled={busy} onClick={() => setDismissed(true)} className="rounded-md px-2.5 py-1 text-fg-muted hover:bg-hover">
            Descartar
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
