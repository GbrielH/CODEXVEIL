/**
 * Erros de aplicação com códigos estáveis, para que web e mobile exibam mensagens
 * consistentes e o código consiga reagir a cada caso (ex.: sessão expirada → login).
 */

export const APP_ERROR_CODES = [
  'not_authenticated',
  'session_expired',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'limit_reached',
  'rate_limited',
  'network',
  'not_configured',
  'unknown',
] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export const appErrorMessages: Record<AppErrorCode, string> = {
  not_authenticated: 'Você precisa entrar na sua conta para continuar.',
  session_expired: 'Sua sessão expirou. Entre novamente para continuar.',
  forbidden: 'Você não tem permissão para realizar esta ação.',
  not_found: 'Não encontramos o que você procurava. Talvez tenha sido removido.',
  conflict:
    'Este conteúdo foi alterado em outro lugar. Recarregue para ver a versão mais recente.',
  validation: 'Alguns dados não são válidos. Revise os campos destacados.',
  limit_reached: 'O limite do seu plano foi atingido.',
  rate_limited: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.',
  network: 'Não foi possível falar com o servidor. Verifique sua conexão.',
  not_configured: 'O serviço ainda não foi configurado neste ambiente.',
  unknown: 'Algo deu errado. Tente novamente em instantes.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Detalhes estruturados (ex.: erros por campo); nunca devem conter segredos. */
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: AppErrorCode,
    message: string = appErrorMessages[code],
    options: { cause?: unknown; details?: Record<string, unknown> } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Resultado explícito para operações que podem falhar de forma esperada. */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
