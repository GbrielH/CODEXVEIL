import { parseSupabasePublicConfig } from '@codexveil/database';

/**
 * Configuração pública do Supabase. As variáveis NEXT_PUBLIC_* precisam ser lidas de forma
 * literal para que o Next.js as embuta no bundle do navegador.
 * Sem configuração válida, o app funciona em modo "configuração pendente": a página
 * inicial abre normalmente e as áreas que dependem do backend explicam o que falta.
 */
export const supabaseConfig = parseSupabasePublicConfig({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  names: {
    url: 'NEXT_PUBLIC_SUPABASE_URL',
    publishableKey: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  },
});

if (!supabaseConfig.ok && typeof window === 'undefined') {
  console.warn(`[codexveil] Supabase não configurado: ${supabaseConfig.problems.join(' ')}`);
}

/** URL pública do site, usada em links de e-mail e redirecionamentos de autenticação. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (raw && raw.length > 0 ? raw : 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Login com Google ligado? Só depois de configurar o provedor Google no Supabase
 * (deploy/supabase/config.toml) e definir NEXT_PUBLIC_AUTH_GOOGLE=on na Vercel.
 */
export const googleAuthEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE?.trim() === 'on';

/** Assistente de IA ligado? Só com ANTHROPIC_API_KEY definida no servidor (Vercel). */
export function assistantEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
