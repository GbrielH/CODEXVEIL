import { Link2 } from 'lucide-react';
import type { Route } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { characterPath } from '@/lib/routes';

export interface LinkableCharacter {
  id: string;
  name: string;
  /** Campanha em que a ficha já está (precisa ser desvinculada antes); `null` = livre. */
  campaignName: string | null;
}

/**
 * "Adicionar personagem existente": as fichas do jogador do mesmo sistema. As livres vão direto
 * para a aba Ajustes da ficha com esta campanha escolhida (lá ficam as conferências das regras e
 * das perguntas do mestre); as que já estão em outra campanha abrem a ficha para desvincular antes.
 */
export function LinkExistingCharacter({
  campaignId,
  characters,
  supported = true,
}: {
  campaignId: string;
  characters: LinkableCharacter[];
  /** Sistema sem vínculo depois da criação (ainda): só explica. */
  supported?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-3">
      <p className="text-sm font-medium text-fg">Adicionar personagem existente</p>
      {!supported ? (
        <p className="text-sm text-fg-muted">
          Neste sistema, o personagem entra na campanha só ao ser criado por aqui (“Criar
          personagem”).
        </p>
      ) : characters.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Você não tem fichas deste sistema. Crie uma em “Criar personagem”.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {characters.map((character) => (
            <li
              key={character.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-fg">{character.name}</span>
                {character.campaignName ? (
                  <span className="block truncate text-xs text-fg-muted">
                    Em “{character.campaignName}”: desvincule na aba Ajustes da ficha antes.
                  </span>
                ) : null}
              </span>
              {character.campaignName ? (
                <ButtonLink href={characterPath(character.id) as Route} size="sm" variant="ghost">
                  Abrir ficha
                </ButtonLink>
              ) : (
                <ButtonLink
                  href={`${characterPath(character.id)}?vincular=${campaignId}` as Route}
                  size="sm"
                  variant="secondary"
                  icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
                >
                  Vincular
                </ButtonLink>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
