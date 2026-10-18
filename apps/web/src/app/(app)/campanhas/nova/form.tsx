'use client';

import { useActionState, useState } from 'react';
import { CampaignRulesFields } from '@/components/campaigns/campaign-rules-fields';
import { CoverPicker } from '@/components/campaigns/cover-picker';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
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
  const [name, setName] = useState(state.values?.name ?? '');
  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Card ornate>
        <CardHeader title="A campanha" description="Nome, capa e sistema. Tudo pode ser alterado depois, menos o sistema." />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8">
          <CoverPicker name={name} />
          <div className="flex flex-col gap-5">
            <TextField
              id="name"
              name="name"
              label="Nome da campanha"
              maxLength={80}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={state.fieldErrors?.name}
            />
            <TextareaField
              id="description"
              name="description"
              label="Descrição"
              hint="Opcional. Visível para todos os participantes."
              maxLength={2000}
              rows={6}
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
          </div>
        </div>
      </Card>
      <CampaignRulesFields systemId={systemId} errors={state.fieldErrors} />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <ButtonLink href={routes.campaigns} variant="ghost">
          Cancelar
        </ButtonLink>
        <SubmitButton pendingLabel="Criando…">Criar campanha</SubmitButton>
      </div>
    </form>
  );
}
