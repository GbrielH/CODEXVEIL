import { clearDiceRolls, listDiceRolls, type DiceRoll } from '@codexveil/database';
import { describeDiceRoll, diceRollModeLabels, naturalD20 } from '@codexveil/domain';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { AppText, Badge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useRealtimeRefresh } from '@/lib/hooks';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Mural de rolagens da campanha, ao vivo (o RLS decide o que cada um vê). */
export function RollFeed({ campaignId, canClear = false, limit = 40 }: { campaignId: string; canClear?: boolean; limit?: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rolls, setRolls] = useState<DiceRoll[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRolls(await listDiceRolls(getSupabase(), campaignId, limit));
      setError(null);
    } catch (cause) {
      setError(failureMessage(cause));
    }
  }, [campaignId, limit]);

  useEffect(() => {
    let active = true;
    listDiceRolls(getSupabase(), campaignId, limit)
      .then((loaded) => {
        if (active) setRolls(loaded);
      })
      .catch((cause: unknown) => {
        if (active) setError(failureMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [campaignId, limit]);

  const live = useRealtimeRefresh(`rolagens:${campaignId}`, [{ table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` }], () => void reload());

  const clear = async () => {
    const ok = await confirm({ title: 'Limpar o mural?', message: 'Todas as rolagens desta campanha serão apagadas para todos.', confirmLabel: 'Limpar', tone: 'danger' });
    if (!ok) return;
    try {
      await clearDiceRolls(getSupabase(), campaignId);
      await reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'O mural não foi limpo', description: failureMessage(cause) });
    }
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <AppText variant="small" style={{ flex: 1, color: live === 'live' ? colors.success : colors.fgMuted }}>
          {live === 'live' ? '● Ao vivo' : live === 'connecting' ? 'Conectando…' : 'Reconectando…'}
        </AppText>
        {canClear && rolls && rolls.length > 0 ? (
          <Button label="Limpar" compact variant="ghost" icon={<Trash2 size={14} color={colors.fgSecondary} />} onPress={() => void clear()} />
        ) : null}
      </View>
      {error ? <AppText style={{ color: '#EC9384' }}>{error}</AppText> : null}
      {rolls === null ? (
        <AppText variant="muted">Carregando…</AppText>
      ) : rolls.length === 0 ? (
        <AppText variant="muted">Nenhuma rolagem ainda. As rolagens da mesa aparecem aqui na hora.</AppText>
      ) : (
        rolls.map((roll) => {
          const natural = naturalD20(roll);
          return (
            <View key={roll.id} style={[styles.row, roll.visibility === 'gm' && styles.secret]}>
              <AppText
                variant="number"
                style={{ width: 52, textAlign: 'center', color: natural === 20 ? colors.success : natural === 1 ? colors.danger : colors.fgAccent }}
              >
                {roll.total}
              </AppText>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <AppText style={{ fontFamily: fonts.sansMedium }}>{roll.rollerName}</AppText>
                  {roll.label ? <AppText variant="small">· {roll.label}</AppText> : null}
                  {roll.visibility === 'gm' ? <Badge label="Secreta" tone="brand" /> : null}
                </View>
                <AppText variant="small" style={{ color: colors.fgMuted }}>
                  {roll.expression} → {describeDiceRoll(roll)}
                  {roll.mode !== 'normal' ? ` · ${diceRollModeLabels[roll.mode]}` : ''}
                </AppText>
              </View>
              <AppText variant="small" style={{ color: colors.fgSubtle }}>
                {timeLabel(roll.createdAt)}
              </AppText>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
  },
  secret: { borderColor: 'rgba(122, 140, 214, 0.45)' },
});
