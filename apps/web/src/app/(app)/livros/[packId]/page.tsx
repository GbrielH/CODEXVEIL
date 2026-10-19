import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookIndexScreen } from '@/components/books/book-reader';
import { requireSessionUser } from '@/lib/auth';
import { loadBookReader } from '@/lib/books';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Livro' };

export default async function MyBookPage({ params, searchParams }: PageProps<'/livros/[packId]'>) {
  const user = await requireSessionUser(routes.books);
  const [{ packId }, query] = await Promise.all([params, searchParams]);
  const reader = await loadBookReader(await createSupabaseServerClient(), packId, { userId: user.id });
  if (!reader) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Link href={routes.books} className="text-sm text-fg-muted hover:text-fg">
        ← Meus livros
      </Link>
      <BookIndexScreen reader={reader} kindSlug={typeof query.tipo === 'string' ? query.tipo : ''} term={typeof query.q === 'string' ? query.q : ''} />
    </div>
  );
}
