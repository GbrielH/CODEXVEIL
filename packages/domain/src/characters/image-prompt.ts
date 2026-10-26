/** Dados do personagem usados para montar o prompt de imagem (todos opcionais, menos o sistema). */
export interface CharacterImageInput {
  system: string;
  name?: string;
  species?: string;
  className?: string;
  level?: number | null;
  background?: string;
  alignment?: string;
  /** Atributos mais altos, em ordem (ex.: ["Força", "Constituição"]). */
  strengths?: readonly string[];
  /** Itens equipados ou marcantes (armas, armadura, foco). */
  equipment?: readonly string[];
  appearance?: string;
  personality?: string;
  backstory?: string;
}

function clip(text: string | undefined, max: number): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const STRENGTH_LOOKS: Record<string, string> = {
  Força: 'físico forte e musculoso',
  Destreza: 'postura ágil e esguia',
  Constituição: 'corpo robusto e resistente',
  Inteligência: 'olhar atento e estudioso',
  Sabedoria: 'expressão serena e perspicaz',
  Carisma: 'presença marcante e confiante',
};

/**
 * Prompt opcional para gerar a imagem do personagem numa IA de imagens, a partir do que foi
 * escolhido na criação. O jogador copia ou ignora; nada é enviado a serviço nenhum.
 */
export function characterImagePrompt(input: CharacterImageInput): string {
  const who = [input.species, input.className ? `${input.className}${input.level ? ` de nível ${input.level}` : ''}` : ''].filter(Boolean).join(' ');
  const looks = (input.strengths ?? []).slice(0, 2).map((name) => STRENGTH_LOOKS[name]).filter(Boolean);
  const parts = [
    `Retrato de personagem de RPG de fantasia (${input.system})${input.name ? `: ${clip(input.name, 80)}` : ''}${who ? `, ${who}` : ''}.`,
    input.background ? `Antecedente/origem: ${clip(input.background, 80)}.` : '',
    input.alignment ? `Tendência: ${clip(input.alignment, 40)}.` : '',
    looks.length ? `Aparência física: ${looks.join(', ')}.` : '',
    input.appearance ? `Descrição: ${clip(input.appearance, 500)}.` : '',
    input.equipment?.length ? `Equipamento visível: ${input.equipment.slice(0, 6).join(', ')}.` : '',
    input.personality ? `Personalidade que deve transparecer na pose e na expressão: ${clip(input.personality, 300)}.` : '',
    input.backstory ? `Contexto da história: ${clip(input.backstory, 400)}.` : '',
    'Estilo: pintura digital de fantasia, iluminação dramática, meio corpo, fundo que combine com a origem do personagem, alta riqueza de detalhes, sem texto nem marca d’água.',
  ];
  return parts.filter(Boolean).join('\n');
}

/**
 * Prompt para gerar o token do grid numa IA de imagens. O jogador anexa a imagem do personagem
 * (o retrato) junto com este texto; a IA usa a imagem como referência e devolve o token.
 */
export function characterTokenPrompt(input: CharacterImageInput): string {
  const who = [input.species, input.className].filter(Boolean).join(' ');
  return [
    `Use a imagem anexada como referência fiel do personagem${input.name ? ` ${clip(input.name, 80)}` : ''}${who ? ` (${who}, ${input.system})` : ` (${input.system})`}: mesmo rosto, cabelo, roupas, cores e equipamento.`,
    'Crie um token redondo para mapa de RPG de mesa virtual (VTT): o personagem centralizado, do peito para cima ou de corpo inteiro visto levemente de cima, olhando para a frente.',
    'Moldura circular com borda metálica fina e discreta; fundo fora do círculo totalmente transparente (PNG) ou liso de uma cor só.',
    'Imagem quadrada 512 × 512, contornos nítidos e alto contraste para ler bem em tamanho pequeno, sem texto, sem marca d’água, sem outros personagens.',
    'Estilo: pintura digital de fantasia, a mesma paleta da imagem de referência.',
  ].join('\n');
}
