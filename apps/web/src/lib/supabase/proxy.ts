import type { Database } from '@codexveil/database';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from '@/lib/env';
import { isGuestOnlyPath, isPrivatePath, routes, signInPath } from '@/lib/routes';

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));
}

/**
 * Renova a sessão do Supabase a cada requisição e aplica o redirecionamento de áreas
 * privadas. Segue o padrão oficial do @supabase/ssr: nenhum código entre a criação do
 * cliente e `getClaims()`, e a resposta devolvida carrega os cookies atualizados.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  if (!supabaseConfig.ok) {
    // Sem backend configurado, áreas privadas mostram a explicação na tela de login.
    if (isPrivatePath(pathname)) {
      return NextResponse.redirect(new URL(routes.signIn, request.url));
    }
    return response;
  }

  const supabase = createServerClient<Database>(
    supabaseConfig.config.url,
    supabaseConfig.config.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Respostas que gravam cookies de sessão nunca podem ser cacheadas por CDNs.
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  const redirectTo = (target: string) => {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  };

  if (!isAuthenticated && isPrivatePath(pathname)) {
    const reason = hasAuthCookie(request) ? 'sessao-expirada' : undefined;
    return redirectTo(signInPath(pathname + search, reason));
  }

  if (isAuthenticated && isGuestOnlyPath(pathname)) {
    return redirectTo(routes.dashboard);
  }

  return response;
}
