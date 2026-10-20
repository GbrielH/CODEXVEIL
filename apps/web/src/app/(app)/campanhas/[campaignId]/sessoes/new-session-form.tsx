'use client';

import { useActionState, useState } from 'react';
import { SessionModeFields, type SessionModeValue } from '@/components/sessions/session-mode-fields';
import { Alert } from '@/components/ui/alert';
import { DateTimeField } from '@/components/ui/date-time-field';
import { CheckboxField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { createSessionAction } from './actions';

export function NewSessionForm({ campaignId, suggestedTitle }: { campaignId: string; suggestedTitle: string }) {
  const [state, action] = useActionState(createSessionAction.bind(null, campaignId), idleFormState);
  const [sessionMode, setSessionMode] = useState<{ mode: SessionModeValue; physicalDice: boolean }>({ mode: 'presencial', physicalDice: false });
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <TextField
        id="title"
        name="title"
        label="Título"
        required
        maxLength={120}
        placeholder={suggestedTitle}
        defaultValue={state.values?.title ?? ''}
        error={state.fieldErrors?.title}
      />
      <DateTimeField
        id="scheduledAt"
        name="scheduledAt"
        label="Data e hora (opcional)"
        hint="Horário de Brasília. Aparece no painel dos jogadores quando a sessão é publicada."
        defaultValue={state.values?.scheduledAt ?? ''}
        error={state.fieldErrors?.scheduledAt}
      />
      <CheckboxField
        id="isPublished"
        name="isPublished"
        label="Publicar para os jogadores"
        description="Jogadores veem apenas sessões publicadas, e só os blocos públicos. Notas privadas nunca são enviadas a eles."
      />
      <SessionModeFields mode={sessionMode.mode} physicalDice={sessionMode.physicalDice} onChange={setSessionMode} inputs />
      <div>
        <SubmitButton pendingLabel="Criando…">Criar e abrir o editor</SubmitButton>
      </div>
    </form>
  );
}
