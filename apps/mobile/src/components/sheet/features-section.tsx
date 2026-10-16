import { abilityEntryKindLabels } from '@codexveil/validation';
import { attackRollBonus, dnd5eAttackDataSchema, dnd5eSpellDataSchema, formatModifier } from '@codexveil/rpg-systems/dnd5e';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { colors, spacing } from '@/lib/theme';
import { useSheet } from './context';

/**
 * Habilidades, ataques e magias para consulta durante o jogo. Usos limitados podem ser
 * gastos aqui; o cadastro completo de habilidades é feito no site.
 */
export function FeaturesSection() {
  const { abilities, resources, derived, adjustResource, canEditPlay } = useSheet();
  const [open, setOpen] = useState<string | null>(null);

  if (abilities.length === 0) {
    return <AppText variant="muted">Nenhuma habilidade registrada. Cadastre ataques, magias e habilidades pelo site.</AppText>;
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {derived.spellcasting ? (
        <Card>
          <AppText variant="heading">Conjuração</AppText>
          <AppText>
            CD {derived.spellcasting.saveDc} · ataque mágico {formatModifier(derived.spellcasting.attackBonus)}
          </AppText>
        </Card>
      ) : null}
      {abilities.map((entry) => {
        const resource = entry.resourceId ? resources.find((item) => item.id === entry.resourceId) : undefined;
        const attack = entry.kind === 'attack' ? dnd5eAttackDataSchema.safeParse(entry.data ?? {}) : null;
        const spell = entry.kind === 'spell' ? dnd5eSpellDataSchema.safeParse(entry.data ?? {}) : null;
        const expanded = open === entry.id;
        return (
          <Card key={entry.id}>
            <Pressable onPress={() => setOpen(expanded ? null : entry.id)} accessibilityRole="button" accessibilityState={{ expanded }} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText style={{ flex: 1, fontFamily: 'Cinzel_600SemiBold', color: colors.fgAccent }}>{entry.name}</AppText>
                {attack?.success ? <AppText variant="number">{formatModifier(attackRollBonus(attack.data, derived))}</AppText> : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                <Badge label={abilityEntryKindLabels[entry.kind]} />
                {spell?.success ? <Badge label={spell.data.circle === 0 ? 'Truque' : `${spell.data.circle}º círculo`} tone="parchment" /> : null}
                {spell?.success && spell.data.concentration ? <Badge label="Concentração" tone="warning" /> : null}
                {attack?.success && attack.data.damage ? <Badge label={`${attack.data.damage} ${attack.data.damageType}`.trim()} tone="danger" /> : null}
              </View>
            </Pressable>
            {expanded && entry.description ? <AppText variant="serif">{entry.description}</AppText> : null}
            {resource ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText variant="muted" style={{ flex: 1 }}>
                  {resource.label}: {resource.current}
                  {resource.max === null ? '' : `/${resource.max}`}
                </AppText>
                {canEditPlay ? <Button label="Usar" compact variant="secondary" disabled={resource.current <= 0} onPress={() => adjustResource(resource, 'spend', 1)} /> : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
