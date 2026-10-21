/**
 * Cliente Supabase do app. Usa apenas a URL e a chave PUBLICÁVEL (EXPO_PUBLIC_*): o app
 * é distribuído para qualquer pessoa, então nunca pode conter a chave secreta. Toda a
 * autorização acontece no banco (RLS), igual à web.
 */
import { AppError } from '@codexveil/domain';
import {
  parseSupabasePublicConfig,
  type CodexveilClient,
  type Database,
} from '@codexveil/database';
import { createClient, processLock } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { AppState, type AppStateStatus } from 'react-native';

// As variáveis EXPO_PUBLIC_* precisam ser lidas de forma literal para o Expo embuti-las.
export const supabaseConfig = parseSupabasePublicConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  names: {
    url: 'EXPO_PUBLIC_SUPABASE_URL',
    publishableKey: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  },
});

/** Endereço do site (links de convite e de redefinição de senha abrem no navegador). */
export const siteUrl = (process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

let client: CodexveilClient | undefined;

export function getSupabase(): CodexveilClient {
  if (!supabaseConfig.ok) throw new AppError('not_configured');
  client ??= createClient<Database>(
    supabaseConfig.config.url,
    supabaseConfig.config.publishableKey,
    {
      auth: {
        // Sessão guardada no armazenamento privado do app (SQLite), renovada automaticamente.
        storage: Storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // PKCE: o login com Google volta ao app com um código (codexveil://google?code=...).
        flowType: 'pkce',
        lock: processLock,
      },
    },
  );
  return client;
}

/**
 * O Supabase só renova o token enquanto o app está em primeiro plano; ao voltar, a
 * renovação retoma (recomendação oficial para React Native).
 */
export function bindAuthRefreshToAppState(): () => void {
  if (!supabaseConfig.ok) return () => undefined;
  const supabase = getSupabase();
  const onChange = (state: AppStateStatus) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  };
  onChange(AppState.currentState);
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}
