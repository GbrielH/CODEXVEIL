'use client';

import type { CodexveilClient, Database } from '@codexveil/database';
import { AppError } from '@codexveil/domain';
import { createBrowserClient } from '@supabase/ssr';
import { supabaseConfig } from '@/lib/env';

let client: CodexveilClient | undefined;

/** Cliente Supabase do navegador (instância única). Respeita RLS com a sessão do usuário. */
export function getSupabaseBrowserClient(): CodexveilClient {
  if (!supabaseConfig.ok) {
    throw new AppError('not_configured');
  }
  client ??= createBrowserClient<Database>(
    supabaseConfig.config.url,
    supabaseConfig.config.publishableKey,
  );
  return client;
}
