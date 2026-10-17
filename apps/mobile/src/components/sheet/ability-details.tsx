import type { CharacterAbility } from '@codexveil/database';
import {
  abilityLabels,
  loadSrdSpellTexts,
  spellSchoolLabels,
  summarizeSrdSpell,
  type Dnd5eAttackData,
  type Dnd5eSpellData,
  type SrdSpellTexts,
} from '@codexveil/rpg-systems/dnd5e';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, spacing } from '@/lib/theme';

/** Textos das magias do SRD, carregados uma vez quando a primeira magia é aberta. */
export function useSrdSpellTexts(): SrdSpellTexts | null {
  const [texts, setTexts] = useState<SrdSpellTexts | null>(null);
  useEffect(() => {
    let active = true;
    loadSrdSpellTexts()
      .then((loaded) => {
        if (active) setTexts(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return texts;
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <View style={{ gap: 2 }}>
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', gap: spacing[2] }}>
            <AppText variant="small" style={{ width: 96, color: colors.fgMuted }}>
              {label}
            </AppText>
            <AppText variant="small" style={{ flex: 1, color: colors.fg }}>
              {value}
            </AppText>
          </View>
        ))}
    </View>
  );
}

/** Especificações da magia: dados da ficha e o que o SRD diz (dano, resistência, área…). */
export function SpellDetails({ name, data, description }: { name: string; data: Dnd5eSpellData; description: string }) {
  const texts = useSrdSpellTexts();
  const [showText, setShowText] = useState(false);
  const srd = texts?.[name] ?? null;
  const summary = srd ? summarizeSrdSpell(srd) : [];
  return (
    <View style={{ gap: spacing[2] }}>
      <Rows
        rows={[
          ['Escola', data.school ? spellSchoolLabels[data.school] : ''],
          ['Conjuração', data.castingTime],
          ['Alcance', data.range],
          ['Componentes', data.components],
          ['Duração', data.duration],
          ['Especial', [data.concentration ? 'Concentração' : null, data.ritual ? 'Ritual' : null].filter(Boolean).join(' · ')],
          ...summary.map((line): [string, string] => [line.label, line.value]),
        ]}
      />
      {description ? <AppText variant="serif">{description}</AppText> : null}
      {srd && !description ? (
        <View style={{ gap: spacing[1] }}>
          <Pressable onPress={() => setShowText((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: showText }} hitSlop={8}>
            <AppText variant="small" style={{ color: colors.fgAccent, fontFamily: fonts.sansMedium }}>
              {showText ? 'Ocultar o texto do SRD' : 'Ver o texto completo do SRD 5.2.1 (em inglês)'}
            </AppText>
          </Pressable>
          {showText
            ? srd.map((paragraph) => (
                <AppText key={paragraph} variant="small">
                  {paragraph}
                </AppText>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

export function AttackDetails({ attack, data, bonus }: { attack: CharacterAbility; data: Dnd5eAttackData; bonus: string }) {
  return (
    <View style={{ gap: spacing[2] }}>
      <Rows
        rows={[
          ['Ataque', bonus],
          ['Dano', [data.damage, data.damageType].filter(Boolean).join(' ')],
          ['Alcance', data.range],
          ['Atributo', data.ability ? abilityLabels[data.ability].name : 'Bônus fixo'],
          ['Proficiente', data.proficient ? 'Sim' : 'Não'],
        ]}
      />
      {attack.description ? <AppText variant="serif">{attack.description}</AppText> : null}
    </View>
  );
}
