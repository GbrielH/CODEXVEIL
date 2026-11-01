/** Instruções fixas: a imagem precisa servir de textura quadrada para a face do dado 3D. */
const DICE_SKIN_BASE = `Crie uma textura quadrada (1:1, 1024 × 1024 px) para ser aplicada nas faces de um dado de RPG 3D.
Regras:
- Padrão contínuo que preencha a imagem inteira, sem bordas, molduras, sombras externas ou fundo branco.
- Nada de números, letras, logotipos ou marcas d'água: os números do dado são colocados depois.
- Contraste médio no centro, para que um número por cima continue legível.
- Visual de material (pedra, metal, cristal, osso, tecido, energia…) visto de frente, sem perspectiva e sem mostrar o dado inteiro.
- Estilo de fantasia sombria, rico em detalhes, alta resolução.

Descrição da skin que eu quero:`;

/**
 * Prompt para gerar a skin de um dado numa IA de imagens. A descrição da pessoa vai no fim; para
 * o dado de um personagem, `context` diz quem ele é (a skin combina com o personagem).
 */
export function diceSkinPrompt(description: string, context?: string): string {
  const text = description.trim();
  return `${DICE_SKIN_BASE}
${text || '[descreva aqui a skin que você quer]'}${
    context ? `

O dado é de um personagem de RPG; combine o visual com ele:
${context}` : ''
  }`;
}
