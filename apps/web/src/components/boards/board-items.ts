/** Blocos do quadro livre. O banco guarda a lista como JSON; aqui ela é conferida ao abrir. */

export const BOARD_COLORS = ['amber', 'violet', 'sky', 'emerald', 'rose', 'slate'] as const;
export type BoardColor = (typeof BOARD_COLORS)[number];

/** Fundo e borda de cada cor (notas e molduras). */
export const COLOR_STYLES: Record<BoardColor, { note: string; frame: string; swatch: string }> = {
  amber: { note: 'bg-amber-200 text-stone-900', frame: 'border-amber-400/70 bg-amber-400/5', swatch: 'bg-amber-300' },
  violet: { note: 'bg-violet-200 text-stone-900', frame: 'border-violet-400/70 bg-violet-400/5', swatch: 'bg-violet-300' },
  sky: { note: 'bg-sky-200 text-stone-900', frame: 'border-sky-400/70 bg-sky-400/5', swatch: 'bg-sky-300' },
  emerald: { note: 'bg-emerald-200 text-stone-900', frame: 'border-emerald-400/70 bg-emerald-400/5', swatch: 'bg-emerald-300' },
  rose: { note: 'bg-rose-200 text-stone-900', frame: 'border-rose-400/70 bg-rose-400/5', swatch: 'bg-rose-300' },
  slate: { note: 'bg-slate-200 text-stone-900', frame: 'border-slate-400/70 bg-slate-400/5', swatch: 'bg-slate-300' },
};

interface BoxBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface NoteItem extends BoxBase {
  type: 'note';
  color: BoardColor;
  text: string;
}
export interface TextItem extends BoxBase {
  type: 'text';
  text: string;
  size: 'sm' | 'md' | 'lg';
}
export interface FrameItem extends BoxBase {
  type: 'frame';
  color: BoardColor;
  title: string;
}
export interface ImageItem extends BoxBase {
  type: 'image';
  /** Caminho no bucket `campaign-media` (`campaigns/<campanha>/boards/<arquivo>`). */
  path: string;
}
export interface ArrowItem {
  id: string;
  type: 'arrow';
  from: string;
  to: string;
}
export type BoxItem = NoteItem | TextItem | FrameItem | ImageItem;
export type BoardItem = BoxItem | ArrowItem;

export const MIN_SIZE = 60;
const MAX_TEXT = 5000;

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(-100_000, Math.min(100_000, value)) : fallback;
const str = (value: unknown, max = MAX_TEXT) => (typeof value === 'string' ? value.slice(0, max) : '');
const color = (value: unknown): BoardColor => (BOARD_COLORS as readonly unknown[]).includes(value) ? (value as BoardColor) : 'amber';

/** Lê a lista gravada, descartando o que não for um bloco conhecido. */
export function parseBoardItems(raw: unknown): BoardItem[] {
  if (!Array.isArray(raw)) return [];
  const items: BoardItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Record<string, unknown>;
    const id = str(value.id, 64);
    if (!id) continue;
    const box = {
      id,
      x: num(value.x, 0),
      y: num(value.y, 0),
      w: Math.max(MIN_SIZE, num(value.w, 200)),
      h: Math.max(MIN_SIZE, num(value.h, 140)),
    };
    if (value.type === 'note') items.push({ ...box, type: 'note', color: color(value.color), text: str(value.text) });
    else if (value.type === 'text')
      items.push({ ...box, type: 'text', text: str(value.text), size: value.size === 'sm' || value.size === 'lg' ? value.size : 'md' });
    else if (value.type === 'frame') items.push({ ...box, type: 'frame', color: color(value.color), title: str(value.title, 120) });
    else if (value.type === 'image' && typeof value.path === 'string' && /^campaigns\/[0-9a-f-]{36}\/boards\/[\w.-]+$/.test(value.path))
      items.push({ ...box, type: 'image', path: value.path });
    else if (value.type === 'arrow' && typeof value.from === 'string' && typeof value.to === 'string')
      items.push({ id, type: 'arrow', from: value.from, to: value.to });
  }
  // Setas só entre blocos que existem.
  const ids = new Set(items.filter((item) => item.type !== 'arrow').map((item) => item.id));
  return items.filter((item) => item.type !== 'arrow' || (ids.has(item.from) && ids.has(item.to) && item.from !== item.to));
}

/** Ponto onde a reta do centro de `box` até `toward` cruza a borda de `box`. */
export function edgePoint(box: BoxBase, toward: { x: number; y: number }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(Math.abs(box.w / 2 / (dx || 1e-9)), Math.abs(box.h / 2 / (dy || 1e-9)));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
