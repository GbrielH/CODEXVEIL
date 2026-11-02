/** Limite de momentos por geração (controle de uso do plano gratuito da IA). */
export const MAX_HIGHLIGHTS = 8;

/** Estilo das imagens, combinando com a identidade do Codexveil. */
export const HIGHLIGHT_IMAGE_STYLE =
  'dark fantasy oil painting, dramatic chiaroscuro lighting, rich wine red, charcoal and parchment tones, cinematic composition, highly detailed, no text';

export interface HighlightPromptInput {
  campaign: { name: string; description: string };
  session: { number: number; title: string };
  characters: { name: string; description: string }[];
  creatures: { name: string; description: string }[];
  segments: { id: string; speaker: string; text: string }[];
}

export interface ExistingAiHighlight {
  id: string;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Só cartões automáticos ainda intactos podem ser substituídos. Uma imagem enviada ou qualquer
 * edição posterior à criação transforma o cartão em parte do registro curado pelo mestre.
 */
export function replaceableAiHighlightIds(highlights: readonly ExistingAiHighlight[]): string[] {
  return highlights.flatMap((highlight) => {
    if (highlight.imagePath) return [];
    const created = Date.parse(highlight.createdAt);
    const updated = Date.parse(highlight.updatedAt);
    if (!Number.isFinite(created) || !Number.isFinite(updated) || updated > created) return [];
    return [highlight.id];
  });
}

/**
 * Prompt da análise. As falas do mestre chegam só como "Mestre": a IA deduz pelo contexto quando
 * é narração e quando é a fala de um NPC ou monstro (ex.: no combate contra o ogro, a fala do
 * mestre dirigida aos jogadores provavelmente é do ogro).
 */
export function buildHighlightsPrompt(input: HighlightPromptInput): string {
  const characters = input.characters
    .map((entry) => `- ${entry.name}: ${entry.description || 'sem descrição'}`)
    .join('\n');
  const creatures = input.creatures
    .map((entry) => `- ${entry.name}: ${entry.description || 'sem descrição'}`)
    .join('\n');
  const transcript = input.segments
    .map((entry) => `(${entry.id}) ${entry.speaker}: ${entry.text}`)
    .join('\n');
  return `Você analisa a transcrição de uma sessão de RPG de mesa e escolhe os melhores momentos.

Campanha: ${input.campaign.name}
${input.campaign.description ? `Resumo da campanha: ${input.campaign.description}\n` : ''}Sessão ${input.session.number}: ${input.session.title}

Personagens dos jogadores:
${characters || '- (nenhum cadastrado)'}

NPCs e monstros desta sessão:
${creatures || '- (nenhum citado no roteiro)'}

Regras:
- Toda fala do mestre aparece como "Mestre". Pelo contexto da cena, deduza quando é narração e quando é a fala de um NPC ou monstro específico (por exemplo, numa luta contra um ogro, uma fala do mestre dirigida aos jogadores provavelmente é do ogro). Use essa dedução ao descrever os momentos e nos prompts de imagem.
- Escolha de 3 a ${MAX_HIGHLIGHTS} momentos marcantes: diálogos, combates, reviravoltas, momentos engraçados ou emocionantes. Menos, se a sessão for curta.
- Responda em português do Brasil, exceto "imagePrompt", que deve ser em inglês.
- "segmentIds": os ids (entre parênteses) das falas que mostram o momento.
- "characters": nomes dos personagens dos jogadores envolvidos, exatamente como na lista.
- "imagePrompt": prompt detalhado para gerar a imagem da cena (personagens com a aparência descrita, ação, ambiente, luz, enquadramento), no estilo: ${HIGHLIGHT_IMAGE_STYLE}. Diga para usar os retratos anexados como referência visual dos personagens.

Responda só com JSON no formato:
{"moments":[{"title":"...","summary":"...","segmentIds":["..."],"characters":["..."],"location":"...","mood":"...","imagePrompt":"..."}]}

Transcrição:
${transcript}`;
}
