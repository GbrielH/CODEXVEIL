/**
 * Glifos próprios do Codexveil, desenhados no mesmo estilo dos ícones Lucide
 * (grade 24×24, traço 2, pontas arredondadas) para manter o sistema de ícones consistente.
 * Ícones genéricos de interface vêm do Lucide; aqui ficam apenas os temáticos que ele não tem.
 */

export const GLYPH_VIEWBOX = '0 0 24 24';

export interface GlyphDefinition {
  /** Caminhos desenhados apenas com traço (stroke), sem preenchimento. */
  readonly paths: readonly string[];
}

export const glyphs = {
  /** Dado de 20 faces — sistemas baseados em d20. */
  d20: {
    paths: [
      'M12 2l8.66 5v10L12 22l-8.66-5V7z',
      'M12 8l5 8H7z',
      'M3.34 7L12 8l8.66-1',
      'M20.66 7L17 16l-5 6-5-6-3.66-9',
    ],
  },
} as const satisfies Record<string, GlyphDefinition>;

export type GlyphName = keyof typeof glyphs;
