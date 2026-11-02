import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export type ScheduleAnswer = 'yes' | 'maybe' | 'no';

export interface ScheduleOption {
  id: string;
  startsAt: string;
  votes: { userId: string; name: string; answer: ScheduleAnswer }[];
}

export interface SchedulePoll {
  id: string;
  sessionId: string | null;
  title: string;
  status: 'open' | 'closed';
  chosenOptionId: string | null;
  createdAt: string;
  options: ScheduleOption[];
}

const isAnswer = (value: string): value is ScheduleAnswer =>
  value === 'yes' || value === 'maybe' || value === 'no';

/** Votações de data da campanha (mais recentes primeiro), com as respostas de cada membro. */
export async function listSchedulePolls(
  client: CodexveilClient,
  campaignId: string,
): Promise<SchedulePoll[]> {
  const { data, error } = await client
    .from('schedule_polls')
    .select(
      'id, session_id, title, status, chosen_option_id, created_at, options:schedule_options(id, starts_at, votes:schedule_votes(user_id, answer, profile:profiles(display_name)))',
    )
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    status: row.status === 'closed' ? 'closed' : 'open',
    chosenOptionId: row.chosen_option_id,
    createdAt: row.created_at,
    options: [...row.options]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((option) => ({
        id: option.id,
        startsAt: option.starts_at,
        votes: option.votes.flatMap((vote) =>
          isAnswer(vote.answer)
            ? [
                {
                  userId: vote.user_id,
                  name: vote.profile?.display_name ?? 'Alguém',
                  answer: vote.answer,
                },
              ]
            : [],
        ),
      })),
  }));
}

/** Mestre: propõe de 1 a 10 datas (ISO) e, opcionalmente, a sessão que recebe a data escolhida. */
export async function createSchedulePoll(
  client: CodexveilClient,
  input: { campaignId: string; sessionId: string | null; title: string; starts: string[] },
): Promise<string> {
  const { data, error } = await client.rpc('create_schedule_poll', {
    p_campaign_id: input.campaignId,
    p_session_id: input.sessionId as string,
    p_title: input.title,
    p_starts: input.starts,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function voteSchedule(
  client: CodexveilClient,
  optionId: string,
  answer: ScheduleAnswer,
): Promise<void> {
  const { error } = await client.rpc('vote_schedule', { p_option_id: optionId, p_answer: answer });
  if (error) throw toAppError(error);
}

export async function confirmSchedule(
  client: CodexveilClient,
  pollId: string,
  optionId: string,
): Promise<void> {
  const { error } = await client.rpc('confirm_schedule', {
    p_poll_id: pollId,
    p_option_id: optionId,
  });
  if (error) throw toAppError(error);
}

export async function deleteSchedulePoll(client: CodexveilClient, pollId: string): Promise<void> {
  const { error } = await client.from('schedule_polls').delete().eq('id', pollId);
  if (error) throw toAppError(error);
}
