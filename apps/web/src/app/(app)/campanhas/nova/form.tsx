'use client';

import { useActionState, useState } from 'react';
import { CampaignRulesFields } from '@/components/campaigns/campaign-rules-fields';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { routes } from '@/lib/routes';
import { createCampaignAction } from '../actions';

interface SystemOption {
  id: string;
  name: string;
  reference: string;
}

export function CreateCampaignForm({ systems }: { systems: SystemOption[] }) {
  const [state, action] = useActionState(createCampaignAction, idleFormState);
  const [systemId, setSystemId] = useState(state.values?.systemId ?? systems[0]?.id ?? 'dnd5e');
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <TextField
        id="name"
        name="name"
        label="Nome da campanha"
        maxLength={80}
        required
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <TextareaField
        id="description"
        name="description"
        label="Descrição"
        hint="Opcional. Visível para todos os participantes."
        maxLength={2000}
        rows={4}
        defaultValue={state.values?.description}
        error={state.fieldErrors?.description}
      />
      <SelectField
        id="systemId"
        name="systemId"
        label="Sistema de RPG"
        hint="O sistema define as fichas e não pode ser trocado depois."
        required
        value={systemId}
        onChange={(event) => setSystemId(event.target.value)}
        error={state.fieldErrors?.systemId}
      >
        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name} — {system.reference}
          </option>
        ))}
      </SelectField>
      <CampaignRulesFields systemId={systemId} errors={state.fieldErrors} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink href={routes.campaigns} variant="ghost">
          Cancelar
        </ButtonLink>
        <SubmitButton pendingLabel="Criando…">Criar campanha</SubmitButton>
      </div>
    </form>
  );
}
