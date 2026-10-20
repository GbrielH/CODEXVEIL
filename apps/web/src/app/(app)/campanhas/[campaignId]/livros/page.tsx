import { sourcebookCategoryLabels, type SourcebookCategory } from '@codexveil/rpg-systems/dnd5e';
import { BookOpen } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { SystemBadge } from '@/components/books/system-badge';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { describeBookCounts } from '@/lib/book-counts';
import { campaignBookPacks } from '@/lib/books';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { bookPath, campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Livros da campanha' };

export default async function CampaignBooksPage({ params }: PageProps<'/campanhas/[campaignId]/livros'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const packs = await campaignBookPacks(await createSupabaseServerClient(), campaign);
  const isGm = campaign.role === 'gm';

  if (packs.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-8 w-8" aria-hidden="true" />}
        title="Nenhum livro liberado"
        description={
          isGm
            ? 'Importe livros em "Meus livros" e libere-os em Configurações → Conteúdo do sistema.'
            : 'O mestre ainda não liberou livros para esta campanha. Por enquanto, vale o SRD 5.2.1.'
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        Livros que o mestre liberou nesta mesa. {isGm ? 'Monstros e itens podem ser copiados para a biblioteca.' : 'Monstros e segredos do mestre não aparecem para jogadores.'}
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {packs.map((pack) => (
          <li key={pack.id}>
            <Link href={bookPath(pack.id, '', campaign.id) as Route} className="block h-full">
              <Card className="flex h-full flex-col gap-2 transition-colors hover:border-line-strong">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="parchment">{sourcebookCategoryLabels[pack.category as SourcebookCategory]?.name ?? pack.category}</Badge>
                  <SystemBadge systemId={pack.systemId} edition={pack.edition} />
                </div>
                <span className="font-display text-xl text-fg-accent">{pack.name}</span>
                <span className="text-sm text-fg-muted">{describeBookCounts(pack.entryCounts, pack.systemId)}</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={campaignPath(campaign.id) as Route} className="sr-only">
        Voltar à campanha
      </Link>
    </div>
  );
}
