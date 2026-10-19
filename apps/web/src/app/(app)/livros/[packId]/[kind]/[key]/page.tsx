import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookEntryScreen } from '@/components/books/book-reader';
import { requireSessionUser } from '@/lib/auth';
import { loadBookReader } from '@/lib/books';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Livro' };

export default async function MyBookEntryPage({ params }: PageProps<'/livros/[packId]/[kind]/[key]'>) {
  const user = await requireSessionUser(routes.books);
  const { packId, kind, key } = await params;
  const reader = await loadBookReader(await createSupabaseServerClient(), packId, { userId: user.id });
  if (!reader) notFound();
  return <BookEntryScreen reader={reader} kindSlug={kind} entryKey={key} />;
}
