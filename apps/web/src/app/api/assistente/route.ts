import { GoogleGenAI } from '@google/genai';
import { getCampaign, getCharacter } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { assistantEnabled } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Assistente de IA (consultivo), com o Google Gemini (plano gratuito). Só no servidor: a chave fica
 * em GEMINI_API_KEY na Vercel. A resposta volta em texto puro, em streaming.
 * O contexto é montado aqui com o cliente do Supabase da própria pessoa, então o RLS
 * garante que só entra o que ela já pode ver.
 */
export const runtime = 'nodejs';

/**
 * Modelos em ordem de preferência. O Flash-Lite 3.1 começa a responder em ~1 s no plano gratuito
 * (o Flash principal levou 60 s em 2026-10-23); o apelido "latest" é a reserva quando uma versão fixa
 * sai do ar ou está sobrecarregada. GEMINI_MODEL troca o primeiro sem mudar o código.
 */
const MODELS = [process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
const MAX_QUESTION = 2000;
const MAX_CONTEXT = 12000;

const SYSTEM_PROMPT = `Você é Tomo, o Mestre do Codexveil: um grimório encantado e encapuzado, mestre de RPG de mesa veterano, sábio e bem-humorado, que acompanha cada mesa. Se perguntarem quem você é, apresente-se como Tomo. A plataforma roda D&D 5e (SRD 5.2.1 e livros importados) e Tormenta20. Responda sempre em português do Brasil.

Personalidade: fale como um mestre na mesa, com calor e um toque de narração ("Ah, aventureiro…", "Role os dados e veremos…"), mas sem enrolar. A primeira frase já responde; o tom de mestre é tempero, não recheio. Respostas curtas e práticas, em poucas linhas ou uma lista breve; só se alongue se pedirem detalhes. Trate a pessoa pelo personagem dela quando a ficha estiver no contexto.

O que você faz: explica regras, tira dúvidas sobre a ficha e a campanha, sugere ideias, ajuda a montar cenas, encontros, NPCs e personagens. Você é consultivo e não altera nada na plataforma (não salva, não rola dados, não muda fichas); se pedirem, diga onde a pessoa faz isso.

Regras do ofício: use o contexto fornecido (tela atual, ficha, campanha) e o que sabe das regras; se faltar informação, diga o que falta. Cite a regra (livro e seção) quando souber e deixe claro quando algo é sugestão sua, não regra. O contexto já vem filtrado pelo que a pessoa pode ver: não especule sobre segredos do mestre da mesa. Para jogadores, nada de spoilers da história; para quem mestra a campanha, pode sugerir ganchos, NPCs e desafios. Como bom mestre, lembre que a palavra final na mesa é de quem mestra a campanha.`;

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

  const context = await buildContext(pathname, user.id);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents = messages.map((message, index) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: index === messages.length - 1 ? `<contexto>\n${context}\n</contexto>\n\n${message.content}` : message.content }],
  }));
  const abort = new AbortController();

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Tenta o próximo modelo só se o anterior falhar antes de começar a responder.
        let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>> | null = null;
        let lastError: unknown = null;
        for (const model of MODELS) {
          try {
            stream = await ai.models.generateContentStream({
              model,
              contents,
              config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 2000, abortSignal: abort.signal },
            });
            break;
          } catch (caught) {
            lastError = caught;
            console.error('[assistente] modelo indisponível', model, caught);
          }
        }
        if (!stream) throw lastError;
        let finish: string | undefined;
        for await (const chunk of stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
          finish = chunk.candidates?.[0]?.finishReason ?? finish;
        }
        if (finish === 'SAFETY') controller.enqueue(encoder.encode('\n\n(O assistente não pode responder a isso.)'));
        if (finish === 'MAX_TOKENS') controller.enqueue(encoder.encode('\n\n(Resposta cortada por tamanho.)'));
      } catch (caught) {
        console.error('[assistente] falha no Gemini', caught);
        const busy = typeof caught === 'object' && caught !== null && 'status' in caught && caught.status === 429;
        const message = busy ? 'O assistente está ocupado (limite gratuito). Tente de novo em instantes.' : 'O assistente falhou ao responder. Tente de novo.';
        controller.enqueue(encoder.encode(`\n\n(${message})`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
