import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { supabaseConfig } from '@/lib/env';
import { signInPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface SessionUser {
  id: string;
  email: string | null;
  /** `user_metadata` do token (ex.: foto da conta Google). */
  user_metadata: Record<string, unknown>;
}

/**
 * Usuário da requisição atual, validado pelo Supabase (`getClaims` verifica a assinatura
 * do JWT). Nunca confie em `getSession()` no servidor. Memorizado por requisição.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!supabaseConfig.ok) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const { sub, email, user_metadata: metadata } = data.claims;
  return {
    id: sub,
    email: typeof email === 'string' ? email : null,
    user_metadata: metadata ?? {},
  };
});

/** Exige sessão; sem ela, redireciona ao login preservando o destino. */
export async function requireSessionUser(currentPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(signInPath(currentPath) as Route);
  return user;
}
