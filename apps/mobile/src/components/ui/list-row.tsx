import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/lib/theme';
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
export function ListRow({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  accessibilityHint,
}: ListRowProps) {
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 21, color: colors.fg }}
          numberOfLines={1}
        >
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
      {onPress ? <ChevronRight size={18} color={colors.fgSubtle} /> : null}
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
    paddingVertical: spacing[3],
    paddingHorizontal: 14,
    minHeight: 68,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
});
