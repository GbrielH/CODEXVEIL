import { encounterStatusLabels, getCampaignTurn, type CampaignTurn } from '@codexveil/database';
import { turnModeLabels } from '@codexveil/domain';
import { dnd5eActions, dnd5eTurnGuides } from '@codexveil/rpg-systems/dnd5e';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ColorDot, useDicePalette } from '@/components/dice/dice-color';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { useRealtimeRefresh } from '@/lib/hooks';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

/**
 * Turno atual da campanha (modo, rodada, de quem é a vez e a ordem), ao vivo. Na vez do
 * próprio personagem, lembra o que dá para fazer no turno. Some quando não há turnos.
 */
export function TurnStatus({
  campaignId,
  ownCharacterId = null,
  systemId,
}: {
  campaignId: string;
  ownCharacterId?: string | null;
  systemId: string;
}) {
  const [turn, setTurn] = useState<CampaignTurn | null>(null);
  const palette = useDicePalette(campaignId);

  const reload = useCallback(async () => {
    try {
      setTurn(await getCampaignTurn(getSupabase(), campaignId));
    } catch {
      // Sem conexão: mantém o último turno conhecido.
    }
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    getCampaignTurn(getSupabase(), campaignId)
      .then((loaded) => {
        if (active) setTurn(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  useRealtimeRefresh(
    `turno:${campaignId}`,
    [{ table: 'campaign_turns', filter: `campaign_id=eq.${campaignId}` }],
    () => void reload(),
  );

  if (!turn) return null;
  const mine = ownCharacterId !== null && turn.activeCharacterId === ownCharacterId;
  const active = turn.status === 'active';
  const guide = systemId === 'dnd5e' ? dnd5eTurnGuides[turn.mode] : null;

  return (
    <Card ornate style={mine ? { borderColor: colors.parchmentEdge } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <AppText variant="heading" style={{ flex: 1 }}>
          {turnModeLabels[turn.mode]}
        </AppText>
        <Badge label={encounterStatusLabels[turn.status]} tone={active ? 'brand' : 'parchment'} />
      </View>
      {active ? (
        <AppText variant={mine ? 'title' : 'body'} accessibilityLiveRegion="polite">
          {mine ? 'É a sua vez!' : turn.activeName ? `Vez de ${turn.activeName}` : 'Vez do mestre'}{' '}
          · rodada {turn.round}
        </AppText>
      ) : (
        <AppText variant="muted">O mestre está preparando a ordem dos turnos.</AppText>
      )}
      {turn.order.length > 0 ? (
        <View style={styles.order} accessibilityLabel="Ordem dos turnos">
          {turn.order.map((entry, index) => (
            <View
              key={entry.id}
              style={[
                styles.pill,
                styles.pillRow,
                entry.current && styles.current,
                entry.defeated && { opacity: 0.55 },
              ]}
            >
              <ColorDot color={palette.colorOfCharacter(entry.characterId)} />
              <AppText
                variant="small"
                style={{
                  color: entry.current ? colors.fgAccent : colors.fgSecondary,
                  textDecorationLine: entry.defeated ? 'line-through' : 'none',
                }}
              >
                {index + 1}. {entry.name}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {mine && guide ? (
        <View style={styles.guide}>
          <AppText style={{ fontFamily: fonts.sansMedium }}>No seu turno</AppText>
          {guide.economy.map((line) => (
            <AppText key={line} variant="small">
              • {line}
            </AppText>
          ))}
          <AppText variant="small">
            <AppText variant="small" style={{ fontFamily: fonts.sansMedium, color: colors.fg }}>
              Ações comuns:{' '}
            </AppText>
            {guide.actions.map((key) => dnd5eActions[key].label).join(', ')}.
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  order: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  current: { borderColor: colors.parchmentEdge, backgroundColor: 'rgba(80, 22, 36, 0.6)' },
  guide: {
    gap: 4,
    padding: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sunken,
  },
});
