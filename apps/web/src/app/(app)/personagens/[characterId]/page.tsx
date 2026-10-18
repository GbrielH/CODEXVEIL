import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { CharacterSheet } from '@/components/sheets/character-sheet';
import { Notice } from '@/components/ui/notice';
import { loadCharacterOrNotFound } from '@/lib/characters';
import { campaignPath, routes } from '@/lib/routes';

export async function generateMetadata({ params }: PageProps<'/personagens/[characterId]'>): Promise<Metadata> {
  const { characterId } = await params;
  const { character } = await loadCharacterOrNotFound(characterId);
  return { title: character.name };
}

export default async function CharacterSheetPage({ params, searchParams }: PageProps<'/personagens/[characterId]'>) {
  const [{ characterId }, query] = await Promise.all([params, searchParams]);
  const { character } = await loadCharacterOrNotFound(characterId);
  const backLink = character.campaign
    ? { href: campaignPath(character.campaign.id), label: character.campaign.name }
    : { href: routes.characters, label: 'Personagens' };

  return (
    <div className="flex flex-col gap-6">
      <Link href={backLink.href as Route} className="text-sm text-fg-muted hover:text-fg">
        ← {backLink.label}
      </Link>
      <Notice value={query.aviso} />
      <CharacterSheet characterId={characterId} />
    </div>
  );
}
