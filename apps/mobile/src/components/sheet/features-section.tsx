import type { CharacterAbility } from '@codexveil/database';
import { d20Expression } from '@codexveil/domain';
import {
  canRage,
  rageDamageBonus,
  resolveDnd5eAttack,
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
import { useRage } from '@/lib/active-effects';
import { RageGlow } from './rage-glow';
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
    characterId,
  } = useSheet();
  const [rage, setRage] = useRage(characterId);
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

      {show !== 'passive' && canRage(sheet) ? (
        <Pressable
          disabled={!canEditPlay}
          accessibilityRole="switch"
          accessibilityState={{ checked: rage > 0 }}
          onPress={() => setRage(rage > 0 ? 0 : 1)}
          style={{
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            borderColor: rage > 0 ? '#F87171' : colors.line,
            backgroundColor: rage > 0 ? 'rgba(239,68,68,0.15)' : 'transparent',
          }}
        >
          {rage > 0 ? <RageGlow /> : null}
          <AppText style={{ fontFamily: fonts.display, color: colors.fg }}>
            {rage > 0 ? 'Em Fúria! (toque para sair)' : 'Entrar em Fúria'}
          </AppText>
          <AppText variant="small">
            +
            {rageDamageBonus(
              sheet.identity.classes
                .filter((entry) => /b[aá]rbaro|barbarian/i.test(entry.name))
                .reduce((total, entry) => total + entry.level, 0),
            )}{' '}
            no dano com Força corpo a corpo; vantagem em testes e salvaguardas de Força; resistência
            a dano contundente, cortante e perfurante.
          </AppText>
        </Pressable>
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
        const resolved = attack?.success
          ? resolveDnd5eAttack(entry.name, attack.data, {
              sheet,
              derived,
              items,
              features: allAbilities
                .filter((item) => item.kind !== 'attack' && item.kind !== 'spell')
                .map((item) => item.name),
              effects: { rage: rage > 0 },
            })
          : null;
        const attackBonus = resolved?.toHit ?? null;
        const damage = resolved?.damage ?? null;
        const critical = resolved?.critical ?? null;
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
              {canEditSheet ? (
                <IconButton
                  icon={<Pencil size={16} color={colors.fgSecondary} />}
                  accessibilityLabel={`Editar ${entry.name}`}
                  onPress={() => setEditing({ entry, kind: entry.kind })}
                />
              ) : null}
            </View>
            {attackBonus !== null && attack?.success ? (
              // As três rolagens, na ordem do jogo: acerto, dano e dano crítico.
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  {
                    key: 'acerto',
                    title: 'Acerto',
                    expression: d20Expression(attackBonus),
                    value: formatModifier(attackBonus),
                    color: colors.fgAccent,
                    label: `Ataque: ${entry.name}`,
                  },
                  {
                    key: 'dano',
                    title: 'Dano',
                    expression: damage,
                    value: damage ?? '—',
                    color: '#EC9384',
                    label: `Dano: ${entry.name}`,
                  },
                  {
                    key: 'critico',
                    title: `Crítico (${critRangeLabel(resolved?.critRange ?? attack.data.critRange)})`,
                    expression: critical,
                    value: critical ?? '—',
                    color: '#E6BE74',
                    label: `Dano crítico: ${entry.name}`,
                  },
                ].map((roll) => (
                  <RollButton
                    key={roll.key}
                    expression={roll.expression}
                    label={roll.label}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={{
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.line,
                        borderRadius: 8,
                        paddingVertical: 6,
                      }}
                    >
                      <AppText variant="small" style={{ fontSize: 11 }}>
                        {roll.title}
                      </AppText>
                      <AppText variant="number" style={{ color: roll.color }}>
                        {roll.value}
                      </AppText>
                    </View>
                  </RollButton>
                ))}
              </View>
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
