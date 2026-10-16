import type { CodexveilClient, Database } from '@codexveil/database';
import { AppError } from '@codexveil/domain';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from '@/lib/env';

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Crie um novo cliente a cada requisição — nunca o guarde em variável global.
 */
export async function createSupabaseServerClient(): Promise<CodexveilClient> {
  if (!supabaseConfig.ok) {
    throw new AppError('not_configured');
  }
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseConfig.config.url, supabaseConfig.config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão a cada requisição.
        }
      },
    },
  });
}
