import { getMyFriendCode, listFriends, listKnownPeople } from '@codexveil/database';
import type { Metadata } from 'next';
import { FriendsPanel } from '@/components/friends/friends-panel';
import { PageHeader } from '@/components/ui/page-header';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Amigos' };

/** Lista de amigos: código para adicionar, pedidos e sugestões de quem já joga com você. */
export default async function FriendsPage() {
  const user = await requireSessionUser(routes.friends);
  const supabase = await createSupabaseServerClient();
  const [code, friends, known] = await Promise.all([
    getMyFriendCode(supabase, user.id),
    listFriends(supabase, user.id),
    listKnownPeople(supabase, user.id),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Sua mesa"
        title="Amigos"
        description="Adicione amigos para convidá-los direto para suas campanhas e compartilhar fichas de personagem."
      />
      <FriendsPanel code={code} friends={friends} known={known} />
    </div>
  );
}
