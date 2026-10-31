import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AppText } from '@/components/ui/primitives';

const LOADER = require('../../../assets/images/carregando.webp') as number;
/** Proporção da animação do site (260 × 313). */
const RATIO = 313 / 260;

/**
 * Carregamento temático: o mesmo dragão em pixel art do site (`public/mestre/carregando.webp`),
 * animado em loop. Com movimento reduzido, fica parado no primeiro quadro.
 */
export function DragonLoader({
  label = 'Carregando…',
  width = 180,
}: {
  label?: string;
  width?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <Image
        source={LOADER}
        style={{ width, height: width * RATIO }}
        contentFit="contain"
        autoplay={!reduced}
        accessibilityIgnoresInvertColors
      />
      <AppText variant="eyebrow">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
});
