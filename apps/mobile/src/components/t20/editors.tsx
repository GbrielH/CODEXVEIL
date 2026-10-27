import {
  createCharacterAbility,
  deleteCharacterAbility,
  updateCharacterAbility,
  type CharacterAbility,
  type Json,
} from '@codexveil/database';
import {
  T20_ATTRIBUTES,
  T20_SIZES,
  T20_SKILLS,
  T20_SKILL_IDS,
  t20AttributeLabels,
  t20SizeLabels,
  type T20Sheet,
  type T20Size,
  type T20Skill,
} from '@codexveil/rpg-systems/tormenta20';
import { abilityEntrySchema, type AbilityEntryKind } from '@codexveil/validation';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, NumberField } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Card, CardTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

/** Botões – e + com o número no meio (atributos, bônus, PV/PM). */
function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.stepper}>
      <AppText variant="small" style={{ flex: 1 }}>
        {label}
      </AppText>
      <Button compact variant="ghost" label="–" accessibilityLabel={`Diminuir ${label}`} onPress={() => onChange(Math.max(min, value - 1))} />
      <AppText style={styles.stepperValue}>{value}</AppText>
      <Button compact variant="ghost" label="+" accessibilityLabel={`Aumentar ${label}`} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}

/** Edição na aba Perícias: valores dos atributos, perícias treinadas e bônus fixos por perícia. */
export function T20SkillsEditor({ sheet, onSave, onCancel }: { sheet: T20Sheet; onSave: (next: T20Sheet) => Promise<void>; onCancel: () => void }) {
  const [attributes, setAttributes] = useState({ ...sheet.attributes });
  const [trained, setTrained] = useState(new Set<T20Skill>(sheet.skills.trained));
  const [bonuses, setBonuses] = useState<Record<string, number>>({ ...sheet.skills.bonuses });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        ...sheet,
        attributes,
        skills: {
          ...sheet.skills,
          trained: T20_SKILL_IDS.filter((skill) => trained.has(skill)),
          bonuses: Object.fromEntries(Object.entries(bonuses).filter(([, value]) => value !== 0)),
        },
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardTitle title="Editar atributos e perícias" description="Os totais continuam calculados; aqui ficam os valores de base." />
      {T20_ATTRIBUTES.map((key) => (
        <Stepper
          key={key}
          label={t20AttributeLabels[key].name}
          value={attributes[key] ?? 0}
          min={-10}
          max={20}
          onChange={(value) => setAttributes({ ...attributes, [key]: value })}
        />
      ))}
      <AppText variant="small" style={{ marginTop: spacing[2] }}>
        Toque no nome para marcar como treinada; use – e + para o bônus fixo.
      </AppText>
      {T20_SKILL_IDS.map((skill) => {
        const on = trained.has(skill);
        return (
          <View key={skill} style={styles.stepper}>
            <View style={{ flex: 1 }}>
              <Chip
                label={`${on ? '● ' : '○ '}${T20_SKILLS[skill].label}`}
                selected={on}
                role="checkbox"
                onPress={() => {
                  const next = new Set(trained);
                  if (on) next.delete(skill);
                  else next.add(skill);
                  setTrained(next);
                }}
              />
            </View>
            <Button compact variant="ghost" label="–" accessibilityLabel={`Diminuir bônus de ${T20_SKILLS[skill].label}`} onPress={() => setBonuses({ ...bonuses, [skill]: (bonuses[skill] ?? 0) - 1 })} />
            <AppText style={styles.stepperValue}>{bonuses[skill] ?? 0}</AppText>
            <Button compact variant="ghost" label="+" accessibilityLabel={`Aumentar bônus de ${T20_SKILLS[skill].label}`} onPress={() => setBonuses({ ...bonuses, [skill]: (bonuses[skill] ?? 0) + 1 })} />
          </View>
        );
      })}
      <View style={styles.actions}>
        <Button variant="ghost" label="Cancelar" onPress={onCancel} disabled={busy} />
        <Button label="Salvar" loading={busy} onPress={() => void save()} />
      </View>
    </Card>
  );
}

export interface T20StatsChange {
  sheet: T20Sheet;
  hitPointsMax: number;
  manaPointsMax: number;
}

