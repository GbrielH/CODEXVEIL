import { toAppError } from '@codexveil/database';

/** Mensagem amigável para erros ocorridos no navegador (Supabase, rede, validação). */
export function failureMessage(error: unknown, fallback: string): string {
  const appError = toAppError(error);
  if (appError.code === 'unknown') {
    console.error(error);
    return fallback;
  }
  return appError.message;
}
