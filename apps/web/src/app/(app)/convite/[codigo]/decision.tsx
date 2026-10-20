'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { acceptInviteAction, declineInviteAction } from '../actions';

/** Botões de aceitar/recusar; funcionam como formulários (também sem JavaScript). */
export function InviteDecision({ code, canDecline }: { code: string; canDecline: boolean }) {
  const [acceptState, accept] = useActionState(acceptInviteAction.bind(null, code), idleFormState);
  const [declineState, decline] = useActionState(
    declineInviteAction.bind(null, code),
    idleFormState,
  );
  const message = acceptState.message ?? declineState.message;

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone="danger">{message}</Alert> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={accept}>
          <SubmitButton size="lg" pendingLabel="Entrando…" className="w-full sm:w-auto">
            Aceitar e entrar na campanha
          </SubmitButton>
        </form>
        {canDecline ? (
          <form action={decline}>
            <SubmitButton
              size="lg"
              variant="ghost"
              pendingLabel="Recusando…"
              className="w-full sm:w-auto"
            >
              Recusar convite
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
