import { getProfile, listMyCampaigns } from '@codexveil/database';
import { campaignRoleLabels } from '@codexveil/domain';
import { ScrollText, ShieldCheck, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PasswordReset } from './password-reset';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfilePage() {
  const user = await requireSessionUser(routes.profile);
  const supabase = await createSupabaseServerClient();
  const [profile, campaigns] = await Promise.all([getProfile(supabase, user.id), listMyCampaigns(supabase, user.id)]);

  if (!profile) {
    return <ErrorState description="Não encontramos o seu perfil. Saia e entre novamente; se persistir, contate o suporte." />;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Conta" title="Perfil" description="Como você aparece para os outros participantes." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card ornate>
          <CardHeader icon={<UserRound className="h-5 w-5" aria-hidden="true" />} title="Dados públicos" />
          <ProfileForm
            initial={{ displayName: profile.displayName, bio: profile.bio, preferences: profile.preferences }}
          />
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} title="Acesso" />
            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-muted">E-mail</dt>
              <dd className="break-all">{user.email ?? '—'}</dd>
              <dt className="text-fg-muted">Conta criada</dt>
              <dd>{formatDate(profile.createdAt)}</dd>
            </dl>
            <PasswordReset />
          </Card>

          <Card>
            <CardHeader icon={<ScrollText className="h-5 w-5" aria-hidden="true" />} title="Minhas campanhas" />
            {campaigns.length === 0 ? (
              <p className="text-sm text-fg-muted">Você ainda não participa de nenhuma campanha.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      href={`/campanhas/${campaign.id}`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-hover"
                    >
                      <span className="truncate text-sm">{campaign.name}</span>
                      <Badge tone={campaign.role === 'gm' ? 'brand' : 'neutral'}>
                        {campaignRoleLabels[campaign.role]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
