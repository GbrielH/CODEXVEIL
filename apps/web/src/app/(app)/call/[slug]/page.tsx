import { findCallRoom, getCallRoom, listFriends } from '@codexveil/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSessionUser } from '@/lib/auth';
import { callPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CallRoomView } from './call-room';

export const metadata: Metadata = { title: 'Call' };

/** Sala de call pelo link: entra (ou aguarda aprovação) e abre a chamada. */
export default async function CallRoomPage({ params }: PageProps<'/call/[slug]'>) {
  const { slug } = await params;
  const user = await requireSessionUser(callPath(slug));
  const supabase = await createSupabaseServerClient();
  const summary = await findCallRoom(supabase, slug);
  if (!summary) notFound();
  const [room, friends] = await Promise.all([
    getCallRoom(supabase, slug).catch(() => null),
    listFriends(supabase, user.id).catch(() => []),
  ]);
  return (
    <CallRoomView
      room={summary}
      isOwner={room?.ownerId === user.id}
      userId={user.id}
      friends={friends
        .filter((friend) => friend.status === 'accepted')
        .map((friend) => ({ id: friend.userId, name: friend.displayName }))}
    />
  );
}
