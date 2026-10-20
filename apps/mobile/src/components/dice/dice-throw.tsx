import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, palette } from '@/lib/theme';
import type { ShownRoll } from './dice';

/** Limite de dados animados ao mesmo tempo (o resto entra só no total), para não travar. */
export const MAX_THROWN_DICE = 6;
const SPIN_MS = 900;
const VISIBLE_MS = 2300;

function diePoints(sides: number): string {
  switch (sides) {
    case 4:
      return '50,6 94,88 6,88';
    case 6:
      return '12,12 88,12 88,88 12,88';
    case 8:
      return '50,4 94,50 50,96 6,50';
    case 10:
    case 100:
      return '50,4 92,40 50,96 8,40';
    case 12:
      return '50,4 94,36 77,92 23,92 6,36';
    default:
      return '50,3 91,26 91,74 50,97 9,74 9,26';
  }
}

interface Thrown {
  sides: number;
  value: number;
  kept: boolean;
}

function thrownDice(roll: ShownRoll): Thrown[] {
  const list: Thrown[] = [];
  for (const group of roll.dice) {
    const kept = [...group.kept];
    for (const value of group.values) {
      const index = kept.indexOf(value);
      if (index >= 0) kept.splice(index, 1);
      list.push({ sides: group.sides, value, kept: index >= 0 });
    }
  }
  return list.slice(0, MAX_THROWN_DICE);
}

function Die({ die, index, size, natural }: { die: Thrown; index: number; size: number; natural: 'crit' | 'fumble' | null }) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * die.sides));
  const [landed, setLanded] = useState(false);
  const y = useSharedValue(reduced ? 0 : -height * 0.7);
  const turn = useSharedValue(reduced ? 0 : -540);

  useEffect(() => {
    const delay = index * 90;
    y.value = withDelay(delay, withSequence(withTiming(0, { duration: 550, easing: Easing.in(Easing.quad) }), withTiming(-height * 0.06, { duration: 150 }), withSpring(0, { damping: 9 })));
    turn.value = withDelay(delay, withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) }));
    const spin = setInterval(() => setFace(1 + Math.floor(Math.random() * die.sides)), 70);
    const stop = setTimeout(() => {
      clearInterval(spin);
      setFace(die.value);
      setLanded(true);
    }, SPIN_MS + delay);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [die, index, height, y, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${turn.value}deg` }] }));
  const fill = landed && natural === 'crit' ? palette.verdigris[900] : landed && natural === 'fumble' ? palette.ember[900] : palette.wine[800];
  const stroke = landed && natural === 'crit' ? palette.verdigris[300] : landed && natural === 'fumble' ? palette.ember[300] : palette.parchment[300];

  return (
    <Animated.View style={[{ width: size, height: size, opacity: !die.kept && landed ? 0.4 : 1 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points={diePoints(die.sides)} fill={fill} stroke={stroke} strokeWidth={4} strokeLinejoin="round" />
      </Svg>
      <View style={styles.faceWrap}>
        <AppText style={[styles.face, { fontSize: size * 0.36 }]}>{face}</AppText>
      </View>
    </Animated.View>
  );
}

/** Dados grandes caindo e girando no meio da tela (sem caixa); somem sozinhos ou com um toque. */
export function DiceThrow({ roll, onDone }: { roll: ShownRoll & { key: number }; onDone: () => void }) {
  const dice = thrownDice(roll);
  const extra = roll.dice.reduce((sum, group) => sum + group.values.length, 0) - dice.length;
  const d20 = roll.dice.find((group) => group.sides === 20 && group.kept.length === 1);
  const natural = d20?.kept[0] === 20 ? 'crit' : d20?.kept[0] === 1 ? 'fumble' : null;
  const [showTotal, setShowTotal] = useState(false);
  const size = dice.length > 3 ? 84 : 112;

  useEffect(() => {
    const total = setTimeout(() => setShowTotal(true), SPIN_MS + dice.length * 90);
    const done = setTimeout(onDone, VISIBLE_MS + dice.length * 90);
    return () => {
      clearTimeout(total);
      clearTimeout(done);
    };
  }, [roll.key, dice.length, onDone]);

  if (dice.length === 0) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDone} accessibilityLabel={`Resultado ${roll.total}. Toque para fechar.`}>
        <View style={styles.row}>
          {dice.map((die, index) => (
            <Die key={`${roll.key}-${index}`} die={die} index={index} size={size} natural={natural} />
          ))}
        </View>
        {showTotal ? (
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.total}>
            <AppText style={styles.totalText}>{roll.total}</AppText>
            {roll.label ? <AppText variant="small">{roll.label}</AppText> : null}
            {extra > 0 ? <AppText variant="small">(+{extra} dados)</AppText> : null}
          </Animated.View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, backgroundColor: 'rgba(0,0,0,0.25)' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, maxWidth: '92%' },
  faceWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  face: { fontFamily: 'Cinzel_600SemiBold', color: palette.parchment[200] },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
  totalText: { fontFamily: fonts.sansSemiBold, fontSize: 30, color: colors.fgAccent },
});
