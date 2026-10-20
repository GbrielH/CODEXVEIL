import { characterIcons } from '@codexveil/ui/character-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '@/components/ui/primitives';
import { colors, palette } from '@/lib/theme';

const CYCLE = 1450;
const FLAME_PATH = 'M0 0C22 -10 48 -30 80 -20C102 -12 104 8 82 18C50 30 22 10 0 0Z';
const HEAD = characterIcons.species.dragonborn?.d ?? '';
/** Boca do dragão no desenho de 1000 × 512. */
const MOUTH = { x: 440, y: 332 };

const FLAMES = [
  { delay: 0, x: 380, y: -40, color: palette.amber[300] },
  { delay: 0.18, x: 430, y: 30, color: palette.ember[400] },
  { delay: 0.36, x: 400, y: -10, color: palette.amber[400] },
  { delay: 0.54, x: 450, y: 45, color: palette.ember[300] },
  { delay: 0.72, x: 410, y: -55, color: palette.wine[400] },
  { delay: 0.9, x: 440, y: 10, color: palette.ember[400] },
  { delay: 1.08, x: 390, y: 50, color: palette.amber[300] },
  { delay: 1.26, x: 460, y: -25, color: palette.wine[300] },
] as const;

function Flame({
  flame,
  unit,
  reduced,
}: {
  flame: (typeof FLAMES)[number];
  unit: number;
  reduced: boolean;
}) {
  const progress = useSharedValue(reduced ? 0.45 : 0);
  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(
      flame.delay * 1000,
      withRepeat(
        withTiming(1, { duration: CYCLE, easing: Easing.bezier(0.25, 0.1, 0.35, 1) }),
        -1,
        false,
      ),
    );
  }, [flame.delay, progress, reduced]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = reduced
      ? 0.8
      : p < 0.12
        ? p / 0.12
        : p < 0.7
          ? 1 - ((p - 0.12) / 0.58) * 0.45
          : 0.55 * (1 - (p - 0.7) / 0.3);
    return {
      opacity,
      transform: [
        { translateX: flame.x * p * unit },
        { translateY: flame.y * p * unit },
        { scale: 0.2 + 1.9 * p },
      ],
    };
  });
  const width = 104 * unit;
  const height = 60 * unit;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: MOUTH.x * unit,
          top: MOUTH.y * unit - height / 2,
          width,
          height,
          transformOrigin: 'left',
        },
        style,
      ]}
    >
      <Svg width={width} height={height} viewBox="0 -30 104 60">
        <Path d={FLAME_PATH} fill={flame.color} />
      </Svg>
    </Animated.View>
  );
}

function useBreath(reduced: boolean): SharedValue<number> {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: CYCLE * 0.45 }),
        withTiming(0, { duration: CYCLE * 0.55 }),
      ),
      -1,
      false,
    );
  }, [breath, reduced]);
  return breath;
}

/**
 * Carregamento temático: o dragão (game-icons.net, CC BY 3.0) sopra fogo em chamas que crescem,
 * esfriam de âmbar para vinho e somem. Com movimento reduzido, fica parado no meio do sopro.
 */
export function DragonLoader({
  label = 'Carregando…',
  width = 200,
}: {
  label?: string;
  width?: number;
}) {
  const reduced = useReducedMotion();
  const unit = width / 1000;
  const height = 512 * unit;
  const breath = useBreath(reduced);
  const headStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -10 * unit * breath.value },
      { translateY: 4 * unit * breath.value },
      { rotate: `${-2 * breath.value}deg` },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0.12 : 0.05 + 0.12 * breath.value,
  }));

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={{ width, height }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 360 * unit,
              top: 255 * unit,
              width: 600 * unit,
              height: 160 * unit,
              borderRadius: 300 * unit,
              backgroundColor: palette.amber[400],
            },
            glowStyle,
          ]}
        />
        {FLAMES.map((flame) => (
          <Flame key={flame.delay} flame={flame} unit={unit} reduced={reduced} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '15% 85%' }, headStyle]}>
          <Svg width={width} height={height} viewBox="0 0 1000 512">
            <Path d={HEAD} fill={colors.fgAccent} />
          </Svg>
        </Animated.View>
      </View>
      <AppText variant="eyebrow">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
});
