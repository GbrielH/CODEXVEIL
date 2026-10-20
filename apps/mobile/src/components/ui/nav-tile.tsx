import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

/** Atalho em grade (ícone + rótulo) para as seções da campanha. */
export function NavTile({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.hover }]}
    >
      <View style={styles.icon}>{icon}</View>
      <AppText
        style={{ fontFamily: fonts.sansMedium, color: colors.fg, textAlign: 'center' }}
        numberOfLines={2}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function NavGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing[2],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: 'rgba(87, 31, 43, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(187, 167, 125, 0.3)',
  },
});
