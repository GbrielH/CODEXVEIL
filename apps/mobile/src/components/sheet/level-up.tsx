import {
  addCharacterEvent,
  adjustCharacterResource,
  createCharacterAbility,
  createCharacterResource,
  updateCharacterResource,
  type CharacterAbility,
} from '@codexveil/database';
import { rollDiceLocally } from '@codexveil/domain';
import {
  ABILITIES,
  DND5E_RESOURCE_KEYS,
  MAGIC_INITIATE_LISTS,
  abilityLabels,
  applyDnd5eLevelUp,
  dnd5eMulticlassOptions,
  featAbilityIncrease,
  featCategoryLabels,
  magicInitiateListLabels,
  magicInitiateOptions,
  planDnd5eLevelUp,
  skillDefinitions,
  skilledFeatOptions,
  spellNamePt,
  type Ability,
  type AbilityImprovement,
  type Dnd5eLevelUpChoices,
  type MagicInitiateChoice,
  type MagicInitiateList,
  type Skill,
  type SrdSpell,
} from '@codexveil/rpg-systems/dnd5e';
import { Dices, Sparkles, X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { PickerField, type PickerOption } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';
import { useSheet } from './context';

type ImprovementMode = 'plus_two' | 'plus_one_each' | 'feat';

/**
 * Subida de nível no app, com as mesmas regras do site (SRD 5.2.1): a classe que sobe ou uma
 * classe nova (multiclasse), vida, habilidades, aumento de atributo ou talento, magias e opções
 * da classe. Tudo por seletores; nada muda na ficha até aplicar.
 */
export function LevelUpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {visible ? <LevelUpPanel onClose={onClose} /> : null}
    </Modal>
  );
}

