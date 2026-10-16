import { safeRedirectPath } from '@codexveil/validation';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { supabaseConfig } from '@/lib/env';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const otpTypes: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (otpTypes as readonly string[]).includes(value);
}

/**
 * Destino dos links enviados por e-mail (confirmação de conta, recuperação de senha e troca
 * de e-mail). Valida o token no Supabase, abre a sessão e redireciona apenas para caminhos
 * internos — nunca para URLs externas recebidas no parâmetro `next`.
 *
 * Os redirecionamentos são relativos: o navegador permanece no mesmo host em que o cookie
 * de sessão foi gravado, mesmo atrás de proxies reversos.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get('next'), routes.dashboard) as Route;
  const failure: (reason: string) => never = (reason) =>
    redirect(`${routes.authError}?motivo=${reason}` as Route);

  if (!supabaseConfig.ok) failure('configuracao');

  const supabase = await createSupabaseServerClient();
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) failure('link-invalido');
    redirect(next);
  }

  // Fluxo PKCE (links com ?code=), usado pelos templates padrão do Supabase.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failure('link-invalido');
    redirect(next);
  }

  failure('link-incompleto');
}
