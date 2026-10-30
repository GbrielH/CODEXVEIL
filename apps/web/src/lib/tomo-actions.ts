import { z } from 'zod';

/**
 * Ações que o Tomo pode propor a qualquer pessoa. O modelo escreve cada proposta num bloco
 * ```tomo-acao { ... } ``` no fim da resposta; o chat mostra uma prévia e só grava quando a pessoa
 * confirma. O servidor valida de novo e grava com as permissões dela (o RLS decide o que pode).
 */
const text = (max: number) => z.string().trim().max(max).default('');
const required = (max: number) => z.string().trim().min(1).max(max);
const system = z.enum(['dnd5e', 'tormenta20']);
const category = z.enum(['weapon', 'armor', 'gear', 'consumable', 'tool', 'treasure', 'other']).catch('gear');

export const tomoActionSchema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('criar_campanha'), nome: required(80), descricao: text(2000), sistema: system }),
  z.object({
    acao: z.literal('criar_personagem'),
    sistema: system,
    nome: required(80),
    altura: text(40),
    idade: text(40),
    aparencia: text(4000),
    personalidade: text(4000),
    historia: text(20000),
  }),
  z.object({
    acao: z.literal('criar_anotacao'),
    titulo: required(120),
    texto: text(20000),
    visibilidade: z.enum(['grupo', 'mestre', 'so_eu']).catch('so_eu'),
  }),
  z.object({
    acao: z.literal('criar_criatura'),
    tipo: z.enum(['npc', 'monstro']),
    nome: required(80),
    subtitulo: text(80),
    descricao: text(4000),
    segredos: text(8000),
    tamanho: z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']).catch('medium'),
  }),
  z.object({
    acao: z.literal('criar_item'),
    nome: required(120),
    categoria: category,
    raridade: text(60),
    valor: text(60),
    descricao: text(8000),
    visivel_ao_grupo: z.boolean().catch(false),
  }),
  z.object({ acao: z.literal('criar_sessao'), titulo: required(120) }),
  z.object({ acao: z.literal('nota_na_sessao'), sessao: z.number().int().min(1).max(100000), texto: required(20000) }),
  z.object({
    acao: z.literal('criar_quadro'),
    titulo: required(80),
    notas: z.array(z.string().trim().min(1).max(2000)).max(24).default([]),
  }),
  z.object({
    acao: z.literal('editar_personagem'),
    nome: z.string().trim().max(80).optional(),
    aparencia: z.string().trim().max(4000).optional(),
    personalidade: z.string().trim().max(4000).optional(),
    historia: z.string().trim().max(20000).optional(),
  }),
  z.object({
    acao: z.literal('ajustar_recurso'),
    recurso: z.enum(['pv', 'pm', 'dinheiro']),
    operacao: z.enum(['dano', 'cura', 'gastar', 'receber', 'definir']),
    valor: z.number().int().min(0).max(1_000_000),
    /** D&D: moeda (cp, sp, ep, gp, pp); padrão ouro. */
    moeda: z.enum(['cp', 'sp', 'ep', 'gp', 'pp']).catch('gp').optional(),
  }),
  z.object({
    acao: z.literal('habilidade_no_personagem'),
    tipo: z.enum(['habilidade', 'poder', 'magia', 'talento']).catch('habilidade'),
    nome: required(120),
    descricao: text(8000),
  }),
  z.object({
    acao: z.literal('item_no_personagem'),
    nome: required(120),
    categoria: category,
    quantidade: z.number().int().min(1).max(9999).catch(1),
    descricao: text(4000),
  }),
]);
export type TomoAction = z.output<typeof tomoActionSchema>;

const BLOCK = /```tomo-acao\s*([\s\S]*?)```/g;
const MAX_ACTIONS = 5;

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

const SYSTEM_NAMES = { dnd5e: 'D&D 5e', tormenta20: 'Tormenta20' } as const;
const VISIBILITY_NAMES = { grupo: 'visível ao grupo', mestre: 'você e o mestre', so_eu: 'só você' } as const;

