import {
  adjustCharacterResource,
  applyCharacterCondition,
  endTurn,
  getCampaignTurn,
  getSessionState,
  listTurnActions,
  performTurnAction,
  getCampaignCustomActions,
  type CustomAction,
  tickCharacterConditions,
  type CampaignTurn,
  type CharacterAbility,
  type TurnAction,
} from '@codexveil/database';
import {
  d20Expression,
  withBonus,
  turnActionKindLabels,
  turnBudget,
  turnModeLabels,
  type TurnActionKind,
} from '@codexveil/domain';
import {
  DND5E_ACTIONS,
  attackDamageModifier,
  attackRollBonus,
  dnd5eActions,
  dnd5eAttackDataSchema,
  dnd5eConditionsLeftAfter,
  dnd5eSpellDataSchema,
  featureTurnCost,
  findDnd5eCondition,
  spellNamePt,
  spellTurnCost,
  isAttackAvailable,
} from '@codexveil/rpg-systems/dnd5e';
import { Footprints, Swords } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { PickerField } from '@/components/ui/picker';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useRealtimeRefresh } from '@/lib/hooks';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';
import { useSheet } from './context';

interface Option {
  key: string;
  label: string;
  kind: TurnActionKind;
  grantsAction: boolean;
  roll: string | null;
  ability: CharacterAbility | null;
  /** Dano da arma, rolado só depois que o mestre diz que o ataque acertou. */
  damage?: string | null;
}

/**
 * Turno na campanha: de quem é a vez e, na vez do personagem, as ações com o orçamento do D&D,
 * alvo, rolagem que vai para o mural e o botão de encerrar o turno. Se alguém mirar o
 * personagem, aparece a opção de reagir.
 */
