'use client';

import { useActionState } from 'react';
import { TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { goToInviteAction } from './actions';

export function InviteCodeForm() {
  const [state, action] = useActionState(goToInviteAction, idleFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <TextField
        id="code"
        name="code"
        label="Código do convite"
        placeholder="ABCD-EFGH-JKLM"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        className="font-display tracking-[0.18em] uppercase"
        defaultValue={state.values?.code}
        error={state.fieldErrors?.code}
      />
      <SubmitButton pendingLabel="Procurando…">Continuar</SubmitButton>
    </form>
  );
}
