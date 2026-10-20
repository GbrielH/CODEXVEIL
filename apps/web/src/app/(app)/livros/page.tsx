import { listMyBookPacks } from '@codexveil/database';
import { sourcebookCategoryLabels, type SourcebookCategory } from '@codexveil/rpg-systems/dnd5e';
import { BookOpen, Library } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { BookDeleteButton } from '@/components/books/book-delete';
import { BookImporter } from '@/components/books/book-importer';
import { SystemBadge } from '@/components/books/system-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { describeBookCounts } from '@/lib/book-counts';
import { bookPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Meus livros' };

export default async function MyBooksPage() {
  const user = await requireSessionUser(routes.books);
  const packs = await listMyBookPacks(await createSupabaseServerClient(), user.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Biblioteca pessoal"
        title="Meus livros"
        description="O conteúdo dos livros que você tem, importado para a sua conta. Só você e as mesas em que você liberar cada livro veem o conteúdo."
      />

      <Card ornate>
        <CardHeader
          icon={<Library className="h-5 w-5" aria-hidden="true" />}
          title="Importar um livro"
          description="Escolha o arquivo do livro (pacote .json do Codexveil). Importar de novo o mesmo livro substitui a versão anterior."
        />
        <BookImporter userId={user.id} existingKeys={packs.map((pack) => pack.bookKey)} />
      </Card>

      {packs.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" aria-hidden="true" />}
          title="Nenhum livro importado"
          description="Depois de importar, libere o livro nas regras da campanha (Configurações): espécies, classes, antecedentes, magias, monstros e itens dele passam a valer na mesa."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {packs.map((pack) => (
            <li key={pack.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="parchment">{sourcebookCategoryLabels[pack.category as SourcebookCategory]?.name ?? pack.category}</Badge>
                  <SystemBadge systemId={pack.systemId} edition={pack.edition} />
                  {pack.isReady ? null : <Badge tone="warning">Importação incompleta</Badge>}
                </div>
                <Link href={bookPath(pack.id) as Route} className="font-display text-xl text-fg-accent hover:underline">
                  {pack.name}
                </Link>
                <p className="text-sm text-fg-muted">{describeBookCounts(pack.entryCounts, pack.systemId) || 'Sem conteúdo de regras (só texto).'}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <Link href={bookPath(pack.id) as Route} className="text-sm text-fg-brand underline-offset-2 hover:underline">
                    Abrir o livro
                  </Link>
                  <BookDeleteButton packId={pack.id} name={pack.name} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
