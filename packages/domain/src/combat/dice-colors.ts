/** Cores dos dados que cada participante escolhe na sessão (uma cor por pessoa na mesa). */
export const DICE_COLORS: readonly { hex: string; name: string }[] = [
  { hex: '#7a1f2b', name: 'Vinho' },
  { hex: '#b23a48', name: 'Carmim' },
  { hex: '#e04040', name: 'Vermelho' },
  { hex: '#c46a2a', name: 'Cobre' },
  { hex: '#e8862a', name: 'Laranja' },
  { hex: '#d98e04', name: 'Âmbar' },
  { hex: '#e3c13a', name: 'Ouro' },
  { hex: '#9bbf3a', name: 'Lima' },
  { hex: '#5a8f29', name: 'Musgo' },
  { hex: '#2f7d4a', name: 'Esmeralda' },
  { hex: '#2aa198', name: 'Turquesa' },
  { hex: '#4fc3d9', name: 'Céu' },
  { hex: '#1f6f8b', name: 'Petróleo' },
  { hex: '#3b4cb8', name: 'Safira' },
  { hex: '#1e2a6b', name: 'Marinho' },
  { hex: '#6b3fa0', name: 'Ametista' },
  { hex: '#a46bd6', name: 'Lavanda' },
  { hex: '#d4568c', name: 'Rosa' },
  { hex: '#8a4b2a', name: 'Madeira' },
  { hex: '#e8dcc0', name: 'Pergaminho' },
  { hex: '#f2f2f5', name: 'Marfim' },
  { hex: '#c2c2c8', name: 'Prata' },
  { hex: '#5c5c66', name: 'Ferro' },
  { hex: '#222226', name: 'Ônix' },
];

/** Cor do número sobre o dado (escuro em dados claros, claro em dados escuros). */
export function diceTextColor(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

export function diceColorName(hex: string | null | undefined): string {
  if (!hex) return '';
  return DICE_COLORS.find((color) => color.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}
