'use client';

import { saveBoardItems } from '@codexveil/database';
import { ArrowUpRight, Frame, Maximize, Minus, Plus, StickyNote, Trash2, Type } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  BOARD_COLORS,
  COLOR_STYLES,
  MIN_SIZE,
  edgePoint,
  newId,
  type BoardColor,
  type BoardItem,
  type BoxItem,
} from './board-items';

interface View {
  x: number;
  y: number;
  zoom: number;
}

type Gesture =
  | { kind: 'pan'; startX: number; startY: number; origin: View }
  | { kind: 'move'; startX: number; startY: number; origins: Map<string, { x: number; y: number }> }
  | { kind: 'resize'; id: string; startX: number; startY: number; w: number; h: number };

const TEXT_SIZES = { sm: 'text-sm', md: 'text-lg', lg: 'text-3xl font-display' } as const;
const clampZoom = (zoom: number) => Math.min(2.5, Math.max(0.2, zoom));

/**
 * Quadro livre (estilo Miro): notas, textos, molduras e setas que o mestre arrasta à vontade.
 * Arrastar o fundo move a visão; a roda do mouse aproxima. Salva sozinho, um instante depois de
 * cada mudança. Para os jogadores (`readOnly`), só dá para mover a visão e aproximar.
 */
export function BoardCanvas({
  boardId,
  initialItems,
  initialVersion,
  readOnly,
}: {
  boardId: string;
  initialItems: BoardItem[];
  initialVersion: number;
  readOnly: boolean;
}) {
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<View>({ x: 40, y: 40, zoom: 1 });
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<string | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const version = useRef(initialVersion);
  const dirty = useRef(false);
  const blocked = useRef(false);

  // Salvamento automático (espera parar de mexer).
  useEffect(() => {
    if (readOnly || !dirty.current || blocked.current) return;
    setStatus('pending');
    const timer = setTimeout(() => {
      setStatus('saving');
      saveBoardItems(getSupabaseBrowserClient(), boardId, items, version.current)
        .then((next) => {
          version.current = next;
          dirty.current = false;
          setStatus('saved');
          setError(null);
        })
        .catch((cause: unknown) => {
          blocked.current = true;
          setStatus('error');
          setError(failureMessage(cause, 'Não foi possível salvar o quadro.'));
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [items, boardId, readOnly]);

  // Aviso ao sair com mudanças não salvas.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const change = useCallback((update: (current: BoardItem[]) => BoardItem[]) => {
    dirty.current = true;
    setItems(update);
  }, []);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = surface.current?.getBoundingClientRect();
    return { x: (clientX - (rect?.left ?? 0) - view.x) / view.zoom, y: (clientY - (rect?.top ?? 0) - view.y) / view.zoom };
  };

  const removeSelected = useCallback(() => {
    if (!selected) return;
    change((current) => current.filter((item) => item.id !== selected && !(item.type === 'arrow' && (item.from === selected || item.to === selected))));
    setSelected(null);
  }, [selected, change]);

  useEffect(() => {
    if (readOnly) return;
    const onKey = (event: KeyboardEvent) => {
      if (editing || (event.target as HTMLElement | null)?.closest('input, textarea')) return;
      if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
      if (event.key === 'Escape') {
        setSelected(null);
        setConnectFrom(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, editing, removeSelected]);

  // ---- Gestos ----
  const onPointerMove = (event: ReactPointerEvent) => {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.kind === 'pan') {
      setView({ ...current.origin, x: current.origin.x + dx, y: current.origin.y + dy });
    } else if (current.kind === 'move') {
      change((list) =>
        list.map((item) => {
          const origin = current.origins.get(item.id);
          return origin && item.type !== 'arrow'
            ? { ...item, x: Math.round(origin.x + dx / view.zoom), y: Math.round(origin.y + dy / view.zoom) }
            : item;
        }),
      );
    } else {
      change((list) =>
        list.map((item) =>
          item.id === current.id && item.type !== 'arrow'
            ? { ...item, w: Math.max(MIN_SIZE, Math.round(current.w + dx / view.zoom)), h: Math.max(MIN_SIZE, Math.round(current.h + dy / view.zoom)) }
            : item,
        ),
      );
    }
  };
  const endGesture = () => {
    gesture.current = null;
  };

  const startPan = (event: ReactPointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    setSelected(null);
    setEditing(null);
    gesture.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, origin: view };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const startMove = (event: ReactPointerEvent, item: BoxItem) => {
    event.stopPropagation();
    if (readOnly) return startPan(event);
    // Modo seta: o primeiro clique escolhe a origem; o segundo, o destino.
    if (connectFrom !== undefined) {
      if (connectFrom === null) setConnectFrom(item.id);
      else if (connectFrom !== item.id) {
        const from = connectFrom;
        change((list) => [...list, { id: newId(), type: 'arrow', from, to: item.id }]);
        setConnectFrom(undefined);
      }
      return;
    }
    setSelected(item.id);
    if (editing === item.id) return;
    const origins = new Map<string, { x: number; y: number }>([[item.id, { x: item.x, y: item.y }]]);
    // Moldura leva junto o que está dentro dela.
    if (item.type === 'frame') {
      for (const other of items) {
        if (other.type === 'arrow' || other.id === item.id) continue;
        if (other.x >= item.x && other.y >= item.y && other.x + other.w <= item.x + item.w && other.y + other.h <= item.y + item.h) {
          origins.set(other.id, { x: other.x, y: other.y });
        }
      }
    }
    gesture.current = { kind: 'move', startX: event.clientX, startY: event.clientY, origins };
    surface.current?.setPointerCapture(event.pointerId);
  };

  const startResize = (event: ReactPointerEvent, item: BoxItem) => {
    event.stopPropagation();
    gesture.current = { kind: 'resize', id: item.id, startX: event.clientX, startY: event.clientY, w: item.w, h: item.h };
    surface.current?.setPointerCapture(event.pointerId);
  };

  const onWheel = (event: React.WheelEvent) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    const zoom = clampZoom(view.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    setView({ zoom, x: px - ((px - view.x) / view.zoom) * zoom, y: py - ((py - view.y) / view.zoom) * zoom });
  };

  const zoomBy = (factor: number) => {
    const rect = surface.current?.getBoundingClientRect();
    const px = (rect?.width ?? 800) / 2;
    const py = (rect?.height ?? 600) / 2;
    const zoom = clampZoom(view.zoom * factor);
    setView({ zoom, x: px - ((px - view.x) / view.zoom) * zoom, y: py - ((py - view.y) / view.zoom) * zoom });
  };

  const fit = () => {
    const boxes = items.filter((item): item is BoxItem => item.type !== 'arrow');
    const rect = surface.current?.getBoundingClientRect();
    if (!boxes.length || !rect) return setView({ x: 40, y: 40, zoom: 1 });
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const zoom = clampZoom(Math.min((rect.width - 80) / (maxX - minX), (rect.height - 80) / (maxY - minY)));
    setView({ zoom, x: 40 - minX * zoom + (rect.width - 80 - (maxX - minX) * zoom) / 2, y: 40 - minY * zoom });
  };

  // ---- Criação ----
  const [paint, setPaint] = useState<BoardColor>('amber');
  const add = (type: 'note' | 'text' | 'frame') => {
    const rect = surface.current?.getBoundingClientRect();
    const center = toWorld((rect?.left ?? 0) + (rect?.width ?? 800) / 2, (rect?.top ?? 0) + (rect?.height ?? 600) / 2);
    const id = newId();
    const item: BoxItem =
      type === 'note'
        ? { id, type, x: center.x - 100, y: center.y - 70, w: 200, h: 140, color: paint, text: '' }
        : type === 'text'
          ? { id, type, x: center.x - 120, y: center.y - 30, w: 240, h: 60, text: '', size: 'md' }
          : { id, type, x: center.x - 250, y: center.y - 175, w: 500, h: 350, color: paint, title: 'Moldura' };
    change((list) => (type === 'frame' ? [item, ...list] : [...list, item]));
    setSelected(id);
    if (type !== 'frame') setEditing(id);
  };

  const patch = (id: string, values: Partial<BoxItem>) =>
    change((list) => list.map((item) => (item.id === id && item.type !== 'arrow' ? ({ ...item, ...values } as BoxItem) : item)));

  const selectedItem = items.find((item) => item.id === selected);
  const boxes = new Map(items.filter((item): item is BoxItem => item.type !== 'arrow').map((item) => [item.id, item]));
  const frames = items.filter((item) => item.type === 'frame');
  const others = items.filter((item): item is BoxItem => item.type === 'note' || item.type === 'text');
  const arrows = items.filter((item) => item.type === 'arrow');

  const toolButton =
    'inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm text-fg hover:bg-hover disabled:opacity-50 aria-pressed:border-fg-brand aria-pressed:bg-hover';

  const renderBox = (item: BoxItem) => {
    const isSelected = selected === item.id;
    const isEditing = editing === item.id;
    const source = connectFrom === item.id;
    const ring = isSelected || source ? 'ring-2 ring-fg-brand' : '';
    return (
      <div
        key={item.id}
        style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
        className={`absolute touch-none ${item.type === 'frame' ? '' : 'z-10'} ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={(event) => startMove(event, item)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (!readOnly) setEditing(item.id);
        }}
      >
        {item.type === 'frame' ? (
          <div className={`h-full w-full rounded-lg border-2 border-dashed ${COLOR_STYLES[item.color].frame} ${ring}`}>
            {isEditing ? (
              <input
                autoFocus
                value={item.title}
                maxLength={120}
                onChange={(event) => patch(item.id, { title: event.target.value })}
                onBlur={() => setEditing(null)}
                onKeyDown={(event) => event.key === 'Enter' && setEditing(null)}
                onPointerDown={(event) => event.stopPropagation()}
                className="m-2 rounded bg-surface px-2 py-1 text-sm text-fg"
              />
            ) : (
              <p className="px-3 py-2 font-display text-sm text-fg-secondary">{item.title}</p>
            )}
          </div>
        ) : (
          <div
            className={`h-full w-full overflow-hidden rounded-md ${
              item.type === 'note' ? `${COLOR_STYLES[item.color].note} p-3 shadow-lg` : 'p-1 text-fg'
            } ${ring}`}
          >
            {isEditing ? (
              <textarea
                autoFocus
                value={item.text}
                maxLength={5000}
                onChange={(event) => patch(item.id, { text: event.target.value })}
                onBlur={() => setEditing(null)}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="Escreva…"
                className={`h-full w-full resize-none bg-transparent outline-none ${item.type === 'text' ? TEXT_SIZES[item.size] : 'text-sm'}`}
              />
            ) : (
              <p className={`h-full whitespace-pre-wrap break-words select-none ${item.type === 'text' ? TEXT_SIZES[item.size] : 'text-sm'}`}>
                {item.text || (readOnly ? '' : <span className="opacity-50">Clique duas vezes para escrever</span>)}
              </p>
            )}
          </div>
        )}
        {isSelected && !readOnly && !isEditing ? (
          <span
            role="presentation"
            onPointerDown={(event) => startResize(event, item)}
            className="absolute -right-1.5 -bottom-1.5 z-20 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-fg-brand bg-raised"
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Ferramentas do quadro">
          <button type="button" className={toolButton} onClick={() => add('note')}>
            <StickyNote className="h-4 w-4" aria-hidden="true" /> Nota
          </button>
          <button type="button" className={toolButton} onClick={() => add('text')}>
            <Type className="h-4 w-4" aria-hidden="true" /> Texto
          </button>
          <button type="button" className={toolButton} onClick={() => add('frame')}>
            <Frame className="h-4 w-4" aria-hidden="true" /> Moldura
          </button>
          <button
            type="button"
            className={toolButton}
            aria-pressed={connectFrom !== undefined}
            onClick={() => setConnectFrom((current) => (current === undefined ? null : undefined))}
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> Seta
          </button>
          <span className="flex items-center gap-1" aria-label="Cor">
            {BOARD_COLORS.map((name) => (
              <button
                key={name}
                type="button"
                aria-label={`Cor ${name}`}
                aria-pressed={paint === name}
                onClick={() => {
                  setPaint(name);
                  if (selectedItem && (selectedItem.type === 'note' || selectedItem.type === 'frame')) patch(selectedItem.id, { color: name });
                }}
                className={`h-6 w-6 rounded-full border-2 ${COLOR_STYLES[name].swatch} ${paint === name ? 'border-fg' : 'border-transparent'}`}
              />
            ))}
          </span>
          {selectedItem?.type === 'text' ? (
            <select
              aria-label="Tamanho do texto"
              value={selectedItem.size}
              onChange={(event) => patch(selectedItem.id, { size: event.target.value as 'sm' | 'md' | 'lg' })}
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg"
            >
              <option value="sm">Pequeno</option>
              <option value="md">Médio</option>
              <option value="lg">Título</option>
            </select>
          ) : null}
          <button type="button" className={toolButton} disabled={!selected} onClick={removeSelected}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar
          </button>
          <span className="ml-auto text-xs text-fg-muted" role="status">
            {status === 'saved' ? 'Salvo' : status === 'error' ? 'Não salvo' : 'Salvando…'}
          </span>
        </div>
      )}
      {connectFrom !== undefined ? (
        <p className="text-xs text-fg-muted">
          {connectFrom === null ? 'Clique no bloco de origem da seta.' : 'Agora clique no bloco de destino. Esc cancela.'}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div
        ref={surface}
        onPointerDown={startPan}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onWheel={onWheel}
        className="relative h-[70vh] min-h-96 touch-none overflow-hidden rounded-lg border border-line bg-surface select-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(148 130 190 / 0.25) 1px, transparent 1px)',
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          {frames.map((item) => renderBox(item as BoxItem))}
          <svg className="pointer-events-none absolute top-0 left-0 z-[5] overflow-visible" width="1" height="1" aria-hidden="true">
            <defs>
              <marker id={`seta-${boardId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" className="text-fg-secondary" />
              </marker>
            </defs>
            {arrows.map((arrow) => {
              const from = boxes.get(arrow.from);
              const to = boxes.get(arrow.to);
              if (!from || !to) return null;
              const start = edgePoint(from, { x: to.x + to.w / 2, y: to.y + to.h / 2 });
              const end = edgePoint(to, { x: from.x + from.w / 2, y: from.y + from.h / 2 });
              const isSelected = selected === arrow.id;
              return (
                <g key={arrow.id} className="text-fg-secondary">
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="transparent"
                    strokeWidth={14}
                    className={readOnly ? '' : 'pointer-events-auto cursor-pointer'}
                    onPointerDown={(event) => {
                      if (readOnly) return;
                      event.stopPropagation();
                      setSelected(arrow.id);
                    }}
                  />
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="currentColor"
                    strokeWidth={isSelected ? 3 : 2}
                    className={isSelected ? 'text-fg-brand' : ''}
                    markerEnd={`url(#seta-${boardId})`}
                  />
                </g>
              );
            })}
          </svg>
          {others.map(renderBox)}
        </div>

        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-md border border-line bg-raised p-1 shadow" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" aria-label="Afastar" className="rounded p-1.5 hover:bg-hover" onClick={() => zoomBy(1 / 1.2)}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="w-12 text-center text-xs text-fg-muted tabular-nums">{Math.round(view.zoom * 100)}%</span>
          <button type="button" aria-label="Aproximar" className="rounded p-1.5 hover:bg-hover" onClick={() => zoomBy(1.2)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Ver tudo" title="Ver tudo" className="rounded p-1.5 hover:bg-hover" onClick={fit}>
            <Maximize className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-fg-muted">
            {readOnly ? 'O quadro está vazio.' : 'Quadro vazio. Use Nota, Texto ou Moldura acima; arraste o fundo para mover a visão.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
