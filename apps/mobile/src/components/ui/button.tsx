import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, minTouchTarget, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantStyles: Record<Variant, { container: ViewStyle; pressed: ViewStyle; text: string }> = {
  primary: {
    container: { backgroundColor: colors.primary, borderColor: 'rgba(133, 50, 68, 0.7)' },
    pressed: { backgroundColor: colors.primaryPressed },
    text: colors.primaryFg,
  },
  secondary: {
    container: { backgroundColor: colors.raised, borderColor: colors.lineStrong },
    pressed: { backgroundColor: colors.hover },
    text: colors.fg,
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: 'transparent' },
    pressed: { backgroundColor: colors.hover },
    text: colors.fgSecondary,
  },
  danger: {
    container: { backgroundColor: colors.dangerBg, borderColor: 'rgba(226, 109, 90, 0.45)' },
    pressed: { backgroundColor: 'rgba(226, 109, 90, 0.18)' },
    text: '#EC9384',
  },
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Botão com alvo de toque mínimo de 44 px e estados de carregamento e desabilitado. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const theme = variantStyles[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        theme.container,
        pressed && theme.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.text} />
      ) : icon ? (
        <View>{icon}</View>
      ) : null}
      {label ? (
        <AppText
          style={{ color: theme.text, fontFamily: fonts.sansMedium, fontSize: compact ? 14 : 15 }}
        >
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** Botão só com ícone (exige rótulo acessível). */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
}: {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.icon,
        pressed && { backgroundColor: colors.hover },
        disabled && styles.inactive,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  compact: { minHeight: 36, paddingHorizontal: spacing[3] },
  inactive: { opacity: 0.55 },
  icon: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
});
