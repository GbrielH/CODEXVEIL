'use client';

import type { Preferences } from '@codexveil/validation';
import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { TextareaField, TextField } from '@/components/ui/field';
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
      {state.message ? (
        <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}
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
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton>
      </div>
    </form>
  );
}
