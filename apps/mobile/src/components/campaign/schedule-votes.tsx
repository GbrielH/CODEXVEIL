import { listSchedulePolls, voteSchedule, type ScheduleAnswer } from '@codexveil/database';
import { View } from 'react-native';
import { Chip, ChipRow } from '@/components/ui/controls';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

const ANSWERS: { value: ScheduleAnswer; label: string }[] = [
  { value: 'yes', label: 'Posso' },
  { value: 'maybe', label: 'Talvez' },
  { value: 'no', label: 'Não posso' },
];

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Agenda da campanha no app: o jogador responde às datas propostas pelo mestre no site. */
export function ScheduleVotes({ campaignId }: { campaignId: string }) {
  const userId = useUserId();
  const toast = useToast();
  const { data, reload } = useAsyncData(
    () => listSchedulePolls(getSupabase(), campaignId),
    `agenda:${campaignId}`,
  );
  const open = (data ?? []).filter((poll) => poll.status === 'open');
  if (!open.length) return null;

  const vote = async (optionId: string, answer: ScheduleAnswer) => {
    try {
      await voteSchedule(getSupabase(), optionId, answer);
      reload();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'A resposta não foi salva',
        description: failureMessage(error),
      });
    }
  };

  return (
    <Card>
      <AppText variant="heading">Agenda</AppText>
      <AppText variant="small" style={{ color: colors.fgMuted }}>
        Marque quando você pode jogar a próxima sessão.
      </AppText>
      {open.map((poll) => (
        <View key={poll.id} style={{ gap: spacing[2] }}>
          <AppText>{poll.title || 'Próxima sessão'}</AppText>
          {poll.options.map((option) => {
            const mine = option.votes.find((entry) => entry.userId === userId)?.answer;
            const yes = option.votes.filter((entry) => entry.answer === 'yes').length;
            return (
              <View key={option.id} style={{ gap: spacing[1] }}>
                <AppText variant="small">
                  {formatWhen(option.startsAt)} · {yes} podem
                </AppText>
                <ChipRow>
                  {ANSWERS.map((answer) => (
                    <Chip
                      key={answer.value}
                      label={answer.label}
                      selected={mine === answer.value}
                      onPress={() => void vote(option.id, answer.value)}
                    />
                  ))}
                </ChipRow>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}
