'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { createCreatureAction } from './actions';

export function NewCreatureForm({ campaignId, defaultKind }: { campaignId: string; defaultKind: 'npc' | 'monster' }) {
  const [state, action] = useActionState(createCreatureAction.bind(null, campaignId), idleFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <SelectField id="kind" name="kind" label="Tipo" defaultValue={state.values?.kind ?? defaultKind} error={state.fieldErrors?.kind}>
        <option value="npc">NPC</option>
        <option value="monster">Monstro</option>
      </SelectField>
      <TextField id="name" name="name" label="Nome" required maxLength={80} defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <TextField
        id="subtitle"
        name="subtitle"
        label="Descrição curta"
        placeholder="Ex.: Taverneiro de Brumafria"
        maxLength={80}
        defaultValue={state.values?.subtitle}
        error={state.fieldErrors?.subtitle}
      />
      <CheckboxField
        id="revealed"
        name="revealed"
        label="Revelar aos jogadores"
        description="Jogadores veem apenas nome, descrição e imagem. Estatísticas e segredos nunca são enviados a eles."
      />
      <div>
        <SubmitButton pendingLabel="Criando…">Criar registro</SubmitButton>
      </div>
    </form>
  );
}
