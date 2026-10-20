import {
  createCharacterAbility,
  deleteCharacterAbility,
  updateCharacterAbility,
  type CharacterAbility,
} from '@codexveil/database';
import {
  ABILITIES,
  SPELL_SCHOOLS,
  spellNamePt,
  SRD_SPELLS,
  abilityLabels,
  dnd5eAttackDataSchema,
  dnd5eSpellDataSchema,
  spellSchoolLabels,
  type Dnd5eAttackData,
  type Dnd5eSpellData,
} from '@codexveil/rpg-systems/dnd5e';
import {
  ABILITY_ENTRY_KINDS,
  abilityEntryKindLabels,
  abilityEntrySchema,
  fieldErrorsFrom,
  type AbilityEntryKind,
  type FieldErrors,
} from '@codexveil/validation';
import { Trash2, WandSparkles } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow, NumberField } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { PickerSheet } from '@/components/ui/picker';
import { AppText, Card } from '@/components/ui/primitives';
import { colors, spacing } from '@/lib/theme';
import { getSupabase } from '@/lib/supabase';
import { useSheet } from './context';

interface Draft {
  kind: AbilityEntryKind;
  name: string;
  source: string;
  description: string;
  spell: Dnd5eSpellData;
  attack: Dnd5eAttackData;
}

function draftFrom(entry: CharacterAbility | null, kind: AbilityEntryKind): Draft {
  const spell = dnd5eSpellDataSchema.safeParse(entry?.data ?? {});
  const attack = dnd5eAttackDataSchema.safeParse(entry?.data ?? {});
  return {
    kind: entry?.kind ?? kind,
    name: entry?.name ?? '',
    source: entry?.source ?? '',
    description: entry?.description ?? '',
    spell: spell.success ? spell.data : dnd5eSpellDataSchema.parse({}),
    attack: attack.success ? attack.data : dnd5eAttackDataSchema.parse({}),
  };
}

/**
 * Cadastro de ataques, magias e habilidades na ficha (o mesmo formato do site). Magias podem
 * vir do SRD: o nome e os dados técnicos são preenchidos sozinhos.
 */
