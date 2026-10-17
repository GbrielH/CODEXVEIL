import { ABILITIES, abilityLabels, spellSchoolLabels, type Ability, type ChoiceSpec, type Selection } from '@codexveil/rpg-systems/dnd5e';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Badge } from '@/components/ui/primitives';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

interface ChoiceFieldProps {
  spec: ChoiceSpec;
  value: Selection | undefined;
  error?: string | undefined;
  onChange: (value: Selection) => void;
}

/** Uma escolha exigida pelas regras, desenhada conforme o tipo. */
export function ChoiceField({ spec, value, error, onChange }: ChoiceFieldProps) {
  const count = Array.isArray(value) ? value.length : 0;
  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText style={styles.title}>{spec.label}</AppText>
          <AppText variant="small" style={{ color: colors.fgSubtle }}>
            {spec.source}
          </AppText>
        </View>
        {spec.kind === 'multi' || spec.kind === 'spells' ? <Badge label={`${count} de ${spec.count}`} tone={count === spec.count ? 'success' : 'neutral'} /> : null}
      </View>
      {spec.description ? <AppText variant="muted">{spec.description}</AppText> : null}
      {spec.kind === 'option' ? <OptionList spec={spec} value={typeof value === 'string' ? value : ''} onChange={onChange} /> : null}
      {spec.kind === 'multi' ? <MultiList spec={spec} value={Array.isArray(value) ? value : []} onChange={onChange} /> : null}
      {spec.kind === 'spells' ? <SpellList spec={spec} value={Array.isArray(value) ? value : []} onChange={onChange} /> : null}
      {spec.kind === 'ability_increase' ? (
        <IncreaseField spec={spec} value={value && typeof value === 'object' && !Array.isArray(value) ? value : {}} onChange={onChange} />
      ) : null}
      {error ? (
        <AppText style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function OptionCard({
  selected,
  disabled = false,
  title,
  description,
  note,
  onPress,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description?: string | undefined;
  note?: string | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && { backgroundColor: colors.hover }, disabled && styles.disabled]}
    >
      <AppText style={[styles.cardTitle, selected && { color: colors.fgAccent }]}>{title}</AppText>
      {description ? <AppText variant="small">{description}</AppText> : null}
      {note ? <AppText variant="small" style={{ color: '#E6BE74' }}>{note}</AppText> : null}
    </Pressable>
  );
}

function OptionList({ spec, value, onChange }: { spec: Extract<ChoiceSpec, { kind: 'option' }>; value: string; onChange: (value: string) => void }) {
  return (
    <View style={{ gap: spacing[2] }} accessibilityRole="radiogroup" accessibilityLabel={spec.label}>
      {spec.options.map((option) => (
        <OptionCard
          key={option.id}
          selected={option.id === value}
          disabled={Boolean(option.disabledReason) && option.id !== value}
          title={option.name}
          description={option.description}
          note={option.disabledReason}
          onPress={() => onChange(option.id)}
        />
      ))}
    </View>
  );
}

function Chip({ label, selected, disabled, onPress, hint }: { label: string; selected: boolean; disabled: boolean; onPress: () => void; hint?: string | undefined }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { backgroundColor: colors.hover }, disabled && styles.disabled]}
    >
      {selected ? <Check size={14} color={colors.fgAccent} /> : null}
      <AppText style={{ fontSize: 14, color: selected ? colors.fgAccent : colors.fgSecondary }}>{label}</AppText>
    </Pressable>
  );
}

function MultiList({ spec, value, onChange }: { spec: Extract<ChoiceSpec, { kind: 'multi' }>; value: string[]; onChange: (value: string[]) => void }) {
  const full = value.length >= spec.count;
  const detailed = spec.options.some((option) => option.description && option.description.length > 20);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  if (detailed) {
    return (
      <View style={{ gap: spacing[2] }}>
        {spec.options.map((option) => {
          const selected = value.includes(option.id);
          return (
            <OptionCard
              key={option.id}
              selected={selected}
              disabled={!selected && (Boolean(option.disabledReason) || full)}
              title={option.name}
              description={option.description}
              note={selected ? undefined : option.disabledReason}
              onPress={() => toggle(option.id)}
            />
          );
        })}
      </View>
    );
  }
  return (
    <View style={styles.chips}>
      {spec.options.map((option) => {
        const selected = value.includes(option.id);
        return (
          <Chip
            key={option.id}
            label={option.name}
            selected={selected}
            disabled={!selected && (Boolean(option.disabledReason) || full)}
            hint={option.disabledReason}
            onPress={() => toggle(option.id)}
          />
        );
      })}
    </View>
  );
}

