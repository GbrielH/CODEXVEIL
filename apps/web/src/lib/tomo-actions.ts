import { z } from 'zod';

/**
 * Ações que o Tomo pode propor ao mestre. O modelo escreve cada proposta num bloco
 * ```tomo-acao { ... } ``` no fim da resposta; o chat mostra uma prévia e só grava quando o mestre
 * confirma. O servidor valida de novo e confere se a pessoa é mestre da campanha.
 */
export const tomoActionSchema = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('criar_criatura'),
    tipo: z.enum(['npc', 'monstro']),
    nome: z.string().trim().min(1).max(80),
    subtitulo: z.string().trim().max(80).default(''),
    descricao: z.string().trim().max(4000).default(''),
    segredos: z.string().trim().max(8000).default(''),
    tamanho: z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']).catch('medium'),
  }),
  z.object({
    acao: z.literal('criar_anotacao'),
    titulo: z.string().trim().min(1).max(120),
    texto: z.string().trim().max(20000).default(''),
    visibilidade: z.enum(['mestre', 'grupo']).catch('mestre'),
  }),
  z.object({
    acao: z.literal('nota_na_sessao'),
    sessao: z.number().int().min(1).max(100000),
    texto: z.string().trim().min(1).max(20000),
  }),
]);
export type TomoAction = z.output<typeof tomoActionSchema>;

const BLOCK = /```tomo-acao\s*([\s\S]*?)```/g;
const MAX_ACTIONS = 3;

/**
 * Separa o texto da resposta das ações propostas. Um bloco ainda aberto (resposta chegando) some
 * do texto, para o JSON não piscar na tela; blocos inválidos são descartados.
 */
export function extractTomoActions(text: string): { text: string; actions: TomoAction[] } {
  const actions: TomoAction[] = [];
  for (const match of text.matchAll(BLOCK)) {
    if (actions.length >= MAX_ACTIONS) break;
    try {
      const parsed = tomoActionSchema.safeParse(JSON.parse(match[1] ?? ''));
      if (parsed.success) actions.push(parsed.data);
    } catch {
      // JSON inválido: ignora a proposta.
    }
  }
  let clean = text.replace(BLOCK, '');
  const open = clean.indexOf('```tomo-acao');
  if (open >= 0) clean = clean.slice(0, open);
  return { text: clean.trim(), actions };
}

export function describeTomoAction(action: TomoAction): { title: string; detail: string } {
  switch (action.acao) {
    case 'criar_criatura':
      return {
        title: `Criar ${action.tipo === 'npc' ? 'NPC' : 'monstro'}: ${action.nome}`,
        detail: [action.subtitulo, action.descricao].filter(Boolean).join(' · '),
      };
    case 'criar_anotacao':
      return {
        title: `Criar anotação (${action.visibilidade === 'grupo' ? 'visível ao grupo' : 'só o mestre'}): ${action.titulo}`,
        detail: action.texto,
      };
    case 'nota_na_sessao':
      return { title: `Nota do mestre na sessão ${action.sessao}`, detail: action.texto };
  }
}

/** Instruções extras do modelo quando a pessoa é mestre da campanha aberta. */
export const TOMO_GM_ACTIONS_PROMPT = `Você pode PROPOR ações ao mestre desta campanha (nunca a jogadores). Só proponha quando ele pedir para criar, anotar ou registrar algo. Escreva a resposta normalmente e, no fim, um bloco por ação (no máximo 3), exatamente assim:
\`\`\`tomo-acao
{"acao":"criar_criatura","tipo":"npc","nome":"...","subtitulo":"...","descricao":"...","segredos":"...","tamanho":"medium"}
\`\`\`
Ações possíveis:
- criar_criatura: NPC ou monstro na biblioteca da campanha (fica oculto dos jogadores). tipo "npc" ou "monstro"; tamanho tiny, small, medium, large, huge ou gargantuan; "segredos" só o mestre vê.
- criar_anotacao: {"acao":"criar_anotacao","titulo":"...","texto":"...","visibilidade":"mestre" ou "grupo"} (use "mestre" se não pedirem outra coisa).
- nota_na_sessao: {"acao":"nota_na_sessao","sessao":<número da sessão>,"texto":"..."}: nota privada do mestre no roteiro de uma sessão (melhorias, ganchos, lembretes). Use um número da lista de sessões do contexto.
O JSON precisa ser válido, numa linha. Diga ao mestre que ele confirma no cartão abaixo antes de gravar. Nunca afirme que já gravou.`;
