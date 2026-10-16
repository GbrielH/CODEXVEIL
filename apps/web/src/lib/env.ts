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
