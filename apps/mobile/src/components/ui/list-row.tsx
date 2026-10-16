import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

interface ListRowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
}

/** Linha tocável usada em listas de campanhas, personagens e sessões. */
export function ListRow({ title, subtitle, meta, leading, trailing, onPress, accessibilityHint }: ListRowProps) {
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: 'Cinzel_600SemiBold', fontSize: 16, color: colors.fgAccent }} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
        {meta ? (
          <AppText variant="small" style={{ color: colors.fgMuted }} numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress ? <ChevronRight size={18} color={colors.fgMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, meta].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.hover }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    minHeight: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
});