function LevelUpPanel({ onClose }: { onClose: () => void }) {
  const { characterId, sheet, resources, abilities, updateSheet, setAbilities, reloadPlayState, run } = useSheet();
  const toast = useToast();
  // Classe que sobe: a posição de uma classe da ficha ou "nova:<classe>" (multiclasse).
  const [target, setTarget] = useState('0');
  const newClassId = target.startsWith('nova:') ? target.slice(5) : undefined;
  const classIndex = newClassId ? 0 : Number(target);
  const knownNames = useMemo(() => abilities.map((entry) => entry.name), [abilities]);
  const multiclassOptions = useMemo(() => dnd5eMulticlassOptions(sheet), [sheet]);
  const plan = useMemo(() => planDnd5eLevelUp(sheet, classIndex, knownNames, newClassId), [sheet, classIndex, knownNames, newClassId]);

  const [hpMethod, setHpMethod] = useState<'average' | 'roll'>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const [mode, setMode] = useState<ImprovementMode>('plus_two');
  const [first, setFirst] = useState<Ability>('str');
  const [second, setSecond] = useState<Ability>('dex');
  const [featId, setFeatId] = useState('');
  const [featAbility, setFeatAbility] = useState<Ability | ''>('');
  const [featSkills, setFeatSkills] = useState<(Skill | '')[]>(['', '', '']);
  const [initiate, setInitiate] = useState<MagicInitiateChoice>({ list: '', cantrips: [], spell: '', ability: '' });
  const [cantrips, setCantrips] = useState<string[]>([]);
  const [spells, setSpells] = useState<string[]>([]);
  const [invocations, setInvocations] = useState<string[]>([]);
  const [metamagic, setMetamagic] = useState<string[]>([]);
  const [multiclassSkill, setMulticlassSkill] = useState<Skill | ''>('');
  const [multiclassInstrument, setMulticlassInstrument] = useState('');
  const [busy, setBusy] = useState(false);

  const featOptions = plan.feats.filter((feat) => feat.id !== 'ability_score_improvement');
  const featIncrease = featId ? featAbilityIncrease(featId) : null;
  let improvement: AbilityImprovement | null = null;
  if (plan.abilityScoreImprovement) {
    if (mode === 'plus_two') improvement = { kind: 'plus_two', ability: first };
    else if (mode === 'plus_one_each') improvement = { kind: 'plus_one_each', abilities: [first, second] };
    else if (featId) improvement = { kind: 'feat', featId, ...(featAbility ? { ability: featAbility } : {}) };
  }
  const choices: Dnd5eLevelUpChoices = {
    hitPoints: hpMethod === 'roll' ? { method: 'roll', die: rolled ?? 0 } : { method: 'average' },
    improvement,
    cantrips,
    spells,
    invocations,
    metamagic,
    ...(multiclassSkill ? { multiclassSkill } : {}),
    ...(multiclassInstrument ? { multiclassInstrument } : {}),
    featSkills: featSkills.filter((skill): skill is Skill => Boolean(skill)),
    magicInitiate: initiate,
  };
  const result = applyDnd5eLevelUp(sheet, plan, choices);

  const chooseTarget = (value: string) => {
    setTarget(value);
    setRolled(null);
    setCantrips([]);
    setSpells([]);
    setInvocations([]);
    setMetamagic([]);
    setMulticlassSkill('');
    setMulticlassInstrument('');
  };

  const classOptions: PickerOption[] = [
    ...sheet.identity.classes.map((entry, index) => ({
      value: String(index),
      label: `${entry.name || 'Sem nome'} ${entry.level} → ${entry.level + 1}`,
      disabled: entry.level >= 20,
    })),
    ...multiclassOptions.map((option) => ({
      value: `nova:${option.classDef.id}`,
      label: `Nova classe: ${option.classDef.name} 1`,
      description: option.blocked.length ? option.blocked.join(' ') : 'Multiclasse',
      disabled: option.blocked.length > 0,
    })),
  ];
  const abilityOptions = (scores: Record<Ability, number>): PickerOption[] =>
    ABILITIES.map((ability) => ({ value: ability, label: `${abilityLabels[ability].name} (${scores[ability]})`, disabled: scores[ability] >= 20 }));

  const apply = async () => {
    if (result.issues.length) return;
    setBusy(true);
    const supabase = getSupabase();
    const created = await run(async () => {
      const byKey = new Map(resources.map((resource) => [resource.key, resource]));
      const resourceIds = new Map(resources.map((resource) => [resource.key, resource.id]));
      for (const template of result.resources) {
        const existing = byKey.get(template.key);
        if (!existing) {
          const saved = await createCharacterResource(supabase, characterId, template);
          resourceIds.set(saved.key, saved.id);
        } else if (existing.max !== template.max) {
          // O máximo novo entra como usos disponíveis a mais (ou a menos), sem restaurar os gastos.
          const difference = (template.max ?? 0) - (existing.max ?? 0);
          await updateCharacterResource(supabase, existing.id, {
            label: template.key.startsWith('pact_slots') ? template.label : existing.label,
            current: Math.max(0, existing.current + difference),
            max: template.max,
            recovery: existing.recovery,
          });
        }
      }
      const hp = byKey.get(DND5E_RESOURCE_KEYS.hitPoints);
      if (hp && hp.max !== null) {
        await adjustCharacterResource(supabase, hp.id, 'set_max', hp.max + result.hitPointsGained);
        await adjustCharacterResource(supabase, hp.id, 'heal', result.hitPointsGained);
      }
      const existingNames = new Set(abilities.map((entry) => `${entry.kind}:${entry.name}`));
      const saved: CharacterAbility[] = [];
      for (const entry of result.abilities) {
        if (existingNames.has(`${entry.kind}:${entry.name}`)) continue;
        saved.push(
          await createCharacterAbility(supabase, characterId, {
            kind: entry.kind,
            name: entry.name,
            source: entry.source,
            description: entry.description,
            data: entry.data as CharacterAbility['data'],
            resourceId: entry.resourceKey ? (resourceIds.get(entry.resourceKey) ?? null) : null,
          }),
        );
      }
      await addCharacterEvent(supabase, characterId, { kind: 'level_up', summary: result.summary, data: { classIndex: plan.classIndex, level: plan.newTotalLevel } });
      return saved;
    }, 'A subida de nível não foi concluída');
    setBusy(false);
    if (!created) return;
    updateSheet(() => result.sheet);
    setAbilities((current) => [...current, ...created]);
    await reloadPlayState();
    toast({ tone: 'success', title: `Subiu para o nível ${plan.newTotalLevel}.` });
    onClose();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="eyebrow">Subir de nível</AppText>
          <AppText variant="title" accessibilityRole="header">
            Nível {plan.newTotalLevel}: {plan.className || 'classe'} {plan.newClassLevel}
          </AppText>
        </View>
        <IconButton icon={<X size={20} color={colors.fg} />} accessibilityLabel="Fechar" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="muted">
          {plan.classDef
            ? 'Regras do SRD 5.2.1. Escolha o que o nível oferece e aplique.'
            : 'Esta classe não está no SRD: o nível sobe e a vida é calculada, mas habilidades e magias ficam por sua conta.'}
        </AppText>

        <PickerField label="Classe que sobe de nível" options={classOptions} value={target} onChange={chooseTarget} />
        <AppText variant="small">Multiclasse (SRD 5.2.1): 13 ou mais no atributo principal da classe nova e das que você já tem.</AppText>

        {plan.multiclass ? (
          <Section title="Nova classe">
            <AppText variant="small">
              {plan.className} entra no 1º nível, com dado de vida {plan.classDef?.hitDie}. Os testes de resistência continuam os da primeira classe.
              {[plan.multiclass.training.armor, plan.multiclass.training.weapons, plan.multiclass.training.tools].some(Boolean)
                ? ` Treinamento novo: ${[plan.multiclass.training.armor, plan.multiclass.training.weapons, plan.multiclass.training.tools].filter(Boolean).join('; ')}.`
                : ''}
            </AppText>
            {plan.multiclass.skillOptions.length > 0 ? (
              <PickerField
                label="Perícia da nova classe"
                options={plan.multiclass.skillOptions.map((skill) => ({ value: skill, label: skillDefinitions[skill].label }))}
                value={multiclassSkill}
                onChange={(value) => setMulticlassSkill(value as Skill)}
              />
            ) : null}
            {plan.multiclass.instrumentOptions.length > 0 ? (
              <PickerField
                label="Instrumento musical"
                options={plan.multiclass.instrumentOptions.map((instrument) => ({ value: instrument.id, label: instrument.name }))}
                value={multiclassInstrument}
                onChange={setMulticlassInstrument}
              />
            ) : null}
          </Section>
        ) : null}

        {plan.subclass ? <Notice tone="info" title={`Subclasse: ${plan.subclass.name}`} message={plan.subclass.description} /> : null}

        <Section title="Habilidades novas">
          {plan.features.length === 0 ? (
            <AppText variant="muted">Nenhuma habilidade nova neste nível.</AppText>
          ) : (
            plan.features.map((feature) => (
              <Card key={feature.name}>
                <AppText style={{ fontFamily: fonts.sansSemiBold }}>{feature.name}</AppText>
                <AppText variant="small">{feature.description}</AppText>
              </Card>
            ))
          )}
        </Section>

        <Section title="Pontos de vida">
          <ChipRow>
            <Chip label={`Média: ${Math.floor(plan.hitDieSides / 2) + 1}`} selected={hpMethod === 'average'} role="radio" onPress={() => setHpMethod('average')} />
            <Chip label={`Rolar 1d${plan.hitDieSides}`} selected={hpMethod === 'roll'} role="radio" onPress={() => setHpMethod('roll')} />
          </ChipRow>
          {hpMethod === 'roll' ? (
            <Button
              label={rolled === null ? 'Rolar' : `Rolou ${rolled} · rolar de novo`}
              compact
              variant="secondary"
              icon={<Dices size={14} color={colors.fg} />}
              onPress={() => setRolled(rollDiceLocally(`1d${plan.hitDieSides}`)?.total ?? null)}
            />
          ) : null}
          <AppText variant="small">
            Máximo de PV +{result.hitPointsGained} (inclui o modificador de Constituição{plan.conModifier !== 0 ? ` de ${plan.conModifier > 0 ? '+' : ''}${plan.conModifier}` : ''}).
          </AppText>
        </Section>

        {plan.abilityScoreImprovement ? (
          <Section title={plan.epicBoon ? 'Dádiva épica ou talento' : 'Aumento no Valor de Atributo ou talento'}>
            <ChipRow>
              <Chip label="+2 em um atributo" selected={mode === 'plus_two'} role="radio" onPress={() => setMode('plus_two')} />
              <Chip label="+1 em dois" selected={mode === 'plus_one_each'} role="radio" onPress={() => setMode('plus_one_each')} />
              <Chip label="Talento" selected={mode === 'feat'} role="radio" onPress={() => setMode('feat')} />
            </ChipRow>
            {mode !== 'feat' ? <PickerField label="Atributo" options={abilityOptions(sheet.abilities)} value={first} onChange={(value) => setFirst(value as Ability)} /> : null}
            {mode === 'plus_one_each' ? (
              <PickerField label="Segundo atributo" options={abilityOptions(sheet.abilities)} value={second} onChange={(value) => setSecond(value as Ability)} />
            ) : null}
            {mode === 'feat' ? (
              featOptions.length === 0 ? (
                <AppText variant="muted">Nenhum talento disponível para este personagem.</AppText>
              ) : (
                <PickerField
                  label="Talento"
                  options={featOptions.map((feat) => ({ value: feat.id, label: feat.name, description: `${featCategoryLabels[feat.category]}. ${feat.description}` }))}
                  value={featId}
                  onChange={(value) => {
                    setFeatId(value);
                    setFeatAbility('');
                    setFeatSkills(['', '', '']);
                    setInitiate({ list: '', cantrips: [], spell: '', ability: '' });
                  }}
                />
              )
            ) : null}
            {mode === 'feat' && featIncrease ? (
              <PickerField
                label="Atributo +1"
                options={featIncrease.abilities.map((ability) => ({ value: ability, label: `${abilityLabels[ability].name} (${sheet.abilities[ability]})` }))}
                value={featAbility}
                onChange={(value) => setFeatAbility(value as Ability)}
              />
            ) : null}
            {mode === 'feat' && featId === 'skilled'
              ? featSkills.map((value, position) => (
                  <PickerField
                    key={position}
                    label={`Perícia ${position + 1}`}
                    options={skilledFeatOptions(sheet)
                      .filter((skill) => skill === value || !featSkills.includes(skill))
                      .map((skill) => ({ value: skill, label: skillDefinitions[skill].label }))}
                    value={value}
                    onChange={(next) => setFeatSkills((current) => current.map((entry, index) => (index === position ? (next as Skill) : entry)))}
                  />
                ))
              : null}
            {mode === 'feat' && featId === 'magic_initiate' ? (
              <>
                <PickerField
                  label="Lista de magias"
                  options={MAGIC_INITIATE_LISTS.map((list) => ({ value: list, label: magicInitiateListLabels[list] }))}
                  value={initiate.list}
                  onChange={(value) => setInitiate((current) => ({ ...current, list: value as MagicInitiateList, cantrips: [], spell: '' }))}
                />
                <PickerField
                  label="Atributo de conjuração"
                  options={(['int', 'wis', 'cha'] as const).map((ability) => ({ value: ability, label: abilityLabels[ability].name }))}
                  value={initiate.ability}
                  onChange={(value) => setInitiate((current) => ({ ...current, ability: value as MagicInitiateChoice['ability'] }))}
                />
                {initiate.list ? (
                  <>
                    <SpellChecklist
                      title="Truques do Iniciado em Magia"
                      count={2}
                      options={magicInitiateOptions(initiate.list, knownNames).cantrips}
                      value={[...initiate.cantrips]}
                      onChange={(chosen) => setInitiate((current) => ({ ...current, cantrips: chosen }))}
                    />
                    <SpellChecklist
                      title="Magia de 1º círculo do Iniciado em Magia"
                      count={1}
                      options={magicInitiateOptions(initiate.list, knownNames).spells}
                      value={initiate.spell ? [initiate.spell] : []}
                      onChange={(chosen) => setInitiate((current) => ({ ...current, spell: chosen[0] ?? '' }))}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </Section>
        ) : null}

        {plan.newCantrips > 0 ? <SpellChecklist title="Truques novos" count={plan.newCantrips} options={plan.cantripOptions} value={cantrips} onChange={setCantrips} /> : null}
        {plan.newSpells > 0 ? (
          <SpellChecklist
            title={plan.classDef?.spellcasting?.spellbook ? 'Magias para o grimório' : 'Magias preparadas a mais'}
            hint={`Até o ${plan.maxSpellCircle}º círculo.`}
            count={plan.newSpells}
            options={plan.spellOptions}
            value={spells}
            onChange={setSpells}
          />
        ) : null}
        {plan.newInvocations > 0 ? (
          <OptionChecklist
            title="Invocações Místicas"
            count={plan.newInvocations}
            options={plan.invocationOptions.map((option) => ({ id: option.id, name: option.name, description: option.description }))}
            value={invocations}
            onChange={setInvocations}
          />
        ) : null}
        {plan.newMetamagic > 0 ? (
          <OptionChecklist
            title="Metamagia"
            count={plan.newMetamagic}
            options={plan.metamagicOptions.map((option) => ({ id: option.id, name: option.name, description: option.description }))}
            value={metamagic}
            onChange={setMetamagic}
          />
        ) : null}
        {plan.newWeaponMasteries > 0 ? (
          <Notice tone="info" message={`Maestria em mais ${plan.newWeaponMasteries} arma${plan.newWeaponMasteries > 1 ? 's' : ''}: registre a arma no ataque correspondente.`} />
        ) : null}

        {plan.resources.length ? (
          <Section title="Recursos no novo nível">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {plan.resources.map((resource) => (
                <Badge key={resource.key} label={`${resource.label}: ${resource.max}`} tone="parchment" />
              ))}
            </View>
          </Section>
        ) : null}

        {result.issues.length ? <Notice tone="warning" title="Falta escolher" message={result.issues.map((issue) => `• ${issue}`).join('\n')} /> : null}
        <View style={styles.footer}>
          <Button label="Cancelar" variant="ghost" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <Button
            label={`Aplicar nível ${plan.newTotalLevel}`}
            icon={<Sparkles size={16} color={colors.primaryFg} />}
            loading={busy}
            disabled={result.issues.length > 0}
            onPress={() => void apply()}
            style={{ flex: 2 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="eyebrow">{title}</AppText>
      {children}
    </View>
  );
}

function toggle(list: string[], value: string, limit: number): string[] {
  if (list.includes(value)) return list.filter((entry) => entry !== value);
  return list.length >= limit ? list : [...list, value];
}

/** Até 40 resultados por vez: a busca encontra o resto sem rolar listas enormes no celular. */
const VISIBLE = 40;

function SpellChecklist({ title, hint, count, options, value, onChange }: { title: string; hint?: string; count: number; options: readonly SrdSpell[]; value: string[]; onChange: (next: string[]) => void }) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const filtered = term ? options.filter((spell) => `${spellNamePt(spell.name)} ${spell.name}`.toLowerCase().includes(term)) : options;
  const shown = [...options.filter((spell) => value.includes(spell.name)), ...filtered.filter((spell) => !value.includes(spell.name))].slice(0, VISIBLE);
  return (
    <Section title={`${title} (${value.length}/${count})`}>
      {hint ? <AppText variant="small">{hint}</AppText> : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar magia…"
        placeholderTextColor={colors.fgSubtle}
        accessibilityLabel={`Buscar em ${title}`}
        style={styles.search}
      />
      {shown.map((spell) => {
        const checked = value.includes(spell.name);
        return (
          <CheckRow
            key={spell.name}
            label={spellNamePt(spell.name)}
            description={`${spell.level === 0 ? 'Truque' : `${spell.level}º círculo`} · ${spell.castingTime}`}
            checked={checked}
            disabled={!checked && value.length >= count}
            onChange={() => onChange(toggle(value, spell.name, count))}
          />
        );
      })}
      {filtered.length > shown.length ? <AppText variant="small">Mostrando {shown.length} de {filtered.length}: busque pelo nome para ver as outras.</AppText> : null}
      {filtered.length === 0 ? <AppText variant="muted">Nenhuma magia encontrada.</AppText> : null}
    </Section>
  );
}

function OptionChecklist({ title, count, options, value, onChange }: { title: string; count: number; options: { id: string; name: string; description: string }[]; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <Section title={`${title} (${value.length}/${count})`}>
      {options.map((option) => {
        const checked = value.includes(option.id);
        return (
          <CheckRow
            key={option.id}
            label={option.name}
            description={option.description}
            checked={checked}
            disabled={!checked && value.length >= count}
            onChange={() => onChange(toggle(value, option.id, count))}
          />
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[10],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[4] },
  search: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    color: colors.fg,
    fontFamily: fonts.sans,
    backgroundColor: colors.sunken,
  },
  footer: { flexDirection: 'row', gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing[3] },
});
