import { getCreature, signedMediaUrls } from '@codexveil/database';
import { parseDnd5eStatBlock } from '@codexveil/rpg-systems/dnd5e';
import { buildT20Content, parseT20StatBlock } from '@codexveil/rpg-systems/tormenta20';
import { T20ThreatEditor, T20ThreatView } from '@/components/library/t20-threat';
import { T20TreasureRoller } from '@/components/library/t20-treasure';
import { campaignBookPacks, loadBookSources, packsOfSystem } from '@/lib/books';
import { creatureKindLabels, uuidSchema } from '@codexveil/validation';
import { EyeOff, Skull, UserRound } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreatureEditor } from '@/components/library/creature-editor';
import { StatBlockView } from '@/components/library/stat-block-view';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Props = PageProps<'/campanhas/[campaignId]/biblioteca/[creatureId]'>;

async function load(campaignId: string, creatureId: string) {
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (!uuidSchema.safeParse(creatureId).success) notFound();
  const supabase = await createSupabaseServerClient();
  const creature = await getCreature(supabase, creatureId, campaign.role === 'gm');
  if (!creature || creature.campaignId !== campaign.id) notFound();
  return { campaign, creature, supabase };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaignId, creatureId } = await params;
  const { creature } = await load(campaignId, creatureId);
  return { title: creature.name };
}

export default async function CreaturePage({ params }: Props) {
  const { campaignId, creatureId } = await params;
  const { campaign, creature, supabase } = await load(campaignId, creatureId);
  const images = await signedMediaUrls(supabase, [creature.imagePath]);
  const imageUrl = creature.imagePath ? (images[creature.imagePath] ?? null) : null;
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  // Tabelas de tesouro dos livros T20 liberados (só o mestre lê).
  const treasureTables =
    isGm && campaign.systemId === 'tormenta20'
      ? buildT20Content(
          await loadBookSources(
            supabase,
            packsOfSystem(await campaignBookPacks(supabase, campaign), 'tormenta20'),
            ['table'],
          ),
        ).tables
      : [];

  let statBlock = null;
  let statBlockInvalid = false;
  if (creature.gm && campaign.systemId === 'dnd5e') {
    try {
      statBlock = parseDnd5eStatBlock(creature.gm.stats);
    } catch {
      statBlockInvalid = true;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={campaignPath(campaign.id, '/biblioteca') as Route}
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Biblioteca
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-parchment-400/30 bg-wine-950 text-parchment-300 shadow-card">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`Imagem de ${creature.name}`}
              className="h-full w-full object-cover"
            />
          ) : creature.kind === 'npc' ? (
            <UserRound className="h-12 w-12" aria-hidden="true" />
          ) : (
            <Skull className="h-12 w-12" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{creatureKindLabels[creature.kind]}</Badge>
            {isGm && creature.visibility === 'gm' ? (
              <Badge tone="warning" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />}>
                Oculto dos jogadores
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-2 text-3xl leading-tight">{creature.name}</h2>
          {creature.subtitle ? <p className="text-fg-secondary">{creature.subtitle}</p> : null}
          {creature.description ? (
            <p className="mt-3 max-w-3xl whitespace-pre-line font-serif text-lg leading-relaxed text-fg">
              {creature.description}
            </p>
          ) : null}
        </div>
      </header>

      {statBlockInvalid ? (
        <Alert tone="warning">
          As estatísticas deste registro não seguem o formato esperado. Salve-as novamente pelo
          editor.
        </Alert>
      ) : null}

      {isGm && creature.gm ? (
        canManage ? (
          <CreatureEditor
            campaignId={campaign.id}
            creature={{
              id: creature.id,
              kind: creature.kind,
              name: creature.name,
              subtitle: creature.subtitle,
              description: creature.description,
              visibility: creature.visibility,
              imagePath: creature.imagePath,
              imageUrl,
              size: creature.size,
            }}
            systemId={campaign.systemId}
            gm={{ notes: creature.gm.notes, secrets: creature.gm.secrets }}
            statBlock={
              campaign.systemId === 'dnd5e' ? (statBlock ?? parseDnd5eStatBlock({})) : null
            }
          />
        ) : statBlock ? (
          <StatBlockView name={creature.name} statBlock={statBlock} />
        ) : null
      ) : null}

      {isGm && creature.gm && campaign.systemId === 'tormenta20' ? (
        <>
          <T20ThreatView name={creature.name} stats={parseT20StatBlock(creature.gm.stats)} />
          <T20TreasureRoller
            tables={treasureTables}
            defaultNd={parseT20StatBlock(creature.gm.stats).challenge}
          />
          {canManage ? (
            <T20ThreatEditor
              creatureId={creature.id}
              stats={parseT20StatBlock(creature.gm.stats)}
              gm={{ notes: creature.gm.notes, secrets: creature.gm.secrets }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
