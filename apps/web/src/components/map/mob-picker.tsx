'use client';

import { getSessionCast, setSessionCastMember, type SessionCast } from '@codexveil/database';
import type { TokenSize } from '@codexveil/domain';
import { Plus, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export interface MobEntry {
  /** `creature`: registro da biblioteca; `character`: NPC com ficha completa. */
  kind: 'creature' | 'character';
  id: string;
  name: string;
  size: TokenSize;
}

const EMPTY: SessionCast = { creatureIds: [], characterIds: [] };

/**
 * NPCs e monstros para pôr no mapa. Por padrão mostra só os separados para a sessão (estrela);
 * "Todos" abre a biblioteca inteira, com busca pelo nome.
 */
export function MobPicker({
  campaignId,
  sessionId,
  mobs,
  onAdd,
}: {
  campaignId: string;
  sessionId: string;
  mobs: MobEntry[];
  onAdd: (mob: MobEntry) => void;
}) {
  const { toast } = useToast();
  const [cast, setCast] = useState<SessionCast>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    getSessionCast(getSupabaseBrowserClient(), sessionId)
      .then((value) => {
        if (!alive) return;
        setCast(value);
        // Sessão sem elenco ainda: começa mostrando todos.
        setShowAll(value.creatureIds.length + value.characterIds.length === 0);
      })
      .catch(() => alive && setShowAll(true))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const inCast = (mob: MobEntry) =>
    (mob.kind === 'creature' ? cast.creatureIds : cast.characterIds).includes(mob.id);

  const shown = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return mobs.filter(
      (mob) =>
        (showAll || term || inCast(mob)) &&
        (!term || mob.name.toLocaleLowerCase('pt-BR').includes(term)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobs, query, showAll, cast]);

  const toggleCast = async (mob: MobEntry) => {
    const included = !inCast(mob);
    const key = mob.kind === 'creature' ? 'creatureIds' : 'characterIds';
    setCast((current) => ({
      ...current,
      [key]: included ? [...current[key], mob.id] : current[key].filter((id) => id !== mob.id),
    }));
    try {
      await setSessionCastMember(getSupabaseBrowserClient(), {
        sessionId,
        campaignId,
        ...(mob.kind === 'creature' ? { creatureId: mob.id } : { characterId: mob.id }),
        included,
      });
    } catch (error) {
      setCast((current) => ({
        ...current,
        [key]: included ? current[key].filter((id) => id !== mob.id) : [...current[key], mob.id],
      }));
      toast({
        tone: 'danger',
        title: 'O elenco da sessão não mudou',
        description: failureMessage(error, 'Tente novamente.'),
      });
    }
  };

  if (!mobs.length) {
    return (
      <p className="text-xs text-fg-muted">
        Sem NPCs ou monstros na biblioteca: crie-os na aba Biblioteca para colocá-los aqui.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">NPCs e monstros</span>
        <div className="flex rounded-md border border-line text-xs" role="group" aria-label="Lista">
          {(
            [
              [false, 'Da sessão'],
              [true, 'Todos'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={showAll === value}
              onClick={() => setShowAll(value)}
              className={cx(
                'px-2 py-1 transition-colors first:rounded-l-md last:rounded-r-md',
                showAll === value
                  ? 'bg-wine-900/60 text-fg-accent'
                  : 'text-fg-secondary hover:bg-hover',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pelo nome"
          aria-label="Buscar NPCs e monstros"
          className="h-8 w-full rounded-md border border-line bg-sunken pr-2 pl-8 text-sm text-fg placeholder:text-fg-muted focus:border-fg-brand focus:outline-none"
        />
      </div>
      {loaded && !shown.length ? (
        <p className="text-xs text-fg-muted">
          {query.trim()
            ? 'Nada encontrado.'
            : 'Nenhum separado para esta sessão. Em “Todos”, marque a estrela dos que vão aparecer.'}
        </p>
      ) : null}
      <p className="text-xs text-fg-muted">
        Entram ocultos. Para os jogadores verem nome e foto, selecione o token e desmarque “Oculto dos
        jogadores”.
      </p>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {shown.map((mob) => {
          const starred = inCast(mob);
          return (
            <li key={`${mob.kind}:${mob.id}`} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void toggleCast(mob)}
                aria-pressed={starred}
                aria-label={
                  starred ? `Tirar ${mob.name} da sessão` : `Separar ${mob.name} para a sessão`
                }
                className="rounded p-1 hover:bg-hover"
              >
                <Star
                  className={cx(
                    'h-4 w-4',
                    starred ? 'fill-current text-fg-accent' : 'text-fg-muted',
                  )}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={() => onAdd(mob)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm text-fg hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate">
                  {mob.name}
                  {mob.kind === 'character' ? (
                    <span className="ml-1 text-xs text-fg-muted">(ficha completa)</span>
                  ) : null}
                </span>
                <Plus className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