const levelLabel = (level: number) => (level === 0 ? 'Truque' : `${level}º`);
const MAX_VISIBLE_SPELLS = 60;

function SpellList({ spec, value, onChange }: { spec: Extract<ChoiceSpec, { kind: 'spells' }>; value: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState('');
  const levels = useMemo(() => [...new Set(spec.options.map((option) => option.level))].sort((a, b) => a - b), [spec.options]);
  const [level, setLevel] = useState<number | null>(null);
  const full = value.length >= spec.count;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return spec.options.filter((option) => (level === null || option.level === level) && (!term || option.name.toLowerCase().includes(term)));
  }, [spec.options, query, level]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);

  return (
    <View style={{ gap: spacing[2] }}>
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((name) => (
            <Chip key={name} label={`${name} ×`} selected disabled={false} onPress={() => toggle(name)} hint="Toque para remover" />
          ))}
        </View>
      ) : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar pelo nome (em inglês, como no SRD)"
        placeholderTextColor={colors.fgSubtle}
        selectionColor={palette.wine[400]}
        accessibilityLabel="Buscar magia"
        style={styles.search}
      />
      {levels.length > 1 ? (
        <View style={styles.chips}>
          <Chip label="Todos" selected={level === null} disabled={false} onPress={() => setLevel(null)} />
          {levels.map((entry) => (
            <Chip key={entry} label={levelLabel(entry)} selected={level === entry} disabled={false} onPress={() => setLevel(entry)} />
          ))}
        </View>
      ) : null}
      <View style={styles.spellList}>
        {filtered.slice(0, MAX_VISIBLE_SPELLS).map((option) => {
          const selected = value.includes(option.id);
          const disabled = !selected && (Boolean(option.disabledReason) || full);
          return (
            <Pressable
              key={option.id}
              onPress={() => toggle(option.id)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              style={({ pressed }) => [styles.spellRow, selected && styles.cardSelected, pressed && { backgroundColor: colors.hover }, disabled && styles.disabled]}
            >
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 15, color: selected ? colors.fgAccent : colors.fg }}>{option.name}</AppText>
                <AppText variant="small">
                  {levelLabel(option.level)} · {spellSchoolLabels[option.school]}
                  {option.concentration ? ' · C' : ''}
                  {option.ritual ? ' · R' : ''}
                  {option.disabledReason && !selected ? ` · ${option.disabledReason}` : ''}
                </AppText>
              </View>
              {selected ? <Check size={16} color={colors.fgAccent} /> : null}
            </Pressable>
          );
        })}
        {filtered.length === 0 ? <AppText variant="muted">Nenhuma magia encontrada.</AppText> : null}
        {filtered.length > MAX_VISIBLE_SPELLS ? (
          <AppText variant="small">Mostrando {MAX_VISIBLE_SPELLS} de {filtered.length}. Busque ou filtre pelo círculo para ver as outras.</AppText>
        ) : null}
      </View>
      <AppText variant="small" style={{ color: colors.fgSubtle }}>
        C = concentração · R = ritual. Nomes e dados técnicos do SRD 5.2 (CC-BY-4.0).
      </AppText>
    </View>
  );
}

