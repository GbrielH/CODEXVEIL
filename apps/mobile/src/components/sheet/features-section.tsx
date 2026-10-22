import type { CharacterAbility } from '@codexveil/database';
import { d20Expression } from '@codexveil/domain';
import {
  attackDamageFormula,
  attackRollBonus,
  critRangeLabel,
  dnd5eAttackDataSchema,
  dnd5eSpellDataSchema,
  featureTurnCost,
  formatModifier,
  spellNamePt,
  isAttackAvailable,
} from '@codexveil/rpg-systems/dnd5e';
import { abilityEntryKindLabels, type AbilityEntryKind } from '@codexveil/validation';
import { Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { RollButton } from '@/components/dice/dice';
import { Button, IconButton } from '@/components/ui/button';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { colors, fonts, spacing } from '@/lib/theme';
import { AbilityEditor } from './ability-editor';
import { AttackDetails, SpellDetails } from './ability-details';
import { useSheet } from './context';

/**
 * Ataques, magias e habilidades: consulta durante o jogo (toque para ver os detalhes, toque no
 * bônus para rolar) e cadastro completo, como no site. Na campanha, a aba Jogo mostra só o que se
 * usa na mesa (`show="usable"`) e a aba Atributos, as características passivas (`show="passive"`).
 */
export function FeaturesSection({ show = 'all' }: { show?: 'all' | 'usable' | 'passive' }) {
  const {
    abilities: allAbilities,
    items,
    resources,
    derived,
    sheet,
    adjustResource,
    canEditPlay,
    canEditSheet,
  } = useSheet();
  const usable = (entry: CharacterAbility) =>
    (entry.kind === 'attack' && isAttackAvailable(entry.name, items)) ||
    entry.kind === 'spell' ||
    entry.resourceId !== null ||
    featureTurnCost(entry.name) !== null;
  const abilities = allAbilities.filter((entry) =>
    show === 'usable' ? usable(entry) : show === 'passive' ? !usable(entry) : true,
  );
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    entry: CharacterAbility | null;
    kind: AbilityEntryKind;
  } | null>(null);

  return (
    <View style={{ gap: spacing[3] }}>
      {show === 'passive' ? <AppText variant="heading">Características</AppText> : null}
      {derived.spellcasting && show !== 'passive' ? (
        <Card>
          <AppText variant="heading">Conjuração</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <AppText>CD {derived.spellcasting.saveDc} · ataque mágico</AppText>
            <RollButton
              expression={d20Expression(derived.spellcasting.attackBonus)}
              label="Ataque mágico"
              style={{ paddingHorizontal: 6 }}
            >
              <AppText variant="number">{formatModifier(derived.spellcasting.attackBonus)}</AppText>
            </RollButton>
          </View>
        </Card>
      ) : null}

      {editing ? (
        <AbilityEditor
          key={editing.entry?.id ?? `nova-${editing.kind}`}
          entry={editing.entry}
          kind={editing.kind}
          onDone={() => setEditing(null)}
        />
      ) : canEditSheet && show !== 'passive' ? (
        <Button
          label="Nova entrada (ataque, magia ou habilidade)"
          variant="secondary"
          icon={<Plus size={16} color={colors.fg} />}
          onPress={() => setEditing({ entry: null, kind: 'attack' })}
        />
      ) : null}

      {abilities.length === 0 ? (
        <AppText variant="muted">Nenhuma habilidade registrada ainda.</AppText>
      ) : null}
      {abilities.map((entry) => {
        const resource = entry.resourceId
          ? resources.find((item) => item.id === entry.resourceId)
          : undefined;
        const attack =
          entry.kind === 'attack' ? dnd5eAttackDataSchema.safeParse(entry.data ?? {}) : null;
        const spell =
          entry.kind === 'spell' ? dnd5eSpellDataSchema.safeParse(entry.data ?? {}) : null;
        const expanded = open === entry.id;
        const attackBonus = attack?.success ? attackRollBonus(attack.data, derived) : null;
        const damage = attack?.success ? attackDamageFormula(attack.data, sheet.abilities) : null;
        const critical = attack?.success ? attackDamageFormula(attack.data, sheet.abilities, true) : null;
        return (
          <Card key={entry.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setOpen(expanded ? null : entry.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={{ flex: 1, gap: 4 }}
              >
                <AppText style={{ fontFamily: fonts.display, color: colors.fgAccent }}>
                  {entry.kind === 'spell' ? spellNamePt(entry.name) : entry.name}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  <Badge label={abilityEntryKindLabels[entry.kind]} />
                  {spell?.success ? (
                    <Badge
                      label={spell.data.circle === 0 ? 'Truque' : `${spell.data.circle}º círculo`}
                      tone="parchment"
                    />
                  ) : null}
                  {spell?.success && spell.data.concentration ? (
                    <Badge label="Concentração" tone="warning" />
                  ) : null}
                  {attack?.success && attack.data.damage ? (
                    <Badge
                      label={`${attack.data.damage} ${attack.data.damageType}`.trim()}
                      tone="danger"
                    />
                  ) : null}
                </View>
              </Pressable>
              {attackBonus !== null ? (
                <RollButton
                  expression={d20Expression(attackBonus)}
                  label={`Ataque: ${entry.name}`}
                  style={{ paddingHorizontal: 6 }}
                >
                  <AppText variant="number">{formatModifier(attackBonus)}</AppText>
                </RollButton>
              ) : null}
              {canEditSheet ? (
                <IconButton
                  icon={<Pencil size={16} color={colors.fgSecondary} />}
                  accessibilityLabel={`Editar ${entry.name}`}
                  onPress={() => setEditing({ entry, kind: entry.kind })}
                />
              ) : null}
            </View>
            {damage ? (
              <RollButton
                expression={damage}
                label={`Dano: ${entry.name}`}
                style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 4 }}
              >
                <AppText variant="small" style={{ color: '#EC9384', fontFamily: fonts.sansMedium }}>
                  Rolar dano ({damage})
                </AppText>
              </RollButton>
            ) : null}
            {critical && attack?.success ? (
              <RollButton
                expression={critical}
                label={`Dano crítico: ${entry.name}`}
                style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 4 }}
              >
                <AppText variant="small" style={{ color: '#E6BE74', fontFamily: fonts.sansMedium }}>
                  Crítico ({critRangeLabel(attack.data.critRange)} no d20): {critical}
                </AppText>
              </RollButton>
            ) : null}
            {expanded && spell?.success ? (
              <SpellDetails
                name={spellNamePt(entry.name)}
                data={spell.data}
                description={entry.description}
              />
            ) : null}
            {expanded && attack?.success ? (
              <AttackDetails
                attack={entry}
                data={attack.data}
                bonus={formatModifier(attackBonus ?? 0)}
              />
            ) : null}
            {expanded && !spell?.success && !attack?.success ? (
              <View style={{ gap: 4 }}>
                {entry.source ? <AppText variant="small">Origem: {entry.source}</AppText> : null}
                <AppText variant={entry.description ? 'serif' : 'muted'}>
                  {entry.description || 'Sem descrição.'}
                </AppText>
              </View>
            ) : null}
            {resource ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText variant="muted" style={{ flex: 1 }}>
                  {resource.label}: {resource.current}
                  {resource.max === null ? '' : `/${resource.max}`}
                </AppText>
                {canEditPlay ? (
                  <Button
                    label="Usar"
                    compact
                    variant="secondary"
                    disabled={resource.current <= 0}
                    onPress={() => adjustResource(resource, 'spend', 1)}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