/** Ajuste manual: bônus de Defesa e Iniciativa, deslocamento, tamanho e PV/PM máximos. */
export function T20StatsEditor({
  sheet,
  hitPointsMax,
  manaPointsMax,
  onSave,
  onCancel,
}: {
  sheet: T20Sheet;
  hitPointsMax: number;
  manaPointsMax: number;
  onSave: (change: T20StatsChange) => Promise<void>;
  onCancel: () => void;
}) {
  const [defenseOther, setDefenseOther] = useState(sheet.defense.other);
  const [initiative, setInitiative] = useState(sheet.skills.bonuses.iniciativa ?? 0);
  const [speed, setSpeed] = useState<number | null>(sheet.identity.speed);
  const [size, setSize] = useState<T20Size>(sheet.identity.size);
  const [hp, setHp] = useState<number | null>(hitPointsMax);
  const [pm, setPm] = useState<number | null>(manaPointsMax);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        sheet: {
          ...sheet,
          identity: { ...sheet.identity, speed: speed ?? 0, size },
          defense: { ...sheet.defense, other: defenseOther },
          skills: { ...sheet.skills, bonuses: { ...sheet.skills.bonuses, iniciativa: initiative } },
          hitPoints: { ...sheet.hitPoints, max: Math.max(1, hp ?? 1) },
          manaPoints: { ...sheet.manaPoints, max: Math.max(0, pm ?? 0) },
        },
        hitPointsMax: Math.max(1, hp ?? 1),
        manaPointsMax: Math.max(0, pm ?? 0),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardTitle title="Ajustar números da ficha" description="Para o que o livro não cobre (itens, decisões do mestre). Defesa e Iniciativa continuam calculadas; aqui entra o bônus extra." />
      <Stepper label="Defesa: outros bônus" value={defenseOther} min={-20} max={40} onChange={setDefenseOther} />
      <Stepper label="Iniciativa: bônus" value={initiative} min={-20} max={40} onChange={setInitiative} />
      <NumberField label="Deslocamento (m)" value={speed} onChange={setSpeed} decimal />
      <AppText variant="small">Tamanho</AppText>
      <ChipRow>
        {T20_SIZES.map((option) => (
          <Chip key={option} label={t20SizeLabels[option]} selected={size === option} role="radio" onPress={() => setSize(option)} />
        ))}
      </ChipRow>
      <NumberField label="PV máximos" value={hp} onChange={setHp} />
      <NumberField label="PM máximos" value={pm} onChange={setPm} />
      <View style={styles.actions}>
        <Button variant="ghost" label="Cancelar" onPress={onCancel} disabled={busy} />
        <Button label="Salvar" loading={busy} onPress={() => void save()} />
      </View>
    </Card>
  );
}

/** PV temporários: define o valor (0 tira). */
export function T20TempHitPoints({ current, onSet }: { current: number; onSet: (amount: number) => Promise<void> }) {
  const [value, setValue] = useState('');
  return (
    <View style={styles.stepper}>
      <AppText variant="small" style={{ flex: 1 }}>
        Temporários (agora {current})
      </AppText>
      <TextInput
        value={value}
        onChangeText={(text) => setValue(text.replace(/[^0-9]/g, '').slice(0, 3))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.fgMuted}
        accessibilityLabel="PV temporários"
        style={styles.input}
      />
      <Button
        compact
        variant="secondary"
        label="Definir"
        onPress={() => {
          void onSet(Math.max(0, Math.min(999, Number(value) || 0)));
          setValue('');
        }}
      />
    </View>
  );
}

/** Tibares: gastar e receber. */
export function T20MoneyCard({ amount, canEdit, onSpend, onReceive }: { amount: number; canEdit: boolean; onSpend: (n: number) => Promise<void>; onReceive: (n: number) => Promise<void> }) {
  const [value, setValue] = useState('');
  const n = Math.max(0, Number(value) || 0);
  return (
    <Card>
      <AppText variant="heading">Tibares</AppText>
      <AppText variant="number">T$ {amount}</AppText>
      {canEdit ? (
        <View style={styles.stepper}>
          <TextInput
            value={value}
            onChangeText={(text) => setValue(text.replace(/[^0-9]/g, '').slice(0, 7))}
            keyboardType="number-pad"
            placeholder="Valor"
            placeholderTextColor={colors.fgMuted}
            accessibilityLabel="Valor em tibares"
            style={[styles.input, { flex: 1 }]}
          />
          <Button compact variant="secondary" label="Gastar" disabled={!n} onPress={() => void onSpend(n).then(() => setValue(''))} />
          <Button compact variant="secondary" label="Receber" disabled={!n} onPress={() => void onReceive(n).then(() => setValue(''))} />
        </View>
      ) : null}
    </Card>
  );
}

