import { ABILITY_SCORE_METHODS, abilityScoreMethodLabels, type Dnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, radii, spacing } from '@/lib/theme';

interface Props {
  value: Dnd5eCampaignRules;
  onChange: (value: Dnd5eCampaignRules) => void;
  error?: string | undefined;
}

/** Regras de criação de personagens de D&D 5e definidas pelo mestre. */
export function Dnd5eRulesEditor({ value, onChange, error }: Props) {
  const setLevel = (level: number) => onChange({ ...value, startingLevel: Math.min(20, Math.max(1, level)) });
  const toggleMethod = (method: (typeof ABILITY_SCORE_METHODS)[number]) => {
    const has = value.abilityScoreMethods.includes(method);
    onChange({
      ...value,
      abilityScoreMethods: has
        ? value.abilityScoreMethods.filter((entry) => entry !== method)
        : ABILITY_SCORE_METHODS.filter((entry) => entry === method || value.abilityScoreMethods.includes(entry)),
    });
  };
  return (
    <View style={styles.box}>
      <AppText variant="eyebrow">Criação de personagens</AppText>
      <AppText variant="muted">Os jogadores criam os personagens num passo a passo com as regras do SRD 5.2 e as escolhas abaixo.</AppText>
      <View style={styles.levelRow}>
        <AppText style={{ flex: 1 }}>Nível inicial</AppText>
        <IconButton icon={<Minus size={18} color={colors.fg} />} onPress={() => setLevel(value.startingLevel - 1)} accessibilityLabel="Diminuir nível inicial" disabled={value.startingLevel <= 1} />
        <AppText variant="number" accessibilityLabel={`Nível inicial ${value.startingLevel}`}>
          {value.startingLevel}º
        </AppText>
        <IconButton icon={<Plus size={18} color={colors.fg} />} onPress={() => setLevel(value.startingLevel + 1)} accessibilityLabel="Aumentar nível inicial" disabled={value.startingLevel >= 20} />
      </View>
      <AppText variant="small">O SRD recomenda o 1º nível, ou o 3º para grupos experientes.</AppText>
      <AppText style={{ fontFamily: fonts.sansMedium }}>Métodos de atributos permitidos</AppText>
      {ABILITY_SCORE_METHODS.map((method) => {
        const selected = value.abilityScoreMethods.includes(method);
        return (
          <Pressable
            key={method}
            onPress={() => toggleMethod(method)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <AppText style={{ fontFamily: fonts.sansMedium, color: selected ? colors.fgAccent : colors.fg }}>{abilityScoreMethodLabels[method].name}</AppText>
            <AppText variant="small">{abilityScoreMethodLabels[method].description}</AppText>
          </Pressable>
        );
      })}
      {error ? <AppText style={{ color: '#EC9384' }}>{error}</AppText> : null}
      <Pressable
        onPress={() => onChange({ ...value, allowEvilAlignments: !value.allowEvilAlignments })}
        accessibilityRole="switch"
        accessibilityState={{ checked: value.allowEvilAlignments }}
        style={[styles.option, value.allowEvilAlignments && styles.optionSelected]}
      >
        <AppText style={{ fontFamily: fonts.sansMedium }}>{value.allowEvilAlignments ? 'Alinhamentos malignos liberados' : 'Sem alinhamentos malignos'}</AppText>
        <AppText variant="small">O SRD pressupõe personagens que não são malignos. Toque para alternar.</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[2], borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing[3] },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing[3], gap: 2 },
  optionSelected: { borderColor: 'rgba(206, 191, 157, 0.7)', backgroundColor: 'rgba(228, 216, 189, 0.08)' },
});
