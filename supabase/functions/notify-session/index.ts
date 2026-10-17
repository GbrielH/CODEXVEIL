// Edge Function `notify-session` (Supabase, Deno).
//
// Avisa os participantes de uma campanha, por notificação push no app, quando o mestre agenda
// (ou remarca) uma sessão publicada. Chamada pelo site e pelo app logo depois de salvar a
// sessão, com o token do mestre.
//
// Segurança:
// * Só o mestre da campanha pode pedir o aviso (conferido aqui, com a chave secreta).
// * Cada data é avisada uma vez (`session_notifications`): repetir o pedido não repete o aviso.
// * Os tokens dos aparelhos nunca saem do servidor.
//
// Publicação: `supabase functions deploy notify-session --no-verify-jwt` (o token é conferido
// aqui dentro). Opcional: o segredo EXPO_ACCESS_TOKEN, se a segurança reforçada de push do
// Expo estiver ligada. Veja docs/DEPLOY.md.
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
  if (!supabaseUrl || !secretKey) return reply({ error: 'Função sem configuração.' }, 500);

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply({ error: 'Entre na sua conta.' }, 401);

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return reply({ error: 'Sessão inválida.' }, 401);
  const userId = userData.user.id;

  let sessionId: unknown;
  try {
    ({ sessionId } = (await request.json()) as { sessionId?: unknown });
  } catch {
    return reply({ error: 'Requisição inválida.' }, 400);
  }
  if (typeof sessionId !== 'string' || !UUID_PATTERN.test(sessionId)) return reply({ error: 'Requisição inválida.' }, 400);

  const { data: session } = await admin
    .from('sessions')
    .select('id, campaign_id, number, title, scheduled_at, is_published')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return reply({ error: 'Sessão não encontrada.' }, 404);

  const { data: membership } = await admin
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', session.campaign_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (membership?.role !== 'gm') return reply({ error: 'Só o mestre da campanha pode avisar a mesa.' }, 403);

  if (!session.is_published) return reply({ sent: 0, skipped: 'unpublished' });
  if (!session.scheduled_at) return reply({ sent: 0, skipped: 'no_date' });
  const scheduledAt = new Date(session.scheduled_at);
  if (scheduledAt.getTime() < Date.now()) return reply({ sent: 0, skipped: 'past' });

  const { data: previous } = await admin
    .from('session_notifications')
    .select('scheduled_for')
    .eq('session_id', session.id)
    .maybeSingle();
  if (previous && new Date(previous.scheduled_for).getTime() === scheduledAt.getTime()) {
    return reply({ sent: 0, skipped: 'already_notified' });
  }

  const [{ data: campaign }, { data: members }] = await Promise.all([
    admin.from('campaigns').select('name, status').eq('id', session.campaign_id).single(),
    admin.from('campaign_members').select('user_id').eq('campaign_id', session.campaign_id).neq('user_id', userId),
  ]);
  if (!campaign || campaign.status !== 'active') return reply({ sent: 0, skipped: 'archived' });

  const memberIds = (members ?? []).map((member) => member.user_id as string);
  const { data: devices } = memberIds.length > 0
    ? await admin.from('push_tokens').select('token').in('user_id', memberIds)
    : { data: [] as { token: string }[] };
  const recipients = (devices ?? []).map((device) => device.token as string);

  const when = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(scheduledAt);
  const title = previous ? `Sessão remarcada · ${campaign.name}` : `Nova sessão agendada · ${campaign.name}`;
  const body = `Sessão ${session.number}: ${session.title} — ${when} (horário de Brasília).`;

  let sent = 0;
  let failed = 0;
  const invalid: string[] = [];
  for (let index = 0; index < recipients.length; index += 100) {
    const chunk = recipients.slice(index, index + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            title,
            body,
            sound: 'default',
            priority: 'high',
            channelId: 'sessoes',
            data: { type: 'session', sessionId: session.id, campaignId: session.campaign_id },
          })),
        ),
      });
      if (!response.ok) {
        failed += chunk.length;
        continue;
      }
      const result = (await response.json()) as { data?: ExpoTicket[] };
      (result.data ?? []).forEach((ticket, position) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') invalid.push(chunk[position] ?? '');
        else failed += 1;
      });
    } catch {
      failed += chunk.length;
    }
  }

  if (invalid.length > 0) await admin.from('push_tokens').delete().in('token', invalid);
  // Se o serviço de push falhou para todos, o aviso não fica registrado (o mestre pode tentar de novo).
  if (sent > 0 || recipients.length === invalid.length) {
    await admin.from('session_notifications').upsert({
      session_id: session.id,
      scheduled_for: session.scheduled_at,
      recipients: sent,
      sent_at: new Date().toISOString(),
    });
  }
  return reply({ sent, ...(failed > 0 ? { failed } : {}) });
});