export function TurnPlay({ campaignId }: { campaignId: string }) {
  const {
    characterId,
    sheet,
    abilities,
    items,
    derived,
    resources,
    conditions,
    canEditPlay,
    setResources,
    reloadPlayState,
  } = useSheet();
  const toast = useToast();
  const [turn, setTurn] = useState<CampaignTurn | null>(null);
  const [actions, setActions] = useState<TurnAction[]>([]);
  const [choice, setChoice] = useState('');
  const [pendingHit, setPendingHit] = useState<{
    label: string;
    total: number | null;
    damage: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true);
  const [physicalDice, setPhysicalDice] = useState(false);
  const [manual, setManual] = useState('');
  const [customActions, setCustomActions] = useState<CustomAction[]>([]);
  useEffect(() => {
    let active = true;
    getCampaignCustomActions(getSupabase(), campaignId)
      .then((list) => {
        if (active) setCustomActions(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  const reload = useCallback(async () => {
    try {
      const client = getSupabase();
      const [nextTurn, nextActions, inProgress] = await Promise.all([
        getCampaignTurn(client, campaignId),
        listTurnActions(client, campaignId, 60),
        getSessionState(client, campaignId),
      ]);
      setTurn(nextTurn);
      setActions(nextActions);
      setPlaying(inProgress.playing);
      setPhysicalDice(inProgress.physicalDice);
    } catch {
      // Sem conexão: mantém o último estado conhecido.
    }
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    const client = getSupabase();
    Promise.all([
      getCampaignTurn(client, campaignId),
      listTurnActions(client, campaignId, 60),
      getSessionState(client, campaignId),
    ])
      .then(([nextTurn, nextActions, inProgress]) => {
        if (!active) return;
        setTurn(nextTurn);
        setActions(nextActions);
        setPlaying(inProgress.playing);
        setPhysicalDice(inProgress.physicalDice);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  useRealtimeRefresh(
    `turno-app:${campaignId}`,
    [
      { table: 'campaign_turns', filter: `campaign_id=eq.${campaignId}` },
      { table: 'turn_actions', filter: `campaign_id=eq.${campaignId}` },
    ],
    () => void reload(),
  );

  const options = useMemo<Option[]>(() => {
    const list: Option[] = [];
    for (const ability of abilities) {
      if (ability.kind === 'attack') {
        if (!isAttackAvailable(ability.name, items)) continue;
        const parsed = dnd5eAttackDataSchema.safeParse(ability.data ?? {});
        if (parsed.success)
          list.push({
            key: ability.id,
            label: `Atacar: ${ability.name}`,
            kind: 'action',
            grantsAction: false,
            roll: d20Expression(attackRollBonus(parsed.data, derived)),
            ability,
            damage: parsed.data.damage
              ? withBonus(
                  parsed.data.damage,
                  attackDamageModifier(parsed.data.ability, sheet.abilities),
                )
              : null,
          });
      } else if (ability.kind === 'spell') {
        const parsed = dnd5eSpellDataSchema.safeParse(ability.data ?? {});
        const cost = spellTurnCost(parsed.success ? parsed.data.castingTime : '');
        list.push({
          key: ability.id,
          label: `Magia: ${spellNamePt(ability.name)}`,
          kind: cost.kind,
          grantsAction: false,
          roll: derived.spellcasting ? d20Expression(derived.spellcasting.attackBonus) : null,
          ability,
        });
      } else {
        const cost = featureTurnCost(ability.name);
        if (cost)
          list.push({
            key: ability.id,
            label: ability.name,
            kind: cost.kind,
            grantsAction: cost.grantsAction,
            roll: null,
            ability,
          });
      }
    }
    // Ações criadas pelo mestre para esta campanha.
    for (const custom of customActions) {
      list.push({
        key: `custom:${custom.id}`,
        label: custom.name,
        kind: custom.kind,
        grantsAction: false,
        roll: custom.roll || null,
        ability: null,
      });
    }
    for (const key of DND5E_ACTIONS) {
      if (key === 'attack' || key === 'magic') continue;
      list.push({
        key: `acao:${key}`,
        label: dnd5eActions[key].label,
        kind: 'action',
        grantsAction: false,
        roll: null,
        ability: null,
      });
    }
    return list;
  }, [abilities, items, derived, sheet.abilities, customActions]);

  if (!turn) return null;
  const me = turn.order.find((entry) => entry.characterId === characterId) ?? null;
  const mine = me !== null && turn.activeCharacterId === characterId && turn.status === 'active';
  const roundActions = me
    ? actions.filter(
        (action) =>
          action.combatantId === me.id &&
          action.round === turn.round &&
          action.encounterId === turn.encounterId,
      )
    : [];
  const budget = turnBudget(roundActions);
  const incoming = actions.filter(
    (action) =>
      action.targetCharacterId === characterId &&
      action.encounterId === turn.encounterId &&
      action.round >= turn.round - 1 &&
      !dismissed.includes(action.id),
  );
  const available = options.filter(
    (option) => option.kind !== 'reaction' && (option.kind === 'free' || budget[option.kind] > 0),
  );
  const selected = options.find((option) => option.key === choice) ?? null;

  const act = async (option: Option, kind: TurnActionKind = option.kind) => {
    if (!me) return;
    setBusy(true);
    try {
      const done = await performTurnAction(getSupabase(), {
        combatantId: me.id,
        kind,
        label: option.label,
        targetCombatantId: null,
        grantsAction: option.grantsAction,
        // Dados presenciais: o app não rola; o jogador pode anotar o resultado do dado físico.
        rollExpression: physicalDice ? null : option.roll,
        manualTotal:
          physicalDice && manual.trim() !== '' && Number.isInteger(Number(manual))
            ? Number(manual)
            : null,
      });
      const resource = option.ability?.resourceId
        ? resources.find((entry) => entry.id === option.ability?.resourceId)
        : undefined;
      if (resource && resource.current > 0) {
        const updated = await adjustCharacterResource(getSupabase(), resource.id, 'spend', 1);
        setResources((current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
      }
      toast({
        tone: 'success',
        title: `${turnActionKindLabels[kind]}: ${done.label}${done.targetName ? ` → ${done.targetName}` : ''}`,
        description: done.rollTotal !== null ? `Resultado: ${done.rollTotal}` : undefined,
      });
      if (option.damage && kind !== 'reaction')
        setPendingHit({
          label: option.label.replace(/^Atacar: /, ''),
          total: done.rollTotal,
          damage: option.damage,
        });
      setChoice('');
      setManual('');
      await reload();
    } catch (cause) {
      toast({
        tone: 'danger',
        title: 'A ação não foi registrada',
        description: failureMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const client = getSupabase();
      await endTurn(client, turn.encounterId);
      if (conditions.some((condition) => condition.roundsRemaining !== null)) {
        const ended = await tickCharacterConditions(client, characterId);
        const remaining = conditions
          .map((condition) => condition.key)
          .filter((key) => !ended.includes(key));
        for (const next of dnd5eConditionsLeftAfter(ended, remaining))
          await applyCharacterCondition(client, characterId, next);
        if (ended.length > 0)
          toast({
            tone: 'info',
            title: `Terminou: ${ended.map((key) => findDnd5eCondition(key)?.label ?? key).join(', ')}.`,
          });
        await reloadPlayState();
      }
      toast({ tone: 'success', title: 'Turno encerrado.' });
      await reload();
    } catch (cause) {
      toast({
        tone: 'danger',
        title: 'O turno não foi encerrado',
        description: failureMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const reactions = options.filter((option) => option.kind === 'reaction');

  return (
    <Card ornate style={mine ? { borderColor: colors.parchmentEdge } : undefined}>
      <AppText variant="heading">
        {turnModeLabels[turn.mode]}
        {turn.status === 'active' ? ` · rodada ${turn.round}` : ''}
      </AppText>
      <AppText variant={mine ? 'title' : 'body'} accessibilityLiveRegion="polite">
        {turn.status !== 'active'
          ? 'O mestre está preparando a ordem.'
          : mine
            ? 'É a sua vez!'
            : turn.activeName
              ? `Vez de ${turn.activeName}`
              : 'Vez do mestre'}
      </AppText>

      {!playing ? (
        <View style={styles.alert} accessibilityRole="alert">
          <AppText>
            A sessão ainda não começou: as ações e rolagens da mesa ficam liberadas quando o mestre
            iniciar.
          </AppText>
          <ChipRow>
            <Chip
              role="button"
              label="Verificar de novo"
              selected={false}
              onPress={() => void reload()}
            />
          </ChipRow>
        </View>
      ) : null}

      {incoming.slice(0, 2).map((action) => (
        <View key={action.id} style={styles.alert} accessibilityRole="alert">
          <AppText>
            <AppText style={{ fontFamily: fonts.sansSemiBold }}>{action.actorName}</AppText> mirou
            você: {action.label}
            {action.rollTotal !== null ? ` (resultado ${action.rollTotal})` : ''}.
          </AppText>
          <ChipRow>
            {canEditPlay && playing && me && budget.reaction > 0 && turn.status === 'active'
              ? [
                  ...reactions,
                  {
                    key: 'reacao',
                    label: 'Usar reação',
                    kind: 'reaction' as const,
                    grantsAction: false,
                    roll: null,
                    ability: null,
                  },
                ].map((option) => (
                  <Chip
                    key={option.key}
                    role="button"
                    label={option.label}
                    selected={false}
                    disabled={busy}
                    onPress={() => void act(option, 'reaction')}
                  />
                ))
              : null}
            <Chip
              role="button"
              label="Ok"
              selected={false}
              onPress={() => setDismissed((current) => [...current, action.id])}
            />
          </ChipRow>
        </View>
      ))}

      {turn.order.length > 0 ? (
        <View style={styles.order}>
          {turn.order.map((entry, index) => (
            <View
              key={entry.id}
              style={[
                styles.pill,
                entry.current && styles.current,
                entry.defeated && { opacity: 0.55 },
              ]}
            >
              <AppText
                variant="small"
                style={{ color: entry.current ? colors.fgAccent : colors.fgSecondary }}
              >
                {index + 1}. {entry.name}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {mine && canEditPlay && playing ? (
        <View style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(['action', 'bonus_action', 'movement', 'reaction'] as const).map((kind) => (
              <Badge
                key={kind}
                label={`${turnActionKindLabels[kind]}: ${budget[kind] > 0 ? 'livre' : 'usada'}`}
                tone={budget[kind] > 0 ? 'success' : 'neutral'}
              />
            ))}
          </View>
          <PickerField
            label="O que fazer"
            value={choice}
            options={available.map((option) => ({
              value: option.key,
              label: option.label,
              description: turnActionKindLabels[option.kind],
            }))}
            onChange={setChoice}
          />
          {pendingHit ? (
            <View style={styles.alert} accessibilityRole="summary">
              <AppText>
                Ataque com{' '}
                <AppText style={{ fontFamily: fonts.sansSemiBold }}>{pendingHit.label}</AppText>
                {pendingHit.total !== null ? ` (resultado ${pendingHit.total})` : ''}. O mestre diz
                se acertou.
              </AppText>
              <ChipRow>
                <Chip
                  role="button"
                  label={`Acertou: rolar dano (${pendingHit.damage})`}
                  selected={false}
                  disabled={busy}
                  onPress={() => {
                    const hit = pendingHit;
                    setPendingHit(null);
                    void act({
                      key: 'dano',
                      label: `Dano: ${hit.label}`,
                      kind: 'free',
                      grantsAction: false,
                      roll: hit.damage,
                      ability: null,
                    });
                  }}
                />
                <Chip
                  role="button"
                  label="Errou: fechar"
                  selected={false}
                  onPress={() => setPendingHit(null)}
                />
              </ChipRow>
            </View>
          ) : null}
          {physicalDice ? (
            <Field
              label="Resultado do dado físico (opcional)"
              value={manual}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(text) => setManual(text.replace(/[^0-9-]/g, ''))}
              hint="Sessão com dados presenciais: role na mesa e anote o total, se quiser."
            />
          ) : null}
          <Button
            label={selected?.roll && !physicalDice ? 'Fazer e rolar' : 'Fazer'}
            icon={<Swords size={16} color={colors.primaryFg} />}
            loading={busy}
            disabled={!selected}
            onPress={() => selected && void act(selected)}
          />
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Button
              label="Ação de movimento"
              compact
              variant="secondary"
              icon={<Footprints size={14} color={colors.fg} />}
              disabled={busy || budget.movement === 0}
              onPress={() =>
                void act({
                  key: 'movimento',
                  label: 'Movimento',
                  kind: 'movement',
                  grantsAction: false,
                  roll: null,
                  ability: null,
                })
              }
              style={{ flex: 1 }}
            />
            <Button
              label="Encerrar turno"
              compact
              variant="ghost"
              loading={busy}
              onPress={() => void finish()}
              style={{ flex: 1 }}
            />
          </View>
          <AppText variant="small">
            Sem tempo limite: encerre quando terminar o roleplay. Tudo vai para o mural da mesa.
          </AppText>
        </View>
      ) : null}

      {roundActions.length > 0 ? (
        <View style={{ gap: 2 }}>
          {[...roundActions].reverse().map((action) => (
            <AppText key={action.id} variant="small">
              {turnActionKindLabels[action.kind]}: {action.label}
              {action.targetName ? ` → ${action.targetName}` : ''}
              {action.rollTotal !== null ? ` (${action.rollTotal})` : ''}
            </AppText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  alert: {
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 109, 90, 0.5)',
    backgroundColor: colors.dangerBg,
  },
  order: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  current: { borderColor: colors.parchmentEdge, backgroundColor: 'rgba(80, 22, 36, 0.6)' },
});
