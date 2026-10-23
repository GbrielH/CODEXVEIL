import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, minTouchTarget, palette, radii, spacing } from '@/lib/theme';
import { IconButton } from './button';
import { AppText } from './primitives';

export interface PickerOption {
  value: string;
  label: string;
  description?: string | undefined;
  disabled?: boolean;
}

/** Comparação sem acentos e sem diferenciar maiúsculas. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

interface PickerSheetProps {
  visible: boolean;
  title: string;
  /** Texto curto abaixo do título (ex.: por que a lista está limitada). */
  hint?: string | undefined;
  options: readonly PickerOption[];
  selected?: string | undefined;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** A partir de quantas opções aparece a busca. */
  searchThreshold?: number;
}

/**
 * Lista de opções em painel inferior, com a identidade visual do app e busca por digitação
 * (sem acentos). Substitui o seletor nativo, que segue o tema do aparelho.
 */
export function PickerSheet({
  visible,
  title,
  hint,
  options,
  selected,
  onSelect,
  onClose,
  searchThreshold = 6,
}: PickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const searchable = options.length > searchThreshold;
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return options;
    return options.filter((option) =>
      normalize(`${option.label} ${option.description ?? ''}`).includes(term),
    );
  }, [options, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Fechar a lista"
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing[3] }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </AppText>
            <IconButton
              icon={<X size={18} color={colors.fgSecondary} />}
              accessibilityLabel="Fechar"
              onPress={close}
            />
          </View>
          {hint ? (
            <AppText variant="small" style={{ color: colors.fgMuted }}>
              {hint}
            </AppText>
          ) : null}
          {searchable ? (
            <View style={styles.search}>
              <Search size={16} color={colors.fgSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Digite para buscar…"
                placeholderTextColor={colors.fgSubtle}
                selectionColor={palette.wine[400]}
                accessibilityLabel="Buscar nas opções"
                autoCorrect={false}
                style={styles.searchInput}
              />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(option) => option.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 2, paddingBottom: spacing[2] }}
            ListEmptyComponent={
              <AppText variant="muted" style={{ padding: spacing[3] }}>
                Nenhuma opção encontrada.
              </AppText>
            }
            renderItem={({ item }) => {
              const isSelected = item.value === selected;
              return (
                <Pressable
                  onPress={() => {
                    if (item.disabled) return;
                    setQuery('');
                    onSelect(item.value);
                  }}
                  disabled={item.disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: Boolean(item.disabled) }}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionSelected,
                    pressed && { backgroundColor: colors.hover },
                    item.disabled && { opacity: 0.45 },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText
                      style={{
                        color: isSelected ? colors.fgAccent : colors.fg,
                        fontFamily: fonts.sansMedium,
                      }}
                    >
                      {item.label}
                    </AppText>
                    {item.description ? (
                      <AppText variant="small">{item.description}</AppText>
                    ) : null}
                  </View>
                  {isSelected ? <Check size={18} color={colors.fgAccent} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Campo que mostra a opção escolhida e abre a lista com busca. */
export function PickerField({
  label,
  options,
  value,
  onChange,
  placeholder = 'Escolha…',
  title,
}: {
  label: string;
  options: readonly PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontFamily: fonts.sansMedium, fontSize: 14 }}>{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityHint="Abre a lista de opções"
        style={({ pressed }) => [styles.trigger, pressed && { backgroundColor: colors.hover }]}
      >
        <AppText
          style={{ flex: 1, color: current ? colors.fg : colors.fgSubtle }}
          numberOfLines={1}
        >
          {current?.label ?? placeholder}
        </AppText>
        <ChevronDown size={18} color={colors.fgMuted} />
      </Pressable>
      <PickerSheet
        visible={open}
        title={title ?? label}
        options={options}
        selected={value}
        onSelect={(next) => {
          setOpen(false);
          onChange(next);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8, 8, 10, 0.7)' },
  sheet: {
    maxHeight: '82%',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.lineStrong,
    borderTopColor: 'rgba(133, 50, 68, 0.9)',
    backgroundColor: colors.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
  },
  searchInput: {
    flex: 1,
    height: minTouchTarget,
    color: colors.fg,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: minTouchTarget,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
  },
  optionSelected: { backgroundColor: 'rgba(245, 237, 231, 0.08)' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: minTouchTarget,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
  },
});
