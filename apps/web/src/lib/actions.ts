import { toAppError } from '@codexveil/database';
import { appErrorMessages, isAppError } from '@codexveil/domain';
import type { FieldErrors } from '@codexveil/validation';

/** Estado devolvido por Server Actions de formulário (useActionState). */
export interface FormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
}

export const idleFormState: FormState = { status: 'idle' };

/** Resultado de ações chamadas diretamente por componentes cliente. */
export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Converte qualquer falha numa mensagem segura para o usuário. Mensagens de exceções não
 * chegam ao navegador em produção, então o tratamento precisa acontecer aqui.
 */
export function failureMessage(error: unknown): string {
  const appError = isAppError(error) ? error : toAppError(error);
  if (appError.code === 'unknown') {
    console.error('[codexveil] erro inesperado em Server Action', error);
  }
  return appError.message || appErrorMessages[appError.code];
}

export function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}
