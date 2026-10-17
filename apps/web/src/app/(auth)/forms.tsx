'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { TextField } from '@/components/ui/field';
import { PasswordField } from '@/components/ui/password-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { routes } from '@/lib/routes';
import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from './actions';

const initialState: AuthFormState = { status: 'idle' };

function FormMessage({ state }: { state: AuthFormState }) {
  if (!state.message) return null;
  return <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert>;
}

export function SignInForm({ next, sessionExpired }: { next?: string; sessionExpired?: boolean }) {
  const [state, action] = useActionState(signInAction, initialState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {sessionExpired && state.status === 'idle' ? (
        <Alert tone="warning">Sua sessão expirou. Entre novamente para continuar.</Alert>
      ) : null}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ''} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <PasswordField
        id="password"
        name="password"
        label="Senha"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <Link
        href={routes.forgotPassword}
        className="self-end text-sm text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg"
      >
        Esqueci minha senha
      </Link>
      <SubmitButton size="lg" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialState);
  if (state.status === 'success') {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage state={state} />
        <p className="text-sm text-fg-muted">
          Não recebeu? Confira a caixa de spam ou aguarde alguns minutos antes de tentar de novo.
        </p>
      </div>
    );
  }
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage state={state} />
      <TextField
        id="displayName"
        name="displayName"
        label="Nome de exibição"
        hint="É assim que mestres e jogadores verão você."
        autoComplete="nickname"
        maxLength={40}
        required
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
      />
      <TextField
        id="email"
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <PasswordField
        id="password"
        name="password"
        label="Senha"
        hint="Pelo menos 8 caracteres, com letras e números."
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirme a senha"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton size="lg" pendingLabel="Criando conta…">
        Criar conta
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialState);
  if (state.status === 'success') return <FormMessage state={state} />;
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage state={state} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="E-mail da conta"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton size="lg" pendingLabel="Enviando…">
        Enviar link de redefinição
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, initialState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage state={state} />
      <PasswordField
        id="password"
        name="password"
        label="Nova senha"
        hint="Pelo menos 8 caracteres, com letras e números."
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirme a nova senha"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton size="lg" pendingLabel="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
