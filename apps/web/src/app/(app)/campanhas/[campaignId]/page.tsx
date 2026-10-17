import { getCampaignTurn, listCampaignCharacters, listCampaignMembers, signedMediaUrls } from '@codexveil/database';
import { findSystem } from '@codexveil/rpg-systems';
import { Eye, EyeOff, Lock, PenLine, ScrollText, Swords, Users } from 'lucide-react';
import type { Metadata, Route } from 'next';
import { MemberList } from '@/components/campaigns/member-list';
import { TurnStatus } from '@/components/campaigns/turn-status';
import { PartyList } from '@/components/campaigns/party-list';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { formatDate, pluralize } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: PageProps<'/campanhas/[campaignId]'>): Promise<Metadata> {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  return { title: campaign.name };
}

export default async function CampaignOverviewPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const [members, party, turn] = await Promise.all([
    listCampaignMembers(supabase, campaign.id, campaign.ownerId),
    listCampaignCharacters(supabase, campaign.id),
    getCampaignTurn(supabase, campaign.id),
  ]);
  const portraits = await signedMediaUrls(supabase, party.map((character) => character.portraitPath));
  const system = findSystem(campaign.systemId);
  const isGm = campaign.role === 'gm';
  const isActive = campaign.status === 'active';
  const hasOwnCharacter = party.some((character) => character.ownerId === user.id);
  const creationRules = system ? system.describeCampaignRules(system.parseCampaignRules(campaign.characterRules)) : [];

  return (
    <div className="flex flex-col gap-6">
      <Notice value={query.aviso} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
        <TurnStatus
          campaignId={campaign.id}
          initialTurn={turn}
          ownCharacterId={party.find((character) => character.ownerId === user.id)?.id ?? null}
          systemId={campaign.systemId}
        />
        <Card ornate>
          <CardHeader
            icon={<Swords className="h-5 w-5" aria-hidden="true" />}
            title="Grupo"
            description={
              isGm || campaign.settings.partySheetsVisible
                ? pluralize(party.length, 'personagem na campanha', 'personagens na campanha')
                : 'Você vê apenas o seu personagem nesta campanha.'
            }
            action={
              isActive && !isGm && !hasOwnCharacter ? (
                <ButtonLink href={`${routes.newCharacter}?campanha=${campaign.id}` as Route} size="sm" variant="secondary">
                  Criar personagem
                </ButtonLink>
              ) : undefined
            }
          />
          {party.length === 0 ? (
            <p className="text-sm text-fg-muted">
              {isGm
                ? 'Nenhum personagem vinculado ainda. Os jogadores criam os personagens; o mestre usa NPCs e monstros da biblioteca.'
                : 'Nenhum personagem vinculado ainda. Crie o seu aqui ou vincule um existente pela ficha.'}
            </p>
          ) : (
            <PartyList characters={party} portraits={portraits} currentUserId={user.id} />
          )}
        </Card>
        <Card ornate>
          <CardHeader
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="Participantes"
            description={pluralize(members.length, 'pessoa nesta mesa', 'pessoas nesta mesa')}
            action={
              isGm && isActive ? (
                <ButtonLink href={`/campanhas/${campaign.id}/convites`} size="sm" variant="secondary">
                  Convidar jogadores
                </ButtonLink>
              ) : undefined
            }
          />
          <MemberList
            campaignId={campaign.id}
            campaignName={campaign.name}
            members={members}
            currentUserId={user.id}
            viewerIsOwner={campaign.isOwner}
            viewerIsGm={isGm}
            isActive={isActive}
          />
        </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-lg">Sobre a campanha</h2>
            {campaign.description ? (
              <p className="mt-2 whitespace-pre-line font-serif leading-relaxed text-fg-secondary">
                {campaign.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">Sem descrição.</p>
            )}
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-muted">Sistema</dt>
              <dd>{system ? `${system.name} (${system.rulesReference})` : campaign.systemId}</dd>
              <dt className="text-fg-muted">Mestre</dt>
              <dd>{campaign.ownerName}</dd>
              <dt className="text-fg-muted">Criada em</dt>
              <dd>{formatDate(campaign.createdAt)}</dd>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg">Regras da mesa</h2>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              <li className="flex gap-3">
                {campaign.settings.partySheetsVisible ? (
                  <Eye className="mt-0.5 h-4 w-4 shrink-0 text-fg-brand" aria-hidden="true" />
                ) : (
                  <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                )}
                <span>
                  {campaign.settings.partySheetsVisible
                    ? 'Jogadores podem consultar as fichas uns dos outros.'
                    : 'Cada jogador vê apenas a própria ficha.'}
                </span>
              </li>
              <li className="flex gap-3">
                {campaign.settings.playersCanEditSheets ? (
                  <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-fg-brand" aria-hidden="true" />
                ) : (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                )}
                <span>
                  {campaign.settings.playersCanEditSheets
                    ? 'Jogadores editam a própria ficha.'
                    : 'Fichas travadas pelo mestre (vida, recursos e inventário seguem editáveis).'}
                </span>
              </li>
              {creationRules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-fg-brand" aria-hidden="true" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
