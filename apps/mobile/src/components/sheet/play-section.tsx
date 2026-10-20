import {
  createCharacterResource,
  removeCharacterCondition,
  setCharacterConditionLevel,
  takeCharacterRest,
  type CharacterResource,
} from '@codexveil/database';
import {
  RESOURCE_RECOVERIES,
  d20Expression,
  healthStatus,
  resourceRecoveryLabels,
  type ResourceRecovery,
} from '@codexveil/domain';
import {
  DND5E_RESOURCE_KEYS,
  dnd5eLongRestConditionChanges,
  effectiveSpeed,
  formatModifier,
  isDedicatedResourceKey,
  netRollMode,
  passiveWithConditions,
  rollModeShortLabels,
  type ConditionRollSource,
} from '@codexveil/rpg-systems/dnd5e';
import { Heart, HeartCrack, Minus, Plus, Shield } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { RollButton } from '@/components/dice/dice';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, ChipRow, NumberField } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { useConfirm } from '@/components/ui/dialog';
import { HealthBar } from '@/components/ui/health-bar';
import { AppText, Card } from '@/components/ui/primitives';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';
import { ConditionsSection } from './conditions-section';
import { useSheet } from './context';

function HitPoints() {
  const { resources, adjustResource, canEditPlay } = useSheet();
  const [amount, setAmount] = useState('');
  const [invalid, setInvalid] = useState(false);
  const hp = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.hitPoints);
  if (!hp) return <AppText variant="muted">Este personagem não tem trilha de vida.</AppText>;

  const apply = (operation: 'damage' | 'heal' | 'set_temp') => {
    const value = Number(amount.trim());
    if (!amount.trim() || !Number.isInteger(value) || value < 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    adjustResource(hp, operation, value);
    setAmount('');
  };

  return (
    <Card
      ornate
      style={
        healthStatus(hp.current, hp.max) === 'down'
          ? { borderColor: 'rgba(226, 109, 90, 0.6)' }
          : undefined
      }
    >
      <AppText variant="heading">Pontos de vida</AppText>
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}
        accessible
        accessibilityLabel={`${hp.current} de ${hp.max ?? '?'} pontos de vida`}
        accessibilityLiveRegion="polite"
      >
        <AppText variant="display" style={{ fontSize: 52, lineHeight: 56 }}>
          {hp.current}
        </AppText>
        <AppText variant="heading" style={{ color: colors.fgMuted, paddingBottom: 6 }}>
          / {hp.max ?? '—'}
        </AppText>
        {hp.temp > 0 ? (
          <AppText variant="small" style={{ color: '#A5C2E6', paddingBottom: 10 }}>
            +{hp.temp} temp.
          </AppText>
        ) : null}
      </View>
      <HealthBar current={hp.current} max={hp.max} temp={hp.temp} showValues={false} />
      {canEditPlay ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.fgSubtle}
              accessibilityLabel="Quantidade"
              style={[styles.amount, invalid && { borderColor: '#E26D5A' }]}
              onSubmitEditing={() => apply('damage')}
            />
            <Button
              label="Dano"
              variant="danger"
              icon={<HeartCrack size={16} color="#EC9384" />}
              onPress={() => apply('damage')}
              style={{ flex: 1 }}
            />
            <Button
              label="Cura"
              variant="secondary"
              icon={<Heart size={16} color={colors.fg} />}
              onPress={() => apply('heal')}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: '−5', operation: 'damage' as const, value: 5 },
              { label: '−1', operation: 'damage' as const, value: 1 },
              { label: '+1', operation: 'heal' as const, value: 1 },
              { label: '+5', operation: 'heal' as const, value: 5 },
            ].map((quick) => (
              <Button
                key={quick.label}
                label={quick.label}
                compact
                variant="ghost"
                accessibilityLabel={`${quick.operation === 'damage' ? 'Dano' : 'Cura'} de ${quick.value}`}
                onPress={() => adjustResource(hp, quick.operation, quick.value)}
                style={{ flex: 1, borderColor: colors.line }}
              />
            ))}
            <Button
              label="Temp."
              compact
              variant="secondary"
              icon={<Shield size={14} color={colors.fg} />}
              onPress={() => apply('set_temp')}
            />
          </View>
          {invalid ? (
            <AppText style={{ color: '#EC9384' }}>Informe um número inteiro.</AppText>
          ) : null}
        </>
      ) : null}
      <DeathSaves />
    </Card>
  );
}

function Boxes({
  resource,
  label,
  color,
}: {
  resource: CharacterResource;
  label: string;
  color: string;
}) {
  const { adjustResource, canEditPlay } = useSheet();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <AppText variant="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      {Array.from({ length: resource.max ?? 0 }, (_, index) => {
        const filled = index < resource.current;
        return (
          <Pressable
            key={index}
            disabled={!canEditPlay}
            onPress={() =>
              adjustResource(
                resource,
                'set_current',
                filled && resource.current === index + 1 ? index : index + 1,
              )
            }
            accessibilityRole="checkbox"
            accessibilityState={{ checked: filled, disabled: !canEditPlay }}
            accessibilityLabel={`${label} ${index + 1}`}
            hitSlop={8}
            style={[styles.box, filled && { backgroundColor: color, borderColor: color }]}
          />
        );
      })}
    </View>
  );
}

