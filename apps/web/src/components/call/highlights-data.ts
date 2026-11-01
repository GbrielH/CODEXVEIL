import {
  listCampaignCharacters,
  listSessionHighlights,
  listSessionTranscript,
  signedMediaUrls,
  type CodexveilClient,
} from '@codexveil/database';

/**
 * Dados da galeria de Melhores Momentos de uma sessão: momentos, imagens, personagens (com o
 * retrato, para anexar na IA de imagem) e, para o mestre, a transcrição (para criar à mão).
 */
export async function loadSessionHighlights(
  supabase: CodexveilClient,
  campaignId: string,
  sessionId: string,
  isGm: boolean,
) {
  const [highlights, party, transcript] = await Promise.all([
    listSessionHighlights(supabase, sessionId).catch(() => []),
    listCampaignCharacters(supabase, campaignId).catch(() => []),
    isGm ? listSessionTranscript(supabase, sessionId).catch(() => []) : Promise.resolve([]),
  ]);
  const urls = await signedMediaUrls(supabase, [
    ...highlights.map((highlight) => highlight.imagePath),
    ...party.map((character) => character.portraitPath),
  ]);
  return {
    highlights: highlights.map((highlight) => ({
      ...highlight,
      imageUrl: highlight.imagePath ? (urls[highlight.imagePath] ?? null) : null,
    })),
    characters: party.map((character) => ({
      id: character.id,
      name: character.name,
      portraitUrl: character.portraitPath ? (urls[character.portraitPath] ?? null) : null,
    })),
    transcript,
  };
}
