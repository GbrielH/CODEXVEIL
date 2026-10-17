'use client';

import { ITEM_CATEGORIES, itemCategoryLabels } from '@codexveil/domain';
import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { createItemAction } from '../actions';

export function NewItemForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState(createItemAction.bind(null, campaignId), idleFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <TextField id="item-name" name="name" label="Nome" required maxLength={120} defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <SelectField id="item-category" name="category" label="Categoria" defaultValue={state.values?.category ?? 'gear'} error={state.fieldErrors?.category}>
        {ITEM_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {itemCategoryLabels[category]}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField id="item-rarity" name="rarity" label="Raridade" placeholder="Ex.: Raro" maxLength={60} defaultValue={state.values?.rarity} error={state.fieldErrors?.rarity} />
        <TextField id="item-value" name="value" label="Valor" placeholder="Ex.: 50 PO" maxLength={60} defaultValue={state.values?.value} error={state.fieldErrors?.value} />
      </div>
      <TextField
        id="item-weight"
        name="weight"
        label="Peso"
        hint="Na unidade usada nas fichas (kg ou lb). Opcional."
        inputMode="decimal"
        defaultValue={state.values?.weight}
        error={state.fieldErrors?.weight}
      />
      <TextareaField
        id="item-description"
        name="description"
        label="Descrição e efeitos"
        rows={5}
        maxLength={8000}
        placeholder="O que o item faz: bônus, cargas, dano, condições…"
        defaultValue={state.values?.description}
        error={state.fieldErrors?.description}
      />
      <CheckboxField id="item-attunement" name="requiresAttunement" label="Exige sintonia" />
      <CheckboxField id="item-revealed" name="revealed" label="Revelar aos jogadores" description="Os jogadores passam a ver o item na biblioteca." />
      <div>
        <SubmitButton pendingLabel="Criando…">Criar item</SubmitButton>
      </div>
    </form>
  );
}
