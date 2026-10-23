import { getProfile } from '@codexveil/database';
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
  const profile = await getProfile(supabase, user.id);

  return (
    <AppShell
      displayName={profile?.displayName ?? 'Aventureiro'}
      assistant={assistantEnabled()}
      motion={profile?.preferences.motion ?? 'system'}
    >
      {children}
    </AppShell>
  );
}
