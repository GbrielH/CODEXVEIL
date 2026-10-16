/**
 * Converte erros do Supabase (PostgREST, Auth, rede) em `AppError` com códigos estáveis.
 * Os SQLSTATEs próprios (CVLIM, CVARC) são definidos nas migrações.
 */
import { AppError, limitReachedMessages, type LimitedResource } from '@codexveil/domain';

interface PostgrestLikeError {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

export function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

function isLimitedResource(value: unknown): value is LimitedResource {
  return typeof value === 'string' && value in limitReachedMessages;
}

const NETWORK_PATTERN = /failed to fetch|network request failed|fetch failed|networkerror|load failed/i;

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof TypeError && NETWORK_PATTERN.test(error.message)) {
    return new AppError('network', undefined, { cause: error });
  }

  if (isPostgrestLikeError(error)) {
    const { code, message, hint } = error;
    switch (code) {
      case '42501':
        return new AppError('forbidden', undefined, { cause: error });
      case 'CVARC':
        return new AppError('forbidden', 'A campanha está arquivada e é somente leitura.', {
          cause: error,
        });
      case 'CVLIM': {
        const resource = isLimitedResource(hint) ? hint : undefined;
        return new AppError(
          'limit_reached',
          resource ? limitReachedMessages[resource] : undefined,
          { cause: error, details: resource ? { resource } : undefined },
        );
      }
      case 'P0002':
      case 'PGRST116':
        return new AppError('not_found', undefined, { cause: error });
      case '23505':
        return new AppError('conflict', 'Já existe um registro com esses dados.', { cause: error });
      case '23502':
      case '23514':
      case '22023':
      case '22P02':
      case '23503':
        return new AppError('validation', undefined, { cause: error });
      case 'PGRST301':
      case 'PGRST303':
        return new AppError('session_expired', undefined, { cause: error });
      case '':
        if (NETWORK_PATTERN.test(message)) {
          return new AppError('network', undefined, { cause: error });
        }
        break;
      default:
        break;
    }
  }

  return new AppError('unknown', undefined, { cause: error });
}

/** Lança `AppError` quando a resposta do Supabase contém erro; caso contrário devolve os dados. */
export function unwrap<T>(response: { data: T; error: unknown }): T {
  if (response.error) throw toAppError(response.error);
  return response.data;
}