function DeathSaves() {
  const { resources } = useSheet();
  const successes = resources.find(
    (resource) => resource.key === DND5E_RESOURCE_KEYS.deathSaveSuccesses,
  );
  const failures = resources.find(
    (resource) => resource.key === DND5E_RESOURCE_KEYS.deathSaveFailures,
  );
  const inspiration = resources.find(
    (resource) => resource.key === DND5E_RESOURCE_KEYS.heroicInspiration,
  );
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
      {successes ? (
        <Boxes resource={successes} label="Sucessos contra a morte" color={colors.success} />
      ) : null}
      {failures ? (
        <Boxes resource={failures} label="Falhas contra a morte" color={colors.danger} />
      ) : null}
      {inspiration ? (
        <Boxes resource={inspiration} label="Inspiração heroica" color={colors.parchment} />
      ) : null}
    </View>
  );
}

function Resources() {
  const {
    resources,
    conditions,
    adjustResource,
    canEditPlay,
    characterId,
    run,
    reloadPlayState,
    setResources,
  } = useSheet();
  const confirm = useConfirm();
  const general = resources.filter((resource) => !isDedicatedResourceKey(resource.key));
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{
    label: string;
    max: number | null;
    recovery: ResourceRecovery;
  }>({ label: '', max: 1, recovery: 'long_rest' });

  const create = async () => {
    const label = draft.label.trim();
    if (!label) return;
    const created = await run(
      () =>
        createCharacterResource(getSupabase(), characterId, {
          label: label.slice(0, 60),
          current: draft.max ?? 0,
          max: draft.max,
          recovery: draft.recovery,
        }),
      'O recurso não foi criado',
    );
    if (!created) return;
    setResources((current) => [...current, created]);
    setCreating(false);
    setDraft({ label: '', max: 1, recovery: 'long_rest' });
  };

  const rest = async (kind: 'short_rest' | 'long_rest') => {
    const confirmed = await confirm({
      title: kind === 'short_rest' ? 'Descanso curto?' : 'Descanso longo?',
      message:
        kind === 'short_rest'
          ? 'Restaura os recursos de descanso curto.'
          : 'Restaura vida, espaços de magia e recursos de descanso curto e longo. A Exaustão cai 1 nível.',
      confirmLabel: 'Descansar',
    });
    if (!confirmed) return;
    await run(async () => {
      const client = getSupabase();
      await takeCharacterRest(client, characterId, kind);
      // SRD 5.2.1: terminar um Descanso Longo remove 1 nível de Exaustão.
      if (kind === 'long_rest') {
        const changes = dnd5eLongRestConditionChanges(conditions);
        for (const entry of changes.update)
          await setCharacterConditionLevel(client, entry.id, entry.level);
        for (const conditionId of changes.remove)
          await removeCharacterCondition(client, conditionId);
      }
    }, 'O descanso não foi registrado');
    await reloadPlayState();
  };

  return (
    <Card>
      <AppText variant="heading">Recursos</AppText>
      {general.length === 0 ? (
        <AppText variant="muted">
          Nenhum recurso registrado (ex.: usos de Fúria, Canalizar Divindade).
        </AppText>
      ) : null}
      {general.map((resource) => (
        <View key={resource.id} style={styles.resource}>
          <View style={{ flex: 1 }}>
            <AppText>{resource.label}</AppText>
            <AppText variant="small" style={{ color: colors.fgMuted }}>
              {resourceRecoveryLabels[resource.recovery]}
            </AppText>
          </View>
          <AppText variant="number" style={{ fontSize: 18 }}>
            {resource.current}
            {resource.max === null ? '' : `/${resource.max}`}
          </AppText>
          {canEditPlay ? (
            <>
              <IconButton
                icon={<Minus size={16} color={colors.fg} />}
                accessibilityLabel={`Gastar 1 de ${resource.label}`}
                disabled={resource.current <= 0}
                onPress={() => adjustResource(resource, 'spend', 1)}
              />
              <IconButton
                icon={<Plus size={16} color={colors.fg} />}
                accessibilityLabel={`Recuperar 1 de ${resource.label}`}
                disabled={resource.max !== null && resource.current >= resource.max}
                onPress={() => adjustResource(resource, 'heal', 1)}
              />
            </>
          ) : null}
        </View>
      ))}
      {canEditPlay ? (
        creating ? (
          <View
            style={{
              gap: spacing[2],
              padding: spacing[3],
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.lineStrong,
            }}
          >
            <Field
              label="Nome do recurso"
              value={draft.label}
              maxLength={60}
              onChangeText={(label) => setDraft((current) => ({ ...current, label }))}
              placeholder="Ex.: Fúria"
            />
            <NumberField
              label="Máximo (vazio = sem limite)"
              value={draft.max}
              allowEmpty
              onChange={(max) =>
                setDraft((current) => ({
                  ...current,
                  max: max === null ? null : Math.max(0, Math.min(99_999, max)),
                }))
              }
            />
            <ChipRow>
              {RESOURCE_RECOVERIES.map((recovery) => (
                <Chip
                  key={recovery}
                  label={resourceRecoveryLabels[recovery]}
                  selected={draft.recovery === recovery}
                  onPress={() => setDraft((current) => ({ ...current, recovery }))}
                />
              ))}
            </ChipRow>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="Cancelar"
                compact
                variant="ghost"
                onPress={() => setCreating(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Criar"
                compact
                disabled={!draft.label.trim()}
                onPress={() => void create()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <Button
            label="Novo recurso"
            compact
            variant="ghost"
            icon={<Plus size={14} color={colors.fgSecondary} />}
            onPress={() => setCreating(true)}
          />
        )
      ) : null}
      {canEditPlay ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label="Descanso curto"
            compact
            variant="secondary"
            onPress={() => void rest('short_rest')}
            style={{ flex: 1 }}
          />
          <Button
            label="Descanso longo"
            compact
            variant="secondary"
            onPress={() => void rest('long_rest')}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </Card>
  );
}

/** "Vant." / "Desv." quando as condições dão vantagem ou desvantagem direta. */
function rollMark(sources: readonly ConditionRollSource[]): string | null {
  const mode = netRollMode(sources);
  return mode === 'advantage' || mode === 'disadvantage' ? rollModeShortLabels[mode] : null;
}

function CombatStats() {
  const { sheet, derived, conditionEffects: effects } = useSheet();
  const speed = effectiveSpeed(sheet.combat.speed, sheet.combat.speedUnit, effects);
  const passive = passiveWithConditions(derived.passivePerception, effects);
  const initiativeNotes = [
    rollMark(effects.initiative),
    effects.d20Penalty > 0 ? `−${effects.d20Penalty} Exaustão` : null,
  ].filter(Boolean);
  const speedNote =
    effects.speedZero.length > 0
      ? effects.speedZero.join(', ')
      : effects.speedReductionFeet > 0
        ? `Exaustão ${effects.exhaustionLevel}`
        : null;
  const initiativeMode = netRollMode(effects.initiative);
  const stats = [
    { label: 'CA', value: String(sheet.combat.armorClass), note: null, changed: false },
    {
      label: 'Iniciativa',
      value: formatModifier(derived.initiative - effects.d20Penalty),
      note: initiativeNotes.join(' · ') || null,
      changed: initiativeNotes.length > 0,
      roll: {
        expression: d20Expression(derived.initiative - effects.d20Penalty),
        mode:
          initiativeMode === 'advantage' || initiativeMode === 'disadvantage'
            ? initiativeMode
            : 'normal',
      } as const,
    },
    {
      label: 'Desloc.',
      value: `${speed.toLocaleString('pt-BR')} ${sheet.combat.speedUnit}`,
      note: speedNote,
      changed: speed !== sheet.combat.speed,
    },
    {
      label: 'Percepção',
      value: String(passive),
      note: passive !== derived.passivePerception ? `base ${derived.passivePerception}` : null,
      changed: passive !== derived.passivePerception,
    },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={[styles.stat, stat.changed && { borderColor: 'rgba(217, 165, 74, 0.45)' }]}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}${stat.note ? ` (${stat.note})` : ''}`}
        >
          {'roll' in stat && stat.roll ? (
            <RollButton
              expression={stat.roll.expression}
              label={stat.label}
              mode={stat.roll.mode}
              style={{ paddingHorizontal: 6 }}
            >
              <AppText variant="number" style={stat.changed ? { color: '#E6BE74' } : undefined}>
                {stat.value}
              </AppText>
            </RollButton>
          ) : (
            <AppText variant="number" style={stat.changed ? { color: '#E6BE74' } : undefined}>
              {stat.value}
            </AppText>
          )}
          <AppText variant="small" style={{ color: colors.fgMuted }}>
            {stat.label}
          </AppText>
          {stat.note ? (
            <AppText
              variant="small"
              style={{ color: '#E6BE74', fontSize: 10, lineHeight: 13, textAlign: 'center' }}
            >
              {stat.note}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Seção "Jogo": o que se consulta e altera durante a partida. */
export function PlaySection() {
  return (
    <View style={{ gap: spacing[4] }}>
      <HitPoints />
      <CombatStats />
      <ConditionsSection />
      <Resources />
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    width: 72,
    height: 44,
    textAlign: 'center',
    fontSize: 18,
    color: colors.fg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.sunken,
  },
  resource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
  },
});
