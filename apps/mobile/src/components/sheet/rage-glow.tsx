import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

/**
 * Fogo da Fúria ligada: brilho laranja que tremula na base do cartão. Some com "reduzir
 * movimento" ligado no aparelho (fica só a cor fixa).
 */
export function RageGlow() {
  const [flicker] = useState(() => new Animated.Value(0));
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0.35,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0.8,
          duration: 400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker, reduce]);

  const opacity = reduce
    ? 0.6
    : flicker.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scaleY = reduce
    ? 1
    : flicker.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 8 }]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '75%',
          opacity,
          transform: [{ scaleY }],
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(255,90,30,0.10)' }} />
        <View style={{ flex: 1, backgroundColor: 'rgba(255,110,40,0.18)' }} />
        <View style={{ flex: 1, backgroundColor: 'rgba(255,130,50,0.28)' }} />
      </Animated.View>
    </View>
  );
}
