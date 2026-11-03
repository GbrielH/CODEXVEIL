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

/** Assistente de IA ligado? Só com GEMINI_API_KEY definida no servidor (Vercel). */
export function assistantEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Call (LiveKit). Só no servidor: a chave e o segredo nunca vão para o navegador nem para o app.
 * Trocar o LiveKit Cloud por um servidor próprio é só mudar estas três variáveis.
 */
export function livekitConfig(): { url: string; apiKey: string; apiSecret: string } | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
}

/** Limite usado somente pela estimativa exibida no site/app; nunca é enviado como segredo. */
export function livekitMonthlyMinutes(): number {
  const parsed = Number.parseInt(process.env.LIVEKIT_MONTHLY_MINUTES?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

/**
 * Call, transcrição e Melhores Momentos ainda em teste: ficam escondidos até `CALLS_ENABLED=1`
 * na Vercel (padrão: desligado em produção).
 */
export function callsEnabled(): boolean {
  return process.env.CALLS_ENABLED?.trim() === '1';
}