/** Tipos que a ficha do Tormenta20 mostra. */
export const T20_ABILITY_KINDS: { kind: AbilityEntryKind; label: string }[] = [
  { kind: 'class_feature', label: 'Habilidade de classe' },
  { kind: 'species_trait', label: 'Habilidade de raça' },
  { kind: 'background_feature', label: 'Origem' },
  { kind: 'feat', label: 'Poder' },
  { kind: 'spell', label: 'Magia' },
];

/** Cadastro manual de habilidades, poderes e magias (criar, editar e excluir). */
export function T20AbilityForm({
  characterId,
  entry,
  onSaved,
  onDeleted,
  onCancel,
}: {
  characterId: string;
  entry: CharacterAbility | null;
  onSaved: (ability: CharacterAbility, isNew: boolean) => void;
  onDeleted: (abilityId: string) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const data = (entry?.data ?? {}) as { circle?: number; cost?: number };
  const [kind, setKind] = useState<AbilityEntryKind>(entry?.kind ?? 'feat');
  const [name, setName] = useState(entry?.name ?? '');
  const [source, setSource] = useState(entry?.source ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [circle, setCircle] = useState<number | null>(data.circle ?? 1);
  const [cost, setCost] = useState<number | null>(data.cost ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = abilityEntrySchema.safeParse({ kind, name, source, description, resourceId: entry?.resourceId ?? null });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os campos.');
      return;
    }
    const payload = (
      kind === 'spell' ? { ...((entry?.data as object | null) ?? {}), circle: Math.min(5, Math.max(1, circle ?? 1)), cost: Math.max(0, cost ?? 0) } : (entry?.data ?? {})
    ) as Json;
    setBusy(true);
    setError(null);
    try {
      const client = getSupabase();
      const saved = entry
        ? await updateCharacterAbility(client, entry.id, { ...parsed.data, data: payload })
        : await createCharacterAbility(client, characterId, { ...parsed.data, data: payload });
      toast({ tone: 'success', title: entry ? 'Alterações salvas.' : 'Adicionado à ficha.' });
      onSaved(saved, !entry);
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    const ok = await confirm({ title: `Excluir ${entry.name}?`, message: 'Sai da lista da ficha.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteCharacterAbility(getSupabase(), entry.id);
      toast({ tone: 'success', title: 'Removido da ficha.' });
      onDeleted(entry.id);
    } catch (cause) {
      setError(failureMessage(cause));
    }
  };

  return (
    <Card>
      <CardTitle title={entry ? `Editar ${entry.name}` : 'Adicionar à ficha'} />
      <ChipRow>
        {T20_ABILITY_KINDS.map((option) => (
          <Chip key={option.kind} label={option.label} selected={kind === option.kind} role="radio" onPress={() => setKind(option.kind)} />
        ))}
      </ChipRow>
      <Field label="Nome" value={name} onChangeText={setName} maxLength={120} />
      <Field label="Origem (ex.: Arcanista 3º nível, Mestre)" value={source} onChangeText={setSource} maxLength={120} />
      <Field label="Descrição" value={description} onChangeText={setDescription} multiline maxLength={8000} />
      {kind === 'spell' ? (
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <NumberField label="Círculo" value={circle} onChange={setCircle} width={90} />
          <NumberField label="Custo (PM)" value={cost} onChange={setCost} width={90} />
        </View>
      ) : null}
      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      <View style={styles.actions}>
        {entry ? <Button variant="danger" compact label="Excluir" onPress={() => void remove()} disabled={busy} /> : null}
        <View style={{ flex: 1 }} />
        <Button variant="ghost" label="Cancelar" onPress={onCancel} disabled={busy} />
        <Button label="Salvar" loading={busy} onPress={() => void submit()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 2 },
  stepperValue: { minWidth: 32, textAlign: 'center', color: colors.fg },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[2] },
  input: {
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    color: colors.fg,
  },
});
