import { getInvitePreview } from '@codexveil/database';
import { formatInviteCode, inviteRejectionMessages } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { inviteCodeSchema } from '@codexveil/validation';
import { MailX, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { Emblem } from '@/components/brand/emblem';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { formatDateTime, pluralize } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { InviteDecision } from './decision';

export const metadata: Metadata = { title: 'Convite para campanha' };

function Rejected({ message }: { message: string }) {
  return (
    <EmptyState
      icon={<MailX className="h-8 w-8" aria-hidden="true" />}
      title="Convite indisponível"
      description={message}
      action={
        <>
          <ButtonLink href="/convite">Digitar outro código</ButtonLink>
          <ButtonLink href={routes.dashboard} variant="secondary">
            Voltar ao painel
          </ButtonLink>
        </>
      }
    />
  );
}

export default async function InvitePreviewPage({ params }: PageProps<'/convite/[codigo]'>) {
  const { codigo } = await params;
  await requireSessionUser(`/convite/${codigo}`);

  const parsed = inviteCodeSchema.safeParse(decodeURIComponent(codigo));
  if (!parsed.success) return <Rejected message={inviteRejectionMessages.invalid_code} />;

  const supabase = await createSupabaseServerClient();
  const preview = await getInvitePreview(supabase, parsed.data);

  if (!('campaign' in preview)) {
    return <Rejected message={inviteRejectionMessages[preview.reason]} />;
  }

  const { campaign } = preview;
  const system = findSystem(campaign.systemId);
  const alreadyMember = preview.reason === 'already_member';

  return (
    <div className="invite-letter relative mx-auto flex w-full max-w-xl flex-col gap-6 pt-4">
      {/* Envelope fechado com o selo: a aba abre, a carta sobe e o envelope some. */}
      <div
        aria-hidden="true"
        className="invite-envelope pointer-events-none absolute inset-x-0 top-4 z-10 h-72 sm:h-80"
      >
        <div className="absolute inset-0 rounded-lg border border-parchment-400/40 bg-gradient-to-b from-wine-900 to-[#2a1418] shadow-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-lg bg-[#3a1a20] [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
        <div className="invite-envelope-flap absolute inset-x-0 top-0 h-[55%] bg-[#4a1f27] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        <div className="invite-envelope-seal absolute top-[55%] left-1/2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-wine-300/60 bg-wine-700 shadow-lg">
          <Emblem className="h-9 w-9" />
        </div>
      </div>
      <Card ornate className="invite-letter-card flex flex-col items-center gap-5 text-center">
        <Emblem className="emblem-glow h-14 w-14" />
        <div>
          <p className="eyebrow">Você foi convidado para</p>
          <h1 className="mt-2 text-2xl leading-tight">{campaign.name}</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Mestre: {campaign.ownerName ?? 'Mestre'} · {system?.shortName ?? campaign.systemId} ·{' '}
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {pluralize(campaign.memberCount, 'participante', 'participantes')}
            </span>
          </p>
        </div>
        {campaign.description ? (
          <p className="parchment w-full rounded-md p-4 text-left font-serif leading-relaxed whitespace-pre-line">
            {campaign.description}
          </p>
        ) : null}
        <p className="text-xs text-fg-muted">
          Código {formatInviteCode(parsed.data)} · válido até {formatDateTime(preview.expiresAt)}
        </p>
        {alreadyMember ? (
          <ButtonLink href={`/campanhas/${campaign.id}`}>
            Você já participa — abrir campanha
          </ButtonLink>
        ) : (
          <InviteDecision code={parsed.data} canDecline={preview.isPersonal} />
        )}
      </Card>
    </div>
  );
}
