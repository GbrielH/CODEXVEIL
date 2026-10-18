/**
 * Rotas da aplicação e regras de acesso usadas pelo proxy.
 * A proteção real dos dados é o RLS; o proxy apenas evita renderizar áreas privadas
 * para visitantes e mantém a sessão renovada.
 */

export const routes = {
  home: '/',
  signIn: '/entrar',
  signUp: '/cadastro',
  forgotPassword: '/recuperar-senha',
  resetPassword: '/redefinir-senha',
  authConfirm: '/auth/confirmar',
  authError: '/auth/erro',
  dashboard: '/painel',
  profile: '/perfil',
  community: '/comunidade',
  campaigns: '/campanhas',
  newCampaign: '/campanhas/nova',
  characters: '/personagens',
  newCharacter: '/personagens/novo',
  licenses: '/licencas',
} as const;

export function campaignPath(campaignId: string, section = ''): string {
  return `/campanhas/${campaignId}${section}`;
}

export function characterPath(characterId: string): string {
  return `/personagens/${characterId}`;
}

export function sessionPath(campaignId: string, sessionId: string, section = ''): string {
  return `/campanhas/${campaignId}/sessoes/${sessionId}${section}`;
}

/** Áreas que exigem sessão. */
const privatePrefixes = ['/painel', '/perfil', '/comunidade', '/campanhas', '/personagens', '/convite'];

/** Páginas que não fazem sentido para quem já está autenticado. */
const guestOnlyPaths = [routes.signIn, routes.signUp, routes.forgotPassword];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPrivatePath(pathname: string): boolean {
  return privatePrefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return guestOnlyPaths.some((path) => matchesPrefix(pathname, path));
}

/** Caminho de login preservando o destino original. */
export function signInPath(next?: string, reason?: 'sessao-expirada'): string {
  const params = new URLSearchParams();
  if (next && next !== routes.dashboard) params.set('next', next);
  if (reason) params.set('motivo', reason);
  const query = params.toString();
  return query ? `${routes.signIn}?${query}` : routes.signIn;
}
