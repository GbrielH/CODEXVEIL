import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

/** Título de seção: ícone num selo, nome em capitulares e ação opcional à direita. */
export function SectionHeader({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {icon ? <View style={styles.sectionIcon}>{icon}</View> : null}
      <AppText
        variant="eyebrow"
        accessibilityRole="header"
        style={{ flex: 1, color: colors.fgAccent }}
      >
        {title}
      </AppText>
      {action}
    </View>
  );
}

/** Selo redondo para ícones de linhas e cartões. */
export function IconBubble({
  children,
  size = 40,
  tone = 'neutral',
}: {
  children: ReactNode;
  size?: number;
  tone?: 'neutral' | 'brand';
}) {
  return (
    <View
      style={[
        styles.bubble,
        { width: size, height: size, borderRadius: size / 2 },
        tone === 'brand' && {
          backgroundColor: palette.wine[900],
          borderColor: 'rgba(176, 74, 96, 0.45)',
        },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Cartão de destaque (o que fazer agora): fundo vinho escuro, filete de pergaminho à esquerda
 * e área inteira tocável.
 */
export function HeroCard({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <>
      <EmberAccent />
      <View style={{ flex: 1, gap: spacing[3] }}>{children}</View>
    </>
  );
  if (!onPress) return <View style={[styles.hero, style]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.hero, pressed && { opacity: 0.9 }, style]}
    >
      {body}
    </Pressable>
  );
}

function EmberAccent() {
  const reduced = useReducedMotion();
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!reduced) glow.value = withRepeat(withTiming(1, { duration: 2200 }), -1, true);
  }, [glow, reduced]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      glow.value,
      [0, 1],
      [palette.parchment[400], palette.amber[300]],
    ),
    opacity: 0.65 + 0.35 * glow.value,
    shadowOpacity: 0.6 * glow.value,
  }));
  return (
    <Animated.View
      style={[
        styles.heroAccent,
        { shadowColor: palette.amber[400], shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}
    />
  );
}

/** Ação rápida em pílula (ícone + rótulo curto), para fileiras de atalhos. */
export function QuickAction({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quick,
        primary && styles.quickPrimary,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon}
      <AppText
        style={{
          fontFamily: fonts.sansSemiBold,
          fontSize: 13,
          color: primary ? colors.primaryFg : colors.fg,
        }}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function QuickActions({ children }: { children: ReactNode }) {
  return <View style={styles.quickRow}>{children}</View>;
}

const styles = StyleSheet.create({
  section: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  sectionIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hero: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(187, 167, 125, 0.35)',
    backgroundColor: palette.wine[950],
    overflow: 'hidden',
  },
  heroAccent: { width: 3, borderRadius: 2, backgroundColor: palette.parchment[400] },
  quickRow: { flexDirection: 'row', gap: spacing[2] },
  quick: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
  },
  quickPrimary: { backgroundColor: colors.primary, borderColor: palette.wine[500] },
});
