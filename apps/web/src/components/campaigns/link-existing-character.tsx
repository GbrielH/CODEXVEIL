import { Link2 } from 'lucide-react';
import type { Route } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { characterPath } from '@/lib/routes';

/**
 * Fichas do jogador (mesmo sistema, ainda sem campanha) que podem entrar nesta campanha. O
 * vínculo acontece na aba Ajustes da ficha, que confere as regras e as perguntas do mestre: o
 * botão abre a ficha já nessa aba, com a campanha escolhida.
 */
export function LinkExistingCharacter({
  campaignId,
  characters,
}: {
  campaignId: string;
  characters: { id: string; name: string }[];
}) {
  if (characters.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-fg-secondary">Ou use um personagem que você já tem:</p>
      <ul className="flex flex-col gap-1">
        {characters.map((character) => (
          <li
            key={character.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <span className="truncate text-sm text-fg">{character.name}</span>
            <ButtonLink
              href={`${characterPath(character.id)}?vincular=${campaignId}` as Route}
              size="sm"
              variant="secondary"
              icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
            >
              Vincular
            </ButtonLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
