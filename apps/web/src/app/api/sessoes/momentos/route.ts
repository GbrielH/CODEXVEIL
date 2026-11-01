import { GoogleGenAI } from '@google/genai';
import {
  createSessionHighlight,
  getCampaign,
  listCampaignCharacters,
  listCreatures,
  listSessionBlocks,
  listSessionTranscript,
} from '@codexveil/database';
import { buildHighlightsPrompt } from '@codexveil/domain';
import { summarizeSheet } from '@codexveil/rpg-systems';
import { highlightsResponseSchema, uuidSchema } from '@codexveil/validation';
import { z } from 'zod';
import { sessionFrom } from '@/lib/api-session';
import { assistantEnabled } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODELS = [
  process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
];
/** Transcrição enviada à IA (limite para caber no plano gratuito). */
const MAX_TRANSCRIPT_CHARS = 120_000;

const requestSchema = z.object({ sessionId: uuidSchema });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * "Gerar melhores momentos" (só o mestre): a IA (Gemini, plano gratuito) lê a transcrição da
 * sessão, os personagens e os NPCs/monstros citados no roteiro e devolve de 3 a 8 momentos com o
 * prompt de imagem. Substitui os momentos da IA desta sessão; os criados à mão ficam.
 */
export async function POST(request: Request): Promise<Response> {
  if (!assistantEnabled())
    return json({ error: 'A IA ainda não foi configurada no servidor.' }, 503);
  const session = await sessionFrom(request);
  if (!session) return json({ error: 'Entre na sua conta.' }, 401);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Sessão inválida.' }, 400);
  const { supabase, userId } = session;

  const { data: row } = await supabase
    .from('sessions')
    .select('id, campaign_id, number, title')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();
  if (!row) return json({ error: 'Sessão não encontrada.' }, 404);
  const campaign = await getCampaign(supabase, row.campaign_id, userId);
  if (!campaign || campaign.role !== 'gm')
    return json({ error: 'Só o mestre gera os momentos.' }, 403);

  const [segments, party, blocks, creatures] = await Promise.all([
    listSessionTranscript(supabase, row.id),
    listCampaignCharacters(supabase, campaign.id),
    listSessionBlocks(supabase, row.id),
    listCreatures(supabase, campaign.id),
  ]);
  if (segments.length < 3)
    return json(
      { error: 'A transcrição desta sessão ainda é curta demais para achar momentos.' },
      400,
    );

  // NPCs e monstros citados no roteiro da sessão.
  const cited = new Set(
    blocks.flatMap((block) =>
      (block.content?.type === 'npc_ref' || block.content?.type === 'monster_ref') &&
      block.content.data.creatureId
        ? [block.content.data.creatureId]
        : [],
    ),
  );
  let used = 0;
  const kept = segments.filter((segment) => {
    used += segment.text.length + segment.speakerLabel.length + 12;
    return used <= MAX_TRANSCRIPT_CHARS;
  });
  const prompt = buildHighlightsPrompt({
    campaign: { name: campaign.name, description: campaign.description },
    session: { number: row.number, title: row.title },
    characters: party.map((character) => ({
      name: character.name,
      description: summarizeSheet(character.systemId, character.sheet).subtitle,
    })),
    creatures: creatures
      .filter((creature) => cited.has(creature.id))
      .map((creature) => ({ name: creature.name, description: creature.description })),
    segments: kept.map((segment) => ({
      id: segment.id,
      speaker: segment.speakerLabel,
      text: segment.text,
    })),
  });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let result: { moments: z.output<typeof highlightsResponseSchema>['moments'] } | null = null;
  let usage = { in: 0, out: 0, model: '' };
  let lastError = '';
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', maxOutputTokens: 6000 },
      });
      const checked = highlightsResponseSchema.safeParse(JSON.parse(response.text ?? ''));
      usage = {
        in: response.usageMetadata?.promptTokenCount ?? 0,
        out: response.usageMetadata?.candidatesTokenCount ?? 0,
        model,
      };
      if (checked.success) {
        result = checked.data;
        break;
      }
      lastError = 'A IA respondeu fora do formato.';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Falha na IA.';
    }
  }
  const record = (status: 'done' | 'failed', moments: number) =>
    supabase.from('highlight_runs').insert({
      session_id: row.id,
      campaign_id: campaign.id,
      status,
      model: usage.model,
      tokens_in: usage.in,
      tokens_out: usage.out,
      moments,
      error: status === 'failed' ? lastError.slice(0, 500) : '',
    });
  if (!result) {
    await record('failed', 0);
    return json({ error: 'A IA não conseguiu montar os momentos agora. Tente de novo.' }, 502);
  }

  // Substitui os momentos gerados antes (os manuais ficam).
  await supabase.from('session_highlights').delete().eq('session_id', row.id).eq('source', 'ai');
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const byName = new Map(party.map((character) => [character.name.toLowerCase(), character.id]));
  for (const moment of result.moments) {
    const ids = moment.segmentIds.filter((id) => byId.has(id));
    await createSessionHighlight(supabase, row.id, {
      title: moment.title,
      summary: moment.summary,
      quotes: ids.map((id) => ({ speaker: byId.get(id)!.speakerLabel, text: byId.get(id)!.text })),
      segmentIds: ids,
      characterIds: moment.characters.flatMap((name) => {
        const id = byName.get(name.toLowerCase());
        return id ? [id] : [];
      }),
      location: moment.location,
      mood: moment.mood,
      imagePrompt: moment.imagePrompt,
      source: 'ai',
    });
  }
  await record('done', result.moments.length);
  return json({ moments: result.moments.length, tokens: usage.in + usage.out });
}