function IncreaseField({
  spec,
  value,
  onChange,
}: {
  spec: Extract<ChoiceSpec, { kind: 'ability_increase' }>;
  value: Partial<Record<Ability, number>>;
  onChange: (value: Partial<Record<Ability, number>>) => void;
}) {
  const entries = ABILITIES.filter((ability) => (value[ability] ?? 0) > 0);
  const even = spec.mode === 'background' && entries.length === 3;
  // O modo do Aumento no Valor de Atributo fica guardado: com nada escolhido, não dá para deduzi-lo.
  const [asiMode, setAsiMode] = useState<'two' | 'split'>(() => (entries.length === 1 && value[entries[0]!] === 2 ? 'two' : 'split'));
  const asiTwo = spec.mode === 'asi' && asiMode === 'two';
  const two = entries.find((ability) => value[ability] === 2);
  const ones = entries.filter((ability) => value[ability] === 1);

  const setTwoOne = (nextTwo: Ability | undefined, nextOne: Ability | undefined) => {
    const next: Partial<Record<Ability, number>> = {};
    if (nextTwo) next[nextTwo] = 2;
    if (nextOne && nextOne !== nextTwo) next[nextOne] = 1;
    onChange(next);
  };
  const toggleOne = (ability: Ability) => {
    const current = ones.includes(ability) ? ones.filter((entry) => entry !== ability) : [...ones, ability].slice(-2);
    onChange(Object.fromEntries(current.map((entry) => [entry, 1])));
  };

  const modes =
    spec.mode === 'background'
      ? [
          { id: 'split', label: '+2 e +1', active: !even, apply: () => onChange({}) },
          { id: 'even', label: '+1 nos três', active: even, apply: () => onChange(Object.fromEntries(spec.abilities.map((ability) => [ability, 1]))) },
        ]
      : [
          {
            id: 'two',
            label: '+2 em um',
            active: asiTwo,
            apply: () => {
              setAsiMode('two');
              onChange({});
            },
          },
          {
            id: 'split',
            label: '+1 em dois',
            active: !asiTwo,
            apply: () => {
              setAsiMode('split');
              onChange({});
            },
          },
        ];

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={styles.chips}>
        {modes.map((mode) => (
          <Chip key={mode.id} label={mode.label} selected={mode.active} disabled={false} onPress={mode.apply} />
        ))}
      </View>
      {spec.mode === 'background' && !even ? (
        <>
          <AppText variant="small">+2 em</AppText>
          <View style={styles.chips}>
            {spec.abilities.map((ability) => (
              <Chip key={ability} label={abilityLabels[ability].name} selected={two === ability} disabled={false} onPress={() => setTwoOne(ability, ones[0])} />
            ))}
          </View>
          <AppText variant="small">+1 em</AppText>
          <View style={styles.chips}>
            {spec.abilities
              .filter((ability) => ability !== two)
              .map((ability) => (
                <Chip key={ability} label={abilityLabels[ability].name} selected={ones.includes(ability)} disabled={false} onPress={() => setTwoOne(two, ability)} />
              ))}
          </View>
        </>
      ) : null}
      {spec.mode === 'background' && even ? (
        <AppText variant="muted">{spec.abilities.map((ability) => `${abilityLabels[ability].name} +1`).join(' · ')}</AppText>
      ) : null}
      {spec.mode === 'asi' && asiTwo ? (
        <View style={styles.chips}>
          {spec.abilities.map((ability) => (
            <Chip key={ability} label={`${abilityLabels[ability].abbreviation} +2`} selected={value[ability] === 2} disabled={false} onPress={() => onChange({ [ability]: 2 })} />
          ))}
        </View>
      ) : null}
      {spec.mode === 'asi' && !asiTwo ? (
        <>
          <View style={styles.chips}>
            {spec.abilities.map((ability) => (
              <Chip key={ability} label={`${abilityLabels[ability].abbreviation} +1`} selected={ones.includes(ability)} disabled={false} onPress={() => toggleOne(ability)} />
            ))}
          </View>
          <AppText variant="small">Escolha dois atributos diferentes. Para +2 num só, use “+2 em um”.</AppText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[2], borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing[3], backgroundColor: 'rgba(255,255,255,0.01)' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  title: { fontFamily: fonts.sansMedium, fontSize: 15 },
  error: { color: '#EC9384', fontFamily: fonts.sansMedium, fontSize: 14 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing[3], gap: 2 },
  cardSelected: { borderColor: 'rgba(206, 191, 157, 0.7)', backgroundColor: 'rgba(228, 216, 189, 0.08)' },
  cardTitle: { fontFamily: fonts.sansMedium, fontSize: 15 },
  disabled: { opacity: 0.45 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
  },
  chipSelected: { borderColor: 'rgba(206, 191, 157, 0.7)', backgroundColor: 'rgba(228, 216, 189, 0.08)' },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
    color: colors.fg,
    fontFamily: fonts.sans,
    fontSize: 15,
    paddingHorizontal: spacing[3],
  },
  spellList: { gap: 4 },
  spellRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing[2] },
});
