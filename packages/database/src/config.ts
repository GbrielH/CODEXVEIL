/**
 * Validação da configuração pública do Supabase usada por web e mobile.
 *
 * Só a URL do projeto e a chave publicável (ou a antiga chave `anon`) podem ir para o
 * navegador/app. Esta função recusa explicitamente chaves secretas (`sb_secret_...` ou JWT
 * com papel `service_role`), que dariam acesso irrestrito ao banco se vazassem.
 */

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseConfigResult =
  | { ok: true; config: SupabasePublicConfig }
  | { ok: false; problems: string[] };

function decodeJwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  return decodeJwtRole(key) === 'service_role';
}

export function parseSupabasePublicConfig(input: {
  url: string | undefined;
  publishableKey: string | undefined;
  /** Nomes das variáveis no app, usados nas mensagens. */
  names: { url: string; publishableKey: string };
}): SupabaseConfigResult {
  const problems: string[] = [];
  const url = input.url?.trim() ?? '';
  const key = input.publishableKey?.trim() ?? '';

  if (!url) {
    problems.push(`${input.names.url} não foi definida.`);
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '10.0.2.2'].includes(parsed.hostname)) {
        problems.push(`${input.names.url} precisa usar https (exceto em ambiente local).`);
      }
    } catch {
      problems.push(`${input.names.url} não é uma URL válida.`);
    }
  }

  if (!key) {
    problems.push(`${input.names.publishableKey} não foi definida.`);
  } else if (isSecretKey(key)) {
    problems.push(
      `${input.names.publishableKey} contém uma chave SECRETA (service_role). Use a chave publicável ` +
        'e revogue a chave exposta no painel do Supabase.',
    );
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, config: { url: url.replace(/\/+$/, ''), publishableKey: key } };
}
