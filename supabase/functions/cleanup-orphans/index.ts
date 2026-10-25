// Edge Function `cleanup-orphans` (Supabase, Deno).
//
// Apaga do bucket `campaign-media` os arquivos que nenhuma linha do banco usa mais (lista feita
// por `public.list_orphan_media`, com 24 h de folga para envios em andamento). Chamada uma vez por
// semana pelo workflow `.github/workflows/cleanup-orphans.yml`; pode ser chamada à mão.
//
// Segurança: só quem tem o segredo CLEANUP_SECRET (cabeçalho `x-cleanup-secret`) chama. A função
// usa a chave secreta do projeto, que nunca sai do servidor.
//
// Publicação: `supabase functions deploy cleanup-orphans --no-verify-jwt` e
// `supabase secrets set CLEANUP_SECRET=...` (o mesmo valor do segredo do GitHub). Veja
// docs/DEPLOY.md.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'campaign-media';
/** Limite por execução (a próxima semana continua de onde parou). */
const MAX_PER_RUN = 5000;

/** Primeira chave de um dicionário JSON (SUPABASE_SECRET_KEYS) ou a chave antiga. */
function pickKey(dictionary: string | undefined, legacy: string | undefined): string | undefined {
  if (dictionary) {
    try {
      const parsed = JSON.parse(dictionary) as Record<string, unknown>;
      const preferred = parsed.default;
      if (typeof preferred === 'string') return preferred;
      const first = Object.values(parsed).find((value) => typeof value === 'string');
      if (typeof first === 'string') return first;
    } catch {
      // Formato inesperado: usa a chave antiga.
    }
  }
  return legacy;
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Comparação em tempo constante (o segredo não vaza pelo tempo de resposta). */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secretKey = pickKey(Deno.env.get('SUPABASE_SECRET_KEYS'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const cleanupSecret = Deno.env.get('CLEANUP_SECRET');

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
  if (!supabaseUrl || !secretKey || !cleanupSecret) return reply({ error: 'Função sem configuração.' }, 500);
  if (!sameSecret(request.headers.get('x-cleanup-secret') ?? '', cleanupSecret)) {
    return reply({ error: 'Não autorizado.' }, 401);
  }
  // `?dry=1`: só conta o que seria apagado.
  const dry = new URL(request.url).searchParams.get('dry') === '1';

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let removed = 0;
  let found = 0;
  const failures: string[] = [];
  while (found < MAX_PER_RUN) {
    const { data, error } = await admin.rpc('list_orphan_media', { p_min_age_hours: 24, p_limit: 1000 });
    if (error) return reply({ error: error.message, removed }, 500);
    const paths = (data ?? []) as string[];
    found += paths.length;
    if (paths.length === 0 || dry) break;
    for (let index = 0; index < paths.length; index += 100) {
      const chunk = paths.slice(index, index + 100);
      const { error: removeError } = await admin.storage.from(BUCKET).remove(chunk);
      if (removeError) failures.push(removeError.message);
      else removed += chunk.length;
    }
    // Nada saiu nesta volta: para, senão a mesma lista voltaria para sempre.
    if (failures.length > 0) break;
  }
  return reply({ dry, found, removed, ...(failures.length ? { failures } : {}) }, failures.length ? 500 : 200);
});
