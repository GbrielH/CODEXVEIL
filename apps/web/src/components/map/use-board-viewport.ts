'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CELL } from './map-board';

const STEP = 1.15;

/**
 * Zoom e tela cheia do tabuleiro: a roda do mouse aproxima/afasta mantendo o ponto sob o cursor
 * no lugar, e a tela cheia ajusta o zoom para o mapa inteiro caber (volta ao zoom anterior ao sair).
 */
export function useBoardViewport({
  boardAreaRef,
  scrollRef,
  cols,
  rows,
  min,
  max,
}: {
  /** Elemento que vai para a tela cheia. */
  boardAreaRef: RefObject<HTMLDivElement | null>;
  /** Área com rolagem que contém o tabuleiro. */
  scrollRef: RefObject<HTMLDivElement | null>;
  cols: number;
  rows: number;
  min: number;
  max: number;
}) {
  const [zoom, setZoomState] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const beforeFullscreen = useRef(1);
  // Ponto que deve continuar sob o cursor depois do próximo zoom (fração do tabuleiro + posição na tela).
  const anchor = useRef<{ fx: number; fy: number; x: number; y: number } | null>(null);
  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);
  const setZoom = useCallback(
    (update: (value: number) => number) => setZoomState((value) => clamp(update(value))),
    [clamp],
  );

  const fit = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll || !cols || !rows) return;
    setZoomState(
      clamp(Math.min(scroll.clientWidth / (cols * CELL), scroll.clientHeight / (rows * CELL))),
    );
  }, [scrollRef, cols, rows, clamp]);

  const zoomRef = useRef(zoom);
  const fullscreenRef = useRef(false);
  useEffect(() => {
    const sync = () => {
      const on =
        document.fullscreenElement !== null && document.fullscreenElement === boardAreaRef.current;
      if (on === fullscreenRef.current) return;
      fullscreenRef.current = on;
      setFullscreen(on);
      if (on) {
        beforeFullscreen.current = zoomRef.current;
        // Espera o layout de tela cheia para medir a área disponível.
        requestAnimationFrame(fit);
      } else setZoomState(beforeFullscreen.current);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [boardAreaRef, fit]);

  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const scroll = scrollRef.current;
    const point = anchor.current;
    const board = scroll?.querySelector('svg');
    anchor.current = null;
    if (!scroll || !point || !board) return;
    const rect = board.getBoundingClientRect();
    scroll.scrollLeft += rect.left + point.fx * rect.width - point.x;
    scroll.scrollTop += rect.top + point.fy * rect.height - point.y;
  }, [zoom, scrollRef]);

  // Roda do mouse: o listener precisa ser não passivo para impedir a rolagem da página.
  // (`cols`/`rows` nas dependências: a área de rolagem só existe depois que o mapa carrega.)
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const onWheel = (event: WheelEvent) => {
      const board = scroll.querySelector('svg');
      if (!board || event.deltaY === 0) return;
      event.preventDefault();
      const rect = board.getBoundingClientRect();
      anchor.current = {
        fx: (event.clientX - rect.left) / rect.width,
        fy: (event.clientY - rect.top) / rect.height,
        x: event.clientX,
        y: event.clientY,
      };
      // Trackpad (pinça) manda passos pequenos e frequentes; mouse, passos de ~100.
      const factor =
        Math.abs(event.deltaY) < 50
          ? Math.exp(-event.deltaY * 0.01)
          : event.deltaY < 0
            ? STEP
            : 1 / STEP;
      setZoomState((value) => clamp(value * factor));
    };
    scroll.addEventListener('wheel', onWheel, { passive: false });
    return () => scroll.removeEventListener('wheel', onWheel);
  }, [scrollRef, clamp, cols, rows]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boardAreaRef.current?.requestFullscreen();
  }, [boardAreaRef]);

  return { zoom, setZoom, fullscreen, toggleFullscreen };
}
