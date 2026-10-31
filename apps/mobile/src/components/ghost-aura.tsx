import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const GHOST = require('../../assets/images/fantasma.webp') as number;
/** Proporção do fantasminha (147 × 230). */
const RATIO = 230 / 147;

const POSITIONS = [
  { top: 6, left: 6, size: 34, delay: 0 },
  { top: 2, right: 54, size: 28, delay: 800 },
  { top: 64, right: 8, size: 30, delay: 1500 },
] as const;

function Ghost({ position }: { position: (typeof POSITIONS)[number] }) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    offset.value = withDelay(
      position.delay,
      withRepeat(withTiming(-10, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [offset, position.delay, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const { size, delay: _delay, ...place } = position;
  return (
    <Animated.View style={[{ position: 'absolute', ...place }, style]}>
      <Image source={GHOST} style={{ width: size, height: size * RATIO }} contentFit="contain" />
    </Animated.View>
  );
}

/**
 * Personagem morto ou morrendo (vida em zero): fantasminhas flutuando no alto da ficha, em loop,
 * até a vida voltar. Fica por cima sem bloquear os toques.
 */
export function GhostAura({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityLabel="Personagem morto ou morrendo"
    >
      {POSITIONS.map((position) => (
        <Ghost key={position.delay} position={position} />
      ))}
    </View>
  );
}

/** Vida zerada a partir dos recursos do personagem (o recurso de exibição "health"). */
export function isDown(
  resources: readonly { display: string; current: number; max: number | null }[],
) {
  const health = resources.find((resource) => resource.display === 'health');
  return Boolean(health && (health.max ?? 0) > 0 && health.current <= 0);
}
