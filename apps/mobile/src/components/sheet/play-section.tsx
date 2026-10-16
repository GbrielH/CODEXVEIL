import { applyCharacterCondition, removeCharacterCondition, takeCharacterRest, type CharacterResource } from '@codexveil/database';
import { healthStatus, resourceRecoveryLabels } from '@codexveil/domain';
import { DND5E_RESOURCE_KEYS, dnd5eConditions, formatModifier, isDedicatedResourceKey } from '@codexveil/rpg-systems/dnd5e';
import { Heart, HeartCrack, Minus, Plus, Shield, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert as NativeAlert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { HealthBar } from '@/components/ui/health-bar';
import { AppText, Card } from '@/components/ui/primitives';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';
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
    <Card ornate style={healthStatus(hp.current, hp.max) === 'down' ? { borderColor: 'rgba(226, 109, 90, 0.6)' } : undefined}>
      <AppText variant="heading">Pontos de vida</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }} accessible accessibilityLabel={`${hp.current} de ${hp.max ?? '?'} pontos de vida`} accessibilityLiveRegion="polite">
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
            <Button label="Dano" variant="danger" icon={<HeartCrack size={16} color="#EC9384" />} onPress={() => apply('damage')} style={{ flex: 1 }} />
            <Button label="Cura" variant="secondary" icon={<Heart size={16} color={colors.fg} />} onPress={() => apply('heal')} style={{ flex: 1 }} />
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
            <Button label="Temp." compact variant="secondary" icon={<Shield size={14} color={colors.fg} />} onPress={() => apply('set_temp')} />
          </View>
          {invalid ? <AppText style={{ color: '#EC9384' }}>Informe um número inteiro.</AppText> : null}
        </>
      ) : null}
      <DeathSaves />
    </Card>
  );
}

function Boxes({ resource, label, color }: { resource: CharacterResource; label: string; color: string }) {
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
            onPress={() => adjustResource(resource, 'set_current', filled && resource.current === index + 1 ? index : index + 1)}
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
  const successes = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.deathSaveSuccesses);
  const failures = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.deathSaveFailures);
  const inspiration = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.heroicInspiration);
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
      {successes ? <Boxes resource={successes} label="Sucessos contra a morte" color={colors.success} /> : null}
      {failures ? <Boxes resource={failures} label="Falhas contra a morte" color={colors.danger} /> : null}
      {inspiration ? <Boxes resource={inspiration} label="Inspiração heroica" color={colors.parchment} /> : null}
    </View>
  );
}

function Conditions() {
  const { conditions, canEditPlay, characterId, run, reloadPlayState } = useSheet();
  const [picking, setPicking] = useState(false);
  const labelOf = (key: string, level: number | null) => {
    const label = dnd5eConditions.find((condition) => condition.key === key)?.label ?? key;
    return level ? `${label} ${level}` : label;
  };

  return (
    <Card>
      <AppText variant="heading">Condições</AppText>
      {conditions.length === 0 ? <AppText variant="muted">Nenhuma condição ativa.</AppText> : null}
      {conditions.map((condition) => (
        <View key={condition.id} style={styles.condition}>
          <View style={{ flex: 1 }}>
            <AppText style={{ color: '#E6BE74', fontWeight: '600' }}>{labelOf(condition.key, condition.level)}</AppText>
            <AppText variant="small">{dnd5eConditions.find((item) => item.key === condition.key)?.summary ?? ''}</AppText>
          </View>
          {canEditPlay ? (
            <IconButton
              icon={<X size={16} color={colors.fgSecondary} />}
              accessibilityLabel={`Remover ${labelOf(condition.key, condition.level)}`}
              onPress={() => void run(() => removeCharacterCondition(getSupabase(), condition.id), 'A condição não foi removida').then(() => reloadPlayState())}
            />
          ) : null}
        </View>
      ))}
      {canEditPlay ? (
        picking ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {dnd5eConditions
              .filter((condition) => !conditions.some((applied) => applied.key === condition.key))
              .map((condition) => (
                <Button
                  key={condition.key}
                  label={condition.label}
                  compact
                  variant="secondary"
                  onPress={() => {
                    setPicking(false);
                    void run(() => applyCharacterCondition(getSupabase(), characterId, condition.key, 'maxLevel' in condition ? 1 : null), 'A condição não foi aplicada').then(() => reloadPlayState());
                  }}
                />
              ))}
            <Button label="Cancelar" compact variant="ghost" onPress={() => setPicking(false)} />
          </View>
        ) : (
          <Button label="Aplicar condição" compact variant="secondary" icon={<Plus size={14} color={colors.fg} />} onPress={() => setPicking(true)} />
        )
      ) : null}
    </Card>
  );
}

function Resources() {
  const { resources, adjustResource, canEditPlay, characterId, run, reloadPlayState } = useSheet();
  const general = resources.filter((resource) => !isDedicatedResourceKey(resource.key));

  const rest = (kind: 'short_rest' | 'long_rest') =>
    NativeAlert.alert(
      kind === 'short_rest' ? 'Descanso curto?' : 'Descanso longo?',
      kind === 'short_rest' ? 'Restaura os recursos de descanso curto.' : 'Restaura vida, espaços de magia e recursos de descanso curto e longo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descansar', onPress: () => void run(() => takeCharacterRest(getSupabase(), characterId, kind), 'O descanso não foi registrado').then(() => reloadPlayState()) },
      ],
    );

  return (
    <Card>
      <AppText variant="heading">Recursos</AppText>
      {general.length === 0 ? <AppText variant="muted">Nenhum recurso registrado. Crie-os pelo site.</AppText> : null}
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
              <IconButton icon={<Minus size={16} color={colors.fg} />} accessibilityLabel={`Gastar 1 de ${resource.label}`} disabled={resource.current <= 0} onPress={() => adjustResource(resource, 'spend', 1)} />
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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Descanso curto" compact variant="secondary" onPress={() => rest('short_rest')} style={{ flex: 1 }} />
          <Button label="Descanso longo" compact variant="secondary" onPress={() => rest('long_rest')} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Card>
  );
}

function CombatStats() {
  const { sheet, derived } = useSheet();
  const stats = [
    { label: 'CA', value: String(sheet.combat.armorClass) },
    { label: 'Iniciativa', value: formatModifier(derived.initiative) },
    { label: 'Desloc.', value: `${sheet.combat.speed} ${sheet.combat.speedUnit}` },
    { label: 'Percepção', value: String(derived.passivePerception) },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
          <AppText variant="number">{stat.value}</AppText>
          <AppText variant="small" style={{ color: colors.fgMuted }}>
            {stat.label}
          </AppText>
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
      <Conditions />
      <Resources />
    </View>
  );
}

const styles = StyleSheet.create({
  amount: { width: 72, height: 44, textAlign: 'center', fontSize: 18, color: colors.fg, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.md, backgroundColor: colors.sunken },
  box: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.sunken },
  condition: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(217, 165, 74, 0.3)', backgroundColor: colors.warningBg },
  resource: { flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 6 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised },
});
