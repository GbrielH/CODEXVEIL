import { getCallUsageMonth } from '@codexveil/database';
import { callUsagePercent } from '@codexveil/domain';
import { uuidSchema } from '@codexveil/validation';
import { corsHeaders, sessionFrom } from '@/lib/api-session';
import { callsEnabled, livekitMonthlyMinutes } from '@/lib/env';

export const runtime = 'nodejs';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Estimativa mensal agregada. Mestre/dono recebe os números; jogador recebe apenas as faixas de
 * alerta. Credenciais e chaves do LiveKit nunca saem do servidor.
 */
export async function GET(request: Request): Promise<Response> {
  if (!callsEnabled()) return json({ error: 'A call ainda não está liberada.' }, 404);
  const session = await sessionFrom(request);
  if (!session) return json({ error: 'Entre na sua conta.' }, 401);
  const roomRef = new URL(request.url).searchParams.get('roomId');
  const parsedRoom = roomRef ? uuidSchema.safeParse(roomRef) : null;
  if (parsedRoom && !parsedRoom.success) return json({ error: 'Sala inválida.' }, 400);
  const roomId = parsedRoom?.success ? parsedRoom.data : null;
  const { supabase, userId } = session;

  const usage = await getCallUsageMonth(supabase).catch(() => null);
  if (!usage) return json({ error: 'Não foi possível calcular o consumo.' }, 503);
  const limitMinutes = livekitMonthlyMinutes();
  const usedMinutes = Math.ceil(usage.usedMinutes);
  const percentage = callUsagePercent(usedMinutes, limitMinutes);

  let canSeeExact = false;
  if (roomId) {
    const [{ data: room }, { data: participant }] = await Promise.all([
      supabase.from('call_rooms').select('owner_id').eq('id', roomId).maybeSingle(),
      supabase
        .from('call_participants')
        .select('role, status')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    canSeeExact =
      room?.owner_id === userId ||
      (participant?.role === 'master' && participant.status === 'approved');
  } else {
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('campaign_id')
      .eq('user_id', userId)
      .eq('role', 'gm')
      .limit(1)
      .maybeSingle();
    canSeeExact = Boolean(membership);
  }

  const bands = { nearLimit: percentage >= 95, exhausted: percentage >= 100 };
  return canSeeExact
    ? json({ ...bands, usedMinutes, limitMinutes, percentage, monthStart: usage.monthStart })
    : json(bands);
}
