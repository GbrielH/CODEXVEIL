import { importOnePageDungeon, type ImportedDungeon } from './dungeon-import';

export type DungeonSize = 'small' | 'medium' | 'large';

const SETTINGS: Record<DungeonSize, { width: number; height: number; rooms: number }> = {
  small: { width: 24, height: 18, rooms: 6 },
  medium: { width: 36, height: 26, rooms: 10 },
  large: { width: 52, height: 38, rooms: 16 },
};

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

function seedNumber(seed: string): number {
  let value = 2166136261;
  for (const char of seed || 'codexveil') {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function randomFrom(seed: string): () => number {
  let state = seedNumber(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const overlaps = (a: Room, b: Room) =>
  a.x - 1 < b.x + b.w && b.x - 1 < a.x + a.w && a.y - 1 < b.y + b.h && b.y - 1 < a.y + a.h;

/** Gera uma masmorra determinística e devolve o mesmo resultado normalizado do importador. */
export function generateDungeon(seed: string, size: DungeonSize): ImportedDungeon {
  const settings = SETTINGS[size];
  const random = randomFrom(seed.trim());
  const integer = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
  const rooms: Room[] = [];
  for (
    let attempt = 0;
    attempt < settings.rooms * 80 && rooms.length < settings.rooms;
    attempt += 1
  ) {
    const room: Room = { w: integer(4, 8), h: integer(4, 7), x: 0, y: 0 };
    room.x = integer(1, Math.max(1, settings.width - room.w - 1));
    room.y = integer(1, Math.max(1, settings.height - room.h - 1));
    if (!rooms.some((current) => overlaps(room, current))) rooms.push(room);
  }
  if (rooms.length < 2) throw new Error('Não foi possível montar a masmorra com esta semente.');

  rooms.sort((a, b) => a.x + a.y - (b.x + b.y));
  const rects: Room[] = [...rooms];
  const doors: { x: number; y: number; type: number }[] = [];
  for (let index = 1; index < rooms.length; index += 1) {
    const before = rooms[index - 1]!;
    const room = rooms[index]!;
    const ax = Math.floor(before.x + before.w / 2);
    const ay = Math.floor(before.y + before.h / 2);
    const bx = Math.floor(room.x + room.w / 2);
    const by = Math.floor(room.y + room.h / 2);
    const horizontalFirst = random() < 0.5;
    const elbowX = horizontalFirst ? bx : ax;
    const elbowY = horizontalFirst ? ay : by;
    rects.push({ x: Math.min(ax, elbowX), y: elbowY, w: Math.abs(elbowX - ax) + 1, h: 1 });
    rects.push({ x: elbowX, y: Math.min(ay, by), w: 1, h: Math.abs(by - ay) + 1 });
    doors.push({ x: ax, y: ay, type: random() < 0.16 ? 2 : 1 });
    doors.push({ x: bx, y: by, type: random() < 0.16 ? 2 : 1 });
  }
  return importOnePageDungeon({
    title: `Masmorra ${seed.trim() || 'Codexveil'}`.slice(0, 80),
    rects,
    doors,
    notes: rooms.map((room, index) => ({
      ref: String(index + 1),
      text: `Sala ${index + 1}`,
      pos: { x: room.x + room.w / 2, y: room.y + room.h / 2 },
    })),
  });
}
