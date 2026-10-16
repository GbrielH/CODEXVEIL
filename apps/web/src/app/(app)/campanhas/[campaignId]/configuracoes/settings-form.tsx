'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { CheckboxField, TextareaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import type { FormState } from '@/lib/actions';
import { updateCampaignAction } from '../../actions';

interface SettingsFormProps {
  campaignId: string;
  disabled: boolean;
  initial: {
    name: string;
    description: string;
    partySheetsVisible: boolean;
    playersCanEditSheets: boolean;
  };
}

export function CampaignSettingsForm({ campaignId, disabled, initial }: SettingsFormProps) {
  const [state, action] = useActionState<FormState, FormData>(updateCampaignAction.bind(null, campaignId), {
    status: 'idle',
  });

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.message ? <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert> : null}
      <fieldset disabled={disabled} className="flex flex-col gap-5 disabled:opacity-70">
        <TextField
          id="name"
          name="name"
          label="Nome da campanha"
          maxLength={80}
          required
          defaultValue={state.values?.name ?? initial.name}
          error={state.fieldErrors?.name}
        />
        <TextareaField
          id="description"
          name="description"
          label="Descrição"
          maxLength={2000}
          rows={5}
          defaultValue={state.values?.description ?? initial.description}
          error={state.fieldErrors?.description}
        />
        <CheckboxField
          id="partySheetsVisible"
          name="partySheetsVisible"
          label="Jogadores podem consultar as fichas uns dos outros"
          description="Somente leitura. Mestres sempre veem todas as fichas da campanha."
          defaultChecked={initial.partySheetsVisible}
        />
        <CheckboxField
          id="playersCanEditSheets"
          name="playersCanEditSheets"
          label="Jogadores podem editar a construção da própria ficha"
          description="Desmarcado, só mestres alteram atributos, perícias e dados básicos. Vida, recursos e inventário continuam editáveis pelo jogador."
          defaultChecked={initial.playersCanEditSheets}
        />
        <div>
          <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
