'use client';

import { AVATAR_ICONS, type Preferences } from '@codexveil/validation';
import { Avatar } from '@/components/ui/avatar';
import { AVATAR_ICON_ART, AvatarIconArt } from '@/components/ui/avatar-icons';
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
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-fg">Retrato</legend>
        <p className="text-xs text-fg-muted">
          Aparece na mesa e no menu. Sem retrato, ficam as iniciais.
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line p-2 text-[11px] text-fg-muted has-[:checked]:border-wine-400 has-[:checked]:bg-wine-900/40 has-[:checked]:text-fg">
            <input
              type="radio"
              name="avatar"
              value=""
              defaultChecked={!initial.preferences.avatar}
              className="sr-only"
            />
            <Avatar name={initial.displayName} size="lg" />
            Iniciais
          </label>
          {AVATAR_ICONS.map((icon) => (
            <label
              key={icon}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line p-2 text-[11px] text-fg-muted has-[:checked]:border-wine-400 has-[:checked]:bg-wine-900/40 has-[:checked]:text-fg"
            >
              <input
                type="radio"
                name="avatar"
                value={icon}
                defaultChecked={initial.preferences.avatar === icon}
                className="sr-only"
              />
              <AvatarIconArt icon={icon} className="h-16 w-16" />
              {AVATAR_ICON_ART[icon].label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton>
      </div>
    </form>
  );
}
