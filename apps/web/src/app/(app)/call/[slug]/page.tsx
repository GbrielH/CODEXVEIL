import { callsEnabled } from '@/lib/env';
import {
  findCallRoom,
  getCallRoom,
  listFriends,
  listRecentEndedCalls,
  listTranscript,
  purgeExpiredCallTranscripts,
} from '@codexveil/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSessionUser } from '@/lib/auth';
import { callPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EndedCallTranscripts } from '@/components/call/ended-call-transcripts';
import { CallRoomView } from './call-room';

export const metadata: Metadata = { title: 'Call' };

/** Sala de call pelo link: entra (ou aguarda aprovação) e abre a chamada. */
export default async function CallRoomPage({ params }: PageProps<'/call/[slug]'>) {
  if (!callsEnabled()) notFound();
  const { slug } = await params;
  const user = await requireSessionUser(callPath(slug));
  const supabase = await createSupabaseServerClient();
  await purgeExpiredCallTranscripts(supabase).catch(() => undefined);
  const summary = await findCallRoom(supabase, slug);
  if (!summary) notFound();
  if (summary.status === 'ended') {
    const call = (await listRecentEndedCalls(supabase).catch(() => [])).find(
      (item) => item.id === summary.id,
    );
    const segments = call ? await listTranscript(supabase, call.id).catch(() => []) : [];
    return <EndedCallTranscripts single items={call ? [{ call, segments }] : []} />;
  }
  const [room, friends] = await Promise.all([
    getCallRoom(supabase, slug).catch(() => null),
    listFriends(supabase, user.id).catch(() => []),
  ]);
  return (
    <CallRoomView
      room={summary}
      isOwner={room?.ownerId === user.id}
      transcriptionEnabled={room?.transcriptionEnabled ?? false}
      userId={user.id}
      friends={friends
        .filter((friend) => friend.status === 'accepted')
        .map((friend) => ({ id: friend.userId, name: friend.displayName }))}
    />
  );
}
