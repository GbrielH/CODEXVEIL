/**
 * Mensagens em português para erros do Supabase Auth, compartilhadas por web e mobile.
 * Mensagens de login e recuperação são propositalmente genéricas para não revelar se um
 * e-mail tem conta (proteção contra enumeração de usuários).
 */

const messages: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed:
    'Confirme seu e-mail antes de entrar. Procure a mensagem do Codexveil na sua caixa de entrada.',
  user_already_exists: 'Não foi possível criar a conta com esses dados.',
  email_exists: 'Não foi possível criar a conta com esses dados.',
  weak_password: 'Senha fraca: use pelo menos 8 caracteres, com letras e números.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  over_request_rate_limit: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.',
  over_email_send_rate_limit:
    'Já enviamos um e-mail para este endereço há pouco. Aguarde 1 minuto e tente de novo (confira também a caixa de spam).',
  over_sms_send_rate_limit: 'Muitas tentativas em pouco tempo. Aguarde e tente novamente.',
  otp_expired: 'O link expirou ou já foi usado. Peça um novo.',
  flow_state_expired: 'O link expirou ou já foi usado. Peça um novo.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
  refresh_token_not_found: 'Sua sessão expirou. Entre novamente.',
  reauthentication_needed: 'Por segurança, entre novamente antes de alterar a senha.',
  signup_disabled: 'Novos cadastros estão desativados no momento.',
  email_address_invalid: 'Informe um e-mail válido.',
  validation_failed: 'Alguns dados não são válidos. Revise os campos.',
};

const fallback = 'Não foi possível concluir a operação. Tente novamente em instantes.';

export function authErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    if (code && code in messages) return messages[code] ?? fallback;
    const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
    if (status === 429) return messages.over_request_rate_limit ?? fallback;
  }
  if (error instanceof TypeError) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão.';
  }
  return fallback;
}
