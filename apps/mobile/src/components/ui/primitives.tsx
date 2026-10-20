import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radii, spacing } from '@/lib/theme';

type Variant =
  'display' | 'title' | 'heading' | 'body' | 'serif' | 'muted' | 'small' | 'eyebrow' | 'number';

const variants: Record<Variant, TextStyle> = {
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.fgAccent,
    letterSpacing: 0.3,
  },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.fgAccent },
  heading: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.fgAccent },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.fg },
  serif: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 27, color: colors.fg },
  muted: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.fgMuted },
  small: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.fgSecondary },
  eyebrow: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.4,
    color: colors.fgSecondary,
    textTransform: 'uppercase',
  },
  number: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.fgAccent,
    fontVariant: ['tabular-nums'],
  },
};

interface AppTextProps extends TextProps {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
}

/** Texto com a tipografia da identidade (Cinzel nos títulos, Inter na interface, Alegreya na leitura). */
export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return <Text {...props} style={[variants[variant], style]} />;
}

export function Card({
  children,
  style,
  ornate = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  ornate?: boolean;
}) {
  return (
    <View style={[styles.card, ornate && styles.ornate, style]}>
      {ornate ? <View pointerEvents="none" style={styles.cornerTop} /> : null}
      {ornate ? <View pointerEvents="none" style={styles.cornerBottom} /> : null}
      {children}
    </View>
  );
}

export function CardTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.cardTitle}>
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{title}</AppText>
        {description ? <AppText variant="muted">{description}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

type BadgeTone = 'neutral' | 'brand' | 'parchment' | 'warning' | 'success' | 'danger';

const badgeTones: Record<BadgeTone, { background: string; border: string; text: string }> = {
  neutral: { background: colors.raised, border: colors.lineStrong, text: colors.fgSecondary },
  brand: { background: '#3D1520', border: 'rgba(176, 74, 96, 0.5)', text: '#E3B5BD' },
  parchment: {
    background: 'rgba(228, 216, 189, 0.1)',
    border: 'rgba(187, 167, 125, 0.4)',
    text: colors.fgAccent,
  },
  warning: { background: colors.warningBg, border: 'rgba(217, 165, 74, 0.4)', text: '#E6BE74' },
  success: { background: colors.successBg, border: 'rgba(111, 179, 138, 0.4)', text: '#8CC7A3' },
  danger: { background: colors.dangerBg, border: 'rgba(226, 109, 90, 0.45)', text: '#EC9384' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const style = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: style.background, borderColor: style.border }]}>
      <AppText
        style={{ color: style.text, fontSize: 12, lineHeight: 16, fontFamily: fonts.sansMedium }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** Separador ornamental com losango central. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[styles.divider, style]}
      accessibilityRole="none"
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.dividerLine} />
      <View style={styles.diamond} />
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing[4],
    gap: spacing[3],
  },
  ornate: { position: 'relative' },
  cornerTop: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 14,
    height: 14,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(187, 167, 125, 0.5)',
  },
  cornerBottom: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 14,
    height: 14,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(187, 167, 125, 0.5)',
  },
  cardTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  badge: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginVertical: spacing[2],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(187, 167, 125, 0.35)' },
  diamond: {
    width: 8,
    height: 8,
    backgroundColor: 'rgba(187, 167, 125, 0.7)',
    transform: [{ rotate: '45deg' }],
  },
});
