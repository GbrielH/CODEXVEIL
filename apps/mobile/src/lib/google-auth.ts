/**
 * Login com Google no app sem biblioteca nativa nova: abre o navegador do aparelho no login
 * do Google (via Supabase) e volta ao app por `codexveil://google?code=...`, onde a tela
 * `app/google.tsx` troca o código pela sessão (PKCE).
 */
import * as Linking from 'expo-linking';
import { getSupabase } from './supabase';

/** Ligado só depois de configurar o Google no Supabase e definir EXPO_PUBLIC_AUTH_GOOGLE=on. */
export const googleAuthEnabled = process.env.EXPO_PUBLIC_AUTH_GOOGLE?.trim() === 'on';

export async function startGoogleSignIn(): Promise<void> {
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: Linking.createURL('google'), skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('Sem endereço de login do Google.');
  await Linking.openURL(data.url);
}
