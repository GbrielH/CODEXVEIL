'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

type Panel = 'character' | 'dice' | 'gm' | 'session';
type Saved = { left: number; right: number; closed: Panel[] };

const defaults: Saved = { left: 288, right: 352, closed: [] };

function store(key: string, value: Saved) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Navegação privada ou armazenamento bloqueado: o layout só não fica salvo.
  }
}

/** Layout persistente da mesa de jogo. Os filhos mantêm suas próprias regras e assinaturas. */
export function GameWorkspace({
  campaignId,
  map,
  character,
  initiative,
  dice,
  feed,
  table,
  gm,
  session,
}: {
  campaignId: string;
  map: ReactNode;
  character: ReactNode;
  initiative: ReactNode;
  dice: ReactNode;
  feed: ReactNode;
  /** Mural de rolagens, na coluna da direita (abaixo dos dados). */
  table?: ReactNode;
  gm?: ReactNode;
  session: ReactNode;
}) {
  const key = `codexveil:jogo:${campaignId}`;
  const [saved, setSaved] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const left = useRef<HTMLElement>(null);
  const right = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSaved({
          ...defaults,
          ...(JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<Saved>),
        });
      } catch {
        setSaved(defaults);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    const observer = new ResizeObserver(() => {
      const next = {
        ...saved,
        left: Math.round(left.current?.getBoundingClientRect().width ?? saved.left),
        right: Math.round(right.current?.getBoundingClientRect().width ?? saved.right),
      };
      store(key, next);
    });
    if (left.current) observer.observe(left.current);
    if (right.current) observer.observe(right.current);
    return () => observer.disconnect();
  }, [key, saved, loaded]);

  const panel = (id: Panel, title: string, content: ReactNode) => {
    const open = !saved.closed.includes(id);
    return (
      <details
        open={open}
        onToggle={(event) => {
          const isOpen = event.currentTarget.open;
          setSaved((current) => {
            const closed = isOpen
              ? current.closed.filter((entry) => entry !== id)
              : [...new Set([...current.closed, id])];
            const next = { ...current, closed };
            store(key, next);
            return next;
          });
        }}
        className="rounded-lg border border-line bg-card p-3"
      >
        <summary className="cursor-pointer font-display text-fg-accent">{title}</summary>
        <div className="mt-3 min-w-0">{content}</div>
      </details>
    );
  };

  return (
    <div
      data-game-workspace
      className="grid min-w-0 gap-4 xl:grid-cols-[var(--game-left)_minmax(0,1fr)_var(--game-right)]"
      style={
        {
          '--game-left': `${saved.left}px`,
          '--game-right': `${saved.right}px`,
        } as React.CSSProperties
      }
    >
      <aside
        data-game-panel
        ref={left}
        className="flex min-w-0 max-w-[42vw] resize-x flex-col gap-4 overflow-auto xl:w-[var(--game-left)]"
      >
        {panel('character', 'Personagem', character)}
        {initiative}
        {panel('session', 'Sessão', session)}
      </aside>
      {/* Mesa de dados logo abaixo do mapa, na mesma largura: sem espaço vazio embaixo. */}
      <main data-game-map className="flex min-w-0 flex-col gap-4 overflow-hidden">
        {map}
        {feed}
      </main>
      <aside
        data-game-panel
        ref={right}
        className="flex min-w-0 max-w-[48vw] resize-x flex-col gap-4 overflow-auto xl:w-[var(--game-right)]"
      >
        {panel('dice', 'Dados', dice)}
        {table}
        {gm ? panel('gm', 'Atalhos do mestre', gm) : null}
      </aside>
      <style>{`@media (max-width: 1279px){[data-game-panel]{max-width:none!important;width:100%!important;resize:none}[data-game-workspace]{grid-template-columns:minmax(0,1fr)!important}[data-game-map]{order:-1}}`}</style>
    </div>
  );
}
