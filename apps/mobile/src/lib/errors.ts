import { toAppError } from '@codexveil/database';

/** Mensagem segura e compreensível para qualquer falha (Supabase, rede, validação). */
export function failureMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  const appError = toAppError(error);
  if (appError.code === 'unknown') {
    console.error(error);
    return fallback;
  }
  return appError.message;
}

/** Indica que a falha exige entrar novamente. */
export function isSessionError(error: unknown): boolean {
  const code = toAppError(error).code;
  return code === 'session_expired' || code === 'not_authenticated';
}
