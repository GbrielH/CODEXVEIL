import {
  conflictObjectiveKindLabels,
  listConflictObjectives,
  subscribeToChanges,
  type ConflictObjective,
} from '@codexveil/database';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { AssimSymbol } from '@/components/assimilacao/symbols';
import { AppText, Card } from '@/components/ui/primitives';
import { getSupabase } from '@/lib/supabase';
import { colors, radii } from '@/lib/theme';

/** Objetivos do Conflito em andamento (Assimilação RPG), ao vivo. O mestre ajusta no site. */
export function ConflictObjectivesCard({ campaignId }: { campaignId: string }) {
  const [objectives, setObjectives] = useState<ConflictObjective[]>([]);
  const refresh = useCallback(() => {
    void listConflictObjectives(getSupabase(), campaignId)
      .then(setObjectives)
      .catch(() => undefined);
  }, [campaignId]);
  useEffect(() => {
    refresh();
    return subscribeToChanges(
      getSupabase(),
      `conflito:${campaignId}`,
      [{ table: 'conflict_objectives', filter: `campaign_id=eq.${campaignId}` }],
      { onChange: refresh },
    );
  }, [campaignId, refresh]);

  if (objectives.length === 0) return null;
  return (
    <Card ornate>
      <AppText variant="eyebrow">Conflito</AppText>
      {objectives.map((objective) => {
        const done = objective.progress >= objective.needed;
        return (
          <View key={objective.id} style={{ gap: 4 }}>
            <AppText style={{ color: colors.fg }}>
              {objective.name} · {objective.progress}/{objective.needed} <AssimSymbol code="A" />
            </AppText>
            <AppText variant="small">
              {conflictObjectiveKindLabels[objective.kind]}
              {done ? ' · concluído' : ''}
            </AppText>
            <View
              style={{
                height: 6,
                borderRadius: radii.full,
                backgroundColor: colors.sunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.min(100, (objective.progress / objective.needed) * 100)}%`,
                  height: '100%',
                  backgroundColor: done
                    ? '#34d399'
                    : objective.kind === 'ameaca'
                      ? '#f97316'
                      : '#b23a48',
                }}
              />
            </View>
          </View>
        );
      })}
    </Card>
  );
}
