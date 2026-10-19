'use client';

import { useActionState } from 'react';
import { CampaignRulesFields, type CampaignBookOption } from '@/components/campaigns/campaign-rules-fields';
import { Alert } from '@/components/ui/alert';
import { CheckboxField, TextareaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import type { FormState } from '@/lib/actions';
import { updateCampaignAction } from '../../actions';

interface SettingsFormProps {
  campaignId: string;
  systemId: string;
  disabled: boolean;
  books: CampaignBookOption[];
  initial: {
    name: string;
    description: string;
    partySheetsVisible: boolean;
    playersCanEditSheets: boolean;
    characterRules: unknown;
  };
}

export function CampaignSettingsForm({ campaignId, systemId, disabled, books, initial }: SettingsFormProps) {
  const [state, action] = useActionState<FormState, FormData>(updateCampaignAction.bind(null, campaignId), {
    status: 'idle',
  });

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.message ? <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert> : null}
      <fieldset disabled={disabled} className="flex flex-col gap-5 disabled:opacity-70">
        <input type="hidden" name="systemId" value={systemId} />
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
        <CampaignRulesFields systemId={systemId} initial={initial.characterRules} errors={state.fieldErrors} books={books} />
        <div>
          <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
