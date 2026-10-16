'use server';

import { authErrorMessage } from '@codexveil/database';
import {
  fieldErrorsFrom,
  forgotPasswordSchema,
  resetPasswordSchema,
  safeRedirectPath,
  signInSchema,
  signUpSchema,
  type FieldErrors,
} from '@codexveil/validation';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { siteUrl, supabaseConfig } from '@/lib/env';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AuthFormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: FieldErrors;
  /** Valores para repreencher o formulário após um erro (nunca senhas). */
  values?: Record<string, string>;
}

const notConfigured: AuthFormState = {
  status: 'error',
  message:
    'O backend ainda não foi configurado neste ambiente. Defina as variáveis do Supabase (veja o README).',
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!supabaseConfig.ok) return notConfigured;
  const raw = { email: text(formData, 'email'), password: text(formData, 'password') };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error), values: { email: raw.email } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: 'error', message: authErrorMessage(error), values: { email: raw.email } };
  }

  redirect(safeRedirectPath(text(formData, 'next'), routes.dashboard) as Route);
}

export async function signUpAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!supabaseConfig.ok) return notConfigured;
  const raw = {
    displayName: text(formData, 'displayName'),
    email: text(formData, 'email'),
    password: text(formData, 'password'),
    confirmPassword: text(formData, 'confirmPassword'),
  };
  const values = { displayName: raw.displayName, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl()}${routes.authConfirm}?next=${routes.dashboard}`,
    },
  });
  if (error) {
    return { status: 'error', message: authErrorMessage(error), values };
  }

  // Sem confirmação de e-mail (ambiente local), a sessão já vem pronta.
  if (data.session) redirect(routes.dashboard);

  // Mesma resposta para e-mails novos e já cadastrados: não revela quem tem conta.
  return {
    status: 'success',
    message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra-o para ativar sua conta.`,
  };
}

export async function forgotPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!supabaseConfig.ok) return notConfigured;
  const raw = { email: text(formData, 'email') };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error), values: raw };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}${routes.authConfirm}?next=${routes.resetPassword}`,
  });
  // Erros de limite de envio são informados; os demais não revelam se o e-mail existe.
  if (error && (error.status === 429 || error.code?.startsWith('over_'))) {
    return { status: 'error', message: authErrorMessage(error), values: raw };
  }

  return {
    status: 'success',
    message:
      'Se houver uma conta com esse e-mail, você receberá um link para escolher uma nova senha em instantes.',
  };
}

export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!supabaseConfig.ok) return notConfigured;
  const raw = { password: text(formData, 'password'), confirmPassword: text(formData, 'confirmPassword') };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return {
      status: 'error',
      message: 'O link de redefinição expirou ou já foi usado. Peça um novo na tela de recuperação.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: 'error', message: authErrorMessage(error) };
  }

  redirect(`${routes.dashboard}?aviso=senha-alterada` as Route);
}

export async function signOutAction(): Promise<void> {
  if (supabaseConfig.ok) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect(routes.home);
}
