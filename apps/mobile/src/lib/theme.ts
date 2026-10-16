/**
 * Tema do app mobile, derivado dos tokens compartilhados de @codexveil/ui — a mesma
 * identidade "Dark Fantasy Premium + Grimório Vivo" do site.
 */
import { colors, minTouchTarget, palette, radii, spacing } from '@codexveil/ui/tokens';

export { colors, minTouchTarget, palette, radii, spacing };

/** Nomes das fontes carregadas em `app/_layout.tsx` (expo-google-fonts). */
export const fonts = {
  display: 'Cinzel_600SemiBold',
  displayBold: 'Cinzel_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  serif: 'Alegreya_400Regular',
  serifItalic: 'Alegreya_400Regular_Italic',
} as const;

export const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.fgAccent,
    background: colors.canvas,
    card: colors.raised,
    text: colors.fg,
    border: colors.line,
    notification: colors.primary,
  },
  fonts: {
    regular: { fontFamily: fonts.sans, fontWeight: '400' as const },
    medium: { fontFamily: fonts.sansMedium, fontWeight: '500' as const },
    bold: { fontFamily: fonts.sansSemiBold, fontWeight: '600' as const },
    heavy: { fontFamily: fonts.displayBold, fontWeight: '700' as const },
  },
};
