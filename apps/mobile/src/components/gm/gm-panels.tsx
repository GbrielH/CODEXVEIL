import {
  addCombatants,
  addSceneEntity,
  adjustCharacterResource,
  adjustSceneEntityHp,
  applyCharacterCondition,
  createEncounter,
  removeCharacterCondition,
  removeSceneEntity,
  saveEncounterTurn,
  tickCharacterConditions,
  tickSceneEntityConditions,
  updateCombatant,
  updateEncounterSettings,
  updateSceneEntity,
  type Encounter,
  type PartyCharacter,
  type SceneEntity,
} from '@codexveil/database';
import {
  TURN_ECONOMY_KEYS,
  TURN_MODES,
  advanceTurn,
  moveInTurnOrder,
  orderTurns,
  rewindTurn,
  startCombat,
  turnEconomyLabels,
  turnModeLabels,
  turnOrderModeLabels,
  type TurnEconomy,
  type TurnMode,
  type TurnOrderMode,
} from '@codexveil/domain';
import { conditionLabel, conditionsLeftAfter, findSystem } from '@codexveil/rpg-systems';
import { dnd5eActions, dnd5eConditions, dnd5eTurnGuides } from '@codexveil/rpg-systems/dnd5e';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Minus, Play, Plus, Swords, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { HealthBar } from '@/components/ui/health-bar';
import { PickerField, PickerSheet } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';
import { getSupabase } from '@/lib/supabase';

export interface LibraryOption {
  id: string;
  name: string;
  kind: 'npc' | 'monster';
  hitPoints: number | null;
  armorClass: number | null;
  initiativeBonus: number;
}

export interface GmContext {
  campaignId: string;
  systemId: string;
  session: { id: string; number: number };
  canManage: boolean;
  party: PartyCharacter[];
  entities: SceneEntity[];
  encounter: Encounter | null;
  turnSettings: { defaultMode: TurnMode; defaultOrder: TurnOrderMode };
  /** Executa e recarrega; mostra a falha (nada fica como salvo sem confirmação do banco). */
  run: (title: string, action: () => Promise<unknown>) => Promise<void>;
  notify: (title: string) => void;
}

const EMPTY_ECONOMY: TurnEconomy = { action: false, bonusAction: false, reaction: false, movement: false };

/** Campo pequeno de quantidade (dano, cura). */
function AmountInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, 5))}
      keyboardType="number-pad"
      accessibilityLabel={label}
      placeholder="0"
      placeholderTextColor={colors.fgSubtle}
      selectionColor={palette.wine[400]}
      style={styles.amount}
    />
  );
}

// --------------------------------------------------------------------------- Turnos

interface RosterEntry {
  id: string;
  name: string;
  initiative: number | null;
  tiebreaker: number;
  isDefeated: boolean;
  sortOrder: number;
  isHidden: boolean;
  turnState: TurnEconomy;
  characterId: string | null;
  entityId: string | null;
  conditions: { key: string; rounds: number | null }[];
}

