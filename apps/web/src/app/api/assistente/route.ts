import Anthropic from '@anthropic-ai/sdk';
import { getCampaign, getCharacter } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { assistantEnabled } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Assistente de IA (consultivo). Só no servidor: a chave da Anthropic fica em
 * ANTHROPIC_API_KEY na Vercel. A resposta volta em texto puro, em streaming.
 * O contexto é montado aqui com o cliente do Supabase da própria pessoa, então o RLS
 * garante que só entra o que ela já pode ver.
 */
export const runtime = 'nodejs';

const MODEL = 'claude-opus-5-5';
const MAX_QUESTION = 2000;
const MAX_CONTEXT = 12000;

const SYSTEM_PROMPT = `Você é o assistente do Codexveil, uma plataforma de RPG de mesa (D&D 5e, SRD 5.2.1, e Tormenta20). Responda em português do Brasil, de forma curta e prática.

Você é consultivo: explica regras, sugere ideias, ajuda a montar cenas, encontros e personagens, e tira dúvidas sobre a ficha e a campanha. Você não altera nada no sistema: não salva, não rola dados e não muda fichas. Se pedirem isso, diga onde a pessoa faz na plataforma.

Use o contexto fornecido (a tela atual, a ficha, a campanha) e o que você sabe das regras do sistema; se faltar informação, diga o que falta. O contexto já vem filtrado pelo que a pessoa pode ver, então não especule sobre segredos do mestre. Cite a regra (livro e seção) quando souber; quando for uma sugestão sua, deixe claro que é sugestão. Para jogadores, não dê spoilers da história; para o mestre, pode sugerir ganchos, NPCs e desafios.`;

const requestSchema = z.object({
  pathname: z.string().max(300),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(20),
});

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Contexto da tela atual: campanha e/ou personagem pela rota, lidos com o RLS da pessoa. */
async function buildContext(pathname: string, userId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const lines = [`Página atual: ${pathname}`];
  const campaignId = /^\/campanhas\/([^/]+)/.exec(pathname)?.[1];
  if (campaignId && uuidSchema.safeParse(campaignId).success) {
    const campaign = await getCampaign(supabase, campaignId, userId);
    if (campaign) {
      lines.push(
        `Campanha: ${campaign.name} (sistema ${campaign.systemId}, status ${campaign.status}). Papel da pessoa: ${campaign.role === 'gm' ? 'mestre' : 'jogador'}.`,
      );
      if (campaign.description) lines.push(`Descrição da campanha: ${clip(campaign.description, 1500)}`);
    }
  }
  const characterId = /^\/personagens\/([^/]+)/.exec(pathname)?.[1];
  if (characterId && uuidSchema.safeParse(characterId).success) {
    const character = await getCharacter(supabase, characterId, userId);
    if (character) {
      lines.push(
        `Personagem aberto: ${character.name} (sistema ${character.systemId}${character.viewer.isOwner ? ', da própria pessoa' : ''}).`,
        `Ficha (JSON): ${clip(JSON.stringify(character.sheet), 8000)}`,
      );
    }
  }
  return clip(lines.join('\n'), MAX_CONTEXT);
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export async function POST(request: Request): Promise<Response> {
  if (!assistantEnabled()) return text('O assistente ainda não foi configurado.', 503);
  const user = await getSessionUser();
  if (!user) return text('Entre na sua conta para usar o assistente.', 401);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text('Pergunta inválida.', 400);
  const { pathname, messages } = parsed.data;
  const last = messages.at(-1);
  if (last?.role !== 'user') return text('Pergunta inválida.', 400);
  if (last.content.length > MAX_QUESTION) return text(`A pergunta pode ter até ${MAX_QUESTION} caracteres.`, 400);

  const supabase = await createSupabaseServerClient();
  const { data: remaining, error } = await supabase.rpc('consume_assistant_question');
  if (error) return text('Não foi possível verificar sua cota agora.', 500);
  if (remaining < 0) return text('Você chegou ao limite de perguntas de hoje. Volte amanhã.', 429);

  const context = await buildContext(pathname, user.id);
  const client = new Anthropic();
  const history: Anthropic.MessageParam[] = messages.map((message, index) =>
    index === messages.length - 1
      ? { role: 'user', content: `<contexto>\n${context}\n</contexto>\n\n${message.content}` }
      : { role: message.role, content: message.content },
  );

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: history,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') controller.enqueue(encoder.encode('\n\n(O assistente não pode responder a isso.)'));
        if (final.stop_reason === 'max_tokens') controller.enqueue(encoder.encode('\n\n(Resposta cortada por tamanho.)'));
      } catch (caught) {
        const message =
          caught instanceof Anthropic.RateLimitError
            ? 'O assistente está ocupado. Tente de novo em instantes.'
            : 'O assistente falhou ao responder. Tente de novo.';
        controller.enqueue(encoder.encode(`\n\n(${message})`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-assistant-remaining': String(remaining),
    },
  });
}
