import { toAppError } from '@codexveil/database';

/** Mensagem segura e compreensível para qualquer falha (Supabase, rede, validação). */
export function failureMessage(
  error: unknown,
  fallback = 'Algo deu errado. Tente novamente.',
): string {
  const appError = toAppError(error);
  if (appError.code === 'unknown') {
    console.error(error);
    return `${fallback} (${technicalHint(error)})`;
  }
  return appError.message;
}

/** Indica que a falha exige entrar novamente. */
export function isSessionError(error: unknown): boolean {
  const code = toAppError(error).code;
  return code === 'session_expired' || code === 'not_authenticated';
}

/** Pista curta da falha desconhecida (código do banco ou tipo do erro), para o suporte. */
function technicalHint(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, name, message } = error as { code?: unknown; name?: unknown; message?: unknown };
    const label =
      typeof code === 'string' && code ? code : typeof name === 'string' ? name : 'erro';
    const detail = typeof message === 'string' ? message.slice(0, 80) : '';
    return detail ? `${label}: ${detail}` : label;
  }
  return String(error).slice(0, 80);
}
