import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, minTouchTarget, palette, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | undefined;
  hint?: string;
  multiline?: boolean;
}

/** Campo de texto com rótulo, dica e erro anunciados por leitores de tela. */
export function Field({ label, error, hint, multiline = false, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <AppText variant="small" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.fgSubtle}
        selectionColor={palette.wine[400]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        {...props}
        style={[styles.input, multiline && styles.multiline, focused && styles.focused, error ? styles.invalid : null, props.editable === false && styles.readOnly]}
      />
      {error ? (
        <AppText variant="small" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { color: colors.fg, fontFamily: fonts.sansMedium, fontSize: 14 },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
    color: colors.fg,
    fontFamily: fonts.sans,
    fontSize: 16,
    paddingHorizontal: spacing[3],
  },
  multiline: { minHeight: 110, paddingTop: spacing[3], fontFamily: fonts.serif, fontSize: 17, lineHeight: 24 },
  focused: { borderColor: colors.focus },
  invalid: { borderColor: '#E26D5A' },
  readOnly: { opacity: 0.75 },
  error: { color: '#EC9384' },
});