export function describeTomoAction(action: TomoAction): { title: string; detail: string } {
  switch (action.acao) {
    case 'criar_campanha':
      return { title: `Criar campanha (${SYSTEM_NAMES[action.sistema]}): ${action.nome}`, detail: action.descricao };
    case 'criar_personagem':
      return {
        title: `Começar personagem (${SYSTEM_NAMES[action.sistema]}): ${action.nome}`,
        detail: ['Abre a criação já preenchida para você terminar.', action.aparencia].filter(Boolean).join(' '),
      };
    case 'criar_anotacao':
      return { title: `Criar anotação (${VISIBILITY_NAMES[action.visibilidade]}): ${action.titulo}`, detail: action.texto };
    case 'criar_criatura':
      return {
        title: `Criar ${action.tipo === 'npc' ? 'NPC' : 'monstro'}: ${action.nome}`,
        detail: [action.subtitulo, action.descricao].filter(Boolean).join(' · '),
      };
    case 'criar_item':
      return { title: `Criar item na biblioteca: ${action.nome}`, detail: [action.raridade, action.valor, action.descricao].filter(Boolean).join(' · ') };
    case 'criar_sessao':
      return { title: `Criar sessão: ${action.titulo}`, detail: 'Fica como rascunho (não publicada) até você publicar.' };
    case 'nota_na_sessao':
      return { title: `Nota do mestre na sessão ${action.sessao}`, detail: action.texto };
    case 'criar_quadro':
      return { title: `Criar quadro: ${action.titulo}`, detail: action.notas.length ? `${action.notas.length} nota(s): ${action.notas.slice(0, 3).join(' · ')}` : '' };
    case 'editar_personagem':
      return {
        title: `Alterar a ficha${action.nome ? `: nome → ${action.nome}` : ''}`,
        detail: [action.aparencia && 'aparência', action.personalidade && 'personalidade', action.historia && 'história'].filter(Boolean).join(', '),
      };
    case 'ajustar_recurso': {
      const what = { pv: 'PV', pm: 'PM', dinheiro: 'dinheiro' }[action.recurso];
      const verb = { dano: 'Dano em', cura: 'Curar', gastar: 'Gastar', receber: 'Receber', definir: 'Definir' }[action.operacao];
      return { title: `${verb} ${what}: ${action.valor}`, detail: '' };
    }
    case 'habilidade_no_personagem':
      return { title: `Adicionar à ficha (${action.tipo}): ${action.nome}`, detail: action.descricao };
    case 'item_no_personagem':
      return { title: `Adicionar ao inventário: ${action.quantidade}× ${action.nome}`, detail: action.descricao };
  }
}

/** Instruções do modelo: o que ele pode propor, conforme a página e o papel da pessoa. */
export function tomoActionsPrompt(scope: { campaignRole: 'gm' | 'player' | null; characterEditable: boolean }): string {
  const lines = [
    'Você pode PROPOR ações que a pessoa confirma num cartão antes de gravar. Proponha quando ela pedir para criar, anotar, montar ou registrar algo. Escreva a resposta normalmente e, no fim, um bloco por ação (no máximo 5), assim:',
    '```tomo-acao',
    '{"acao":"criar_anotacao","titulo":"...","texto":"...","visibilidade":"so_eu"}',
    '```',
    'O JSON precisa ser válido, numa linha. Diga que ela confirma no cartão abaixo. Nunca afirme que já gravou.',
    'Ações disponíveis agora:',
    '- criar_campanha: {"acao":"criar_campanha","nome":"...","descricao":"...","sistema":"dnd5e" ou "tormenta20"} (a pessoa vira mestre dela).',
    '- criar_personagem: {"acao":"criar_personagem","sistema":"dnd5e" ou "tormenta20","nome":"...","altura":"...","idade":"...","aparencia":"...","personalidade":"...","historia":"..."}: abre o assistente de criação já preenchido; classe, raça e atributos ela escolhe lá.',
  ];
  if (scope.campaignRole) {
    lines.push(
      '- criar_anotacao (nesta campanha): {"acao":"criar_anotacao","titulo":"...","texto":"...","visibilidade":"so_eu", "mestre" ou "grupo"}.',
    );
  }
  if (scope.campaignRole === 'gm') {
    lines.push(
      '- criar_criatura: {"acao":"criar_criatura","tipo":"npc" ou "monstro","nome":"...","subtitulo":"...","descricao":"...","segredos":"...","tamanho":"medium"} (tiny, small, medium, large, huge, gargantuan); fica oculta dos jogadores; "segredos" só o mestre vê.',
      '- criar_item: {"acao":"criar_item","nome":"...","categoria":"weapon|armor|gear|consumable|tool|treasure|other","raridade":"...","valor":"...","descricao":"...","visivel_ao_grupo":false} na biblioteca da campanha.',
      '- criar_sessao: {"acao":"criar_sessao","titulo":"..."} (fica não publicada).',
      '- nota_na_sessao: {"acao":"nota_na_sessao","sessao":<número da lista de sessões>,"texto":"..."}: nota privada do mestre no fim do roteiro.',
      '- criar_quadro: {"acao":"criar_quadro","titulo":"...","notas":["...","..."]}: quadro livre do mestre com notas (até 24).',
    );
  }
  if (scope.characterEditable) {
    lines.push(
      '- item_no_personagem (no personagem aberto): {"acao":"item_no_personagem","nome":"...","categoria":"gear","quantidade":1,"descricao":"..."}.',
      '- editar_personagem (no personagem aberto): {"acao":"editar_personagem","nome":"...","aparencia":"...","personalidade":"...","historia":"..."} (mande só os campos que mudam).',
      '- ajustar_recurso (no personagem aberto): {"acao":"ajustar_recurso","recurso":"pv"|"pm"|"dinheiro","operacao":"dano"|"cura"|"gastar"|"receber"|"definir","valor":10} (D&D: "moeda":"gp" etc.).',
      '- habilidade_no_personagem (no personagem aberto): {"acao":"habilidade_no_personagem","tipo":"habilidade"|"poder"|"magia"|"talento","nome":"...","descricao":"..."}.',
    );
  }
  lines.push(
    'Faça exatamente o que a pessoa pediu, com a ação certa. NUNCA troque o pedido por uma anotação: anotação só quando ela pedir uma anotação. Se nenhuma ação da lista serve, diga isso e onde ela faz na plataforma.',
  );
  return lines.join('\n');
}