/** Ordem dos turnos e passagem de turno (mesmas regras do site). */
export function TurnPanel({ context }: { context: GmContext }) {
  const { encounter, party, entities, canManage, run, notify, campaignId, session, systemId, turnSettings } = context;
  const [mode, setMode] = useState<TurnMode>(turnSettings.defaultMode);
  const system = findSystem(systemId);
  const tiebreakerOf = (characterId: string) => {
    const character = party.find((entry) => entry.id === characterId);
    if (!character || !system) return 0;
    try {
      return system.initiativeBonus(system.parseSheet(character.sheet));
    } catch {
      return 0;
    }
  };

  const roster: RosterEntry[] = (encounter?.combatants ?? []).flatMap((combatant): RosterEntry[] => {
    const entity = combatant.sessionEntityId ? entities.find((entry) => entry.id === combatant.sessionEntityId) : undefined;
    const character = combatant.characterId ? party.find((entry) => entry.id === combatant.characterId) : undefined;
    if (!entity && !character) return [];
    return [
      {
        id: combatant.id,
        name: entity?.name ?? character?.name ?? '—',
        initiative: combatant.initiative,
        tiebreaker: combatant.tiebreaker,
        isDefeated: combatant.isDefeated,
        sortOrder: combatant.sortOrder,
        isHidden: combatant.isHidden,
        turnState: combatant.turnState,
        characterId: combatant.characterId,
        entityId: combatant.sessionEntityId,
        conditions: entity
          ? entity.conditions.map((key) => ({ key, rounds: entity.conditionRounds[key] ?? null }))
          : (character?.conditions ?? []).map((condition) => ({ key: condition.key, rounds: condition.roundsRemaining })),
      },
    ];
  });
  const orderMode: TurnOrderMode = encounter?.orderMode ?? 'initiative';
  const ordered = orderTurns(roster, orderMode);

  const begin = () =>
    run('Os turnos não foram preparados', async () => {
      const client = getSupabase();
      const encounterId = await createEncounter(client, { sessionId: session.id, campaignId, name: `${turnModeLabels[mode]} — sessão ${session.number}`, mode, orderMode: turnSettings.defaultOrder });
      const combatants = [
        ...party.map((character) => ({ characterId: character.id, initiative: null, tiebreaker: tiebreakerOf(character.id) })),
        ...(mode === 'combat' ? entities.map((entity) => ({ sessionEntityId: entity.id, initiative: null, tiebreaker: entity.initiativeBonus })) : []),
      ];
      await addCombatants(client, encounterId, campaignId, combatants.map((combatant, index) => ({ ...combatant, sortOrder: (index + 1) * 10 })));
    });

  if (!encounter) {
    return (
      <Card ornate>
        <View style={styles.titleRow}>
          <Swords size={18} color={colors.fgAccent} />
          <AppText variant="heading">Turnos</AppText>
        </View>
        <AppText variant="muted">Nenhum turno em andamento nesta sessão.</AppText>
        {canManage ? (
          <>
            <ChipRow>
              {TURN_MODES.map((option) => (
                <Chip key={option} label={turnModeLabels[option]} selected={mode === option} onPress={() => setMode(option)} />
              ))}
            </ChipRow>
            <Button label="Preparar turnos" icon={<Swords size={16} color={colors.primaryFg} />} disabled={party.length === 0 && entities.length === 0} onPress={() => void begin()} />
          </>
        ) : null}
      </Card>
    );
  }

  const active = encounter.status === 'active';
  const activeIndex = ordered.findIndex((entry) => entry.id === encounter.activeCombatantId);
  const activeEntry = active ? ordered[activeIndex] : undefined;
  const guide = systemId === 'dnd5e' ? dnd5eTurnGuides[encounter.mode] : null;

  const resetEconomy = async (combatantId: string | null) => {
    const next = roster.find((entry) => entry.id === combatantId);
    if (next && Object.values(next.turnState).some(Boolean)) await updateCombatant(getSupabase(), next.id, { turnState: EMPTY_ECONOMY });
  };

  const tick = async (entry: RosterEntry) => {
    if (!entry.conditions.some((condition) => condition.rounds !== null)) return;
    const client = getSupabase();
    const remainingOf = (ended: string[]) => entry.conditions.map((condition) => condition.key).filter((key) => !ended.includes(key));
    if (entry.characterId) {
      const ended = await tickCharacterConditions(client, entry.characterId);
      for (const next of conditionsLeftAfter(systemId, ended, remainingOf(ended))) await applyCharacterCondition(client, entry.characterId, next);
      if (ended.length > 0) notify(`${entry.name}: terminou ${ended.map((key) => conditionLabel(systemId, key)).join(', ')}.`);
    } else if (entry.entityId) {
      const ended = await tickSceneEntityConditions(client, entry.entityId);
      const left = conditionsLeftAfter(systemId, ended, remainingOf(ended));
      if (left.length > 0) await updateSceneEntity(client, entry.entityId, { conditions: [...remainingOf(ended), ...left] });
      if (ended.length > 0) notify(`${entry.name}: terminou ${ended.map((key) => conditionLabel(systemId, key)).join(', ')}.`);
    }
  };

  const next = () =>
    run('O turno não passou', async () => {
      const ending = ordered.find((entry) => entry.id === encounter.activeCombatantId);
      const state = advanceTurn(ordered, { round: encounter.round, activeCombatantId: encounter.activeCombatantId });
      await saveEncounterTurn(getSupabase(), encounter.id, encounter.version, { status: 'active', ...state });
      await resetEconomy(state.activeCombatantId);
      if (ending) await tick(ending);
    });

  const changeOrder = (target: TurnOrderMode) =>
    run('A ordem não mudou', async () => {
      const client = getSupabase();
      if (target === 'manual') {
        for (const [index, entry] of orderTurns(roster, 'initiative').entries()) {
          if (entry.sortOrder !== (index + 1) * 10) await updateCombatant(client, entry.id, { sortOrder: (index + 1) * 10 });
        }
      }
      await updateEncounterSettings(client, encounter.id, { orderMode: target });
    });

  const move = (entry: RosterEntry, direction: -1 | 1) =>
    run('A ordem não mudou', async () => {
      for (const change of moveInTurnOrder(ordered, entry.id, direction)) {
        const current = ordered.find((item) => item.id === change.id);
        if (current && current.sortOrder !== change.sortOrder) await updateCombatant(getSupabase(), change.id, { sortOrder: change.sortOrder });
      }
    });

  const missingCharacters = party.filter((character) => !encounter.combatants.some((combatant) => combatant.characterId === character.id));
  const missingEntities = entities.filter((entity) => !encounter.combatants.some((combatant) => combatant.sessionEntityId === entity.id));
  const nextSort = Math.max(0, ...roster.map((entry) => entry.sortOrder)) + 10;

  return (
    <Card ornate>
      <View style={styles.titleRow}>
        <Swords size={18} color={colors.fgAccent} />
        <AppText variant="heading" style={{ flex: 1 }}>
          {encounter.name}
        </AppText>
        <Badge label={active ? `Rodada ${encounter.round}` : 'Preparando'} tone={active ? 'brand' : 'parchment'} />
      </View>
      {canManage ? (
        <>
          <ChipRow>
            {TURN_MODES.map((option) => (
              <Chip
                key={option}
                label={turnModeLabels[option]}
                selected={encounter.mode === option}
                onPress={() => void run('O modo não mudou', () => updateEncounterSettings(getSupabase(), encounter.id, { mode: option }))}
              />
            ))}
          </ChipRow>
          <ChipRow>
            {(['initiative', 'manual'] as const).map((option) => (
              <Chip key={option} label={turnOrderModeLabels[option]} selected={orderMode === option} onPress={() => void changeOrder(option)} />
            ))}
          </ChipRow>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {active ? (
              <>
                <Button
                  label="Anterior"
                  compact
                  variant="secondary"
                  icon={<ChevronLeft size={16} color={colors.fg} />}
                  onPress={() => void run('O turno não mudou', () => saveEncounterTurn(getSupabase(), encounter.id, encounter.version, { status: 'active', ...rewindTurn(ordered, { round: encounter.round, activeCombatantId: encounter.activeCombatantId }) }))}
                  style={{ flex: 1 }}
                />
                <Button label="Passar o turno" compact icon={<ChevronRight size={16} color={colors.primaryFg} />} onPress={() => void next()} style={{ flex: 2 }} />
              </>
            ) : (
              <Button
                label={encounter.mode === 'combat' ? 'Começar combate' : 'Começar turnos'}
                icon={<Play size={16} color={colors.primaryFg} />}
                disabled={ordered.length === 0}
                onPress={() =>
                  void run('Os turnos não começaram', async () => {
                    const start = startCombat(ordered);
                    await saveEncounterTurn(getSupabase(), encounter.id, encounter.version, { status: 'active', ...start });
                    await resetEconomy(start.activeCombatantId);
                  })
                }
                style={{ flex: 1 }}
              />
            )}
            <IconButton
              icon={<Flag size={18} color={colors.fgSecondary} />}
              accessibilityLabel="Encerrar os turnos"
              onPress={() => void run('Os turnos não foram encerrados', () => saveEncounterTurn(getSupabase(), encounter.id, encounter.version, { status: 'ended', round: encounter.round, activeCombatantId: null }))}
            />
          </View>
        </>
      ) : null}

      {activeEntry && canManage ? (
        <View style={styles.economy}>
          <AppText style={{ fontFamily: fonts.sansMedium, color: colors.fgAccent }}>Vez de {activeEntry.name}</AppText>
          {TURN_ECONOMY_KEYS.map((key) => (
            <CheckRow
              key={key}
              label={`${turnEconomyLabels[key]} usada`}
              checked={activeEntry.turnState[key]}
              onChange={(checked) => void run('O turno não foi atualizado', () => updateCombatant(getSupabase(), activeEntry.id, { turnState: { ...activeEntry.turnState, [key]: checked } }))}
            />
          ))}
        </View>
      ) : null}

      {ordered.map((entry, index) => {
        const isTurn = active && index === activeIndex;
        return (
          <View key={entry.id} style={[styles.combatant, isTurn && styles.current, entry.isDefeated && { opacity: 0.55 }]}>
            {orderMode === 'manual' ? (
              canManage ? (
                <View>
                  <IconButton icon={<ArrowUp size={16} color={colors.fgSecondary} />} accessibilityLabel={`Subir ${entry.name}`} disabled={index === 0} onPress={() => void move(entry, -1)} />
                  <IconButton icon={<ArrowDown size={16} color={colors.fgSecondary} />} accessibilityLabel={`Descer ${entry.name}`} disabled={index === ordered.length - 1} onPress={() => void move(entry, 1)} />
                </View>
              ) : (
                <AppText variant="number">{index + 1}º</AppText>
              )
            ) : (
              <InitiativeInput
                value={entry.initiative}
                label={`Iniciativa de ${entry.name}`}
                editable={canManage}
                onCommit={(value) => void run('Iniciativa não salva', () => updateCombatant(getSupabase(), entry.id, { initiative: value }))}
              />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <AppText style={{ fontFamily: fonts.sansMedium, color: isTurn ? colors.fgAccent : colors.fg, textDecorationLine: entry.isDefeated ? 'line-through' : 'none' }}>
                {entry.name}
                {entry.isHidden ? ' (oculto)' : ''}
              </AppText>
              {entry.conditions.length > 0 ? (
                <AppText variant="small" style={{ color: colors.warning }}>
                  {entry.conditions.map((condition) => `${conditionLabel(systemId, condition.key)}${condition.rounds !== null ? ` (${condition.rounds})` : ''}`).join(' · ')}
                </AppText>
              ) : null}
            </View>
            {canManage ? (
              <>
                <IconButton
                  icon={entry.isHidden ? <EyeOff size={16} color={colors.warning} /> : <Eye size={16} color={colors.fgSecondary} />}
                  accessibilityLabel={entry.isHidden ? `Mostrar ${entry.name} aos jogadores` : `Ocultar ${entry.name} dos jogadores`}
                  onPress={() => void run('Alteração não salva', () => updateCombatant(getSupabase(), entry.id, { isHidden: !entry.isHidden }))}
                />
                <IconButton
                  icon={<X size={16} color={entry.isDefeated ? colors.danger : colors.fgSecondary} />}
                  accessibilityLabel={entry.isDefeated ? `Trazer ${entry.name} de volta` : `Marcar ${entry.name} como fora`}
                  onPress={() => void run('Alteração não salva', () => updateCombatant(getSupabase(), entry.id, { isDefeated: !entry.isDefeated }))}
                />
              </>
            ) : null}
          </View>
        );
      })}

      {canManage && (missingCharacters.length > 0 || missingEntities.length > 0) ? (
        <View style={{ gap: 6 }}>
          <AppText variant="small">Fora da ordem:</AppText>
          <ChipRow>
            {missingCharacters.map((character) => (
              <Chip
                key={character.id}
                role="button"
                label={`+ ${character.name}`}
                selected={false}
                onPress={() =>
                  void run('Não foi possível adicionar', () =>
                    addCombatants(getSupabase(), encounter.id, campaignId, [{ characterId: character.id, initiative: null, tiebreaker: tiebreakerOf(character.id), sortOrder: nextSort }]),
                  )
                }
              />
            ))}
            {missingEntities.map((entity) => (
              <Chip
                key={entity.id}
                role="button"
                label={`+ ${entity.name}`}
                selected={false}
                onPress={() =>
                  void run('Não foi possível adicionar', () =>
                    addCombatants(getSupabase(), encounter.id, campaignId, [{ sessionEntityId: entity.id, initiative: null, tiebreaker: entity.initiativeBonus, sortOrder: nextSort }]),
                  )
                }
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      {guide ? (
        <View style={styles.guide}>
          <AppText style={{ fontFamily: fonts.sansMedium }}>Regras do turno · {turnModeLabels[encounter.mode]}</AppText>
          <AppText variant="small">{guide.intro}</AppText>
          {guide.actions.slice(0, 8).map((key) => (
            <AppText key={key} variant="small">
              <AppText variant="small" style={{ fontFamily: fonts.sansMedium, color: colors.fg }}>
                {dnd5eActions[key].label}:{' '}
              </AppText>
              {dnd5eActions[key].summary}
            </AppText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function InitiativeInput({ value, label, editable, onCommit }: { value: number | null; label: string; editable: boolean; onCommit: (value: number | null) => void }) {
  return (
    <TextInput
      key={value ?? 'vazio'}
      defaultValue={value === null ? '' : String(value)}
      editable={editable}
      keyboardType="numbers-and-punctuation"
      accessibilityLabel={label}
      placeholder="—"
      placeholderTextColor={colors.fgSubtle}
      selectionColor={palette.wine[400]}
      onEndEditing={(event) => {
        const text = event.nativeEvent.text.trim();
        if (text === '') onCommit(null);
        else if (/^-?\d{1,3}$/.test(text)) onCommit(Math.max(-50, Math.min(100, Number(text))));
      }}
      style={[styles.amount, { width: 52 }]}
    />
  );
}

// --------------------------------------------------------------------------- Grupo

/** Vida e condições dos personagens, ajustadas pelo mestre durante o jogo. */
export function PartyPanel({ context }: { context: GmContext }) {
  const { party, canManage, run, systemId } = context;
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [pickingFor, setPickingFor] = useState<PartyCharacter | null>(null);

  return (
    <Card>
      <AppText variant="heading">Grupo</AppText>
      {party.length === 0 ? <AppText variant="muted">Nenhum personagem na campanha.</AppText> : null}
      {party.map((character) => {
        const hp = character.resources.find((resource) => resource.display === 'health');
        const amount = Number(amounts[character.id] ?? '');
        return (
          <View key={character.id} style={styles.member}>
            <AppText style={{ fontFamily: fonts.sansMedium, color: colors.fgAccent }}>
              {character.name} <AppText variant="small">· {character.ownerName}</AppText>
            </AppText>
            {hp ? <HealthBar current={hp.current} max={hp.max} temp={hp.temp} /> : null}
            {hp && canManage ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <AmountInput label={`Quantidade para ${character.name}`} value={amounts[character.id] ?? ''} onChange={(text) => setAmounts((current) => ({ ...current, [character.id]: text }))} />
                <Button
                  label="Dano"
                  compact
                  variant="danger"
                  icon={<Minus size={14} color="#EC9384" />}
                  disabled={!amount}
                  onPress={() => void run('A vida não mudou', () => adjustCharacterResource(getSupabase(), hp.id, 'damage', amount))}
                />
                <Button
                  label="Cura"
                  compact
                  variant="secondary"
                  icon={<Plus size={14} color={colors.fg} />}
                  disabled={!amount}
                  onPress={() => void run('A vida não mudou', () => adjustCharacterResource(getSupabase(), hp.id, 'heal', amount))}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {character.conditions.map((condition) => (
                <Chip
                  key={condition.id}
                  role="button"
                  label={`${conditionLabel(systemId, condition.key, condition.level)}${condition.roundsRemaining !== null ? ` (${condition.roundsRemaining})` : ''}${canManage ? ' ×' : ''}`}
                  selected
                  disabled={!canManage}
                  onPress={() => void run('A condição não foi removida', () => removeCharacterCondition(getSupabase(), condition.id))}
                />
              ))}
              {canManage && systemId === 'dnd5e' ? <Chip role="button" label="+ Condição" selected={false} onPress={() => setPickingFor(character)} /> : null}
            </View>
          </View>
        );
      })}
      <PickerSheet
        visible={pickingFor !== null}
        title={pickingFor ? `Condição em ${pickingFor.name}` : 'Condição'}
        options={dnd5eConditions.map((condition) => ({ value: condition.key, label: condition.label, description: condition.summary }))}
        onClose={() => setPickingFor(null)}
        onSelect={(key) => {
          const target = pickingFor;
          setPickingFor(null);
          if (target) void run('A condição não foi aplicada', () => applyCharacterCondition(getSupabase(), target.id, key, key === 'exhaustion' ? 1 : null));
        }}
      />
    </Card>
  );
}

// --------------------------------------------------------------------------- Cena

/** NPCs e monstros na cena: entram da biblioteca, levam dano e saem. */
export function ScenePanel({ context, library }: { context: GmContext; library: LibraryOption[] }) {
  const { entities, canManage, run, campaignId, session } = context;
  const confirm = useConfirm();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState('');

  const add = () => {
    const option = library.find((entry) => entry.id === choice);
    if (!option) return;
    const sameName = entities.filter((entity) => entity.creatureId === option.id).length;
    void run('A criatura não entrou na cena', () =>
      addSceneEntity(getSupabase(), {
        sessionId: session.id,
        campaignId,
        creatureId: option.id,
        kind: option.kind,
        name: sameName > 0 ? `${option.name} ${sameName + 1}`.slice(0, 80) : option.name,
        hpMax: option.hitPoints,
        armorClass: option.armorClass,
        initiativeBonus: option.initiativeBonus,
        sortOrder: entities.length,
      }),
    );
  };

  return (
    <Card>
      <AppText variant="heading">Cena</AppText>
      {canManage ? (
        library.length === 0 ? (
          <AppText variant="muted">Cadastre NPCs e monstros na biblioteca para colocá-los na cena.</AppText>
        ) : (
          <View style={{ gap: spacing[2] }}>
            <PickerField label="Adicionar da biblioteca" value={choice} options={library.map((entry) => ({ value: entry.id, label: entry.name, description: entry.kind === 'npc' ? 'NPC' : 'Monstro' }))} onChange={setChoice} />
            <Button label="Pôr na cena" compact variant="secondary" disabled={!choice} icon={<Plus size={14} color={colors.fg} />} onPress={add} />
          </View>
        )
      ) : null}
      {entities.length === 0 ? <AppText variant="muted">Ninguém na cena ainda.</AppText> : null}
      {entities.map((entity) => {
        const amount = Number(amounts[entity.id] ?? '');
        return (
          <View key={entity.id} style={styles.member}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <AppText style={{ flex: 1, fontFamily: fonts.sansMedium, color: colors.fgAccent }}>
                {entity.name}
                {entity.armorClass !== null ? <AppText variant="small"> · CA {entity.armorClass}</AppText> : null}
              </AppText>
              {canManage ? (
                <IconButton
                  icon={<Trash2 size={16} color={colors.fgSecondary} />}
                  accessibilityLabel={`Tirar ${entity.name} da cena`}
                  onPress={async () => {
                    const ok = await confirm({ title: `Tirar ${entity.name} da cena?`, message: 'A instância some da cena e dos turnos. O registro da biblioteca continua.', confirmLabel: 'Tirar', tone: 'danger' });
                    if (ok) await run('A criatura não saiu da cena', () => removeSceneEntity(getSupabase(), entity.id));
                  }}
                />
              ) : null}
            </View>
            {entity.hpMax !== null || entity.hpCurrent !== null ? <HealthBar current={entity.hpCurrent ?? 0} max={entity.hpMax} temp={entity.hpTemp} /> : null}
            {entity.conditions.length > 0 ? (
              <AppText variant="small" style={{ color: colors.warning }}>
                {entity.conditions.map((key) => conditionLabel(context.systemId, key)).join(' · ')}
              </AppText>
            ) : null}
            {canManage ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <AmountInput label={`Quantidade para ${entity.name}`} value={amounts[entity.id] ?? ''} onChange={(text) => setAmounts((current) => ({ ...current, [entity.id]: text }))} />
                <Button label="Dano" compact variant="danger" disabled={!amount} onPress={() => void run('A vida não mudou', () => adjustSceneEntityHp(getSupabase(), entity.id, 'damage', amount))} />
                <Button label="Cura" compact variant="secondary" disabled={!amount} onPress={() => void run('A vida não mudou', () => adjustSceneEntityHp(getSupabase(), entity.id, 'heal', amount))} />
              </View>
            ) : null}
          </View>
        );
      })}
      {canManage ? <AppText variant="small">Remover alguém da cena também o tira da ordem dos turnos.</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  combatant: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[2], borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised },
  current: { borderColor: colors.parchmentEdge, backgroundColor: 'rgba(80, 22, 36, 0.6)' },
  economy: { gap: 2, padding: spacing[2], borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(206, 191, 157, 0.4)' },
  guide: { gap: 4, padding: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.sunken },
  member: { gap: spacing[2], padding: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.line },
  amount: {
    width: 72,
    height: 40,
    paddingHorizontal: spacing[2],
    color: colors.fg,
    fontFamily: fonts.sans,
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
  },
});
