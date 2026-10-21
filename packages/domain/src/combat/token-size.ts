/** Porte das criaturas e tamanho do token na grade da sessão (cada quadrado = 1,5 m). */
export const TOKEN_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type TokenSize = (typeof TOKEN_SIZES)[number];

/** Lado do token em quadrados. Miúdo ocupa 1 quadrado (desenhado menor). */
export const tokenSizeSquares: Record<TokenSize, number> = {
  tiny: 1,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

/** Nomes do porte em cada sistema (D&D 5e e Tormenta20). */
export function tokenSizeLabels(systemId: string): Record<TokenSize, string> {
  return systemId === 'tormenta20'
    ? { tiny: 'Minúsculo', small: 'Pequeno', medium: 'Médio', large: 'Grande', huge: 'Enorme', gargantuan: 'Colossal' }
    : { tiny: 'Miúdo', small: 'Pequeno', medium: 'Médio', large: 'Grande', huge: 'Enorme', gargantuan: 'Imenso' };
}

export function isTokenSize(value: unknown): value is TokenSize {
  return typeof value === 'string' && (TOKEN_SIZES as readonly string[]).includes(value);
}
