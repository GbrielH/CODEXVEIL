'use client';

import { INVITE_MAX_TTL_DAYS, INVITE_MAX_USES_LIMIT } from '@codexveil/domain';
import { useActionState, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { createInviteAction, type InviteFormState } from '../../actions';

const validityOptions = [1, 3, 7, 14, INVITE_MAX_TTL_DAYS];

export function InviteForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState<InviteFormState, FormData>(
    createInviteAction.bind(null, campaignId),
    { status: 'idle' },
  );
  const [unlimited, setUnlimited] = useState(false);
  const [personal, setPersonal] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {state.status === 'success' && state.invite ? (
        <div className="parchment rounded-lg p-5" role="status">
          <p className="text-sm font-semibold text-ink">{state.message}</p>
          <p className="mt-3 font-display text-2xl tracking-[0.2em] text-ink tabular">{state.invite.code}</p>
          <p className="mt-1 break-all text-sm text-ink-muted">{state.invite.link}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton value={state.invite.code} label="Copiar código" />
            <CopyButton value={state.invite.link} label="Copiar link" />
          </div>
        </div>
      ) : null}
      {state.status === 'error' && state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <form action={action} noValidate className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="expiresInDays"
          name="expiresInDays"
          label="Validade"
          defaultValue="7"
          error={state.fieldErrors?.expiresInDays}
        >
          {validityOptions.map((days) => (
            <option key={days} value={days}>
              {days === 1 ? '1 dia' : `${days} dias`}
            </option>
          ))}
        </SelectField>

        <TextField
          id="maxUses"
          name="maxUses"
          type="number"
          inputMode="numeric"
          label="Quantidade de usos"
          min={1}
          max={INVITE_MAX_USES_LIMIT}
          defaultValue="1"
          disabled={unlimited || personal}
          hint={personal ? 'Convites pessoais valem para uma pessoa.' : undefined}
          error={state.fieldErrors?.maxUses}
        />

        <CheckboxField
          id="unlimited"
          name="unlimited"
          label="Usos ilimitados até expirar"
          description="Útil para compartilhar no grupo da mesa."
          checked={unlimited}
          disabled={personal}
          onChange={(event) => setUnlimited(event.target.checked)}
          className="sm:col-span-2"
        />

        <CheckboxField
          id="personal"
          name="personal"
          label="Convite pessoal (para um e-mail específico)"
          description="Só a conta com esse e-mail confirmado poderá aceitar; o convite aparece no painel dela."
          checked={personal}
          onChange={(event) => setPersonal(event.target.checked)}
          className="sm:col-span-2"
        />

        {personal ? (
          <TextField
            id="invitedEmail"
            name="invitedEmail"
            type="email"
            label="E-mail do jogador"
            autoComplete="off"
            required
            error={state.fieldErrors?.invitedEmail}
            fieldClassName="sm:col-span-2"
          />
        ) : null}

        <div className="sm:col-span-2">
          <SubmitButton pendingLabel="Gerando…">Gerar convite</SubmitButton>
        </div>
      </form>
    </div>
  );
}
