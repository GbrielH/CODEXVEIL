import { createClient } from '@supabase/supabase-js';
import type { CodexveilClient, Database } from '@codexveil/database';
import { getSessionUser } from '@/lib/auth';
import { supabaseConfig } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Site: sessão pelos cookies. App: `Authorization: Bearer <token>` (o RLS vale do mesmo jeito). */
export async function sessionFrom(request: Request): Promise<{ supabase: CodexveilClient; userId: string } | null> {
  const bearer = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (bearer && supabaseConfig.ok) {
    const supabase = createClient<Database>(supabaseConfig.config.url, supabaseConfig.config.publishableKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase.auth.getUser(bearer);
    return data.user ? { supabase, userId: data.user.id } : null;
  }
  const user = await getSessionUser();
  return user ? { supabase: await createSupabaseServerClient(), userId: user.id } : null;
}


/**
 * Cabeçalhos para o app chamar a API de outro endereço (no navegador, em desenvolvimento). A
 * sessão vem pelo Bearer, sem cookies, então liberar a origem não expõe nada.
 */
export const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};
