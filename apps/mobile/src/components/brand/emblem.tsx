import { defaultEmblemColors, EMBLEM_VIEWBOX, emblemPaths } from '@codexveil/ui/brand';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';
import { AppText } from '../ui/primitives';

/**
 * Emblema do Codexveil (mesmos caminhos SVG do site e dos ícones do app). É decorativo: o
 * `aria-hidden` fica na View, que o React Native e o navegador (react-native-web) entendem.
 */
export function Emblem({ size = 40 }: { size?: number }) {
  const c = defaultEmblemColors;
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox={EMBLEM_VIEWBOX}>
        <Path d={emblemPaths.arch} fill={c.veil} stroke={c.outline} strokeWidth={2} strokeLinejoin="round" />
        <Path d={emblemPaths.opening} fill={c.opening} />
        <Path d={emblemPaths.star} fill={c.star} />
        <Path d={emblemPaths.bookLeft} fill={c.pages} />
        <Path d={emblemPaths.bookRight} fill={c.pages} />
        <Path d={emblemPaths.spine} stroke={c.spine} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** Logotipo tipográfico: emblema + nome em capitulares. */
export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityLabel="Codexveil">
      <Emblem size={size} />
      <AppText style={{ fontFamily: fonts.display, fontSize: size * 0.5, letterSpacing: 3, color: colors.fgAccent, textTransform: 'uppercase' }}>Codexveil</AppText>
    </View>
  );
}
