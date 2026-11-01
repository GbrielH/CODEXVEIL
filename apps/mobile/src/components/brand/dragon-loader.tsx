import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { AppText } from '@/components/ui/primitives';
import { colors } from '@/lib/theme';

const LOADER = require('../../../assets/images/carregando.webp') as number;
/** Proporção da animação do site (260 × 313). */
const RATIO = 313 / 260;

/** Montanha rochosa do site (viewBox 0 0 140 200): a encosta esquerda esconde o corte da arte. */
const MOUNTAIN =
  'M0 200 L3 168 L9 150 L5 128 L13 110 L9 92 L17 74 L14 58 L22 44 L20 32 L29 20 L36 6 L41 0 L47 9 L53 5 L60 18 L66 16 L74 32 L84 30 L92 48 L104 54 L112 72 L126 80 L140 96 L140 200 Z';
const RIM = 'M3 168 L9 150 L5 128 L13 110 L9 92 L17 74 L14 58 L22 44 L20 32 L29 20 L36 6 L41 0 L47 9';
const SNOW = 'M29 20 L36 6 L41 0 L47 9 L53 5 L60 18 L54 15 L49 21 L43 13 L37 22 L33 18 Z';
const CRACKS =
  'M30 40 L38 62 L34 80 M52 30 L60 58 M44 90 L58 120 L54 150 M78 70 L86 100 M24 120 L32 146';

/**
 * Carregamento temático: o mesmo dragão em pixel art do site, animado em loop, espiando de trás
 * da mesma montanha (a arte termina cortada na direita). Com movimento reduzido, fica parado.
 */
export function DragonLoader({
  label = 'Carregando…',
  width = 160,
}: {
  label?: string;
  width?: number;
}) {
  const reduced = useReducedMotion();
  const height = width * RATIO;
  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      {/* A margem direita reserva espaço para a montanha (~56% da largura do dragão). */}
      <View style={{ width, height, marginRight: width * 0.6 }}>
        <Image
          source={LOADER}
          style={{ width, height }}
          contentFit="contain"
          autoplay={!reduced}
          accessibilityIgnoresInvertColors
        />
        <Svg
          viewBox="0 0 140 200"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left: width * 0.84,
            top: -height * 0.12,
            width: width * 0.72,
            height: height * 1.12,
          }}
        >
          <Defs>
            <LinearGradient id="rocha" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#2C1760" />
              <Stop offset="0.35" stopColor="#1D0F3D" />
              <Stop offset="1" stopColor={colors.canvas} />
            </LinearGradient>
            <LinearGradient id="rocha-fundo" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.6" stopColor={colors.canvas} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.canvas} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Path d={MOUNTAIN} fill="url(#rocha)" />
          <Path d={CRACKS} fill="none" stroke="#07070A" strokeWidth={1.4} opacity={0.7} />
          <Path d={SNOW} fill="#E4D7CC" opacity={0.9} />
          <Path
            d={RIM}
            fill="none"
            stroke="#A88BFF"
            strokeWidth={1.6}
            strokeLinejoin="round"
            opacity={0.85}
          />
          <Rect width="140" height="200" fill="url(#rocha-fundo)" />
        </Svg>
      </View>
      <AppText variant="eyebrow">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
});
