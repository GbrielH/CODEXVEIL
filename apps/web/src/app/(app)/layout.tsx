import { getProfile, listMyCampaigns, listMyCharacters } from '@codexveil/database';
import { campaignRoleLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { requireSessionUser } from '@/lib/auth';
import { assistantEnabled } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Conteúdo por usuário: nunca pré-renderizado nem compartilhado entre requisições. */
export const dynamic = 'force-dynamic';

/** Áreas autenticadas. O proxy já redireciona visitantes; aqui validamos de novo no servidor. */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await requireSessionUser('/painel');
  const supabase = await createSupabaseServerClient();
  const [profile, campaigns, characters] = await Promise.all([
    getProfile(supabase, user.id),
    listMyCampaigns(supabase, user.id),
    listMyCharacters(supabase, user.id),
  ]);
  // Busca rápida da barra superior: só nomes e endereços do que a pessoa já vê.
  const search = [
    ...campaigns.map((campaign) => ({
      kind: 'campaign' as const,
      name: campaign.name,
      href: `/campanhas/${campaign.id}`,
      detail: `${findSystem(campaign.systemId)?.shortName ?? campaign.systemId} · ${campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}`,
    })),
    ...characters.map((character) => ({
      kind: 'character' as const,
      name: character.name,
      href: `/personagens/${character.id}`,
      detail: character.campaignName ? `Personagem · ${character.campaignName}` : 'Personagem',
    })),
  ];

  return (
    <AppShell
      displayName={profile?.displayName ?? 'Aventureiro'}
      assistant={assistantEnabled()}
      search={search}
      motion={profile?.preferences.motion ?? 'system'}
    >
      {children}
    </AppShell>
  );
}
