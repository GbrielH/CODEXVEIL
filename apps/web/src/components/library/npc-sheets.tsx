'use client';

import {
  setCharacterNpcCampaign,
  setCharacterNpcListed,
  type NpcCharacterItem,
} from '@codexveil/database';
import { ScrollText, X } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { characterPath, routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * NPCs com ficha de jogador: o mestre cria a ficha pelo assistente a partir daqui (ela sobe de nível
 * como a dos jogadores) e ela já nasce como NPC desta campanha. Os jogadores não veem essas fichas,
 * e elas não aparecem em "Meus personagens" a menos que o mestre marque "Adicionar aos personagens".
 */
export function NpcSheets({
  campaignId,
  characters,
}: {
  campaignId: string;
  /** Sistema da campanha (o assistente aberto por `?npc=` já usa o dela). */
  systemId: string;
  characters: NpcCharacterItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState('');
  const linked = characters.filter((character) => character.npcCampaignId === campaignId);
  const free = characters.filter((character) => character.npcCampaignId !== campaignId);

  const toggleListed = async (characterId: string, listed: boolean) => {
    setBusy(true);
    try {
      await setCharacterNpcListed(getSupabaseBrowserClient(), characterId, listed);
      toast({
        tone: 'success',
        title: listed
          ? 'Também aparece em Meus personagens.'
          : 'Saiu de Meus personagens; continua como NPC.',
      });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não deu para alterar',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const link = async (characterId: string, next: string | null) => {
    setBusy(true);
    try {
      await setCharacterNpcCampaign(getSupabaseBrowserClient(), characterId, next);
      setChoice('');
      toast({
        tone: 'success',
        title: next ? 'Ficha guardada como NPC.' : 'Ficha tirada dos NPCs.',
      });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não deu para alterar',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {linked.length ? (
        <ul className="flex flex-col gap-1.5">
          {linked.map((character) => (
            <li
              key={character.id}
              className="flex items-center gap-2 rounded-md border border-line bg-canvas/40 px-3 py-2"
            >
              <Link
                href={characterPath(character.id) as Route}
                className="min-w-0 flex-1 truncate text-sm text-fg-accent hover:underline"
              >
                {character.name}
              </Link>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
                <input
                  type="checkbox"
                  checked={character.npcListed}
                  disabled={busy}
                  onChange={(event) => void toggleListed(character.id, event.target.checked)}
                />
                Adicionar aos personagens
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void link(character.id, null)}
                aria-label={`Tirar ${character.name} dos NPCs`}
                className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">
          Nenhuma ainda. A ficha criada pelo assistente abaixo já fica como NPC desta campanha.
        </p>
      )}
      <Link
        href={`${routes.newCharacter}?npc=${campaignId}` as Route}
        className="flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-fg transition-colors hover:border-line-strong hover:bg-hover"
      >
        <ScrollText className="h-4 w-4" aria-hidden="true" />
        Criar ficha pelo assistente
      </Link>
      {free.length ? (
        <div className="flex gap-2">
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            aria-label="Ficha pessoal para guardar como NPC"
            className="h-9 min-w-0 flex-1 rounded-md border border-line bg-sunken px-2 text-sm text-fg"
          >
            <option value="">Ou guarde uma ficha sua já pronta…</option>
            {free.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!choice || busy}
            onClick={() => void link(choice, campaignId)}
          >
            Guardar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
