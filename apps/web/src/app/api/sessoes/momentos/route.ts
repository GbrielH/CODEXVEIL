import { GoogleGenAI } from '@google/genai';
import {
  createSessionHighlight,
  getCampaign,
  hasSessionTranscriptExpired,
  listCampaignCharacters,
  listCreatures,
  listSessionBlocks,
  listSessionTranscript,
} from '@codexveil/database';
import { buildHighlightsPrompt, replaceableAiHighlightIds } from '@codexveil/domain';
import { summarizeSheet } from '@codexveil/rpg-systems';
import { highlightsResponseSchema, uuidSchema } from '@codexveil/validation';
import { z } from 'zod';
import { sessionFrom } from '@/lib/api-session';
import { assistantEnabled, callsEnabled } from '@/lib/env';

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
  if (!callsEnabled())
    return json({ error: 'Os Melhores Momentos ainda não estão liberados.' }, 404);
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
  if (segments.length < 3) {
    const expired =
      segments.length === 0 &&
      (await hasSessionTranscriptExpired(supabase, row.id).catch(() => false));
    return json(
      {
        error: expired
          ? 'As falas desta sessão já foram apagadas (24 h após a call).'
          : 'A transcrição desta sessão ainda é curta demais para achar momentos.',
      },
      400,
    );
  }

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

  const { data: startedRun, error: startError } = await supabase.rpc('start_highlight_run', {
    p_session_id: row.id,
  });
  if (startError) {
    if (startError.code === '55P03')
      return json({ error: 'Já existe uma geração em andamento para esta sessão.' }, 409);
    return json({ error: 'Não foi possível iniciar a geração dos momentos.' }, 500);
  }
  const runId = startedRun;

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
  const finish = (status: 'done' | 'failed', moments: number, error = lastError) =>
    supabase.rpc('finish_highlight_run', {
      p_run_id: runId,
      p_status: status,
      p_model: usage.model,
      p_tokens_in: usage.in,
      p_tokens_out: usage.out,
      p_moments: moments,
      p_error: status === 'failed' ? error.slice(0, 500) : '',
    });
  if (!result) {
    await finish('failed', 0);
    return json({ error: 'A IA não conseguiu montar os momentos agora. Tente de novo.' }, 502);
  }

  // Cria a nova geração antes de remover a anterior. Se uma gravação falhar, apaga somente os
  // cartões novos já criados e preserva a geração que a mesa ainda vê.
  const { data: previous, error: previousError } = await supabase
    .from('session_highlights')
    .select('id, image_path, created_at, updated_at')
    .eq('session_id', row.id)
    .eq('source', 'ai');
  if (previousError) {
    await finish('failed', 0, 'Não foi possível ler a geração anterior.');
    return json({ error: 'Não foi possível preparar a nova geração de momentos.' }, 500);
  }
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const byName = new Map(party.map((character) => [character.name.toLowerCase(), character.id]));
  const created: string[] = [];
  try {
    for (const moment of result.moments) {
      const ids = moment.segmentIds.filter((id) => byId.has(id));
      created.push(
        await createSessionHighlight(supabase, row.id, {
          title: moment.title,
          summary: moment.summary,
          quotes: ids.map((id) => ({
            speaker: byId.get(id)!.speakerLabel,
            text: byId.get(id)!.text,
          })),
          segmentIds: ids,
          characterIds: moment.characters.flatMap((name) => {
            const id = byName.get(name.toLowerCase());
            return id ? [id] : [];
          }),
          location: moment.location,
          mood: moment.mood,
          imagePrompt: moment.imagePrompt,
          source: 'ai',
        }),
      );
    }
  } catch {
    if (created.length) await supabase.from('session_highlights').delete().in('id', created);
    await finish('failed', 0, 'Não foi possível salvar os novos momentos.');
    return json(
      { error: 'Não foi possível salvar os novos momentos. Os anteriores foram preservados.' },
      500,
    );
  }
  const previousIds = replaceableAiHighlightIds(
    previous.map((entry) => ({
      id: entry.id,
      imagePath: entry.image_path,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    })),
  );
  if (previousIds.length) {
    const { error: deleteError } = await supabase
      .from('session_highlights')
      .delete()
      .in('id', previousIds);
    if (deleteError) {
      await finish('failed', 0, 'Não foi possível remover os momentos automáticos anteriores.');
      return json(
        { error: 'Os novos momentos foram salvos, mas os anteriores não puderam ser removidos.' },
        500,
      );
    }
  }
  const { error: finishError } = await finish('done', result.moments.length);
  if (finishError)
    return json({ error: 'Os momentos foram salvos, mas a geração não pôde ser finalizada.' }, 500);
  return json({ moments: result.moments.length, tokens: usage.in + usage.out });
}
