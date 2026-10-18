'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { CheckboxField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { createSessionAction } from './actions';

export function NewSessionForm({ campaignId, suggestedTitle }: { campaignId: string; suggestedTitle: string }) {
  const [state, action] = useActionState(createSessionAction.bind(null, campaignId), idleFormState);
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
      <TextField
        id="scheduledAt"
        name="scheduledAt"
        type="datetime-local"
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
      <CheckboxField
        id="physicalDice"
        name="physicalDice"
        label="Dados presenciais"
        description="Para mesas presenciais: os jogadores rolam dados físicos e o app não rola nas ações. Dá para mudar depois, no editor da sessão."
      />
      <div>
        <SubmitButton pendingLabel="Criando…">Criar e abrir o editor</SubmitButton>
      </div>
    </form>
  );
}
