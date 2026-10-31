import type { PartyCharacter } from '@codexveil/database';
import { conditionLabel, summarizeSheet } from '@codexveil/rpg-systems';
import type { Route } from 'next';
import Link from 'next/link';
import { ColoredName } from '@/components/dice/campaign-colors';
import { HealthBar } from '@/components/characters/health-bar';
import { Portrait } from '@/components/characters/portrait';
import { Badge } from '@/components/ui/badge';
import { characterPath } from '@/lib/routes';
import { GhostAura, isDown } from '@/components/characters/ghost-aura';

interface PartyListProps {
  characters: PartyCharacter[];
  portraits: Record<string, string>;
  currentUserId: string;
}

/** Personagens da campanha com vida e condições (o RLS já filtrou o que o usuário pode ver). */
export function PartyList({ characters, portraits, currentUserId }: PartyListProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {characters.map((character) => {
        const hp = character.resources.find((resource) => resource.display === 'health');
        const summary = summarizeSheet(character.systemId, character.sheet);
        const mine = character.ownerId === currentUserId;
        return (
          <li key={character.id}>
            <GhostAura active={isDown(character.resources)} count={2} className="h-full">
              <Link
                href={characterPath(character.id) as Route}
                className="flex h-full gap-3 rounded-md border border-line bg-raised p-3 transition-colors hover:border-parchment-400/40 hover:bg-hover"
              >
                <Portrait
                  name={character.name}
                  url={character.portraitPath ? (portraits[character.portraitPath] ?? null) : null}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium text-fg">
                    <ColoredName characterId={character.id} className="truncate">
                      {character.name}
                    </ColoredName>
                    {mine ? <Badge tone="brand">Seu</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {summary.subtitle} · {character.ownerName}
                  </p>
                  {hp ? (
                    <HealthBar current={hp.current} max={hp.max} temp={hp.temp} className="mt-2" />
                  ) : null}
                  {character.conditions.length > 0 ? (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {character.conditions.map((condition) => (
                        <Badge key={condition.id} tone="warning">
                          {conditionLabel(character.systemId, condition.key, condition.level)}
                        </Badge>
                      ))}
                    </p>
                  ) : null}
                </div>
              </Link>
            </GhostAura>
          </li>
        );
      })}
    </ul>
  );
}

/** Grupo com fichas ocultas: só o retrato e o nome de cada personagem, sem link para a ficha. */
export function PartyFaces({
  faces,
  portraits,
}: {
  faces: { id: string; name: string; ownerName: string; portraitPath: string | null }[];
  portraits: Record<string, string>;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {faces.map((face) => (
        <li
          key={face.id}
          className="flex items-center gap-3 rounded-md border border-line bg-raised p-3"
        >
          <Portrait
            name={face.name}
            url={face.portraitPath ? (portraits[face.portraitPath] ?? null) : null}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{face.name}</p>
            <p className="truncate text-xs text-fg-muted">{face.ownerName}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
