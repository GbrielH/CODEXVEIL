import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, minTouchTarget, palette, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

/** Opção em forma de pílula (escolha única ou filtro). */
export function Chip({
  label,
  selected,
  onPress,
  role = 'radio',
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox' | 'button';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={
        role === 'button'
          ? { disabled }
          : { selected, checked: role === 'checkbox' ? selected : undefined, disabled }
      }
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { backgroundColor: colors.hover },
        disabled && { opacity: 0.5 },
      ]}
    >
      <AppText style={{ fontSize: 13, color: selected ? colors.fgAccent : colors.fgSecondary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.chips, style]}>{children}</View>;
}

/** Caixa de seleção com rótulo e descrição (alvo de toque inteiro). */
export function CheckRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={({ pressed }) => [
        styles.check,
        pressed && { backgroundColor: colors.hover },
        disabled && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Check size={14} color={colors.primaryFg} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: fonts.sansMedium }}>{label}</AppText>
        {description ? <AppText variant="small">{description}</AppText> : null}
      </View>
    </Pressable>
  );
}

/** Campo numérico compacto (aceita vazio quando `allowEmpty`). */
export function NumberField({
  label,
  value,
  onChange,
  allowEmpty = false,
  decimal = false,
  width = 96,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
  decimal?: boolean;
  width?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      <AppText
        variant="small"
        style={{ color: colors.fg, fontFamily: fonts.sansMedium, fontSize: 14 }}
      >
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        defaultValue={value === null ? '' : String(value).replace('.', ',')}
        onEndEditing={(event) => {
          const text = event.nativeEvent.text.trim().replace(',', '.');
          if (text === '') {
            onChange(allowEmpty ? null : 0);
            return;
          }
          const parsed = Number(text);
          if (Number.isFinite(parsed)) onChange(decimal ? parsed : Math.round(parsed));
        }}
        placeholderTextColor={colors.fgSubtle}
        selectionColor={palette.wine[400]}
        style={[styles.number, { width }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  chipSelected: {
    borderColor: 'rgba(206, 191, 157, 0.7)',
    backgroundColor: 'rgba(228, 216, 189, 0.08)',
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: minTouchTarget,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radii.md,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: palette.wine[400] },
  number: {
    height: minTouchTarget,
    paddingHorizontal: spacing[3],
    color: colors.fg,
    fontFamily: fonts.sans,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
  },
});
