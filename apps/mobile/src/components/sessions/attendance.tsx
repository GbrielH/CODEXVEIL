import { listCampaignAttendance, setMyAttendance, type AttendanceStatus } from '@codexveil/database';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

/** Confirmar presença numa sessão agendada (jogador). */
export function AttendanceCard({ sessionId, campaignId }: { sessionId: string; campaignId: string }) {
  const userId = useUserId();
  const toast = useToast();
  const { data, mutate } = useAsyncData(() => listCampaignAttendance(getSupabase(), campaignId), `presenca:${campaignId}`);
  const status: AttendanceStatus | null = data?.[sessionId]?.[userId] ?? null;
  const answer = async (next: AttendanceStatus) => {
    try {
      await setMyAttendance(getSupabase(), sessionId, campaignId, userId, next);
      mutate((current) => ({ ...current, [sessionId]: { ...(current[sessionId] ?? {}), [userId]: next } }));
      toast({ tone: 'success', title: next === 'yes' ? 'Presença confirmada.' : 'Ausência avisada ao mestre.' });
    } catch (cause) {
      toast({ tone: 'danger', title: 'A resposta não foi salva', description: failureMessage(cause) });
    }
  };
  return (
    <Card>
      <AppText variant="eyebrow">Confirmar presença</AppText>
      <AppText variant="small">{status === 'yes' ? 'Você confirmou presença.' : status === 'no' ? 'Você avisou que não vai.' : 'Você vai a esta sessão?'}</AppText>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Button label="Vou" compact variant={status === 'yes' ? 'primary' : 'secondary'} onPress={() => void answer('yes')} />
        <Button label="Não vou" compact variant={status === 'no' ? 'danger' : 'ghost'} onPress={() => void answer('no')} />
      </View>
    </Card>
  );
}
