'use client';

import { densityLabels, motionLabels, type Preferences } from '@codexveil/validation';
import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { updateProfileAction } from './actions';

interface ProfileFormProps {
  initial: { displayName: string; bio: string; preferences: Preferences };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [state, action] = useActionState(updateProfileAction, idleFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.message ? <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert> : null}
      <TextField
        id="displayName"
        name="displayName"
        label="Nome de exibição"
        hint="Visível para quem participa das mesmas campanhas que você."
        maxLength={40}
        required
        defaultValue={state.values?.displayName ?? initial.displayName}
        error={state.fieldErrors?.displayName}
      />
      <TextareaField
        id="bio"
        name="bio"
        label="Sobre você"
        hint="Opcional. Ex.: estilo de jogo preferido, disponibilidade."
        maxLength={500}
        rows={3}
        defaultValue={state.values?.bio ?? initial.bio}
        error={state.fieldErrors?.bio}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="density"
          name="density"
          label="Densidade da interface"
          defaultValue={initial.preferences.density}
          error={state.fieldErrors?.['preferences.density']}
        >
          {Object.entries(densityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="motion"
          name="motion"
          label="Animações"
          defaultValue={initial.preferences.motion}
          error={state.fieldErrors?.['preferences.motion']}
        >
          {Object.entries(motionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton>
      </div>
    </form>
  );
}
