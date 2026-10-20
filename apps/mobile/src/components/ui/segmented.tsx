import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/lib/theme';
import { AppText } from './primitives';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Abas de seção roláveis na horizontal (ex.: seções da ficha). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.list}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.selected]}
          >
            <AppText
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 14,
                color: selected ? colors.fgAccent : colors.fgMuted,
              }}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[1], borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  selected: { borderBottomColor: colors.parchmentEdge },
});
