import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, minTouchTarget, palette, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | undefined;
  hint?: string;
  multiline?: boolean;
}

/**
 * Campo de texto com rótulo, dica e erro anunciados por leitores de tela. Campos de senha
 * (`secureTextEntry`) ganham um botão para mostrar ou ocultar o que foi digitado.
 */
export function Field({
  label,
  error,
  hint,
  multiline = false,
  secureTextEntry,
  ...props
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  const input = (
    <TextInput
      accessibilityLabel={label}
      accessibilityHint={error ?? hint}
      placeholderTextColor={colors.fgSubtle}
      selectionColor={palette.wine[400]}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      secureTextEntry={isPassword && !visible}
      autoCapitalize={isPassword ? 'none' : props.autoCapitalize}
      autoCorrect={isPassword ? false : props.autoCorrect}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      {...props}
      style={[
        styles.input,
        multiline && styles.multiline,
        isPassword && styles.withToggle,
        focused && styles.focused,
        error ? styles.invalid : null,
        props.editable === false && styles.readOnly,
      ]}
    />
  );
  return (
    <View style={styles.wrapper}>
      <AppText variant="small" style={styles.label}>
        {label}
      </AppText>
      {isPassword ? (
        <View style={styles.row}>
          {input}
          <Pressable
            onPress={() => setVisible((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ selected: visible }}
            hitSlop={6}
            style={({ pressed }) => [styles.toggle, pressed && { backgroundColor: colors.hover }]}
          >
            {visible ? (
              <EyeOff size={20} color={colors.fgMuted} />
            ) : (
              <Eye size={20} color={colors.fgMuted} />
            )}
          </Pressable>
        </View>
      ) : (
        input
      )}
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
  row: { position: 'relative', justifyContent: 'center' },
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
  withToggle: { paddingRight: minTouchTarget + spacing[1] },
  toggle: {
    position: 'absolute',
    right: 0,
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  multiline: {
    minHeight: 110,
    paddingTop: spacing[3],
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 24,
  },
  focused: { borderColor: colors.focus },
  invalid: { borderColor: '#E26D5A' },
  readOnly: { opacity: 0.75 },
  error: { color: '#EC9384' },
});
