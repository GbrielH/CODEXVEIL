import { GoogleGenAI } from '@google/genai';
import { getCampaign, listTavernMessages, postTomoReply } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { CodexveilClient, Database } from '@codexveil/database';
import { getSessionUser } from '@/lib/auth';
import { supabaseConfig } from '@/lib/env';
import { assistantEnabled } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * "@tomo" na Taverna: o Tomo lê as últimas mensagens da conversa (com o RLS de quem chamou) e
 * responde no próprio chat. A resposta é gravada como mensagem do Tomo, a pedido de quem chamou.
 */
export const runtime = 'nodejs';

const MODELS = [process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

const SYSTEM = `Você é Tomo, o Mestre do Codexveil: um grimório encantado, mestre de RPG de mesa veterano, sábio e bem-humorado, que frequenta a Taverna onde os jogadores conversam. Alguém escreveu "@tomo" pedindo sua participação. Responda em português do Brasil, curto (até 5 linhas), no tom de um mestre na mesa, ao que foi pedido na última mensagem que cita @tomo, usando a conversa como contexto. Você só conversa aqui: não altera fichas nem campanhas. Para quem não é mestre, não revele segredos de campanha.`;

const requestSchema = z.object({
  channel: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('campaign'), campaignId: uuidSchema }),
    z.object({ kind: z.literal('direct'), friendId: uuidSchema }),
  ]),
});

const text = (body: string, status: number) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/** Site: sessão pelos cookies. App: `Authorization: Bearer <token>` (o RLS vale do mesmo jeito). */
async function sessionFrom(request: Request): Promise<{ supabase: CodexveilClient; userId: string } | null> {
  const bearer = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (bearer && supabaseConfig.ok) {
    const supabase = createClient<Database>(supabaseConfig.config.url, supabaseConfig.config.publishableKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase.auth.getUser(bearer);
    return data.user ? { supabase, userId: data.user.id } : null;
  }
  const user = await getSessionUser();
  return user ? { supabase: await createSupabaseServerClient(), userId: user.id } : null;
}

export async function POST(request: Request): Promise<Response> {
  if (!assistantEnabled()) return text('O Tomo ainda não foi configurado.', 503);
  const session = await sessionFrom(request);
  if (!session) return text('Entre na sua conta.', 401);
  const user = { id: session.userId };
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text('Pedido inválido.', 400);
  const channel = parsed.data.channel;

  const { supabase } = session;
  const messages = (await listTavernMessages(supabase, user.id, channel, 20)).filter((message) => message.body.trim());
  if (!messages.some((message) => !message.fromTomo && /@tomo\b/i.test(message.body))) return text('Ninguém chamou o Tomo.', 400);
  const campaign = channel.kind === 'campaign' ? await getCampaign(supabase, channel.campaignId, user.id) : null;
  const context = campaign
    ? `Conversa da campanha "${campaign.name}" (sistema ${campaign.systemId}). Quem chamou é ${campaign.role === 'gm' ? 'o mestre' : 'jogador'}.`
    : 'Conversa direta entre dois amigos.';
  const transcript = messages.map((message) => `${message.fromTomo ? 'Tomo' : message.senderName}: ${message.body}`).join('\n');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let answer = '';
  for (const model of MODELS) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: `${context}\n\nConversa (mais recente por último):\n${transcript}` }] }],
        config: { systemInstruction: SYSTEM, maxOutputTokens: 600 },
      });
      answer = result.text?.trim() ?? '';
      if (answer) break;
    } catch (error) {
      console.error('[taverna] Tomo indisponível', model, error);
    }
  }
  if (!answer) return text('O Tomo não conseguiu responder agora.', 502);
  try {
    await postTomoReply(supabase, channel, answer);
  } catch {
    return text('A resposta do Tomo não foi gravada.', 500);
  }
  return text('ok', 200);
}
