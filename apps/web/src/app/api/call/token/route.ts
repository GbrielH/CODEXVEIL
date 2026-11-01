import { joinCallRoom } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
import { corsHeaders, sessionFrom } from '@/lib/api-session';
import { callsEnabled, livekitConfig } from '@/lib/env';

export const runtime = 'nodejs';

const requestSchema = z.object({ roomId: uuidSchema });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Token de entrada na call (LiveKit). Confere o login (cookies no site, Bearer no app) e as
 * regras da sala pelo banco (`join_call_room`: aberta, convidados ou sala de espera). Quem está
 * na sala de espera recebe `waiting` e tenta de novo quando for aprovado.
 */
export async function POST(request: Request): Promise<Response> {
  if (!callsEnabled()) return json({ error: 'A call ainda não está liberada.' }, 404);
  const config = livekitConfig();
  if (!config) return json({ error: 'A call ainda não foi configurada no servidor.' }, 503);
  const session = await sessionFrom(request);
  if (!session) return json({ error: 'Entre na sua conta.' }, 401);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Sala inválida.' }, 400);
  const { supabase, userId } = session;

  let status: string;
  try {
    status = await joinCallRoom(supabase, parsed.data.roomId);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Não foi possível entrar.' },
      403,
    );
  }
  if (status !== 'approved') return json({ status }, 202);

  // Nome e personagem de quem entra (aparecem para os outros na call).
  const [{ data: profile }, { data: participant }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    supabase
      .from('call_participants')
      .select('role, character_id, character:characters(name)')
      .eq('room_id', parsed.data.roomId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  const character = (participant as unknown as { character: { name: string } | null } | null)
    ?.character;
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: userId,
    name: profile?.display_name ?? 'Jogador',
    metadata: JSON.stringify({
      role: participant?.role ?? 'player',
      characterId: participant?.character_id ?? null,
      characterName: character?.name ?? null,
    }),
    ttl: '12h',
  });
  token.addGrant({
    room: parsed.data.roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return json({ status, token: await token.toJwt(), url: config.url });
}
