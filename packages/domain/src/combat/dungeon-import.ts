/**
 * Importação de masmorras do One Page Dungeon (watabou.github.io), no formato JSON que o gerador
 * exporta: `rects` (salas e corredores, em quadrados), `doors` (posição e direção) e `notes`
 * (texto, número `ref` e posição `pos`). Vira um mapa do Codexveil: grade do tamanho certo,
 * paredes em volta do chão (névoa e linha de visão passam a funcionar), números das salas
 * visíveis a todos e a legenda só para o mestre.
 *
 * O formato não tem documentação oficial: o leitor é tolerante e ignora o que não reconhece.
 */

export interface DungeonPoint {
  x: number;
  y: number;
}

export interface ImportedDungeon {
  title: string;
  cols: number;
  rows: number;
  /** Segmentos de parede em quadrados: [x1, y1, x2, y2]. */
  walls: [number, number, number, number][];
  /** Números das salas, onde aparecem no mapa. */
  labels: { ref: string; x: number; y: number }[];
  /** Legenda (só para o mestre): número da sala → texto. */
  legend: { ref: string; text: string }[];
  /** Quantas salas/corredores e portas foram lidos (para o resumo da importação). */
  stats: { rects: number; doors: number; notes: number };
}

/** Margem de quadrados em volta da masmorra. */
const MARGIN = 2;
/** Limites da grade do Codexveil. */
const MAX_SIDE = 100;

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function readRects(input: unknown): { x: number; y: number; w: number; h: number }[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    const rect = item as Record<string, unknown>;
    const x = num(rect.x);
    const y = num(rect.y);
    const w = num(rect.w);
    const h = num(rect.h);
    return x === null || y === null || w === null || h === null || w <= 0 || h <= 0
      ? []
      : [{ x, y, w, h }];
  });
}

/**
 * Converte o JSON do One Page Dungeon. Lança erro com mensagem em português quando o arquivo
 * não parece uma masmorra do gerador.
 */
export function importOnePageDungeon(data: unknown): ImportedDungeon {
  if (!data || typeof data !== 'object') throw new Error('O arquivo não é um JSON de masmorra.');
  const source = data as Record<string, unknown>;
  const rects = readRects(source.rects);
  if (rects.length === 0)
    throw new Error('Não achei salas no arquivo. Exporte em JSON no One Page Dungeon.');

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  const offsetX = MARGIN - minX;
  const offsetY = MARGIN - minY;
  const cols = Math.ceil(maxX - minX) + MARGIN * 2;
  const rows = Math.ceil(maxY - minY) + MARGIN * 2;
  if (cols > MAX_SIDE || rows > MAX_SIDE)
    throw new Error(
      `A masmorra tem ${cols}×${rows} quadrados; o limite é ${MAX_SIDE}×${MAX_SIDE}.`,
    );

  // Chão: cada quadrado coberto por uma sala ou corredor.
  const floor = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (const rect of rects) {
    for (let x = Math.round(rect.x + offsetX); x < Math.round(rect.x + rect.w + offsetX); x += 1) {
      for (let y = Math.round(rect.y + offsetY); y < Math.round(rect.y + rect.h + offsetY); y += 1)
        floor.add(key(x, y));
    }
  }
  const isFloor = (x: number, y: number) => floor.has(key(x, y));

  // Paredes nas bordas entre chão e fora do chão; as portas ligam salas por quadrados de chão, então
  // a passagem já fica aberta. Segmentos vizinhos na mesma linha são unidos.
  const horizontal = new Map<number, number[]>(); // y da borda → x de cada trecho de 1 quadrado
  const vertical = new Map<number, number[]>(); // x da borda → y de cada trecho
  const push = (map: Map<number, number[]>, line: number, start: number) =>
    map.set(line, [...(map.get(line) ?? []), start]);
  for (const cell of floor) {
    const [x, y] = cell.split(',').map(Number) as [number, number];
    if (!isFloor(x, y - 1)) push(horizontal, y, x);
    if (!isFloor(x, y + 1)) push(horizontal, y + 1, x);
    if (!isFloor(x - 1, y)) push(vertical, x, y);
    if (!isFloor(x + 1, y)) push(vertical, x + 1, y);
  }
  const walls: [number, number, number, number][] = [];
  const merge = (
    map: Map<number, number[]>,
    build: (line: number, from: number, to: number) => [number, number, number, number],
  ) => {
    for (const [line, starts] of map) {
      const sorted = [...new Set(starts)].sort((a, b) => a - b);
      let from = sorted[0]!;
      let previous = from;
      for (const start of sorted.slice(1)) {
        if (start !== previous + 1) {
          walls.push(build(line, from, previous + 1));
          from = start;
        }
        previous = start;
      }
      walls.push(build(line, from, previous + 1));
    }
  };
  merge(horizontal, (y, from, to) => [from, y, to, y]);
  merge(vertical, (x, from, to) => [x, from, x, to]);

  const labels: ImportedDungeon['labels'] = [];
  const legend: ImportedDungeon['legend'] = [];
  const notes = Array.isArray(source.notes) ? source.notes : [];
  notes.forEach((item, index) => {
    const note = item as Record<string, unknown>;
    const text = typeof note.text === 'string' ? note.text.trim() : '';
    const ref =
      typeof note.ref === 'string' || typeof note.ref === 'number'
        ? String(note.ref)
        : String(index + 1);
    const pos = (note.pos ?? {}) as Record<string, unknown>;
    const x = num(pos.x);
    const y = num(pos.y);
    if (x !== null && y !== null) labels.push({ ref, x: x + offsetX, y: y + offsetY });
    if (text) legend.push({ ref, text: text.slice(0, 2000) });
  });

  return {
    title:
      typeof source.title === 'string' && source.title.trim()
        ? source.title.trim().slice(0, 80)
        : 'Masmorra',
    cols,
    rows,
    walls,
    labels,
    legend,
    stats: {
      rects: rects.length,
      doors: Array.isArray(source.doors) ? source.doors.length : 0,
      notes: notes.length,
    },
  };
}
