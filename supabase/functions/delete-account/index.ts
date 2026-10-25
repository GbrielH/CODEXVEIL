// Edge Function `delete-account` (Supabase, Deno).
//
// O usuário exclui a própria conta (LGPD). Chamada pelo site e pelo app com o token da pessoa.
//
// O que acontece:
// * A conta do Auth é apagada; o banco apaga em cascata o perfil, os personagens, as anotações,
//   as rolagens e as campanhas de que ela é dona.
// * Por isso, se ela for dona de alguma campanha com outros participantes, nada é apagado e a
//   resposta lista essas campanhas: é preciso transferir a campanha (ou removê-la) antes.
// * As imagens que sobram ficam órfãs e saem na próxima limpeza semanal (`cleanup-orphans`).
//
// Segurança: o token é conferido aqui (a pessoa só apaga a si mesma) e o corpo precisa trazer
// `{ "confirm": "EXCLUIR" }`.
//
// Publicação: `supabase functions deploy delete-account --no-verify-jwt`. Veja docs/DEPLOY.md.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

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

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secretKey = pickKey(Deno.env.get('SUPABASE_SECRET_KEYS'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
  if (!supabaseUrl || !secretKey) return reply({ error: 'Função sem configuração.' }, 500);

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply({ error: 'Entre na sua conta.' }, 401);

  let confirm: unknown;
  try {
    ({ confirm } = (await request.json()) as { confirm?: unknown });
  } catch {
    return reply({ error: 'Requisição inválida.' }, 400);
  }
  if (confirm !== 'EXCLUIR') return reply({ error: 'Digite EXCLUIR para confirmar.' }, 400);

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return reply({ error: 'Sessão inválida.' }, 401);
  const userId = userData.user.id;

  // Campanhas da pessoa com mais alguém dentro: apagar levaria a campanha dos outros junto.
  const { data: owned, error: ownedError } = await admin.from('campaigns').select('id, name').eq('owner_id', userId);
  if (ownedError) return reply({ error: 'Não foi possível conferir as campanhas.' }, 500);
  const ids = (owned ?? []).map((campaign) => campaign.id as string);
  const { data: others } = ids.length
    ? await admin.from('campaign_members').select('campaign_id').in('campaign_id', ids).neq('user_id', userId)
    : { data: [] as { campaign_id: string }[] };
  const shared = new Set((others ?? []).map((row) => row.campaign_id as string));
  const blocking = (owned ?? []).filter((campaign) => shared.has(campaign.id as string)).map((campaign) => campaign.name as string);
  if (blocking.length > 0) {
    return reply(
      { error: 'Você é o mestre responsável por campanhas com outros participantes. Transfira-as antes de excluir a conta.', campaigns: blocking },
      409,
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return reply({ error: 'Não foi possível excluir a conta. Tente de novo.' }, 500);
  return reply({ deleted: true });
});