export function AbilityEditor({
  entry,
  kind,
  onDone,
}: {
  entry: CharacterAbility | null;
  kind: AbilityEntryKind;
  onDone: () => void;
}) {
  const { characterId, run, setAbilities } = useSheet();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(entry, kind));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [pickingSpell, setPickingSpell] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const setSpell = (patch: Partial<Dnd5eSpellData>) =>
    setDraft((current) => ({ ...current, spell: { ...current.spell, ...patch } }));
  const setAttack = (patch: Partial<Dnd5eAttackData>) =>
    setDraft((current) => ({ ...current, attack: { ...current.attack, ...patch } }));

  const save = async () => {
    const parsed = abilityEntrySchema.safeParse({
      kind: draft.kind,
      name: draft.name,
      source: draft.source,
      description: draft.description,
      resourceId: entry?.resourceId ?? null,
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    const data =
      draft.kind === 'spell'
        ? dnd5eSpellDataSchema.parse(draft.spell)
        : draft.kind === 'attack'
          ? dnd5eAttackDataSchema.parse(draft.attack)
          : {};
    setBusy(true);
    const saved = await run(
      () =>
        entry
          ? updateCharacterAbility(getSupabase(), entry.id, {
              name: parsed.data.name,
              source: parsed.data.source,
              description: parsed.data.description,
              data,
              resourceId: entry.resourceId,
            })
          : createCharacterAbility(getSupabase(), characterId, {
              kind: draft.kind,
              name: parsed.data.name,
              source: parsed.data.source,
              description: parsed.data.description,
              data,
              resourceId: null,
            }),
      'A habilidade não foi salva',
    );
    setBusy(false);
    if (!saved) return;
    setAbilities((current) =>
      entry ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved],
    );
    onDone();
  };

  const remove = async () => {
    if (!entry) return;
    const ok = await confirm({
      title: `Excluir “${entry.name}”?`,
      message: 'A entrada sai da ficha.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;
    const done = await run(
      () => deleteCharacterAbility(getSupabase(), entry.id),
      'A habilidade não foi excluída',
    );
    if (done === undefined) return;
    setAbilities((current) => current.filter((item) => item.id !== entry.id));
    onDone();
  };

  return (
    <Card>
      <AppText variant="heading">{entry ? `Editar: ${entry.name}` : 'Nova entrada'}</AppText>
      {entry ? null : (
        <ChipRow>
          {ABILITY_ENTRY_KINDS.map((option) => (
            <Chip
              key={option}
              label={abilityEntryKindLabels[option]}
              selected={draft.kind === option}
              onPress={() => set({ kind: option })}
            />
          ))}
        </ChipRow>
      )}
      {draft.kind === 'spell' && !entry ? (
        <Button
          label="Escolher magia do SRD"
          compact
          variant="secondary"
          icon={<WandSparkles size={14} color={colors.fg} />}
          onPress={() => setPickingSpell(true)}
        />
      ) : null}
      <Field
        label="Nome"
        value={draft.name}
        maxLength={120}
        onChangeText={(name) => set({ name })}
        error={errors.name}
      />
      <Field
        label="Origem (opcional)"
        value={draft.source}
        maxLength={120}
        onChangeText={(source) => set({ source })}
        placeholder="Ex.: Classe: Mago"
      />

      {draft.kind === 'spell' ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="small" style={{ color: colors.fg }}>
            Círculo
          </AppText>
          <ChipRow>
            {Array.from({ length: 10 }, (_, circle) => (
              <Chip
                key={circle}
                label={circle === 0 ? 'Truque' : `${circle}º`}
                selected={draft.spell.circle === circle}
                onPress={() => setSpell({ circle })}
              />
            ))}
          </ChipRow>
          <AppText variant="small" style={{ color: colors.fg }}>
            Escola
          </AppText>
          <ChipRow>
            {SPELL_SCHOOLS.map((school) => (
              <Chip
                key={school}
                label={spellSchoolLabels[school]}
                selected={draft.spell.school === school}
                onPress={() => setSpell({ school })}
              />
            ))}
          </ChipRow>
          <Field
            label="Conjuração"
            value={draft.spell.castingTime}
            maxLength={60}
            onChangeText={(castingTime) => setSpell({ castingTime })}
          />
          <Field
            label="Alcance"
            value={draft.spell.range}
            maxLength={60}
            onChangeText={(range) => setSpell({ range })}
          />
          <Field
            label="Componentes"
            value={draft.spell.components}
            maxLength={120}
            onChangeText={(components) => setSpell({ components })}
          />
          <Field
            label="Duração"
            value={draft.spell.duration}
            maxLength={60}
            onChangeText={(duration) => setSpell({ duration })}
          />
          <CheckRow
            label="Concentração"
            checked={draft.spell.concentration}
            onChange={(concentration) => setSpell({ concentration })}
          />
          <CheckRow
            label="Ritual"
            checked={draft.spell.ritual}
            onChange={(ritual) => setSpell({ ritual })}
          />
          {draft.spell.circle > 0 ? (
            <CheckRow
              label="Preparada"
              checked={draft.spell.prepared}
              onChange={(prepared) => setSpell({ prepared })}
            />
          ) : null}
        </View>
      ) : null}

      {draft.kind === 'attack' ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="small" style={{ color: colors.fg }}>
            Atributo do ataque
          </AppText>
          <ChipRow>
            {ABILITIES.map((ability) => (
              <Chip
                key={ability}
                label={abilityLabels[ability].abbreviation}
                selected={draft.attack.ability === ability}
                onPress={() => setAttack({ ability })}
              />
            ))}
            <Chip
              label="Bônus fixo"
              selected={draft.attack.ability === null}
              onPress={() => setAttack({ ability: null })}
            />
          </ChipRow>
          <CheckRow
            label="Proficiente"
            checked={draft.attack.proficient}
            onChange={(proficient) => setAttack({ proficient })}
          />
          <NumberField
            label="Bônus extra"
            value={draft.attack.bonus}
            onChange={(bonus) => setAttack({ bonus: Math.max(-30, Math.min(30, bonus ?? 0)) })}
          />
          <Field
            label="Dano"
            value={draft.attack.damage}
            maxLength={60}
            autoCapitalize="none"
            onChangeText={(damage) => setAttack({ damage })}
            placeholder="Ex.: 1d8"
            hint="O modificador do atributo é somado ao rolar."
          />
          <Field
            label="Tipo de dano"
            value={draft.attack.damageType}
            maxLength={40}
            onChangeText={(damageType) => setAttack({ damageType })}
            placeholder="Ex.: Cortante"
          />
          <Field
            label="Alcance"
            value={draft.attack.range}
            maxLength={60}
            onChangeText={(range) => setAttack({ range })}
            placeholder="Ex.: 1,5 m"
          />
        </View>
      ) : null}

      <Field
        label="Descrição"
        value={draft.description}
        multiline
        maxLength={8000}
        onChangeText={(description) => set({ description })}
        error={errors.description}
      />
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Button label="Cancelar" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button label="Salvar" loading={busy} onPress={() => void save()} style={{ flex: 1 }} />
      </View>
      {entry ? (
        <Button
          label="Excluir"
          variant="danger"
          compact
          icon={<Trash2 size={14} color="#EC9384" />}
          onPress={() => void remove()}
        />
      ) : null}

      <PickerSheet
        visible={pickingSpell}
        title="Magias do SRD"
        hint="Nomes em português, com o original em inglês. Os dados técnicos são preenchidos sozinhos."
        options={SRD_SPELLS.map((spell) => ({
          value: spell.name,
          label: spellNamePt(spell.name),
          description: `${spell.name} · ${spell.level === 0 ? 'Truque' : `${spell.level}º círculo`} · ${spellSchoolLabels[spell.school]}`,
        }))}
        onClose={() => setPickingSpell(false)}
        onSelect={(name) => {
          setPickingSpell(false);
          const spell = SRD_SPELLS.find((entryOption) => entryOption.name === name);
          if (!spell) return;
          set({
            name: spell.name,
            source: draft.source || 'SRD 5.2.1',
            spell: dnd5eSpellDataSchema.parse({
              circle: spell.level,
              school: spell.school,
              castingTime: spell.castingTime,
              range: spell.range,
              components: spell.components,
              duration: spell.duration,
              concentration: Boolean(spell.concentration),
              ritual: Boolean(spell.ritual),
              prepared: false,
            }),
          });
        }}
      />
    </Card>
  );
}
