import { getCharacterDraft, listMyCampaigns, type CampaignSummary } from '@codexveil/database';
import { findSystem } from '@codexveil/rpg-systems';
import { parseDnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import { parseT20CampaignRules } from '@codexveil/rpg-systems/tormenta20';
import { ScrollText, UserRound } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Dnd5eCreationWizard } from '@/components/characters/dnd5e-wizard/wizard';
import { T20CreationWizard } from '@/components/characters/t20-wizard/wizard';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSessionUser } from '@/lib/auth';
import {
  campaignBookPacks,
  loadBookSources,
  loadT20Sources,
  ownReadyBookPacks,
  packsOfSystem,
} from '@/lib/books';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Novo personagem' };

const SYSTEMS_WITH_WIZARD = ['dnd5e', 'tormenta20'] as const;
type WizardSystem = (typeof SYSTEMS_WITH_WIZARD)[number];
const isWizardSystem = (value: string): value is WizardSystem =>
  (SYSTEMS_WITH_WIZARD as readonly string[]).includes(value);

/**
 * Criação de personagem em dois tempos: primeiro a campanha (ou a ficha pessoal e o sistema),
 * depois o assistente do sistema com os livros disponíveis nela.
 */
export default async function NewCharacterPage({ searchParams }: PageProps<'/personagens/novo'>) {
  const user = await requireSessionUser(routes.newCharacter);
  const supabase = await createSupabaseServerClient();
  const [campaigns, params] = await Promise.all([listMyCampaigns(supabase, user.id), searchParams]);
  // Personagens de campanha são dos jogadores; o mestre cria NPCs e monstros na biblioteca.
  const playable = campaigns.filter(
    (campaign) =>
      campaign.status === 'active' &&
      campaign.role === 'player' &&
      isWizardSystem(campaign.systemId),
  );
  const campaign =
    typeof params.campanha === 'string'
      ? playable.find((entry) => entry.id === params.campanha)
      : undefined;
  const personalSystem =
    typeof params.sistema === 'string' && isWizardSystem(params.sistema)
      ? params.sistema
      : undefined;

  if (!campaign && !personalSystem) return <ChooseStart campaigns={playable} />;

  const systemId: WizardSystem = campaign ? (campaign.systemId as WizardSystem) : personalSystem!;
  const system = findSystem(systemId);
  // Rascunho salvo ("Salvar rascunho"): só vale se for do mesmo sistema e da mesma campanha.
  const savedDraft =
    typeof params.rascunho === 'string' ? await getCharacterDraft(supabase, params.rascunho) : null;
  const remoteDraft =
    savedDraft &&
    savedDraft.systemId === systemId &&
    savedDraft.campaignId === (campaign?.id ?? null)
      ? { id: savedDraft.id, payload: savedDraft.payload }
      : null;
  const ownPacks = await ownReadyBookPacks(supabase, user.id);
  const packs = campaign ? await campaignBookPacks(supabase, campaign) : ownPacks;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={
          campaign ? `Campanha: ${campaign.name}` : `Ficha pessoal · ${system?.name ?? systemId}`
        }
        title="Novo personagem"
        description={
          campaign
            ? 'Um passo a passo com as regras do sistema e os livros que o mestre liberou nesta campanha.'
            : 'Um passo a passo com as regras do sistema e os livros que você importou em Meus livros.'
        }
        actions={
          <Link
            href={routes.newCharacter}
            className="text-sm text-fg-brand underline-offset-2 hover:underline"
          >
            Trocar campanha
          </Link>
        }
      />
      <Card ornate>
        {systemId === 'tormenta20' ? (
          <T20CreationWizard
            campaign={
              campaign
                ? {
                    id: campaign.id,
                    name: campaign.name,
                    rules: parseT20CampaignRules(campaign.characterRules),
                    questions: campaign.creationQuestions,
                  }
                : null
            }
            sources={await loadT20Sources(supabase, packs)}
            remoteDraft={remoteDraft}
          />
        ) : (
          await dnd5eWizard({
            campaign,
            packs: packsOfSystem(packs, 'dnd5e'),
            ownPacks: packsOfSystem(ownPacks, 'dnd5e'),
            userId: user.id,
          })
        )}
      </Card>
    </div>
  );

  async function dnd5eWizard({
    campaign: chosen,
    packs: chosenPacks,
    ownPacks: personal,
    userId,
  }: {
    campaign: CampaignSummary | undefined;
    packs: Awaited<ReturnType<typeof ownReadyBookPacks>>;
    ownPacks: Awaited<ReturnType<typeof ownReadyBookPacks>>;
    userId: string;
  }) {
    const sources = await loadBookSources(supabase, chosen ? chosenPacks : personal);
    const books = Object.fromEntries(sources.map(({ packId, ...source }) => [packId, source]));
    const wizardCampaigns = chosen
      ? [
          {
            id: chosen.id,
            name: chosen.name,
            rules: parseDnd5eCampaignRules(chosen.characterRules),
            packIds: chosenPacks.map((pack) => pack.id),
            questions: chosen.creationQuestions,
          },
        ]
      : [];
    return (
      <Dnd5eCreationWizard
        campaigns={wizardCampaigns}
        books={books}
        personalPackIds={personal.map((pack) => pack.id)}
        defaultCampaignId={chosen?.id ?? ''}
        storageKey={`codexveil:criacao-dnd5e:${userId}:${chosen?.id ?? 'pessoal'}`}
        lockCampaign
        remoteDraft={remoteDraft}
      />
    );
  }
}

/** Primeiro passo: em qual campanha o personagem vai jogar (ou ficha pessoal, com o sistema). */
function ChooseStart({ campaigns }: { campaigns: CampaignSummary[] }) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Personagens"
        title="Novo personagem"
        description="Primeiro, escolha onde o personagem vai jogar. Em seguida aparecem as regras e os livros disponíveis para a criação."
      />
      <Card ornate>
        <CardHeader
          icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
          title="Numa campanha"
          description="O mestre define o sistema, o nível inicial e os livros liberados."
        />
        {campaigns.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Você não é jogador de nenhuma campanha ativa. Aceite um convite ou crie uma ficha
            pessoal.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`${routes.newCharacter}?campanha=${campaign.id}` as Route}
                  className="flex h-full flex-col gap-2 rounded-md border border-line p-4 transition-colors hover:border-line-strong hover:bg-hover"
                >
                  <span className="font-display text-lg text-fg">{campaign.name}</span>
                  <Badge tone="parchment" className="w-fit">
                    {findSystem(campaign.systemId)?.name ?? campaign.systemId}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader
          icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
          title="Ficha pessoal"
          description="Sem campanha: você escolhe o sistema, o nível e os seus livros importados. Dá para vincular a uma campanha depois."
        />
        <div className="flex flex-wrap gap-3">
          {SYSTEMS_WITH_WIZARD.map((id) => (
            <Link
              key={id}
              href={`${routes.newCharacter}?sistema=${id}` as Route}
              className="rounded-md border border-line px-4 py-3 text-sm font-medium text-fg transition-colors hover:border-line-strong hover:bg-hover"
            >
              {findSystem(id)?.name ?? id}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
