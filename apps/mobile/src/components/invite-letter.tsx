import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { Emblem } from '@/components/brand/emblem';

/**
 * Convite como carta: envelope fechado com o selo, a aba abre, a carta sobe e o envelope some.
 * Com "reduzir movimento" ligado, a carta aparece direto.
 */
export function InviteLetter({ children }: { children: ReactNode }) {
  const seal = useState(() => new Animated.Value(0))[0];
  const flap = useState(() => new Animated.Value(0))[0];
  const letter = useState(() => new Animated.Value(0))[0];
  const envelope = useState(() => new Animated.Value(0))[0];
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) {
        letter.setValue(1);
        setDone(true);
        return;
      }
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(seal, {
          toValue: 1,
          duration: 350,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flap, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(letter, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(envelope, {
            toValue: 1,
            duration: 700,
            delay: 350,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        if (active) setDone(true);
      });
    });
    return () => {
      active = false;
    };
  }, [seal, flap, letter, envelope]);

  return (
    <View>
      <Animated.View
        style={{
          opacity: letter,
          transform: [
            { translateY: letter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
            { scale: letter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
          ],
        }}
      >
        {children}
      </Animated.View>
      {done ? null : (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.envelope,
            {
              opacity: envelope.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateY: envelope.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) },
              ],
            },
          ]}
        >
          <View style={styles.body} />
          <View style={styles.pocket} />
          <Animated.View
            style={[
              styles.flapWrap,
              {
                transform: [
                  { perspective: 900 },
                  { translateY: -60 },
                  {
                    rotateX: flap.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                  { translateY: 60 },
                ],
                opacity: flap.interpolate({
                  inputRange: [0, 0.5, 0.51, 1],
                  outputRange: [1, 1, 0.4, 0.4],
                }),
              },
            ]}
          >
            <View style={styles.flap} />
          </Animated.View>
          <Animated.View
            style={[
              styles.seal,
              {
                opacity: seal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  { scale: seal.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
                ],
              },
            ]}
          >
            <Emblem size={34} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  envelope: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 240,
    overflow: 'hidden',
    borderRadius: 12,
  },
  body: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#3D1520',
    borderWidth: 1,
    borderColor: 'rgba(201,130,142,0.4)',
    borderRadius: 12,
  },
  // Bolso inferior em "V" invertido (triângulo por bordas).
  pocket: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -400,
    width: 0,
    height: 0,
    borderBottomWidth: 120,
    borderBottomColor: '#2A0E14',
    borderLeftWidth: 400,
    borderLeftColor: 'transparent',
    borderRightWidth: 400,
    borderRightColor: 'transparent',
  },
  flapWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    alignItems: 'center',
    overflow: 'hidden',
  },
  flap: {
    width: 0,
    height: 0,
    borderTopWidth: 130,
    borderTopColor: '#4A1A24',
    borderLeftWidth: 400,
    borderLeftColor: 'transparent',
    borderRightWidth: 400,
    borderRightColor: 'transparent',
  },
  seal: {
    position: 'absolute',
    top: 120 - 32,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#571F2B',
    borderWidth: 2,
    borderColor: 'rgba(201,130,142,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
