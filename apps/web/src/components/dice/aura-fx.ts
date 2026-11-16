/**
 * Efeitos das auras dos dados, desenhados num canvas 2D por cima da cena:
 *   * em volta do dado, uma aura "emanando" da borda (como chakra) no elemento escolhido, com
 *     detalhes do tema (raios, jatos de sangue, flocos, runas girando, fumaça, luz, engrenagens,
 *     folhas, chamas, escamas), acompanhando o dado na tela;
 *   * no crítico, o tema toma a tela inteira por alguns segundos, com "CRÍTICO!" no centro e som.
 * Respeita "movimento reduzido": nesse caso não desenha nada (o som também não toca).
 */
import { diceAuraLabels, type DiceAura } from '@codexveil/validation';
import { AURA_TIMINGS, playCriticalSound, playFailSound } from './aura-sound';

type Point = { x: number; y: number };
/** Dado na tela: centro e raio aproximado (em pixels). */
export type AuraPoint = Point & { r: number };

type Kind =
  | 'wisp'
  | 'bolt'
  | 'drop'
  | 'splat'
  | 'flake'
  | 'mote'
  | 'rune'
  | 'smoke'
  | 'spark'
  | 'ray'
  | 'beam'
  | 'gear'
  | 'leaf'
  | 'firefly'
  | 'flame'
  | 'ember'
  | 'scale'
  | 'feather'
  | 'bone'
  | 'skull'
  | 'card'
  | 'pixel'
  | 'bubble'
  | 'fish'
  | 'coin'
  | 'fly'
  | 'bat'
  | 'paw'
  | 'confetti'
  | 'rock'
  | 'shard'
  | 'scratch';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  vr: number;
  gravity: number;
  drag: number;
  color: string;
  glyph?: string;
  path?: Point[];
}

/** Intensidade da aura em volta do dado (0 a 1). */
const AURA_INTENSITY = 0.5;

/** Limite de partículas vivas (por efeito). */
const MAX_PARTICLES = 450;

// ---------------------------------------------------------------------------------------------
// Desempenho: brilhos e degradês são desenhados uma vez em canvases pequenos ("sprites") e só
// copiados a cada quadro. Desenhar `shadowBlur` ou criar degradês por partícula travava o PC.
// ---------------------------------------------------------------------------------------------

const spriteCache = new Map<string, HTMLCanvasElement>();

function sprite(
  key: string,
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
) {
  let canvas = spriteCache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) paint(ctx, size);
    spriteCache.set(key, canvas);
  }
  return canvas;
}

/** Bolha suave de uma cor (labaredas, chamas, brilho de pontos). */
function softSprite(rgb: string) {
  return sprite(`soft:${rgb}`, 64, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${rgb}, 1)`);
    g.addColorStop(0.4, `rgba(${rgb}, 0.45)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Ponto brilhante: miolo claro e halo na cor. */
function glowSprite(rgb: string) {
  return sprite(`glow:${rgb}`, 32, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.18, `rgba(${rgb}, 1)`);
    g.addColorStop(0.45, `rgba(${rgb}, 0.35)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Fumaça escura. */
function smokeSprite(rgb: string) {
  return sprite(`smoke:${rgb}`, 64, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(8, 4, 14, 0.75)');
    g.addColorStop(0.6, `rgba(${rgb}, 0.35)`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Chama em 8 tons (amarela no começo da vida, vermelha no fim). */
function flameSprite(step: number) {
  return sprite(`flame:${step}`, 64, (ctx, size) => {
    const t = step / 7;
    const hue = 52 - t * 50;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, `hsla(${hue}, 100%, ${72 - t * 25}%, 1)`);
    g.addColorStop(0.5, `hsla(${hue - 5}, 100%, 50%, 0.4)`);
    g.addColorStop(1, `hsla(${hue - 10}, 100%, 40%, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Runa já com brilho. */
function runeSprite(glyph: string, rgb: string) {
  return sprite(`rune:${glyph}:${rgb}`, 64, (ctx, size) => {
    ctx.font = `${(size * 0.55) / Math.max(1, glyph.length * 0.6)}px "Segoe UI Symbol", "Noto Sans Runic", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `rgba(${rgb}, 1)`;
    ctx.shadowBlur = size * 0.18;
    ctx.fillStyle = rgb === RGB.arcane ? 'rgba(235, 215, 255, 1)' : `rgba(${rgb}, 1)`;
    ctx.fillText(glyph, size / 2, size / 2);
    ctx.fillText(glyph, size / 2, size / 2);
  });
}

/** Os 22 arcanos maiores (as cartas do crítico do tarô são sorteadas entre eles). */
const MAJOR_ARCANA = [
  { numeral: '0', title: 'O LOUCO', symbol: '✧' },
  { numeral: 'I', title: 'O MAGO', symbol: '∞' },
  { numeral: 'II', title: 'A SACERDOTISA', symbol: '☽' },
  { numeral: 'III', title: 'A IMPERATRIZ', symbol: '♀' },
  { numeral: 'IV', title: 'O IMPERADOR', symbol: '♔' },
  { numeral: 'V', title: 'O HIEROFANTE', symbol: '✠' },
  { numeral: 'VI', title: 'OS ENAMORADOS', symbol: '♡' },
  { numeral: 'VII', title: 'O CARRO', symbol: '⚔' },
  { numeral: 'VIII', title: 'A FORÇA', symbol: '♌' },
  { numeral: 'IX', title: 'O EREMITA', symbol: '✶' },
  { numeral: 'X', title: 'A RODA', symbol: '☸' },
  { numeral: 'XI', title: 'A JUSTIÇA', symbol: '⚖' },
  { numeral: 'XII', title: 'O ENFORCADO', symbol: '☥' },
  { numeral: 'XIII', title: 'A MORTE', symbol: '☠' },
  { numeral: 'XIV', title: 'A TEMPERANÇA', symbol: '♒' },
  { numeral: 'XV', title: 'O DIABO', symbol: '♄' },
  { numeral: 'XVI', title: 'A TORRE', symbol: '⚡' },
  { numeral: 'XVII', title: 'A ESTRELA', symbol: '★' },
  { numeral: 'XVIII', title: 'A LUA', symbol: '☾' },
  { numeral: 'XIX', title: 'O SOL', symbol: '☀' },
  { numeral: 'XX', title: 'O JULGAMENTO', symbol: '✝' },
  { numeral: 'XXI', title: 'O MUNDO', symbol: '❂' },
] as const;

/** Verso da carta de tarô (a carta ocupa o meio do quadrado). */
function cardBackSprite() {
  return sprite('card-back', 256, (ctx, size) => {
    const w = size / 1.6;
    const x = (size - w) / 2;
    ctx.fillStyle = '#2a1240';
    ctx.strokeStyle = '#d9b25a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(x + 3, 3, w - 6, size - 6, 14);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 14, 14, w - 28, size - 28);
    // Estrela de oito pontas no centro.
    ctx.fillStyle = '#d9b25a';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 === 0 ? w * 0.32 : w * 0.12;
      ctx.lineTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    for (const y of [40, size - 40]) {
      ctx.beginPath();
      ctx.arc(size / 2, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Frente da carta de tarô: número romano, símbolo e título. */
function cardFaceSprite(face: { symbol: string; title: string; numeral: string }) {
  return sprite(`card-face:${face.title}`, 512, (ctx, size) => {
    const w = size / 1.6;
    const x = (size - w) / 2;
    const paper = ctx.createLinearGradient(0, 0, 0, size);
    paper.addColorStop(0, '#f6ead0');
    paper.addColorStop(1, '#d9c290');
    ctx.fillStyle = paper;
    ctx.strokeStyle = '#8a5a1c';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(x + 5, 5, w - 10, size - 10, 24);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 26, 26, w - 52, size - 52);
    const font =
      getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a3a1a';
    ctx.font = `bold 40px ${font}`;
    ctx.fillText(face.numeral, size / 2, 70);
    ctx.shadowColor = 'rgba(150, 80, 220, 0.9)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#5b2a90';
    ctx.font = `180px "Segoe UI Symbol", serif`;
    ctx.fillText(face.symbol, size / 2, size / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3b2410';
    ctx.font = `bold 36px ${font}`;
    ctx.fillText(face.title, size / 2, size - 70, w - 60);
  });
}

/** Moeda de ouro. */
function coinSprite() {
  return sprite('coin', 64, (ctx, size) => {
    const c = size / 2;
    const g = ctx.createRadialGradient(c - 8, c - 8, 2, c, c, c);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.5, '#ffc83c');
    g.addColorStop(1, '#b07a10');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5a08';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, c * 0.62, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#8a5a08';
    ctx.font = `bold ${size * 0.42}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', c, c + 2);
  });
}

function blit(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  alpha: number,
) {
  if (alpha <= 0.01 || radius <= 0.5) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
}

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

/** Cor principal (r, g, b) de cada aura. */
const RGB: Record<DiceAura, string> = {
  blood: '200, 16, 40',
  storm: '140, 220, 255',
  frost: '190, 238, 255',
  arcane: '176, 108, 255',
  shadow: '40, 22, 62',
  holy: '255, 215, 106',
  gears: '230, 160, 60',
  forest: '110, 200, 80',
  fire: '255, 120, 30',
  skeleton: '150, 255, 160',
  cosmic: '150, 120, 255',
  tarot: '200, 150, 230',
  glitch: '0, 255, 140',
  ink: '20, 20, 26',
  abyss: '40, 160, 220',
  time: '230, 200, 140',
  gold: '255, 200, 60',
  frog: '120, 200, 60',
  vampire: '196, 24, 58',
  bard: '255, 180, 80',
  rainbow: '255, 150, 220',
  poison: '150, 255, 60',
  cat: '255, 180, 210',
  meteor: '255, 140, 66',
  party: '255, 106, 213',
  wind: '210, 240, 245',
  ritual: '255, 40, 40',
  claw: '60, 255, 120',
};

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  if (document.querySelector('[data-motion="reduce"]')) return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const rune = () => pick([...RUNES]);

function particle(kind: Kind, x: number, y: number, extra: Partial<Particle> = {}): Particle {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0,
    max: 60,
    size: 3,
    rot: rand(0, Math.PI * 2),
    vr: 0,
    gravity: 0,
    drag: 1,
    color: '255, 255, 255',
    ...extra,
  };
}

/** Zigue-zague de um raio entre dois pontos. */
function bolt(from: Point, to: Point, jitter: number, steps = 7): Point[] {
  const points: Point[] = [from];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    points.push({
      x: from.x + (to.x - from.x) * t + rand(-jitter, jitter),
      y: from.y + (to.y - from.y) * t + rand(-jitter, jitter),
    });
  }
  points.push(to);
  return points;
}

/** Contorno de uma engrenagem (centro na origem). */
function gearPath(ctx: CanvasRenderingContext2D, radius: number, teeth: number) {
  const step = (Math.PI * 2) / teeth;
  const inner = radius * 0.8;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    ctx.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a + step * 0.15) * radius, Math.sin(a + step * 0.15) * radius);
    ctx.lineTo(Math.cos(a + step * 0.45) * radius, Math.sin(a + step * 0.45) * radius);
    ctx.lineTo(Math.cos(a + step * 0.6) * inner, Math.sin(a + step * 0.6) * inner);
  }
  ctx.closePath();
  ctx.moveTo(radius * 0.32, 0);
  ctx.arc(0, 0, radius * 0.32, 0, Math.PI * 2, true);
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const t = p.life / p.max;
  const fade = 1 - t;
  ctx.save();
  switch (p.kind) {
    case 'wisp':
      // Labareda da aura: bolha suave que sobe e encolhe.
      blit(ctx, softSprite(p.color), p.x, p.y, p.size * (1 - t * 0.6), 0.5 * fade);
      break;
    case 'bolt': {
      if (!p.path) break;
      ctx.globalAlpha = Math.random() < 0.25 ? 0.25 : fade;
      ctx.strokeStyle = 'rgba(245, 252, 255, 1)';
      // Brilho só nos raios grandes (poucos por vez); nos pequenos, um traço mais grosso por baixo.
      if (p.size > 2.5) {
        ctx.shadowColor = `rgba(${p.color}, 1)`;
        ctx.shadowBlur = 24;
      }
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.path[0]!.x, p.path[0]!.y);
      for (const point of p.path.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = `rgba(${p.color}, 0.45)`;
      ctx.lineWidth = p.size * 3.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(245, 252, 255, 1)';
      ctx.lineWidth = p.size;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.path[0]!.x, p.path[0]!.y);
      for (const point of p.path.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
      break;
    }
    case 'drop': {
      // Gota alongada no sentido do movimento.
      ctx.globalAlpha = Math.min(1, fade * 1.5);
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      const speed = Math.hypot(p.vx, p.vy);
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        p.size * (1 + Math.min(speed, 20) * 0.18),
        p.size * 0.75,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
    }
    case 'splat': {
      // Respingo grudado na tela, escorrendo.
      ctx.globalAlpha = Math.min(1, fade * 3);
      ctx.fillStyle = `rgba(${p.color}, 0.92)`;
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + p.rot;
        const r = p.size * (0.7 + ((i * 37) % 10) / 22);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      const drip = Math.min(p.life * 0.6, p.size * 4);
      ctx.fillRect(-p.size * 0.15, 0, p.size * 0.3, p.size * 0.6 + drip);
      ctx.beginPath();
      ctx.arc(0, p.size * 0.6 + drip, p.size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'flake': {
      ctx.globalAlpha = fade;
      ctx.strokeStyle = `rgba(${p.color}, 1)`;
      ctx.lineWidth = Math.max(1, p.size / 4);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.lineTo(p.size, 0);
        ctx.moveTo(p.size * 0.55, 0);
        ctx.lineTo(p.size * 0.8, p.size * 0.25);
        ctx.moveTo(p.size * 0.55, 0);
        ctx.lineTo(p.size * 0.8, -p.size * 0.25);
        ctx.stroke();
      }
      break;
    }
    case 'rune':
      blit(ctx, runeSprite(p.glyph ?? 'ᚠ', p.color), p.x, p.y, p.size, Math.sin(Math.PI * t));
      break;
    case 'smoke':
      blit(ctx, smokeSprite(p.color), p.x, p.y, p.size * (0.6 + t), fade);
      break;
    case 'ray': {
      // Raio de luz saindo da borda do dado.
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.9;
      const length = p.size * 6;
      const g = ctx.createLinearGradient(
        p.x,
        p.y,
        p.x + Math.cos(p.rot) * length,
        p.y + Math.sin(p.rot) * length,
      );
      g.addColorStop(0, `rgba(${p.color}, 0.9)`);
      g.addColorStop(1, `rgba(${p.color}, 0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = p.size / 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.rot) * length, p.y + Math.sin(p.rot) * length);
      ctx.stroke();
      break;
    }
    case 'beam': {
      // Feixe de luz descendo do alto (crítico sagrado).
      const height = ctx.canvas.height;
      const g = ctx.createLinearGradient(p.x, 0, p.x, height);
      const alpha = Math.sin(Math.PI * t) * 0.45;
      g.addColorStop(0, `rgba(${p.color}, ${alpha})`);
      g.addColorStop(1, `rgba(${p.color}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.size / 2, 0, p.size, height);
      break;
    }
    case 'gear': {
      ctx.globalAlpha = Math.min(1, fade * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      gearPath(ctx, p.size, p.size > 40 ? 14 : 8);
      ctx.fillStyle = `rgba(${p.color}, 0.85)`;
      ctx.strokeStyle = 'rgba(60, 35, 10, 0.9)';
      ctx.lineWidth = Math.max(1, p.size / 12);
      ctx.fill('evenodd');
      ctx.stroke();
      break;
    }
    case 'leaf': {
      ctx.globalAlpha = Math.min(1, fade * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.abs(Math.cos(p.life * 0.08)) * 0.7 + 0.3);
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.quadraticCurveTo(0, -p.size * 0.7, p.size, 0);
      ctx.quadraticCurveTo(0, p.size * 0.7, -p.size, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 60, 20, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.stroke();
      break;
    }
    case 'flame':
      // Chama: amarela no começo, vermelha no fim, encolhendo.
      blit(
        ctx,
        flameSprite(Math.min(7, Math.floor(t * 8))),
        p.x,
        p.y,
        p.size * (1 - t * 0.7),
        0.95 * fade,
      );
      break;
    case 'scale': {
      // Escama dourada girando (brilho do dragão).
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.cos(p.life * 0.15), 1);
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.quadraticCurveTo(p.size, 0, 0, p.size);
      ctx.quadraticCurveTo(-p.size, 0, 0, -p.size);
      ctx.fill();
      break;
    }
    case 'bone': {
      // Osso girando.
      ctx.globalAlpha = Math.min(1, fade * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(236, 228, 205, 1)';
      ctx.strokeStyle = 'rgba(70, 60, 45, 0.8)';
      ctx.lineWidth = Math.max(0.8, p.size / 8);
      const knob = p.size * 0.32;
      ctx.beginPath();
      ctx.rect(-p.size, -knob * 0.55, p.size * 2, knob * 1.1);
      for (const [x, y] of [
        [-p.size, -knob * 0.6],
        [-p.size, knob * 0.6],
        [p.size, -knob * 0.6],
        [p.size, knob * 0.6],
      ] as const) {
        ctx.moveTo(x + knob, y);
        ctx.arc(x, y, knob, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'skull': {
      // Caveirinha-espírito subindo e sumindo.
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.85;
      ctx.translate(p.x + Math.sin(p.life * 0.08 + p.rot) * p.size * 0.6, p.y);
      ctx.scale(p.size / 100, p.size / 100);
      drawSkull(ctx, 0, false);
      break;
    }
    case 'card': {
      // Carta de tarô girando (verso).
      ctx.globalAlpha = Math.min(1, fade * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(0.1, Math.abs(Math.cos(p.life * 0.12))), 1);
      ctx.drawImage(cardBackSprite(), -p.size, -p.size, p.size * 2, p.size * 2);
      break;
    }
    case 'pixel': {
      // Pixel solto (glitch), piscando.
      ctx.globalAlpha = Math.random() < 0.15 ? 0 : fade;
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size * (p.glyph === 'bar' ? 6 : 1), p.size);
      break;
    }
    case 'bubble': {
      ctx.globalAlpha = Math.min(1, fade * 2) * 0.8;
      const x = p.x + Math.sin(p.life * 0.15 + p.rot) * p.size * 0.6;
      ctx.strokeStyle = `rgba(${p.color}, 0.9)`;
      ctx.lineWidth = Math.max(1, p.size / 6);
      ctx.beginPath();
      ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fish': {
      // Peixinho luminoso nadando.
      const alpha = Math.sin(Math.PI * t);
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      blit(ctx, glowSprite(p.color), 0, 0, p.size * 2.2, alpha * 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      const wag = Math.sin(p.life * 0.5) * p.size * 0.3;
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.8, 0);
      ctx.lineTo(-p.size * 1.6, -p.size * 0.5 + wag);
      ctx.lineTo(-p.size * 1.6, p.size * 0.5 + wag);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'coin': {
      ctx.globalAlpha = Math.min(1, fade * 3);
      ctx.translate(p.x, p.y);
      ctx.scale(Math.max(0.12, Math.abs(Math.cos(p.rot))), 1);
      ctx.drawImage(coinSprite(), -p.size, -p.size, p.size * 2, p.size * 2);
      break;
    }
    case 'fly': {
      // Mosca zumbindo (asas batendo).
      ctx.globalAlpha = Math.min(1, fade * 3);
      ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(20, 22, 18, 1)';
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 235, 255, 0.55)';
      const flap = p.life % 2 === 0 ? 1 : 0.4;
      ctx.beginPath();
      ctx.ellipse(
        -p.size * 0.6,
        -p.size * 0.9,
        p.size * 0.7,
        p.size * 0.4 * flap,
        -0.5,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        p.size * 0.6,
        -p.size * 0.9,
        p.size * 0.7,
        p.size * 0.4 * flap,
        0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
    }
    case 'bat': {
      // Morcego batendo as asas.
      ctx.globalAlpha = Math.min(1, fade * 2);
      ctx.translate(p.x, p.y);
      const flap = Math.sin(p.life * 0.6);
      const z = p.size;
      ctx.fillStyle = 'rgba(18, 6, 10, 0.95)';
      ctx.beginPath();
      ctx.ellipse(0, 0, z * 0.35, z * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * z * 0.2, -z * 0.1);
        ctx.quadraticCurveTo(
          side * z * 0.9,
          -z * (0.2 + flap * 0.8),
          side * z * 1.6,
          -z * flap * 0.6,
        );
        ctx.lineTo(side * z * 1.25, z * 0.1);
        ctx.lineTo(side * z * 0.95, -z * 0.05);
        ctx.lineTo(side * z * 0.7, z * 0.25);
        ctx.lineTo(side * z * 0.2, z * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(side * z * 0.25, -z * 0.35);
        ctx.lineTo(side * z * 0.15, -z * 0.7);
        ctx.lineTo(side * z * 0.05, -z * 0.4);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 40, 60, 1)';
      ctx.fillRect(-z * 0.16, -z * 0.25, z * 0.09, z * 0.07);
      ctx.fillRect(z * 0.07, -z * 0.25, z * 0.09, z * 0.07);
      break;
    }
    case 'paw':
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.85;
      drawPaw(ctx, p.x, p.y, p.size, p.rot, `rgba(${p.color}, 1)`, null);
      break;
    case 'confetti': {
      ctx.globalAlpha = Math.min(1, fade * 3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.life * 0.3));
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      break;
    }
    case 'rock': {
      ctx.globalAlpha = Math.min(1, fade * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(70, 50, 40, 1)';
      ctx.strokeStyle = 'rgba(255, 140, 60, 0.9)';
      ctx.lineWidth = Math.max(1, p.size / 4);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = p.size * (0.75 + ((i * 53) % 10) / 30);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'scratch': {
      // Três arranhões verdes paralelos.
      ctx.globalAlpha = Math.sin(Math.PI * t);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.lineCap = 'round';
      for (const [w, style] of [
        [p.size * 0.35, `rgba(${p.color}, 0.35)`],
        [p.size * 0.12, 'rgba(230, 255, 235, 1)'],
      ] as const) {
        ctx.lineWidth = w;
        ctx.strokeStyle = style;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(-p.size, k * p.size * 0.45 - p.size * 0.2);
          ctx.quadraticCurveTo(
            0,
            k * p.size * 0.45 + p.size * 0.15,
            p.size,
            k * p.size * 0.45 - p.size * 0.1,
          );
          ctx.stroke();
        }
      }
      break;
    }
    case 'shard': {
      // Caco de gelo caindo.
      ctx.globalAlpha = Math.min(1, fade * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(210, 240, 255, 0.55)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.7, p.size * 0.6);
      ctx.lineTo(-p.size * 0.5, p.size * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'feather': {
      // Pena de anjo caindo e balançando.
      ctx.globalAlpha = Math.min(1, fade * 2.5);
      ctx.translate(p.x + Math.sin(p.life * 0.05 + p.rot) * p.size, p.y);
      ctx.rotate(Math.sin(p.life * 0.04 + p.rot) * 0.6 + 0.4);
      ctx.fillStyle = 'rgba(255, 252, 240, 0.95)';
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.quadraticCurveTo(p.size * 0.45, -p.size * 0.2, p.size * 0.1, p.size);
      ctx.quadraticCurveTo(-p.size * 0.4, 0, 0, -p.size);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 180, 90, 0.9)';
      ctx.lineWidth = Math.max(0.8, p.size / 14);
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 0.9);
      ctx.quadraticCurveTo(p.size * 0.08, 0, p.size * 0.1, p.size * 1.25);
      ctx.stroke();
      break;
    }
    default: {
      // mote, spark, firefly, ember: ponto brilhante.
      const blink = p.kind === 'firefly' ? 0.5 + 0.5 * Math.sin(p.life * 0.25 + p.rot) : 1;
      blit(ctx, glowSprite(p.color), p.x, p.y, p.size * 3, fade * blink);
    }
  }
  ctx.restore();
}

/** Atualiza e desenha as partículas (as claras somam luz; as escuras cobrem). */
function stepParticles(ctx: CanvasRenderingContext2D, particles: Particle[], height: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life += 1;
    p.vy += p.gravity;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.kind === 'bat') p.vy += Math.sin(p.life * 0.3) * 0.3;
    if (p.kind === 'fly') {
      // Voo errático.
      p.vx += rand(-0.7, 0.7);
      p.vy += rand(-0.7, 0.7);
    }
    if (p.life >= p.max || p.y > height + 80) particles.splice(i, 1);
  }
  for (const p of particles) {
    const dark =
      p.kind === 'smoke' ||
      p.kind === 'drop' ||
      p.kind === 'splat' ||
      p.kind === 'gear' ||
      p.kind === 'leaf' ||
      p.kind === 'feather' ||
      p.kind === 'bone' ||
      p.kind === 'skull' ||
      p.kind === 'card' ||
      p.kind === 'coin' ||
      p.kind === 'fly' ||
      p.kind === 'bat' ||
      p.kind === 'paw' ||
      p.kind === 'confetti' ||
      p.kind === 'rock' ||
      p.kind === 'shard';
    ctx.globalCompositeOperation = dark ? 'source-over' : 'lighter';
    drawParticle(ctx, p);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Ponto na borda do dado, no ângulo `a` (k > 1 = um pouco para fora). */
function edge(o: AuraPoint, a: number, k = 1): Point {
  return { x: o.x + Math.cos(a) * o.r * k, y: o.y + Math.sin(a) * o.r * k };
}

/** Partículas emanando da borda de um dado. `power` de 0 a 1 (rolando = 1; parado, menos). */
function emitAround(aura: DiceAura, o: AuraPoint, out: Particle[], power: number) {
  if (out.length > MAX_PARTICLES) return;
  const s = o.r / 40;
  const chance = (p: number) => Math.random() < p * power;
  const color = RGB[aura];
  // Camada "chakra": labaredas que nascem na borda e sobem, em todos os temas.
  const wisps = Math.round(1.6 * power + Math.random() * 0.8);
  for (let i = 0; i < wisps; i++) {
    const a = rand(0, Math.PI * 2);
    const from = edge(o, a, 0.85);
    out.push(
      particle(aura === 'shadow' || aura === 'ink' ? 'smoke' : 'wisp', from.x, from.y, {
        vx: Math.cos(a) * 0.5 * s,
        vy: (Math.sin(a) * 0.4 - rand(0.8, 1.8)) * s,
        max: rand(28, 46),
        size: rand(10, 18) * s,
        color:
          aura === 'blood'
            ? '150, 0, 20'
            : aura === 'rainbow'
              ? pick(RAINBOW)
              : aura === 'party'
                ? pick(CONFETTI)
                : color,
      }),
    );
  }
  const a = rand(0, Math.PI * 2);
  const from = edge(o, a);
  switch (aura) {
    case 'storm':
      if (chance(0.55)) {
        const to = edge(o, a + rand(-0.3, 0.3), rand(1.5, 2.3));
        out.push(
          particle('bolt', 0, 0, {
            path: bolt(from, to, 5 * s, 5),
            max: rand(4, 9),
            size: rand(1, 2),
            color,
          }),
        );
      }
      if (chance(0.25)) {
        const to = edge(o, a + rand(0.6, 1.4), 1.05);
        out.push(
          particle('bolt', 0, 0, {
            path: bolt(from, to, 7 * s, 6),
            max: rand(3, 6),
            size: 1.2,
            color,
          }),
        );
      }
      break;
    case 'blood':
      // Jatinhos: gotas espirradas para fora e para cima, caindo com a gravidade.
      for (let i = 0; i < 2; i++)
        if (chance(0.8))
          out.push(
            particle('drop', from.x, from.y, {
              vx: Math.cos(a) * rand(1, 2.6) * s,
              vy: (Math.sin(a) - rand(1.5, 3)) * s,
              gravity: 0.14 * s,
              max: rand(35, 55),
              size: rand(1.4, 2.6) * s,
              color,
            }),
          );
      break;
    case 'frost':
      if (chance(0.7))
        out.push(
          particle('flake', from.x, from.y, {
            vx: Math.cos(a) * rand(0.4, 1.2) * s,
            vy: Math.sin(a) * rand(0.4, 1.2) * s,
            vr: rand(-0.05, 0.05),
            max: rand(40, 70),
            size: rand(2.5, 5) * s,
            color,
          }),
        );
      break;
    case 'arcane':
      if (chance(0.35))
        out.push(
          particle('rune', from.x, from.y, {
            vx: Math.cos(a) * 0.4 * s,
            vy: -rand(0.6, 1.2) * s,
            max: rand(40, 60),
            size: rand(10, 16) * s,
            glyph: rune(),
            color,
          }),
        );
      if (chance(0.6))
        out.push(
          particle('mote', from.x, from.y, {
            vx: -Math.sin(a) * 1.4 * s,
            vy: Math.cos(a) * 1.4 * s - 0.4,
            drag: 0.97,
            max: rand(30, 50),
            size: rand(1.2, 2.2) * s,
            color: '220, 180, 255',
          }),
        );
      break;
    case 'shadow':
      if (chance(0.4))
        out.push(
          particle('mote', from.x, from.y, {
            vx: Math.cos(a) * 0.6,
            vy: -rand(0.5, 1.2),
            max: rand(30, 50),
            size: rand(1, 1.8) * s,
            color: '150, 90, 220',
          }),
        );
      break;
    case 'holy':
      if (chance(0.3))
        out.push(
          particle('ray', from.x, from.y, {
            rot: a,
            max: rand(18, 30),
            size: rand(5, 9) * s,
            color,
          }),
        );
      if (chance(0.06))
        out.push(
          particle('feather', from.x, from.y, {
            vx: rand(-0.4, 0.4),
            vy: rand(0.2, 0.6),
            max: rand(60, 90),
            size: rand(5, 8) * s,
          }),
        );
      if (chance(0.7))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-0.3, 0.3),
            vy: -rand(0.8, 2) * s,
            max: rand(30, 50),
            size: rand(1.2, 2.2) * s,
            color: '255, 240, 180',
          }),
        );
      break;
    case 'gears':
      if (chance(0.18))
        out.push(
          particle('gear', from.x, from.y, {
            vx: Math.cos(a) * rand(0.4, 1) * s,
            vy: Math.sin(a) * rand(0.4, 1) * s - 0.3,
            vr: rand(-0.12, 0.12),
            max: rand(40, 60),
            size: rand(4, 8) * s,
            color: pick(['205, 150, 60', '170, 120, 70', '190, 190, 200']),
          }),
        );
      for (let i = 0; i < 2; i++)
        if (chance(0.6))
          out.push(
            particle('spark', from.x, from.y, {
              vx: Math.cos(a) * rand(1, 3) * s,
              vy: (Math.sin(a) - 1.5) * rand(1, 2) * s,
              gravity: 0.18 * s,
              max: rand(18, 30),
              size: rand(0.8, 1.5) * s,
              color: '255, 190, 80',
            }),
          );
      if (chance(0.12)) {
        const to = edge(o, a, 1.6);
        out.push(
          particle('bolt', 0, 0, {
            path: bolt(from, to, 4 * s, 4),
            max: 5,
            size: 1,
            color: '80, 230, 255',
          }),
        );
      }
      break;
    case 'forest':
      if (chance(0.4))
        out.push(
          particle('leaf', from.x, from.y, {
            vx: Math.cos(a + 1.2) * rand(0.8, 1.6) * s,
            vy: Math.sin(a + 1.2) * rand(0.8, 1.6) * s - 0.3,
            vr: rand(-0.08, 0.08),
            max: rand(45, 70),
            size: rand(3, 5.5) * s,
            color: pick(['90, 170, 60', '130, 190, 70', '60, 140, 50', '170, 200, 80']),
          }),
        );
      if (chance(0.25))
        out.push(
          particle('firefly', from.x, from.y, {
            vx: rand(-0.5, 0.5),
            vy: -rand(0.3, 0.9),
            max: rand(50, 80),
            size: rand(1.2, 2) * s,
            color: '210, 255, 120',
          }),
        );
      break;
    case 'cosmic':
      // Estrelas sendo sugadas em espiral para o dado.
      for (let i = 0; i < 2; i++) {
        if (!chance(0.8)) continue;
        const b = rand(0, Math.PI * 2);
        const at = edge(o, b, 2.3);
        out.push(
          particle('mote', at.x, at.y, {
            vx: (-Math.sin(b) * 2 - Math.cos(b) * 1.1) * s,
            vy: (Math.cos(b) * 2 - Math.sin(b) * 1.1) * s,
            drag: 0.97,
            max: rand(30, 45),
            size: rand(0.8, 1.8) * s,
            color: pick(['255, 255, 255', '170, 150, 255', '140, 220, 255']),
          }),
        );
      }
      break;
    case 'tarot':
      if (chance(0.1))
        out.push(
          particle('card', from.x, from.y, {
            vx: Math.cos(a) * 1.1 * s,
            vy: (Math.sin(a) - 0.6) * s,
            vr: rand(-0.06, 0.06),
            max: rand(45, 60),
            size: rand(8, 11) * s,
          }),
        );
      if (chance(0.5))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-0.4, 0.4),
            vy: -rand(0.6, 1.4) * s,
            max: rand(30, 45),
            size: rand(1, 1.8) * s,
            color: '225, 190, 255',
          }),
        );
      break;
    case 'glitch':
      for (let i = 0; i < 2; i++)
        if (chance(0.9)) {
          const at = edge(o, rand(0, Math.PI * 2), rand(0.8, 1.5));
          out.push(
            particle('pixel', at.x, at.y, {
              vx: (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 2.5) * s,
              vy: rand(-0.3, 0.3),
              max: rand(10, 25),
              size: rand(2, 4) * s,
              color: pick(['0, 255, 140', '0, 220, 255', '255, 0, 200']),
              glyph: Math.random() < 0.2 ? 'bar' : undefined,
            }),
          );
        }
      if (chance(0.15))
        out.push(
          particle('rune', from.x, from.y, {
            vy: -rand(0.6, 1.2) * s,
            max: rand(30, 45),
            size: rand(9, 13) * s,
            glyph: pick(['0', '1']),
            color: '0, 255, 140',
          }),
        );
      break;
    case 'ink':
      if (chance(0.25)) {
        const at = edge(o, a, rand(1.2, 1.6));
        out.push(
          particle('splat', at.x, at.y, {
            max: rand(25, 40),
            size: rand(3, 6) * s,
            color: '14, 14, 18',
          }),
        );
      }
      if (chance(0.5))
        out.push(
          particle('drop', from.x, from.y, {
            vx: Math.cos(a) * rand(1.5, 3) * s,
            vy: (Math.sin(a) - 1) * rand(1, 2) * s,
            gravity: 0.15 * s,
            max: rand(25, 40),
            size: rand(1.2, 2.2) * s,
            color: '14, 14, 18',
          }),
        );
      break;
    case 'abyss':
      if (chance(0.4))
        out.push(
          particle('bubble', from.x, from.y, {
            vy: -rand(0.6, 1.4) * s,
            max: rand(40, 60),
            size: rand(2, 5) * s,
            color: '170, 230, 255',
          }),
        );
      if (chance(0.05)) {
        const at = edge(o, a, 1.4);
        out.push(
          particle('fish', at.x, at.y, {
            vx: -Math.sin(a) * 1.5 * s,
            vy: Math.cos(a) * 1.5 * s,
            max: rand(50, 70),
            size: rand(3.5, 5) * s,
            color: pick(['120, 255, 230', '90, 200, 255', '255, 140, 220']),
          }),
        );
      }
      break;
    case 'time':
      if (chance(0.12))
        out.push(
          particle('rune', from.x, from.y, {
            vy: -rand(0.6, 1) * s,
            vx: rand(-0.3, 0.3),
            max: rand(40, 55),
            size: rand(11, 14) * s,
            glyph: pick(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']),
            color: '230, 200, 140',
          }),
        );
      if (chance(0.5))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-0.3, 0.3),
            vy: rand(0.2, 0.8),
            max: rand(30, 45),
            size: rand(0.7, 1.3) * s,
            color: '240, 210, 150',
          }),
        );
      break;
    case 'gold':
      if (chance(0.2))
        out.push(
          particle('coin', from.x, from.y, {
            vx: Math.cos(a) * 2 * s,
            vy: -rand(2, 3.5) * s,
            gravity: 0.15 * s,
            vr: 0.25,
            max: rand(35, 50),
            size: rand(3.5, 5) * s,
          }),
        );
      if (chance(0.4))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-0.4, 0.4),
            vy: -rand(0.3, 1),
            max: rand(20, 35),
            size: rand(1, 1.8) * s,
            color: '255, 240, 170',
          }),
        );
      break;
    case 'frog':
      if (chance(0.06)) {
        const at = edge(o, a, 1.3);
        out.push(
          particle('fly', at.x, at.y, {
            vx: rand(-1, 1),
            vy: rand(-1, 1),
            drag: 0.9,
            max: rand(80, 120),
            size: rand(1.4, 2) * s,
          }),
        );
      }
      break;
    case 'vampire':
      if (chance(0.08))
        out.push(
          particle('bat', from.x, from.y, {
            vx: Math.cos(a) * 1.5 * s,
            vy: (Math.sin(a) - 0.8) * 1.2 * s,
            max: rand(50, 70),
            size: rand(5, 7) * s,
          }),
        );
      if (chance(0.3))
        out.push(
          particle('mote', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(30, 45),
            size: rand(1, 1.6) * s,
            color: '255, 60, 80',
          }),
        );
      break;
    case 'bard':
      if (chance(0.15))
        out.push(
          particle('rune', from.x, from.y, {
            vx: rand(-0.4, 0.4),
            vy: -rand(0.7, 1.1) * s,
            max: rand(40, 55),
            size: rand(12, 15) * s,
            glyph: pick(['♪', '♫', '♬', '♩']),
            color: pick(['255, 190, 90', '255, 140, 200', '140, 220, 255']),
          }),
        );
      break;
    case 'rainbow':
      for (let i = 0; i < 2; i++)
        if (chance(0.9))
          out.push(
            particle('mote', from.x, from.y, {
              vx: Math.cos(a + i) * 0.8 * s,
              vy: (Math.sin(a + i) * 0.8 - 0.5) * s,
              max: rand(30, 45),
              size: rand(1, 1.8) * s,
              color: pick(RAINBOW),
            }),
          );
      break;
    case 'poison':
      if (chance(0.3))
        out.push(
          particle('bubble', from.x, from.y, {
            vy: -rand(0.5, 1.1) * s,
            max: rand(30, 50),
            size: rand(2, 4) * s,
            color: '170, 255, 120',
          }),
        );
      if (chance(0.3))
        out.push(
          particle('drop', from.x, from.y, {
            vx: Math.cos(a) * 0.6 * s,
            vy: 0.5 * s,
            gravity: 0.12 * s,
            max: rand(30, 45),
            size: rand(1.2, 2) * s,
            color: '120, 230, 50',
          }),
        );
      break;
    case 'cat':
      if (chance(0.04)) {
        const at = edge(o, a, 1.6);
        out.push(
          particle('paw', at.x, at.y, {
            rot: a + Math.PI / 2,
            max: 50,
            size: 5 * s,
            color: '255, 190, 215',
          }),
        );
      }
      if (chance(0.3))
        out.push(
          particle('spark', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(25, 40),
            size: rand(1, 1.6) * s,
            color: '255, 190, 215',
          }),
        );
      break;
    case 'meteor':
      if (chance(0.6))
        out.push(
          particle('ember', from.x, from.y, {
            vx: -Math.sin(a) * 2 * s,
            vy: Math.cos(a) * 2 * s,
            drag: 0.95,
            max: rand(18, 28),
            size: rand(0.8, 1.5) * s,
            color: '255, 150, 70',
          }),
        );
      if (chance(0.06))
        out.push(
          particle('rock', from.x, from.y, {
            vx: -Math.sin(a) * 1.2 * s,
            vy: Math.cos(a) * 1.2 * s,
            vr: 0.1,
            max: 40,
            size: 2.5 * s,
          }),
        );
      break;
    case 'party':
      if (chance(0.5))
        out.push(
          particle('confetti', from.x, from.y, {
            vx: Math.cos(a) * 2 * s,
            vy: -rand(1.5, 3) * s,
            gravity: 0.1 * s,
            drag: 0.98,
            vr: 0.2,
            max: rand(40, 60),
            size: rand(2, 3) * s,
            color: pick(CONFETTI),
          }),
        );
      break;
    case 'claw':
      if (chance(0.05)) {
        const at = edge(o, a, 1.4);
        out.push(
          particle('scratch', at.x, at.y, { rot: rand(-0.8, 0.8), max: 30, size: 6 * s, color }),
        );
      }
      if (chance(0.4))
        out.push(
          particle('spark', from.x, from.y, {
            vx: Math.cos(a) * rand(0.8, 1.6) * s,
            vy: Math.sin(a) * rand(0.8, 1.6) * s,
            max: rand(20, 35),
            size: rand(1, 1.6) * s,
            color: '120, 255, 160',
          }),
        );
      break;
    case 'ritual':
      if (chance(0.4))
        out.push(
          particle('ember', from.x, from.y, {
            vx: rand(-0.4, 0.4),
            vy: -rand(0.8, 1.8) * s,
            max: rand(30, 45),
            size: rand(0.8, 1.4) * s,
            color: '255, 60, 40',
          }),
        );
      if (chance(0.06))
        out.push(
          particle('rune', from.x, from.y, {
            vy: -rand(0.5, 1) * s,
            max: rand(40, 55),
            size: rand(10, 13) * s,
            glyph: rune(),
            color: '255, 50, 50',
          }),
        );
      break;
    case 'wind':
      // Poeira e folhinhas girando em volta do dado.
      if (chance(0.5))
        out.push(
          particle(Math.random() < 0.3 ? 'leaf' : 'spark', from.x, from.y, {
            vx: -Math.sin(a) * 2.2 * s,
            vy: Math.cos(a) * 2.2 * s - 0.3,
            drag: 0.96,
            vr: 0.2,
            max: rand(25, 40),
            size: rand(1.5, 3) * s,
            color: pick(['220, 235, 240', '180, 200, 170', '200, 210, 215']),
          }),
        );
      break;
    case 'skeleton':
      if (chance(0.22))
        out.push(
          particle('bone', from.x, from.y, {
            vx: Math.cos(a) * rand(1, 2.2) * s,
            vy: (Math.sin(a) - 1) * rand(1, 2) * s,
            gravity: 0.08 * s,
            vr: rand(-0.25, 0.25),
            max: rand(35, 55),
            size: rand(4, 6.5) * s,
          }),
        );
      if (chance(0.08))
        out.push(
          particle('skull', from.x, from.y - o.r * 0.3, {
            vy: -rand(0.8, 1.4) * s,
            max: rand(55, 80),
            size: rand(9, 14) * s,
          }),
        );
      break;
    case 'fire':
      for (let i = 0; i < 3; i++) {
        const b = rand(0, Math.PI * 2);
        const at = edge(o, b, 0.8);
        if (chance(0.9))
          out.push(
            particle('flame', at.x, at.y, {
              vx: Math.cos(b) * 0.4 * s,
              vy: -rand(1.2, 2.4) * s,
              max: rand(22, 36),
              size: rand(7, 12) * s,
            }),
          );
      }
      if (chance(0.4))
        out.push(
          particle('ember', from.x, from.y, {
            vx: rand(-1, 1) * s,
            vy: -rand(1.5, 3) * s,
            max: rand(35, 60),
            size: rand(0.8, 1.5) * s,
            color: '255, 170, 60',
          }),
        );
      break;
  }
}

/** Halo desenhado a cada quadro em volta do dado (brilho e, na arcana, o anel de runas). */
function drawHalo(
  ctx: CanvasRenderingContext2D,
  aura: DiceAura,
  o: AuraPoint,
  time: number,
  power: number,
) {
  const color = RGB[aura];
  ctx.save();
  const flicker = 0.85 + Math.sin(time * 9) * 0.08 + Math.random() * 0.07;
  const g = ctx.createRadialGradient(o.x, o.y, o.r * 0.7, o.x, o.y, o.r * 1.9);
  if (aura === 'shadow' || aura === 'ink') {
    g.addColorStop(0, `rgba(10, 4, 18, ${0.55 * power})`);
    g.addColorStop(1, 'rgba(10, 4, 18, 0)');
  } else {
    ctx.globalCompositeOperation = 'lighter';
    g.addColorStop(0, `rgba(${color}, ${0.35 * power * flicker})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(o.x - o.r * 2, o.y - o.r * 2, o.r * 4, o.r * 4);
  if (aura === 'ritual') {
    // Pentagrama girando por baixo do dado.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7 * power;
    ctx.strokeStyle = 'rgba(255, 50, 40, 0.9)';
    ctx.lineWidth = Math.max(1, o.r * 0.05);
    const ring = o.r * 1.5;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, ring, ring * 0.9, 0, 0, Math.PI * 2);
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + time * 0.6 + ((i * 2) % 5) * ((Math.PI * 2) / 5);
      const x = o.x + Math.cos(a) * ring;
      const y = o.y + Math.sin(a) * ring * 0.9;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  if (aura === 'wind') {
    // Redemoinho: arcos de vento girando rápido em volta do dado.
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const start = time * (5 + i) + (i * Math.PI * 2) / 3;
      ctx.globalAlpha = 0.45 * power;
      ctx.strokeStyle = 'rgba(235, 250, 255, 1)';
      ctx.lineWidth = Math.max(1, o.r * (0.08 - i * 0.02));
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, o.r * (1.3 + i * 0.18), o.r * (0.8 + i * 0.1), 0.3, start, start + 1.4);
      ctx.stroke();
    }
  }
  if (aura === 'ink') {
    // Pinceladas girando em volta do dado.
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.8 * power;
    ctx.strokeStyle = 'rgba(14, 14, 18, 1)';
    ctx.lineWidth = o.r * 0.12;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * 1.25, time * 2, time * 2 + 1.7);
    ctx.stroke();
    ctx.lineWidth = o.r * 0.06;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * 1.45, time * 2 + Math.PI, time * 2 + Math.PI + 1.2);
    ctx.stroke();
  }
  if (aura === 'time') {
    // Mostrador de relógio em volta do dado, com o ponteiro varrendo.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 * power;
    ctx.strokeStyle = 'rgba(230, 200, 140, 0.9)';
    ctx.lineWidth = Math.max(1, o.r * 0.04);
    const ring = o.r * 1.4;
    ctx.beginPath();
    ctx.arc(o.x, o.y, ring, 0, Math.PI * 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.moveTo(o.x + Math.cos(a) * ring * 0.86, o.y + Math.sin(a) * ring * 0.86);
      ctx.lineTo(o.x + Math.cos(a) * ring, o.y + Math.sin(a) * ring);
    }
    ctx.stroke();
    const hand = -time * 4;
    ctx.lineWidth = Math.max(1.5, o.r * 0.07);
    ctx.beginPath();
    ctx.moveTo(o.x + Math.cos(hand) * ring * 0.7, o.y + Math.sin(hand) * ring * 0.7);
    ctx.lineTo(o.x + Math.cos(hand) * ring * 1.12, o.y + Math.sin(hand) * ring * 1.12);
    ctx.stroke();
  }
  if (aura === 'cosmic') {
    // Disco de acreção inclinado, girando.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * power;
    ctx.strokeStyle = 'rgba(170, 150, 255, 0.8)';
    ctx.lineWidth = Math.max(1.5, o.r * 0.08);
    ctx.setLineDash([o.r * 0.3, o.r * 0.18]);
    ctx.lineDashOffset = -time * o.r * 2;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.r * 1.7, o.r * 0.5, -0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (aura === 'holy') {
    // Auréola flutuando sobre o dado.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = power;
    ctx.strokeStyle = 'rgba(255, 230, 150, 0.95)';
    ctx.shadowColor = `rgba(${color}, 1)`;
    ctx.shadowBlur = 16;
    ctx.lineWidth = Math.max(2, o.r * 0.09);
    ctx.beginPath();
    ctx.ellipse(
      o.x,
      o.y - o.r * 1.3 + Math.sin(time * 2.5) * o.r * 0.06,
      o.r * 0.62,
      o.r * 0.17,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  if (aura === 'arcane') {
    // Anel de runas girando em volta do dado.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 * power;
    ctx.strokeStyle = `rgba(${color}, 0.8)`;
    ctx.shadowColor = `rgba(${color}, 1)`;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.2;
    const ring = o.r * 1.45;
    ctx.beginPath();
    ctx.arc(o.x, o.y, ring + o.r * 0.18, 0, Math.PI * 2);
    ctx.arc(o.x, o.y, ring - o.r * 0.18, 0, Math.PI * 2, true);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(225, 195, 255, 1)';
    ctx.font = `${Math.max(9, o.r * 0.3)}px "Segoe UI Symbol", "Noto Sans Runic", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const count = 10;
    for (let i = 0; i < count; i++) {
      const a = time * 1.2 + (i / count) * Math.PI * 2;
      ctx.save();
      ctx.translate(o.x + Math.cos(a) * ring, o.y + Math.sin(a) * ring);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(RUNES[(i * 7) % RUNES.length]!, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Canvas 2D por cima de `host` (posição absoluta) ou da tela inteira (fixo). */
function overlay(host: HTMLElement | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: host ? 'absolute' : 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: host ? '5' : '120',
  });
  (host ?? document.body).appendChild(canvas);
  return canvas;
}

function fit(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxRatio = 1.5,
) {
  // Resolução limitada: em telas 4K/150% o canvas cheio custava 4x mais para desenhar.
  const ratio = Math.min(maxRatio, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
}

/**
 * Aura emanando dos dados. `positions` devolve, a cada quadro, onde estão os dados (pixels
 * relativos a `host`, com o raio); `power` (0 a 1) controla a intensidade (rolando = 1).
 * Devolve a função que encerra o efeito (com esmaecimento).
 */
export function startDiceAura(
  host: HTMLElement,
  aura: DiceAura,
  positions: () => AuraPoint[],
  power: () => number = () => 1,
): () => void {
  if (reducedMotion()) return () => undefined;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const canvas = overlay(host);
  const ctx = canvas.getContext('2d');
  const particles: Particle[] = [];
  const started = performance.now();
  let emitting = true;
  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
    if (!ctx) return;
    // No máximo ~60 quadros/s (monitores de 144 Hz dobravam o trabalho).
    if (now - last < 15) {
      frame = requestAnimationFrame(tick);
      return;
    }
    last = now;
    fit(canvas, ctx, host.clientWidth, host.clientHeight);
    const time = (now - started) / 1000;
    if (emitting) {
      // Aura discreta no dado (o crítico é que toma a tela): metade das partículas e do brilho.
      const strength = Math.max(0, Math.min(1, power())) * AURA_INTENSITY;
      for (const origin of positions()) {
        drawHalo(ctx, aura, origin, time, strength);
        emitAround(aura, origin, particles, strength);
      }
    }
    stepParticles(ctx, particles, host.clientHeight);
    if (emitting || particles.length) frame = requestAnimationFrame(tick);
    else canvas.remove();
  };
  frame = requestAnimationFrame(tick);
  return () => {
    emitting = false;
    // Com a aba em segundo plano a animação para: garante a limpeza.
    window.setTimeout(() => {
      cancelAnimationFrame(frame);
      canvas.remove();
    }, 4000);
  };
}

// --------------------------------------------------------------------------------------------
// Crítico: tela inteira
// --------------------------------------------------------------------------------------------

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Momento (s) em que o trecho começa a crescer. */
  t: number;
  w: number;
}

/** Galhos crescendo a partir das sementes (gelo cobrindo a tela, cipós da floresta). */
function grow(
  seeds: { x: number; y: number; a: number }[],
  options: {
    length: number;
    depth: number;
    spread: number;
    speed: number;
    jitter: number;
    max: number;
  },
): Segment[] {
  const segments: Segment[] = [];
  const branch = (x: number, y: number, a: number, depth: number, t: number, w: number) => {
    if (depth <= 0 || segments.length >= options.max) return;
    const length = options.length * rand(0.6, 1.1);
    const x2 = x + Math.cos(a) * length;
    const y2 = y + Math.sin(a) * length;
    segments.push({ x1: x, y1: y, x2, y2, t, w });
    const next = t + length / options.speed;
    branch(x2, y2, a + rand(-options.jitter, options.jitter), depth - 1, next, w * 0.86);
    if (Math.random() < 0.65)
      branch(
        x2,
        y2,
        a + (Math.random() < 0.5 ? -1 : 1) * options.spread * rand(0.6, 1.2),
        depth - 2,
        next,
        w * 0.6,
      );
  };
  for (const seed of seeds) branch(seed.x, seed.y, seed.a, options.depth, rand(0, 0.25), 2.4);
  return segments;
}

/**
 * Caveira (centro na origem, cerca de 200 unidades de altura). `jaw` abre a boca; `glow` acende
 * os olhos verdes (na caveira grande do crítico).
 */
function drawSkull(ctx: CanvasRenderingContext2D, jaw: number, glow: boolean) {
  const bone = 'rgba(236, 228, 205, 1)';
  const dark = 'rgba(26, 21, 16, 1)';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(60, 50, 38, 0.9)';
  ctx.lineWidth = 4;
  // Boca aberta por trás do queixo.
  if (jaw > 0) {
    ctx.fillStyle = dark;
    ctx.fillRect(-40, 84, 80, jaw + 10);
  }
  // Queixo (desce com a risada).
  ctx.save();
  ctx.translate(0, jaw);
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.moveTo(-56, 88);
  ctx.quadraticCurveTo(-62, 140, 0, 146);
  ctx.quadraticCurveTo(62, 140, 56, 88);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-40, 92, 80, 16);
  ctx.beginPath();
  for (let x = -40; x <= 40; x += 13.3) {
    ctx.moveTo(x, 92);
    ctx.lineTo(x, 108);
  }
  ctx.moveTo(-40, 92);
  ctx.lineTo(40, 92);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Crânio e maçãs do rosto.
  ctx.lineWidth = 4;
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(0, -18, 96, 90, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-78, 8);
  ctx.quadraticCurveTo(-74, 70, -46, 84);
  ctx.lineTo(46, 84);
  ctx.quadraticCurveTo(74, 70, 78, 8);
  ctx.closePath();
  ctx.fill();
  // Dentes de cima.
  ctx.fillRect(-42, 70, 84, 18);
  ctx.beginPath();
  for (let x = -42; x <= 42; x += 14) {
    ctx.moveTo(x, 70);
    ctx.lineTo(x, 88);
  }
  ctx.moveTo(-42, 88);
  ctx.lineTo(42, 88);
  ctx.lineWidth = 2;
  ctx.stroke();
  // Órbitas e nariz.
  ctx.fillStyle = dark;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 38, 6, 27, 31, side * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, 32);
  ctx.lineTo(-12, 58);
  ctx.quadraticCurveTo(0, 52, 12, 58);
  ctx.closePath();
  ctx.fill();
  // Rachadura.
  ctx.strokeStyle = 'rgba(60, 50, 38, 0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(18, -106);
  ctx.lineTo(10, -84);
  ctx.lineTo(24, -70);
  ctx.lineTo(14, -52);
  ctx.stroke();
  // Olhos verdes acesos.
  const eye = glowSprite(RGB.skeleton);
  ctx.globalCompositeOperation = 'lighter';
  const flicker = glow ? 0.8 + Math.random() * 0.2 : 0.7;
  for (const side of [-1, 1]) blit(ctx, eye, side * 38, 8, glow ? 30 : 18, flicker);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Camada onde os galhos são desenhados uma vez só, à medida que crescem (redesenhar milhares de
 * traços com brilho a cada quadro travava o PC).
 */
function growthLayer(
  width: number,
  height: number,
  segments: Segment[],
  paint: (ctx: CanvasRenderingContext2D, segment: Segment, index: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const layer = canvas.getContext('2d');
  const sorted = [...segments].sort((a, b) => a.t - b.t);
  let next = 0;
  return {
    canvas,
    advance(time: number) {
      if (!layer) return;
      while (next < sorted.length && sorted[next]!.t <= time) {
        paint(layer, sorted[next]!, next);
        next += 1;
      }
    },
  };
}

/** Sementes nas bordas da tela, apontando para dentro. */
function edgeSeeds(
  width: number,
  height: number,
  count: number,
  sides: ('top' | 'bottom' | 'left' | 'right')[],
) {
  const seeds: { x: number; y: number; a: number }[] = [];
  for (let i = 0; i < count; i++) {
    const side = pick(sides);
    const jitter = rand(-0.5, 0.5);
    if (side === 'top') seeds.push({ x: rand(0, width), y: 0, a: Math.PI / 2 + jitter });
    else if (side === 'bottom')
      seeds.push({ x: rand(0, width), y: height, a: -Math.PI / 2 + jitter });
    else if (side === 'left') seeds.push({ x: 0, y: rand(0, height), a: jitter });
    else seeds.push({ x: width, y: rand(0, height), a: Math.PI + jitter });
  }
  return seeds;
}

/** Círculo mágico com runas (arcana). */
function magicCircleLayers(radius: number) {
  const color = RGB.arcane;
  const size = Math.ceil(radius * 2.2);
  const prepare = (ctx: CanvasRenderingContext2D) => {
    ctx.translate(size / 2, size / 2);
    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.fillStyle = 'rgba(230, 205, 255, 1)';
    ctx.shadowColor = `rgba(${color}, 1)`;
    ctx.shadowBlur = 14;
    ctx.lineWidth = Math.max(1.5, radius / 140);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  };
  const ring = (k: number, count: number, offset: number) =>
    sprite(`circle:${Math.round(radius)}:${k}`, size, (ctx) => {
      prepare(ctx);
      ctx.beginPath();
      ctx.arc(0, 0, radius * k, 0, Math.PI * 2);
      ctx.arc(0, 0, radius * (k - 0.13), 0, Math.PI * 2, true);
      ctx.stroke();
      ctx.font = `${radius * 0.085}px "Segoe UI Symbol", "Noto Sans Runic", serif`;
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.rotate((i / count) * Math.PI * 2);
        ctx.translate(0, -radius * (k - 0.065));
        ctx.fillText(RUNES[(i * 5 + offset) % RUNES.length]!, 0, 0);
        ctx.restore();
      }
    });
  const star = sprite(`circle:${Math.round(radius)}:star`, size, (ctx) => {
    prepare(ctx);
    for (const offset of [0, Math.PI / 3]) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = offset + (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.27, 0, Math.PI * 2);
    ctx.stroke();
  });
  return { size, outer: ring(1, 24, 0), inner: ring(0.72, 16, 3), star };
}

/** Círculo mágico com runas (arcana): camadas prontas, só giradas a cada quadro. */
function magicCircle(
  ctx: CanvasRenderingContext2D,
  layers: ReturnType<typeof magicCircleLayers>,
  x: number,
  y: number,
  scale: number,
  time: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const half = layers.size / 2;
  for (const [image, speed] of [
    [layers.outer, 0.35],
    [layers.inner, -0.55],
    [layers.star, -0.8],
  ] as const) {
    ctx.save();
    ctx.rotate(time * speed);
    ctx.drawImage(image, -half, -half);
    ctx.restore();
  }
  ctx.restore();
}

/** "CRÍTICO!" no centro da tela, no estilo do tema. */
/** Altura do "CRÍTICO!" quando a cena ocupa o centro da tela. */
const TEXT_TOP: Partial<Record<DiceAura, string>> = {
  skeleton: '80%',
  cosmic: '84%',
  tarot: '90%',
  time: '86%',
};

function criticalText(aura: DiceAura, durationMs: number, top = '50%') {
  const color = diceAuraLabels[aura].color;
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.textContent = 'Crítico!';
  const font = getComputedStyle(document.body).getPropertyValue('--font-display').trim();
  Object.assign(element.style, {
    position: 'fixed',
    left: '50%',
    top,
    transform: 'translate(-50%, -50%)',
    zIndex: '121',
    pointerEvents: 'none',
    fontFamily: font || 'serif',
    fontSize: 'clamp(3.5rem, 11vw, 9rem)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    color: aura === 'shadow' ? '#d9c8ff' : '#fff',
    textShadow: `0 0 12px ${color}, 0 0 32px ${color}, 0 0 64px ${color}, 0 4px 0 rgba(0,0,0,0.6)`,
    WebkitTextStroke: `2px ${color}`,
  });
  if (aura === 'glitch')
    Object.assign(element.style, {
      fontFamily: 'ui-monospace, Consolas, monospace',
      textShadow: '-5px 0 rgba(0, 255, 255, 0.9), 5px 0 rgba(255, 0, 200, 0.9), 0 0 24px #22ff99',
      WebkitTextStroke: '0',
    });
  if (aura === 'ink')
    Object.assign(element.style, {
      color: '#101014',
      textShadow: '0 0 12px rgba(255, 250, 235, 0.9), 0 0 30px rgba(255, 250, 235, 0.7)',
      WebkitTextStroke: '1px #f2ead8',
    });
  document.body.appendChild(element);
  shakeTargets.add(element);
  window.setTimeout(() => shakeTargets.delete(element), durationMs + 100);
  const shake = aura === 'storm' || aura === 'blood' || aura === 'glitch';
  element.animate(
    [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(2.2)', filter: 'blur(8px)' },
      {
        opacity: 1,
        transform: 'translate(-50%, -50%) scale(0.95)',
        filter: 'blur(0)',
        offset: 0.12,
      },
      {
        opacity: 1,
        transform: shake ? 'translate(-51%, -49%) scale(1)' : 'translate(-50%, -50%) scale(1)',
        offset: 0.2,
      },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1.04)', offset: 0.75 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1.15)', filter: 'blur(4px)' },
    ],
    { duration: durationMs, easing: 'ease-out', fill: 'forwards' },
  );
  window.setTimeout(() => element.remove(), durationMs + 100);
}

/** Leque de raios de luz e auréola da Sagrada, desenhados uma vez. */
function holyLayers(width: number, height: number) {
  const color = RGB.holy;
  const rays = document.createElement('canvas');
  rays.width = Math.ceil(width / 2);
  rays.height = Math.ceil(height / 2);
  const r = rays.getContext('2d');
  if (r) {
    r.scale(0.5, 0.5);
    r.globalCompositeOperation = 'lighter';
    const sx = width / 2;
    const sy = -height * 0.15;
    const reach = Math.hypot(width, height) * 1.2;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 2 + (i / count - 0.5) * 2.4;
      const spread = 0.045 + (i % 3) * 0.015;
      const strength = 0.16 + (0.12 * ((i * 7) % 5)) / 4;
      const g = r.createLinearGradient(sx, sy, sx + Math.cos(a) * reach, sy + Math.sin(a) * reach);
      g.addColorStop(0, `rgba(255, 245, 200, ${strength})`);
      g.addColorStop(0.7, `rgba(${color}, ${strength * 0.4})`);
      g.addColorStop(1, `rgba(${color}, 0)`);
      r.fillStyle = g;
      r.beginPath();
      r.moveTo(sx, sy);
      r.lineTo(sx + Math.cos(a - spread) * reach, sy + Math.sin(a - spread) * reach);
      r.lineTo(sx + Math.cos(a + spread) * reach, sy + Math.sin(a + spread) * reach);
      r.closePath();
      r.fill();
    }
  }
  const radius = Math.min(width, height) * 0.3;
  const halo = sprite(`holy-halo:${Math.round(radius)}`, Math.ceil(radius * 2.6), (h, size) => {
    h.translate(size / 2, size / 2);
    h.strokeStyle = 'rgba(255, 235, 170, 0.9)';
    h.shadowColor = `rgba(${color}, 1)`;
    h.shadowBlur = 40;
    h.lineWidth = 6;
    h.beginPath();
    h.arc(0, 0, radius, 0, Math.PI * 2);
    h.stroke();
    h.lineWidth = 2;
    h.beginPath();
    h.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
    h.stroke();
  });
  return { rays, halo };
}

/** Vidro congelado: borda da tela embaçada e azulada (gelo). */
function frozenGlass(durationMs: number) {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  const mask = 'radial-gradient(ellipse at center, transparent 6%, black 45%)';
  Object.assign(element.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '119',
    pointerEvents: 'none',
    backdropFilter: 'blur(6px) saturate(0.3) brightness(1.2)',
    background:
      'radial-gradient(ellipse at center, rgba(200, 235, 255, 0.12) 10%, rgba(190, 230, 255, 0.4) 55%, rgba(235, 248, 255, 0.7) 100%)',
    maskImage: mask,
    WebkitMaskImage: mask,
  });
  document.body.appendChild(element);
  element.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { opacity: 1, offset: 0.78 },
      { opacity: 0, offset: 0.84 },
      { opacity: 0 },
    ],
    { duration: durationMs, fill: 'forwards' },
  );
  window.setTimeout(() => element.remove(), durationMs + 100);
}

/**
 * Crítico: o tema toma a tela inteira por alguns segundos, com "CRÍTICO!" no centro e o som do
 * tema (raio, jorro de sangue, gelo trincando, runas, rugido…).
 */
export function criticalAuraBurst(
  aura: DiceAura,
  options: { durationMs?: number; sound?: boolean; text?: boolean } = {},
): void {
  if (reducedMotion()) return;
  const durationMs = options.durationMs ?? 3600;
  if (options.text !== false && aura !== 'frog' && aura !== 'cat')
    criticalText(aura, durationMs - 400, TEXT_TOP[aura] ?? '50%');
  if (options.sound !== false) playCriticalSound(aura);
  if (aura === 'frost') frozenGlass(durationMs);
  const canvas = overlay(null);
  shakeTargets.add(canvas);
  window.setTimeout(() => shakeTargets.delete(canvas), durationMs + 5000);
  const ctx = canvas.getContext('2d');
  const particles: Particle[] = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  const color = RGB[aura];
  const started = performance.now();
  let flash = 0;
  // Elementos fixos de cada tema.
  const fernSegments =
    aura === 'frost'
      ? grow(edgeSeeds(width, height, 60, ['top', 'bottom', 'left', 'right']), {
          length: 30,
          depth: 11,
          spread: 0.75,
          speed: 420,
          jitter: 0.35,
          max: 4500,
        })
      : [];
  const ferns = fernSegments.length
    ? growthLayer(width, height, fernSegments, (layer, segment) => {
        layer.lineCap = 'round';
        layer.shadowColor = 'rgba(200, 240, 255, 1)';
        layer.shadowBlur = 6;
        layer.strokeStyle = 'rgba(230, 248, 255, 0.85)';
        layer.lineWidth = segment.w;
        layer.beginPath();
        layer.moveTo(segment.x1, segment.y1);
        layer.lineTo(segment.x2, segment.y2);
        layer.stroke();
      })
    : null;
  const fountains =
    aura === 'blood'
      ? Array.from({ length: 7 }, (_, i) =>
          i < 4
            ? {
                x: rand(width * 0.1, width * 0.9),
                y: height + 10,
                a: -Math.PI / 2 + rand(-0.35, 0.35),
              }
            : i === 4
              ? { x: -10, y: rand(height * 0.4, height * 0.8), a: -0.7 }
              : i === 5
                ? { x: width + 10, y: rand(height * 0.4, height * 0.8), a: Math.PI + 0.7 }
                : { x: width / 2 + rand(-80, 80), y: height + 10, a: -Math.PI / 2 },
        )
      : [];
  const circles =
    aura === 'arcane'
      ? [
          { x: width / 2, y: height / 2, r: Math.min(width, height) * 0.36, delay: 0 },
          { x: width * 0.15, y: height * 0.25, r: Math.min(width, height) * 0.13, delay: 0.4 },
          { x: width * 0.85, y: height * 0.72, r: Math.min(width, height) * 0.15, delay: 0.6 },
          { x: width * 0.82, y: height * 0.18, r: Math.min(width, height) * 0.09, delay: 0.9 },
          { x: width * 0.2, y: height * 0.8, r: Math.min(width, height) * 0.1, delay: 1.1 },
        ].map((c) => ({ ...c, layers: magicCircleLayers(c.r) }))
      : [];
  // Sagrada: leque de raios e auréola desenhados uma vez (em meia resolução).
  const holy = aura === 'holy' ? holyLayers(width, height) : null;
  const scene = SCENES[aura]?.(width, height, durationMs) ?? null;
  let last = 0;

  const tick = (now: number) => {
    if (!ctx) return;
    if (now - last < 15) {
      requestAnimationFrame(tick);
      return;
    }
    last = now;
    fit(canvas, ctx, width, height, 1);
    const elapsed = now - started;
    const time = elapsed / 1000;
    const emitting = elapsed < durationMs - 700;
    // Entrada e saída suaves dos elementos fixos.
    const presence =
      Math.min(1, elapsed / 400) * Math.min(1, Math.max(0, (durationMs - elapsed) / 700));

    // Fundo do tema (vinheta).
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    const tint =
      aura === 'shadow' || aura === 'cosmic'
        ? `rgba(6, 2, 12, ${(aura === 'cosmic' ? 0.7 : 0.8) * presence})`
        : aura === 'ink'
          ? `rgba(235, 225, 200, ${0.35 * presence})`
          : aura === 'ritual'
            ? `rgba(40, 0, 0, ${0.75 * presence})`
            : aura === 'blood'
              ? `rgba(90, 0, 10, ${(0.45 + Math.max(0, Math.sin(time * 7)) * 0.2) * presence})`
              : `rgba(${color}, ${0.28 * presence})`;
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, tint);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    if (emitting && particles.length < MAX_PARTICLES) {
      switch (aura) {
        case 'storm':
          if (Math.random() < 0.2) {
            const x = rand(0, width);
            const to = { x: x + rand(-120, 120), y: rand(height * 0.5, height) };
            particles.push(
              particle('bolt', 0, 0, {
                path: bolt({ x, y: 0 }, to, 40, 12),
                max: rand(8, 16),
                size: rand(2.5, 4.5),
                color,
              }),
            );
            flash = 0.4;
          }
          for (let i = 0; i < 3; i++)
            particles.push(
              particle('drop', rand(0, width), -10, {
                vx: -2,
                vy: rand(16, 22),
                max: 80,
                size: 1,
                color: '170, 210, 255',
              }),
            );
          break;
        case 'blood':
          // Jorros: jatos fortes saindo das bordas, caindo em arco e respingando na tela.
          for (const f of fountains) {
            const pulse = Math.max(0, Math.sin(time * 7 + f.x)) > 0.3 ? 4 : 1;
            for (let i = 0; i < pulse; i++) {
              const a = f.a + rand(-0.12, 0.12);
              const speed = rand(14, 24) * Math.min(1.3, height / 700);
              particles.push(
                particle('drop', f.x, f.y, {
                  vx: Math.cos(a) * speed,
                  vy: Math.sin(a) * speed,
                  gravity: 0.45,
                  max: 160,
                  size: rand(2.5, 5),
                  color,
                }),
              );
            }
          }
          if (Math.random() < 0.12)
            particles.push(
              particle('splat', rand(0, width), rand(0, height * 0.7), {
                max: (durationMs - elapsed) / 16,
                size: rand(14, 34),
                color: '150, 0, 18',
              }),
            );
          break;
        case 'frost':
          for (let i = 0; i < 3; i++)
            particles.push(
              particle('flake', rand(-100, width), -10, {
                vx: rand(2, 4),
                vy: rand(2, 4),
                vr: rand(-0.05, 0.05),
                max: 260,
                size: rand(3, 7),
                color,
              }),
            );
          break;
        case 'arcane':
          if (Math.random() < 0.5)
            particles.push(
              particle('rune', rand(0, width), height + 20, {
                vy: -rand(1.5, 3),
                vx: rand(-0.3, 0.3),
                max: rand(120, 200),
                size: rand(18, 34),
                glyph: rune(),
                color,
              }),
            );
          for (let i = 0; i < 2; i++)
            particles.push(
              particle('mote', rand(0, width), rand(0, height), {
                vy: -rand(0.3, 1),
                max: rand(40, 80),
                size: rand(1, 2.5),
                color: '220, 180, 255',
              }),
            );
          break;
        case 'holy':
          if (Math.random() < 0.18)
            particles.push(
              particle('feather', rand(0, width), -30, {
                vx: rand(-0.5, 0.5),
                vy: rand(0.8, 1.6),
                max: 400,
                size: rand(12, 22),
              }),
            );
          for (let i = 0; i < 2; i++)
            particles.push(
              particle('spark', rand(0, width), -10, {
                vy: rand(1.5, 3.5),
                vx: rand(-0.4, 0.4),
                max: 260,
                size: rand(1.5, 3),
                color: '255, 240, 180',
              }),
            );
          break;
        case 'forest':
          for (let i = 0; i < 2; i++)
            particles.push(
              particle('leaf', rand(-200, width), -20, {
                vx: rand(2, 4),
                vy: rand(1.5, 3),
                vr: rand(-0.08, 0.08),
                max: 300,
                size: rand(6, 12),
                color: pick([
                  '90, 170, 60',
                  '130, 190, 70',
                  '60, 140, 50',
                  '170, 200, 80',
                  '200, 160, 60',
                ]),
              }),
            );
          if (Math.random() < 0.4)
            particles.push(
              particle('firefly', rand(0, width), rand(0, height), {
                vx: rand(-0.6, 0.6),
                vy: rand(-0.6, 0.3),
                max: 120,
                size: rand(2, 3.5),
                color: '210, 255, 120',
              }),
            );
          break;
        case 'skeleton':
          // Ossos chovendo e névoa verde subindo.
          if (Math.random() < 0.35)
            particles.push(
              particle('bone', rand(0, width), -30, {
                vx: rand(-1, 1),
                vy: rand(3, 6),
                gravity: 0.12,
                vr: rand(-0.2, 0.2),
                max: 220,
                size: rand(10, 20),
              }),
            );
          for (let i = 0; i < 2; i++)
            particles.push(
              particle('wisp', rand(0, width), height + 20, {
                vx: rand(-0.4, 0.4),
                vy: -rand(1.5, 3.5),
                max: rand(80, 130),
                size: rand(40, 80),
                color,
              }),
            );
          if (Math.random() < 0.06)
            particles.push(
              particle('skull', rand(width * 0.05, width * 0.95), height + 30, {
                vy: -rand(2, 3.5),
                max: 160,
                size: rand(40, 70),
              }),
            );
          break;
        case 'fire': {
          // Fogo subindo pela parte de baixo da tela.
          const count = 9;
          for (let i = 0; i < count; i++)
            particles.push(
              particle('flame', rand(0, width), height + 20, {
                vx: rand(-0.6, 0.6),
                vy: -rand(4, 9),
                max: rand(40, 70),
                size: rand(30, 70),
              }),
            );
          for (let i = 0; i < 2; i++)
            particles.push(
              particle('ember', rand(0, width), height, {
                vx: rand(-1.5, 1.5),
                vy: -rand(3, 7),
                max: 140,
                size: rand(1.2, 2.5),
                color: '255, 170, 60',
              }),
            );
          break;
        }
        default:
          // As demais auras emitem pela cena (SCENES).
          break;
      }
    }

    // Elementos fixos de cada tema.
    if (holy) {
      // O céu se abre: clarão, leque de raios balançando e auréola atrás do texto.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const opening = elapsed < 250 ? 1 - elapsed / 250 : 0;
      if (opening > 0) {
        ctx.fillStyle = `rgba(255, 250, 230, ${opening * 0.85})`;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.save();
      ctx.globalAlpha = presence * (0.8 + 0.2 * Math.sin(time * 2.2));
      ctx.translate(width / 2, -height * 0.15);
      ctx.rotate(Math.sin(time * 0.7) * 0.04);
      ctx.translate(-width / 2, height * 0.15);
      ctx.drawImage(holy.rays, 0, 0, width, height);
      ctx.restore();
      const grow = 0.8 + 0.2 * Math.min(1, elapsed / 500);
      const half = (holy.halo.width / 2) * grow;
      ctx.globalAlpha = presence;
      ctx.drawImage(holy.halo, width / 2 - half, height / 2 - half, half * 2, half * 2);
      ctx.restore();
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(200, 235, 255, ${flash})`;
      ctx.fillRect(0, 0, width, height);
      flash = Math.max(0, flash - 0.05);
    }
    if (ferns) {
      ferns.advance(time);
      ctx.globalAlpha = presence;
      ctx.drawImage(ferns.canvas, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    for (const c of circles) {
      const local = time - c.delay;
      if (local < 0) continue;
      const grow = Math.min(1, local / 0.5);
      magicCircle(ctx, c.layers, c.x, c.y, 0.6 + 0.4 * grow, time, presence * grow);
    }
    if (aura === 'skeleton') {
      // Caveira gigante no centro, gargalhando (o queixo bate) com olhos verdes.
      const size = Math.min(width, height) * 0.0026;
      const pop = Math.min(1, elapsed / 250);
      const laugh = time > 0.25 && time < durationMs / 1000 - 0.6;
      const jaw = laugh ? Math.abs(Math.sin(time * 15)) * 22 : 0;
      ctx.save();
      ctx.globalAlpha = presence;
      ctx.translate(width / 2, height * 0.4 + (laugh ? Math.sin(time * 15) * 4 : 0));
      ctx.rotate(laugh ? Math.sin(time * 7.5) * 0.07 : 0);
      ctx.scale(size * (0.5 + 0.5 * pop), size * (0.5 + 0.5 * pop));
      drawSkull(ctx, jaw, true);
      ctx.restore();
    }
    scene?.frame(ctx, { time, elapsed, presence, emitting, particles });
    stepParticles(ctx, particles, height);
    if (elapsed < durationMs || particles.length) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
  window.setTimeout(() => canvas.remove(), durationMs + 5000);
}

// --------------------------------------------------------------------------------------------
// Cenas de crítico das auras mais elaboradas (desenhadas a cada quadro sobre a vinheta)
// --------------------------------------------------------------------------------------------

interface SceneFrame {
  time: number;
  elapsed: number;
  presence: number;
  emitting: boolean;
  particles: Particle[];
}
type Scene = { frame: (ctx: CanvasRenderingContext2D, frame: SceneFrame) => void };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3;

/** Aplica um filtro rápido na página inteira (sustos do glitch). */
let joltTimer = 0;
function pageJolt(filter: string, ms: number) {
  // Sempre volta ao normal (sem filtro): guardar o filtro "anterior" prendia a página bugada
  // quando dois sustos se sobrepunham.
  const root = document.documentElement;
  root.style.filter = filter;
  window.clearTimeout(joltTimer);
  joltTimer = window.setTimeout(() => {
    root.style.filter = '';
  }, ms);
}

/** Camada em tom sépia sobre a página (o tempo parado). */
function sepiaGlass(durationMs: number) {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '119',
    pointerEvents: 'none',
    backdropFilter: 'sepia(0.9) contrast(1.05)',
    background: 'rgba(120, 90, 40, 0.12)',
  });
  document.body.appendChild(element);
  element.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.86 },
      { opacity: 0, offset: 0.88 },
      { opacity: 0 },
    ],
    { duration: durationMs, fill: 'forwards' },
  );
  window.setTimeout(() => element.remove(), durationMs + 100);
}

/** Cores do arco-íris e dos confetes. */
const RAINBOW = [
  '255, 70, 70',
  '255, 160, 50',
  '255, 230, 60',
  '90, 220, 90',
  '70, 170, 255',
  '110, 90, 255',
  '200, 90, 255',
];
const CONFETTI = [
  '255, 80, 120',
  '255, 200, 60',
  '80, 220, 255',
  '140, 255, 120',
  '200, 120, 255',
  '255, 140, 60',
];

/** Pata de gato (`beans` = cor das almofadinhas, na pata grande). */
function drawPaw(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rot: number,
  color: string,
  beans: string | null,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.35, size * 0.55, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [
    [-0.55, -0.25],
    [-0.2, -0.6],
    [0.2, -0.6],
    [0.55, -0.25],
  ] as const;
  for (const [tx, ty] of toes) {
    ctx.beginPath();
    ctx.ellipse(tx * size, ty * size, size * 0.2, size * 0.26, tx * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (beans) {
    ctx.fillStyle = beans;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.38, size * 0.32, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [tx, ty] of toes) {
      ctx.beginPath();
      ctx.ellipse(tx * size, ty * size, size * 0.11, size * 0.14, tx * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Tremor da página (impacto do meteoro, patada do gato). */
/**
 * Tremor do crítico. Só o efeito (canvas e "CRÍTICO!") treme: mexer no `transform` do `<body>`
 * fazia tudo que é fixo na tela pular de lugar (o "bug" do Abissal, do Meteoro e do Vento).
 * Usa a propriedade `translate`, separada do `transform` que o texto já anima.
 */
const shakeTargets = new Set<HTMLElement>();
function screenShake(ms: number, strength = 8) {
  const frames = Array.from({ length: 8 }, (_, i) => ({
    translate: i === 7 ? '0 0' : `${rand(-strength, strength)}px ${rand(-strength, strength)}px`,
  }));
  for (const target of shakeTargets) target.animate(frames, { duration: ms });
}

/** Símbolo grande com brilho (o ☣ do veneno). */
function bigGlyphSprite(glyph: string, rgb: string) {
  return sprite(`big-glyph:${glyph}:${rgb}`, 256, (ctx, size) => {
    ctx.font = `${size * 0.7}px "Segoe UI Symbol", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `rgba(${rgb}, 1)`;
    ctx.shadowBlur = size * 0.08;
    ctx.fillStyle = `rgba(${rgb}, 1)`;
    ctx.fillText(glyph, size / 2, size / 2);
  });
}

/** Engrenagem metálica com brilho (latão ou aço). */
function gearSprite(radius: number, steel: boolean) {
  const r = Math.round(radius);
  return sprite(`gear2:${r}:${steel ? 'aco' : 'latao'}`, r * 2 + 16, (ctx, size) => {
    ctx.translate(size / 2, size / 2);
    gearPath(ctx, r, Math.max(8, Math.round(r / 7)));
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, steel ? '#e2e6ee' : '#f2c56a');
    g.addColorStop(0.6, steel ? '#8c93a0' : '#b07a2a');
    g.addColorStop(1, steel ? '#4a505a' : '#5e3c12');
    ctx.fillStyle = g;
    ctx.fill('evenodd');
    ctx.strokeStyle = steel ? '#30343c' : '#3c250a';
    ctx.lineWidth = Math.max(2, r / 25);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, r * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = steel ? '#30343c' : '#3c250a';
      ctx.fill();
    }
  });
}

/** Vaquinha voando no tornado. */
function drawCow(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = '#f4f1ea';
  ctx.strokeStyle = '#2a2420';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a2420';
  for (const [x, y, r] of [
    [-0.4, -0.15, 0.25],
    [0.3, 0.2, 0.2],
    [0.1, -0.3, 0.14],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x * size, y * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const x of [-0.6, -0.25, 0.25, 0.6]) ctx.fillRect(x * size - 2, size * 0.45, 4, size * 0.45);
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath();
  ctx.ellipse(size * 1.05, -size * 0.2, size * 0.35, size * 0.28, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2a0b0';
  ctx.beginPath();
  ctx.ellipse(size * 1.3, -size * 0.12, size * 0.14, size * 0.12, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** "CRÍTICO!" desenhado no próprio canvas (cenas que mexem no texto: Sapo e Gato). */
function canvasCritText(ctx: CanvasRenderingContext2D, size: number, rgb: string) {
  const font = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = `rgb(${rgb})`;
  ctx.shadowColor = `rgb(${rgb})`;
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#fff';
  ctx.strokeText('CRÍTICO!', 0, 0);
  ctx.fillText('CRÍTICO!', 0, 0);
}

const SCENES: Partial<
  Record<DiceAura, (width: number, height: number, durationMs: number) => Scene>
> = {
  cosmic: (width, height, durationMs) => {
    // A tela racha e um olho gigante e hostil abre: injetado, íris em brasa, pupila em fenda e
    // pálpebra franzida, olhando em volta e depois fixo em quem está na tela.
    const cx = width / 2;
    const cy = height * 0.42;
    const eyeW = Math.min(width, height) * 0.36;
    const cracks = Array.from({ length: 10 }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const start = { x: cx + side * eyeW * 0.95, y: cy + rand(-10, 10) };
      const a = (side > 0 ? 0 : Math.PI) + rand(-0.9, 0.9);
      const length = rand(eyeW * 0.6, eyeW * 1.8);
      return bolt(
        start,
        { x: start.x + Math.cos(a) * length, y: start.y + Math.sin(a) * length },
        18,
        8,
      );
    });
    // Veias de sangue saindo dos cantos e da borda de baixo em direção à íris.
    const veins = Array.from({ length: 14 }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const start = { x: side * eyeW * rand(0.55, 0.95), y: rand(-0.15, 0.35) * eyeW * 0.42 };
      const end = { x: side * eyeW * rand(0.2, 0.35), y: rand(-0.2, 0.2) * eyeW * 0.42 };
      return bolt(start, end, 8, 6);
    });
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const blink =
          f.time > 1.7 && f.time < 1.95 ? Math.abs(Math.cos(((f.time - 1.7) / 0.25) * Math.PI)) : 1;
        const open = easeOut(f.time / 0.6) * blink * clamp01((end - 0.3 - f.time) / 0.5);
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          for (let i = 0; i < 2; i++)
            f.particles.push(
              particle('mote', rand(0, width), rand(0, height), {
                max: rand(40, 80),
                size: rand(0.8, 2),
                color: pick(['255, 255, 255', '170, 150, 255', '140, 220, 255']),
              }),
            );
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        blit(ctx, softSprite('200, 30, 70'), cx, cy, eyeW * 1.5, 0.55 * f.presence);
        blit(ctx, softSprite('110, 40, 220'), cx, cy, eyeW * 2.1, 0.35 * f.presence);
        // Rachaduras saindo dos cantos do olho.
        const grow = clamp01(f.time / 0.45);
        ctx.globalAlpha = f.presence;
        ctx.lineJoin = 'round';
        for (const crack of cracks) {
          const count = Math.max(2, Math.round(crack.length * grow));
          for (const [width, style] of [
            [7, 'rgba(220, 40, 90, 0.35)'],
            [2, 'rgba(255, 215, 230, 1)'],
          ] as const) {
            ctx.lineWidth = width;
            ctx.strokeStyle = style;
            ctx.beginPath();
            crack
              .slice(0, count)
              .forEach((point, index) =>
                index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
              );
            ctx.stroke();
          }
        }
        ctx.restore();
        const eyeH = eyeW * 0.42 * open;
        if (eyeH < 1) return;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(cx, cy);
        const almond = () => {
          ctx.beginPath();
          ctx.moveTo(-eyeW, 0);
          ctx.quadraticCurveTo(0, -eyeH * 2, eyeW, 0);
          ctx.quadraticCurveTo(0, eyeH * 2, -eyeW, 0);
          ctx.closePath();
        };
        almond();
        ctx.save();
        ctx.clip();
        const sclera = ctx.createRadialGradient(0, 0, eyeH * 0.2, 0, 0, eyeW);
        sclera.addColorStop(0, '#f6e4e0');
        sclera.addColorStop(0.6, '#c98a96');
        sclera.addColorStop(1, '#4a0c2a');
        ctx.fillStyle = sclera;
        ctx.fillRect(-eyeW, -eyeH * 2, eyeW * 2, eyeH * 4);
        ctx.strokeStyle = 'rgba(190, 20, 40, 0.75)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        for (const vein of veins) {
          ctx.beginPath();
          vein.forEach((point, index) =>
            index
              ? ctx.lineTo(point.x, point.y * (eyeH / (eyeW * 0.42)))
              : ctx.moveTo(point.x, point.y * (eyeH / (eyeW * 0.42))),
          );
          ctx.stroke();
        }
        // Olha em volta rápido e depois crava o olhar no centro, com tremidas.
        const wander = clamp01(1 - (f.time - 0.9) / 0.3);
        const look = {
          x: Math.sin(f.time * 4) * eyeW * 0.35 * wander + rand(-2, 2),
          y: Math.sin(f.time * 5.3) * eyeH * 0.2 * wander + rand(-2, 2),
        };
        const iris = eyeW * 0.3;
        const irisFill = ctx.createRadialGradient(look.x, look.y, 0, look.x, look.y, iris);
        irisFill.addColorStop(0, '#fff4c0');
        irisFill.addColorStop(0.3, '#ff7a1a');
        irisFill.addColorStop(0.72, '#b0102a');
        irisFill.addColorStop(1, '#22000a');
        ctx.fillStyle = irisFill;
        ctx.beginPath();
        ctx.arc(look.x, look.y, iris, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(
          look.x,
          look.y,
          iris * (wander > 0 ? 0.14 : 0.07),
          iris * 0.85,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(look.x - iris * 0.35, look.y - iris * 0.35, iris * 0.08, 0, Math.PI * 2);
        ctx.fill();
        // Pálpebra franzida em "V" (cara fechada) e sombra por baixo dela.
        ctx.fillStyle = '#14041c';
        ctx.beginPath();
        ctx.moveTo(-eyeW, -eyeH * 2);
        ctx.lineTo(eyeW, -eyeH * 2);
        ctx.lineTo(eyeW, -eyeH * 0.75);
        ctx.quadraticCurveTo(eyeW * 0.4, -eyeH * 0.55, 0, -eyeH * 0.2);
        ctx.quadraticCurveTo(-eyeW * 0.4, -eyeH * 0.55, -eyeW, -eyeH * 0.75);
        ctx.closePath();
        ctx.fill();
        const lid = ctx.createLinearGradient(0, -eyeH * 0.2, 0, eyeH * 0.4);
        lid.addColorStop(0, 'rgba(20, 4, 28, 0.7)');
        lid.addColorStop(1, 'rgba(20, 4, 28, 0)');
        ctx.fillStyle = lid;
        ctx.fillRect(-eyeW, -eyeH * 0.6, eyeW * 2, eyeH);
        ctx.restore();
        almond();
        ctx.strokeStyle = 'rgba(255, 120, 150, 0.95)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(220, 30, 80, 1)';
        ctx.shadowBlur = 25;
        ctx.stroke();
        ctx.restore();
      },
    };
  },
  tarot: (width, height) => {
    // Três cartas caem e viram: a Lua, o Crítico e o Sol.
    const cardH = Math.min(height * 0.5, width * 0.42);
    const cardW = cardH / 1.6;
    const gap = cardW * 0.25;
    // Três cartas diferentes, sorteadas entre os 22 arcanos maiores.
    const faces = [...MAJOR_ARCANA]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(cardFaceSprite);
    const back = cardBackSprite();
    return {
      frame(ctx, f) {
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          f.particles.push(
            particle('spark', rand(0, width), rand(0, height), {
              vy: -rand(0.2, 0.8),
              max: rand(40, 70),
              size: rand(1, 2.2),
              color: '225, 190, 255',
            }),
          );
        for (let i = 0; i < 3; i++) {
          const local = f.time - i * 0.22;
          if (local < 0) continue;
          const x = width / 2 + (i - 1) * (cardW + gap);
          const y = -cardH + (height * 0.42 + cardH) * easeOut(local / 0.45);
          const flip = clamp01((f.time - (0.9 + i * 0.3)) / 0.35);
          const float = Math.sin(f.time * 2 + i) * 4;
          if (i === 1 && flip > 0.5) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            blit(ctx, softSprite('190, 140, 255'), x, y, cardH * 0.9, 0.5 * f.presence);
            ctx.restore();
          }
          ctx.save();
          ctx.globalAlpha = f.presence;
          ctx.translate(x, y + float);
          ctx.rotate((i - 1) * 0.08 * (1 - flip));
          ctx.scale(Math.max(0.02, Math.abs(Math.cos(flip * Math.PI))), 1);
          ctx.drawImage(flip < 0.5 ? back : faces[i]!, -cardH / 2, -cardH / 2, cardH, cardH);
          ctx.restore();
        }
      },
    };
  },
  glitch: (width, height, durationMs) => {
    // A página "buga" em sustos rápidos; chuva de caracteres, faixas e chiado.
    for (let i = 0; i < 5; i++)
      window.setTimeout(
        () =>
          pageJolt(
            pick([
              'hue-rotate(90deg) saturate(3)',
              'invert(1)',
              'hue-rotate(200deg) contrast(1.6)',
            ]),
            rand(60, 120),
          ),
        rand(100, durationMs - 800),
      );
    // No fim, a página volta ao normal... menos em 10% das vezes: fica em negativo até recarregar.
    const cursed = Math.random() < 0.1;
    window.setTimeout(() => {
      document.documentElement.style.filter = cursed ? 'invert(1)' : '';
    }, durationMs);
    const scan = document.createElement('canvas');
    scan.width = 1;
    scan.height = 4;
    const sctx = scan.getContext('2d');
    if (sctx) {
      sctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      sctx.fillRect(0, 0, 1, 1);
    }
    const glyphs = [...'01アイウエオカキクケコ#$%'];
    return {
      frame(ctx, f) {
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          for (let i = 0; i < 4; i++)
            f.particles.push(
              particle('rune', Math.round(rand(0, width) / 22) * 22, -20, {
                vy: rand(8, 14),
                max: 90,
                size: rand(14, 20),
                glyph: pick(glyphs),
                color: '0, 255, 140',
              }),
            );
        ctx.save();
        ctx.globalAlpha = f.presence;
        const pattern = ctx.createPattern(scan, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.globalCompositeOperation = 'lighter';
        const bars = Math.floor(rand(0, 4));
        for (let i = 0; i < bars; i++) {
          ctx.fillStyle = pick([
            'rgba(0, 255, 255, 0.25)',
            'rgba(255, 0, 200, 0.25)',
            'rgba(0, 255, 140, 0.2)',
          ]);
          ctx.fillRect(
            rand(-100, width * 0.3),
            rand(0, height),
            rand(width * 0.4, width),
            rand(4, 30),
          );
        }
        for (let i = 0; i < 18; i++) {
          ctx.fillStyle = pick([
            'rgba(0, 255, 140, 0.6)',
            'rgba(255, 0, 200, 0.5)',
            'rgba(255, 255, 255, 0.5)',
          ]);
          ctx.fillRect(rand(0, width), rand(0, height), rand(4, 40), rand(2, 10));
        }
        ctx.restore();
      },
    };
  },
  ink: (width, height) => {
    // Um pincel invisível pinta um ensō (círculo zen) que respinga e escorre.
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const lctx = layer.getContext('2d');
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.32;
    const start = -2.2;
    const sweep = Math.PI * 2 * 0.92;
    let painted = 0;
    let splashed = false;
    return {
      frame(ctx, f) {
        const target = clamp01((f.time - 0.15) / 1.1) * sweep;
        if (lctx) {
          lctx.lineCap = 'round';
          for (; painted < target; painted += 0.02) {
            const progress = painted / sweep;
            const a1 = start + painted;
            const a2 = a1 + 0.025;
            const thickness = radius * 0.26 * (1 - 0.7 * progress) * rand(0.85, 1.15);
            for (let k = -3; k <= 3; k++) {
              const r = radius + (k * thickness) / 7;
              lctx.globalAlpha = rand(0.55, 1);
              lctx.strokeStyle = 'rgba(12, 12, 16, 1)';
              lctx.lineWidth = (thickness / 7) * rand(0.7, 1.4);
              lctx.beginPath();
              lctx.moveTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
              lctx.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
              lctx.stroke();
            }
          }
        }
        if (!splashed && f.time > 1.25) {
          splashed = true;
          for (let i = 0; i < 26; i++) {
            const a = rand(0, Math.PI * 2);
            const r = radius * rand(0.8, 1.6);
            f.particles.push(
              particle('splat', cx + Math.cos(a) * r, cy + Math.sin(a) * r, {
                max: 140,
                size: rand(6, 22),
                color: '12, 12, 16',
              }),
            );
          }
          for (let i = 0; i < 30; i++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('drop', cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, {
                vx: Math.cos(a) * rand(4, 10),
                vy: Math.sin(a) * rand(4, 10) - 2,
                gravity: 0.35,
                max: 70,
                size: rand(2, 4),
                color: '12, 12, 16',
              }),
            );
          }
        }
        // Papel de arroz por baixo (a tinta preta aparece de verdade).
        ctx.save();
        ctx.globalAlpha = f.presence * 0.94;
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = f.presence * 0.25;
        const fiber = ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          Math.max(width, height) * 0.7,
        );
        fiber.addColorStop(0, 'rgba(255, 255, 255, 0)');
        fiber.addColorStop(1, 'rgba(140, 110, 70, 1)');
        ctx.fillStyle = fiber;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        ctx.globalAlpha = f.presence;
        ctx.drawImage(layer, 0, 0, width, height);
        // Carimbo vermelho ("golpe certeiro") quando o círculo termina.
        const stamp = clamp01((f.time - 1.45) / 0.15);
        if (stamp > 0) {
          const size = radius * 0.32;
          ctx.save();
          ctx.translate(cx + radius * 0.95, cy + radius * 0.75);
          ctx.rotate(-0.08);
          ctx.scale(1.6 - 0.6 * stamp, 1.6 - 0.6 * stamp);
          ctx.globalAlpha = f.presence * stamp * 0.92;
          ctx.fillStyle = '#c4161c';
          ctx.beginPath();
          ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.12);
          ctx.fill();
          ctx.fillStyle = '#f6e7d0';
          ctx.font = `bold ${size * 0.36}px "Yu Mincho", "MS Mincho", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('会', 0, -size * 0.2);
          ctx.fillText('心', 0, size * 0.2);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
    };
  },
  claw: (width, height) => {
    // Garras de urso: dois golpes rasgam a tela com três (depois quatro) cortes verdes brilhantes.
    const tear = (from: Point, to: Point, maxWidth: number, curve: number) => {
      const steps = 18;
      const top: Point[] = [];
      const bottom: Point[] = [];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      const nx = -dy / length;
      const ny = dx / length;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const bend = Math.sin(u * Math.PI) * curve;
        const cx = from.x + dx * u + nx * bend;
        const cy = from.y + dy * u + ny * bend;
        const w = maxWidth * Math.sin(u * Math.PI) ** 0.7;
        top.push({
          x: cx + nx * (w / 2) * rand(0.7, 1.15),
          y: cy + ny * (w / 2) * rand(0.7, 1.15),
        });
        bottom.push({
          x: cx - nx * (w / 2) * rand(0.7, 1.15),
          y: cy - ny * (w / 2) * rand(0.7, 1.15),
        });
      }
      return { top, bottom };
    };
    const swipe = (at: number, count: number, ax: number, ay: number, bx: number, by: number) => {
      const gap = Math.min(width, height) * 0.08;
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy);
      const nx = -dy / length;
      const ny = dx / length;
      return {
        at,
        done: false,
        tears: Array.from({ length: count }, (_, i) => {
          const offset = (i - (count - 1) / 2) * gap;
          return tear(
            { x: ax + nx * offset, y: ay + ny * offset },
            { x: bx + nx * offset, y: by + ny * offset },
            Math.min(width, height) * 0.045,
            Math.min(width, height) * 0.05,
          );
        }),
      };
    };
    const swipes = [
      swipe(0.3, 3, width * 0.12, height * 0.08, width * 0.78, height * 0.92),
      swipe(0.9, 4, width * 0.9, height * 0.12, width * 0.2, height * 0.88),
    ];
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        for (const s of swipes) {
          const p = clamp01((f.time - s.at) / 0.14);
          if (p <= 0) continue;
          if (!s.done) {
            s.done = true;
            screenShake(300, 12);
            for (const t of s.tears)
              for (let k = 0; k < 12; k++) {
                const point = t.top[Math.floor(rand(0, t.top.length))]!;
                f.particles.push(
                  particle('spark', point.x, point.y, {
                    vx: rand(-4, 4),
                    vy: rand(-4, 4),
                    gravity: 0.1,
                    max: rand(30, 50),
                    size: rand(1.5, 2.5),
                    color: '120, 255, 160',
                  }),
                );
              }
          }
          for (const t of s.tears) {
            const n = Math.max(2, Math.round(t.top.length * p));
            const top = t.top.slice(0, n);
            const bottom = t.bottom.slice(0, n).reverse();
            const shape = () => {
              ctx.beginPath();
              top.forEach((point, i) =>
                i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
              );
              for (const point of bottom) ctx.lineTo(point.x, point.y);
              ctx.closePath();
            };
            // Brilho verde em volta do rasgo, interior escuro e borda clara.
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(60, 255, 120, 0.35)';
            ctx.lineWidth = 16;
            ctx.lineJoin = 'round';
            shape();
            ctx.stroke();
            ctx.restore();
            ctx.fillStyle = '#021208';
            shape();
            ctx.fill();
            ctx.strokeStyle = 'rgba(190, 255, 205, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }
        }
        ctx.restore();
      },
    };
  },
  ritual: (width, height) => {
    // Um pentagrama demoníaco se desenha sozinho: o círculo, depois a estrela; velas acendem nas
    // pontas, runas giram entre os círculos e labaredas sobem das linhas.
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width, height) * 0.38;
    const point = (i: number) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    };
    const star = [0, 2, 4, 1, 3, 0].map(point);
    const stroke = (ctx: CanvasRenderingContext2D, draw: () => void) => {
      for (const [w, style] of [
        [10, 'rgba(255, 30, 20, 0.25)'],
        [3, 'rgba(255, 90, 60, 1)'],
      ] as const) {
        ctx.lineWidth = w;
        ctx.strokeStyle = style;
        ctx.beginPath();
        draw();
        ctx.stroke();
      }
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        blit(
          ctx,
          softSprite('255, 30, 20'),
          cx,
          cy,
          R * 1.6,
          (0.35 + Math.sin(t * 5) * 0.08) * f.presence,
        );
        ctx.globalAlpha = f.presence;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Círculo externo traçado.
        const circle = clamp01(t / 0.5);
        stroke(ctx, () =>
          ctx.arc(cx, cy, R * 1.08, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * circle),
        );
        // Estrela traçada linha por linha.
        const lines = clamp01((t - 0.5) / 0.6) * 5;
        stroke(ctx, () => {
          ctx.moveTo(star[0]!.x, star[0]!.y);
          for (let i = 1; i <= 5; i++) {
            const part = Math.min(1, lines - (i - 1));
            if (part <= 0) break;
            const from = star[i - 1]!;
            const to = star[i]!;
            ctx.lineTo(from.x + (to.x - from.x) * part, from.y + (to.y - from.y) * part);
          }
        });
        // Círculo interno e runas girando entre os dois.
        const inner = clamp01((t - 1.1) / 0.3);
        if (inner > 0) {
          stroke(ctx, () => ctx.arc(cx, cy, R * 1.24, 0, Math.PI * 2));
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2 + t * 0.3;
            blit(
              ctx,
              runeSprite(RUNES[(i * 7) % RUNES.length]!, '255, 50, 40'),
              cx + Math.cos(a) * R * 1.16,
              cy + Math.sin(a) * R * 1.16,
              R * 0.07,
              inner * f.presence,
            );
          }
        }
        ctx.restore();
        // Velas nas pontas.
        const candles = clamp01((t - 0.9) / 0.3);
        if (candles > 0) {
          for (let i = 0; i < 5; i++) {
            const p = point(i);
            ctx.save();
            ctx.globalAlpha = f.presence * candles;
            ctx.fillStyle = '#e8dcc0';
            ctx.fillRect(p.x - 7, p.y - 6, 14, 30);
            ctx.globalCompositeOperation = 'lighter';
            blit(
              ctx,
              flameSprite(1),
              p.x + Math.sin(t * 13 + i) * 1.5,
              p.y - 14,
              12 + Math.random() * 3,
              f.presence * candles,
            );
            ctx.restore();
          }
        }
        if (f.emitting && f.particles.length < MAX_PARTICLES && t > 1)
          for (let i = 0; i < 2; i++) {
            const k = Math.floor(rand(0, 5));
            const u = Math.random();
            const a = star[k]!;
            const b = star[k + 1]!;
            f.particles.push(
              particle('flame', a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, {
                vy: -rand(1, 2.5),
                max: rand(25, 40),
                size: rand(10, 18),
              }),
            );
          }
      },
    };
  },
  skeleton: (width, height) => {
    // Cemitério: lápides sobem do chão e mãos de esqueleto saem da terra entre elas.
    const tombs = Array.from({ length: 6 }, (_, i) => ({
      x: width * (0.07 + i * 0.172) + rand(-20, 20),
      w: rand(70, 95),
      h: rand(110, 150),
      tilt: rand(-0.08, 0.08),
      delay: i * 0.08,
    }));
    const hands = Array.from({ length: 4 }, (_, i) => ({
      x: width * (0.155 + i * 0.23) + rand(-15, 15),
      delay: 0.6 + i * 0.15,
      phase: rand(0, 6),
    }));
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Terra.
        ctx.fillStyle = '#1c140e';
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width + 40; x += 40)
          ctx.lineTo(x, height - 26 - Math.sin(x * 0.02) * 8);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        for (const tomb of tombs) {
          const rise = easeOut((f.time - tomb.delay) / 0.5);
          if (rise <= 0) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width, height - 22);
          ctx.clip();
          ctx.translate(tomb.x, height - 22 + (1 - rise) * tomb.h);
          ctx.rotate(tomb.tilt);
          ctx.fillStyle = '#6d6a66';
          ctx.strokeStyle = '#2f2c29';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-tomb.w / 2, 0);
          ctx.lineTo(-tomb.w / 2, -tomb.h + tomb.w / 2);
          ctx.arc(0, -tomb.h + tomb.w / 2, tomb.w / 2, Math.PI, 0);
          ctx.lineTo(tomb.w / 2, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#3a3734';
          ctx.font = `bold ${tomb.w * 0.28}px serif`;
          ctx.textAlign = 'center';
          ctx.fillText('RIP', 0, -tomb.h * 0.55);
          ctx.strokeStyle = 'rgba(40, 36, 32, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tomb.w * 0.15, -tomb.h * 0.85);
          ctx.lineTo(tomb.w * 0.05, -tomb.h * 0.7);
          ctx.lineTo(tomb.w * 0.2, -tomb.h * 0.6);
          ctx.stroke();
          ctx.restore();
        }
        // Mãos ossudas saindo da terra, mexendo os dedos.
        for (const hand of hands) {
          const rise = easeOut((f.time - hand.delay) / 0.5);
          if (rise <= 0) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width, height - 20);
          ctx.clip();
          ctx.translate(hand.x, height - 20 + (1 - rise) * 120);
          ctx.rotate(Math.sin(f.time * 3 + hand.phase) * 0.12);
          ctx.strokeStyle = '#ece4cd';
          ctx.lineCap = 'round';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(-5, 0);
          ctx.lineTo(-5, -60);
          ctx.moveTo(5, 0);
          ctx.lineTo(5, -60);
          ctx.stroke();
          ctx.fillStyle = '#ece4cd';
          ctx.beginPath();
          ctx.ellipse(0, -72, 16, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 4.5;
          for (let k = 0; k < 4; k++) {
            const bend = Math.sin(f.time * 8 + k + hand.phase) * 0.35;
            const bx = -12 + k * 8;
            ctx.beginPath();
            ctx.moveTo(bx, -82);
            ctx.lineTo(bx + Math.sin(bend) * 10, -100);
            ctx.lineTo(bx + Math.sin(bend * 2) * 16, -114);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(16, -72);
          ctx.lineTo(28, -86);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },
  frost: (width, height, durationMs) => {
    // No fim, o gelo que cobriu tudo se estilhaça e os cacos caem.
    let broke = false;
    return {
      frame(ctx, f) {
        const at = durationMs / 1000 - 0.75;
        if (!broke && f.time >= at) {
          broke = true;
          for (let i = 0; i < 70; i++)
            f.particles.push(
              particle('shard', rand(0, width), rand(0, height), {
                vx: rand(-2, 2),
                vy: rand(-2, 1),
                gravity: 0.35,
                vr: rand(-0.15, 0.15),
                max: 90,
                size: rand(12, 34),
              }),
            );
        }
        const flash = 1 - Math.abs(f.time - at) / 0.1;
        if (flash > 0) {
          ctx.fillStyle = `rgba(235, 250, 255, ${flash * 0.6})`;
          ctx.fillRect(0, 0, width, height);
        }
      },
    };
  },
  shadow: (width, height, durationMs) => {
    // A escuridão consome tudo: um breu fecha a tela até sobrar só um círculo de luz no texto,
    // com tentáculos de sombra e olhos acendendo no escuro; no fim, recua.
    const cx = width / 2;
    const cy = height / 2;
    const far = Math.hypot(width, height) / 2 + 60;
    const near = Math.min(width, height) * 0.2;
    const eyes = Array.from({ length: 12 }, () => ({
      x: rand(0, width),
      y: rand(0, height),
      phase: rand(0, 6),
      size: rand(5, 9),
    }));
    const tendrils = Array.from({ length: 16 }, (_, i) => ({
      a: (i / 16) * Math.PI * 2 + rand(-0.15, 0.15),
      reach: rand(0.25, 0.6),
      phase: rand(0, 6),
    }));
    const dark = 'rgba(3, 1, 8, 0.97)';
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const close = easeOut(f.time / 1.4) * (1 - easeOut((f.time - (end - 0.7)) / 0.7));
        const r = far - (far - near) * close;
        const ring = (radius: number) => {
          for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            const noise = Math.sin(a * 5 + f.time * 3) * 0.06 + Math.sin(a * 9 - f.time * 2) * 0.04;
            const x = cx + Math.cos(a) * radius * (1 + noise);
            const y = cy + Math.sin(a) * radius * (1 + noise) * 0.8;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.closePath();
        };
        ctx.save();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ring(r);
        ctx.fill('evenodd');
        // Borda esfumada da luz.
        const soft = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
        soft.addColorStop(0, 'rgba(3, 1, 8, 0)');
        soft.addColorStop(1, 'rgba(3, 1, 8, 0.85)');
        ctx.fillStyle = soft;
        ctx.beginPath();
        ring(r * 1.02);
        ctx.fill();
        // Tentáculos de sombra avançando para dentro.
        ctx.strokeStyle = dark;
        ctx.lineCap = 'round';
        for (const t of tendrils) {
          const steps = 6;
          let x = cx + Math.cos(t.a) * r;
          let y = cy + Math.sin(t.a) * r * 0.8;
          const length = r * t.reach * close;
          for (let k = 1; k <= steps; k++) {
            const u = k / steps;
            const a = t.a + Math.PI + Math.sin(u * 4 + f.time * 3 + t.phase) * 0.5;
            const nx = x + Math.cos(a) * (length / steps);
            const ny = y + Math.sin(a) * (length / steps) * 0.8;
            ctx.lineWidth = 18 * (1 - u) + 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            x = nx;
            y = ny;
          }
        }
        // Brilho roxo na borda e olhos no escuro.
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(130, 70, 220, ${0.35 * close})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ring(r);
        ctx.stroke();
        const eye = glowSprite('190, 90, 255');
        for (const e of eyes) {
          const outside = Math.hypot(e.x - cx, (e.y - cy) / 0.8) > r * 1.1;
          const open = Math.sin(f.time * 2 + e.phase) > -0.5 ? 1 : 0;
          if (!outside || !open) continue;
          blit(ctx, eye, e.x - e.size * 1.6, e.y, e.size * 2, close);
          blit(ctx, eye, e.x + e.size * 1.6, e.y, e.size * 2, close);
        }
        ctx.restore();
      },
    };
  },
  gears: (width, height) => {
    // Uma máquina: trens de engrenagens engatadas no alto e embaixo, uma engrenagem enorme atrás
    // do texto, vapor escapando, faíscas nos encaixes e arcos elétricos.
    const train = (edge: 'top' | 'bottom') => {
      const gears: { x: number; y: number; r: number; dir: number; steel: boolean }[] = [];
      const sizes = [70, 46, 92, 54, 78, 40, 86, 60];
      let x = -30;
      let i = 0;
      while (x < width + 120) {
        const r = sizes[i % sizes.length]!;
        if (gears.length) {
          const prev = gears[gears.length - 1]!;
          x = prev.x + (prev.r + r) * 0.9;
        }
        gears.push({
          x,
          y: edge === 'top' ? r * 0.45 : height - r * 0.45,
          r,
          dir: i % 2 ? -1 : 1,
          steel: i % 3 === 1,
        });
        i += 1;
      }
      return gears;
    };
    const trains = [train('top'), train('bottom')];
    const big = Math.min(width, height) * 0.32;
    const bigImage = gearSprite(big, false);
    return {
      frame(ctx, f) {
        const slide = easeOut(f.time / 0.6);
        ctx.save();
        ctx.globalAlpha = f.presence * 0.35;
        ctx.translate(width / 2, height / 2);
        ctx.rotate(f.time * 0.3);
        ctx.drawImage(bigImage, -bigImage.width / 2, -bigImage.height / 2);
        ctx.restore();
        trains.forEach((gears, row) => {
          for (const g of gears) {
            const image = gearSprite(g.r, g.steel);
            const offset = (1 - slide) * g.r * 2.2 * (row === 0 ? -1 : 1);
            ctx.save();
            ctx.globalAlpha = f.presence;
            ctx.translate(g.x, g.y + offset);
            // Velocidade inversa ao raio: as engrenagens engatadas giram juntas.
            ctx.rotate((f.time * 60 * g.dir) / g.r);
            ctx.drawImage(image, -image.width / 2, -image.height / 2);
            ctx.restore();
          }
        });
        if (!f.emitting || f.particles.length > MAX_PARTICLES) return;
        const gears = pick(trains);
        const index = Math.floor(rand(0, gears.length - 1));
        const a = gears[index]!;
        const b = gears[index + 1]!;
        const contact = { x: a.x + (b.x - a.x) * (a.r / (a.r + b.r)), y: a.y + (b.y - a.y) * 0.5 };
        if (Math.random() < 0.6)
          for (let k = 0; k < 3; k++)
            f.particles.push(
              particle('spark', contact.x, contact.y, {
                vx: rand(-4, 4),
                vy: gears === trains[0] ? rand(1, 5) : rand(-6, -1),
                gravity: 0.3,
                max: 40,
                size: rand(1, 2),
                color: '255, 190, 80',
              }),
            );
        if (Math.random() < 0.12)
          for (let k = 0; k < 5; k++)
            f.particles.push(
              particle('wisp', a.x, a.y, {
                vx: rand(-1, 1),
                vy: gears === trains[0] ? rand(1, 3) : -rand(1, 3),
                max: rand(50, 80),
                size: rand(30, 60),
                color: '235, 235, 240',
              }),
            );
        if (Math.random() < 0.06)
          f.particles.push(
            particle('bolt', 0, 0, {
              path: bolt(
                { x: a.x, y: a.y },
                { x: width / 2 + rand(-big, big), y: height / 2 + rand(-big, big) * 0.5 },
                30,
                10,
              ),
              max: 8,
              size: 3,
              color: '80, 230, 255',
            }),
          );
      },
    };
  },
  forest: (width, height, durationMs) => {
    // Árvores crescem do chão, galhos se abrem em folhas e flores, pétalas e vaga-lumes.
    type Branch = Segment & { tip: boolean; seed: number };
    const branches: Branch[] = [];
    const tree = (x: number, scale: number) => {
      const grow = (
        x1: number,
        y1: number,
        a: number,
        length: number,
        depth: number,
        t: number,
        w: number,
      ) => {
        const x2 = x1 + Math.cos(a) * length;
        const y2 = y1 + Math.sin(a) * length;
        branches.push({ x1, y1, x2, y2, t, w, tip: depth === 1, seed: Math.random() });
        if (depth <= 1) return;
        const next = t + length / 520;
        grow(x2, y2, a - rand(0.25, 0.55), length * rand(0.68, 0.8), depth - 1, next, w * 0.7);
        grow(x2, y2, a + rand(0.25, 0.55), length * rand(0.68, 0.8), depth - 1, next, w * 0.7);
        if (Math.random() < 0.3)
          grow(x2, y2, a + rand(-0.15, 0.15), length * 0.6, depth - 2, next, w * 0.6);
      };
      grow(
        x,
        height + 10,
        -Math.PI / 2 + rand(-0.08, 0.08),
        height * 0.17 * scale,
        8,
        rand(0, 0.25),
        16 * scale,
      );
    };
    tree(width * 0.08, 1.1);
    tree(width * 0.27, 0.8);
    tree(width * 0.73, 0.85);
    tree(width * 0.93, 1.15);
    branches.sort((a, b) => a.t - b.t);
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const lctx = layer.getContext('2d');
    let next = 0;
    const greens = ['#3f8f2f', '#58a83a', '#2f7a28', '#79bf4a'];
    return {
      frame(ctx, f) {
        if (lctx) {
          lctx.lineCap = 'round';
          while (next < branches.length && branches[next]!.t <= f.time) {
            const b = branches[next]!;
            lctx.strokeStyle = '#4a3018';
            lctx.lineWidth = b.w;
            lctx.beginPath();
            lctx.moveTo(b.x1, b.y1);
            lctx.lineTo(b.x2, b.y2);
            lctx.stroke();
            if (b.tip) {
              for (let k = 0; k < 3; k++) {
                lctx.fillStyle = greens[Math.floor(b.seed * 10 + k) % greens.length]!;
                lctx.beginPath();
                lctx.arc(b.x2 + rand(-8, 8), b.y2 + rand(-8, 8), rand(7, 13), 0, Math.PI * 2);
                lctx.fill();
              }
              if (b.seed < 0.3) {
                // Flor de cinco pétalas.
                lctx.fillStyle = b.seed < 0.15 ? '#ff9ec8' : '#fff4f8';
                for (let k = 0; k < 5; k++) {
                  const a = (k / 5) * Math.PI * 2;
                  lctx.beginPath();
                  lctx.arc(b.x2 + Math.cos(a) * 5, b.y2 + Math.sin(a) * 5, 4, 0, Math.PI * 2);
                  lctx.fill();
                }
                lctx.fillStyle = '#ffd34a';
                lctx.beginPath();
                lctx.arc(b.x2, b.y2, 3, 0, Math.PI * 2);
                lctx.fill();
              }
            }
            next += 1;
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.drawImage(layer, 0, 0, width, height);
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES && f.time > 0.8 && Math.random() < 0.5)
          f.particles.push(
            particle('leaf', rand(0, width), -10, {
              vx: rand(0.5, 2),
              vy: rand(1, 2),
              vr: rand(-0.08, 0.08),
              max: 300,
              size: rand(5, 8),
              color: pick(['255, 158, 200', '255, 230, 240', '255, 190, 220']),
            }),
          );
        void durationMs;
      },
    };
  },
  wind: (width, height, durationMs) => {
    // Um tornado desce, gira no meio da tela arrastando pedras, folhas e uma vaca.
    const cx = width / 2;
    const top = Math.min(width * 0.28, height * 0.45);
    const debris = Array.from({ length: 26 }, (_, i) => ({
      angle: rand(0, Math.PI * 2),
      y: rand(0.2, 1),
      speed: rand(3, 6),
      size: rand(4, 10),
      kind: i === 0 ? 'cow' : Math.random() < 0.5 ? 'rock' : 'leaf',
    }));
    const streaks = Array.from({ length: 24 }, () => ({
      x: rand(0, width),
      y: rand(0, height),
      length: rand(60, 200),
      speed: rand(14, 26),
    }));
    const funnelX = (y: number, t: number) =>
      cx + Math.sin(y * 0.008 + t * 2) * 50 * (y / height) + Math.sin(t * 0.9) * width * 0.08;
    const radiusAt = (y: number) => top * (1 - y / height) ** 1.4 + 18;
    let shook = false;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const reach = easeOut(f.time / 0.6) * (1 - easeOut((f.time - (end - 0.6)) / 0.6));
        const bottom = height * reach;
        if (!shook && f.time > 0.6) {
          shook = true;
          screenShake(600, 6);
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Rajadas atravessando a tela.
        ctx.strokeStyle = 'rgba(230, 245, 250, 0.35)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        for (const s of streaks) {
          s.x += s.speed;
          if (s.x - s.length > width) s.x = -rand(0, 200);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.length, s.y + Math.sin(f.time * 4 + s.y) * 6);
          ctx.stroke();
        }
        // Funil: corpo translúcido e anéis girando.
        ctx.fillStyle = 'rgba(150, 160, 170, 0.28)';
        ctx.beginPath();
        for (let y = 0; y <= bottom; y += 20) ctx.lineTo(funnelX(y, f.time) - radiusAt(y), y);
        for (let y = bottom; y >= 0; y -= 20) ctx.lineTo(funnelX(y, f.time) + radiusAt(y), y);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([40, 26]);
        ctx.lineDashOffset = -f.time * 400;
        for (let y = 0; y <= bottom; y += height / 28) {
          const r = radiusAt(y);
          ctx.strokeStyle = `rgba(220, 230, 235, ${0.25 + 0.2 * Math.sin(y * 0.05)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(funnelX(y, f.time), y, r, r * 0.22, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // Detritos girando em volta do funil.
        for (const d of debris) {
          d.angle += d.speed * 0.02;
          d.y -= 0.002;
          if (d.y < 0.05) d.y = 1;
          const y = d.y * bottom;
          if (y <= 0) continue;
          const r = radiusAt(y) * 1.15;
          const x = funnelX(y, f.time) + Math.cos(d.angle) * r;
          const depth = 0.6 + 0.4 * Math.sin(d.angle);
          ctx.save();
          ctx.translate(x, y + Math.sin(d.angle) * r * 0.2);
          ctx.rotate(d.angle * 2);
          ctx.scale(depth, depth);
          if (d.kind === 'cow') drawCow(ctx, 22);
          else if (d.kind === 'rock') {
            ctx.fillStyle = '#6b625a';
            ctx.beginPath();
            ctx.arc(0, 0, d.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#6fae45';
            ctx.beginPath();
            ctx.ellipse(0, 0, d.size, d.size * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES && reach > 0.9)
          for (let i = 0; i < 2; i++)
            f.particles.push(
              particle('wisp', funnelX(bottom, f.time) + rand(-80, 80), bottom - 10, {
                vx: rand(-3, 3),
                vy: -rand(0.5, 1.5),
                max: 60,
                size: rand(30, 60),
                color: '170, 150, 120',
              }),
            );
      },
    };
  },
  abyss: (width, height, durationMs) => {
    // O kraken: a água sobe, um olho gigante surge e tentáculos se erguem e esmagam a tela,
    // rachando tudo onde batem.
    const water = document.createElement('canvas');
    water.width = 4;
    water.height = 256;
    const wctx = water.getContext('2d');
    if (wctx) {
      const g = wctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(30, 110, 170, 0.5)');
      g.addColorStop(1, 'rgba(4, 14, 40, 0.85)');
      wctx.fillStyle = g;
      wctx.fillRect(0, 0, 4, 256);
    }
    const arms = [
      {
        base: { x: width * 0.12, y: height + 40 },
        angle: -Math.PI / 2 + 0.3,
        side: 1,
        delay: 0.2,
        slam: AURA_TIMINGS.krakenSlams[0],
        thick: 46,
      },
      {
        base: { x: width * 0.88, y: height + 40 },
        angle: -Math.PI / 2 - 0.3,
        side: -1,
        delay: 0.35,
        slam: AURA_TIMINGS.krakenSlams[1],
        thick: 50,
      },
      {
        base: { x: width * 0.38, y: height + 40 },
        angle: -Math.PI / 2 + 0.1,
        side: 1,
        delay: 0.5,
        slam: AURA_TIMINGS.krakenSlams[2],
        thick: 40,
      },
      {
        base: { x: width * 0.66, y: height + 40 },
        angle: -Math.PI / 2 - 0.1,
        side: -1,
        delay: 0.6,
        slam: 99,
        thick: 38,
      },
    ];
    const cracks: Point[][] = [];
    const slammed = new Set<number>();
    const eyeR = Math.min(width, height) * 0.12;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const fill = easeOut(f.time / 0.8) * clamp01((end - f.time) / 0.8);
        const level = height - fill * height * 0.34;
        // Olho do kraken surgindo da água.
        const rise = easeOut((f.time - 0.4) / 0.6) * clamp01((end - 0.5 - f.time) / 0.5);
        if (rise > 0) {
          const ex = width / 2;
          const ey = level + eyeR * 0.25 - rise * eyeR * 0.6;
          const blink = f.time > 1.9 && f.time < 2.05 ? 0.1 : 1;
          ctx.save();
          ctx.globalAlpha = f.presence;
          ctx.fillStyle = '#3a0f2e';
          ctx.beginPath();
          ctx.ellipse(ex, ey, eyeR * 1.6, eyeR * 1.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffd23a';
          ctx.beginPath();
          ctx.ellipse(ex, ey, eyeR, eyeR * 0.62 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#120408';
          ctx.beginPath();
          ctx.ellipse(
            ex + Math.sin(f.time * 2) * eyeR * 0.3,
            ey,
            eyeR * 0.12,
            eyeR * 0.5 * blink,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
        }
        // Tentáculos.
        ctx.save();
        ctx.globalAlpha = f.presence;
        arms.forEach((arm, index) => {
          const grow = easeOut((f.time - arm.delay) / 0.6) * clamp01((end - 0.2 - f.time) / 0.6);
          if (grow <= 0) return;
          const slam = clamp01((f.time - (arm.slam - 0.25)) / 0.25);
          const lift = 1 - clamp01((f.time - arm.slam - 0.25) / 0.6);
          const bend = -0.5 * arm.side + slam * 2.2 * arm.side * (slam < 1 ? 1 : lift);
          const length = height * 0.85 * grow;
          let x = arm.base.x;
          let y = arm.base.y;
          const steps = 24;
          for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const a = arm.angle + bend * u * u + Math.sin(u * 4 + f.time * 3 + index) * 0.3 * u;
            const r = arm.thick * (1 - u) + 5;
            ctx.fillStyle = '#5a1f4a';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            if (i % 2 === 0) {
              ctx.fillStyle = '#e8a6c8';
              ctx.beginPath();
              ctx.arc(
                x + Math.cos(a + Math.PI / 2) * r * 0.55,
                y + Math.sin(a + Math.PI / 2) * r * 0.55,
                r * 0.25,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
            x += Math.cos(a) * (length / steps);
            y += Math.sin(a) * (length / steps);
          }
          if (slam >= 1 && !slammed.has(index)) {
            slammed.add(index);
            screenShake(350, 12);
            for (let k = 0; k < 7; k++) {
              const a = rand(0, Math.PI * 2);
              const l = rand(80, 260);
              cracks.push(
                bolt({ x, y }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l }, 16, 7),
              );
            }
            for (let k = 0; k < 18; k++) {
              const a = rand(0, Math.PI * 2);
              f.particles.push(
                particle('rock', x, y, {
                  vx: Math.cos(a) * rand(3, 9),
                  vy: Math.sin(a) * rand(3, 9) - 3,
                  gravity: 0.35,
                  vr: 0.2,
                  max: 70,
                  size: rand(4, 9),
                }),
              );
            }
          }
        });
        ctx.restore();
        // Rachaduras na "tela".
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.lineJoin = 'round';
        for (const crack of cracks)
          for (const [w, style] of [
            [5, 'rgba(0, 0, 0, 0.6)'],
            [1.5, 'rgba(235, 245, 255, 0.9)'],
          ] as const) {
            ctx.lineWidth = w;
            ctx.strokeStyle = style;
            ctx.beginPath();
            crack.forEach((point, i) =>
              i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
            );
            ctx.stroke();
          }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          for (let i = 0; i < 2; i++)
            f.particles.push(
              particle('bubble', rand(0, width), height + 10, {
                vy: -rand(2, 4),
                max: 120,
                size: rand(3, 9),
                color: '200, 240, 255',
              }),
            );
        if (fill <= 0) return;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width + 24; x += 24)
          ctx.lineTo(x, level + Math.sin(x * 0.02 + f.time * 3) * 10);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        ctx.drawImage(water, 0, 0, width, height);
        ctx.restore();
        ctx.strokeStyle = 'rgba(200, 240, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      },
    };
  },
  time: (width, height, durationMs) => {
    // Tudo fica sépia e um relógio gigante gira os ponteiros para trás.
    sepiaGlass(durationMs);
    const radius = Math.min(width, height) * 0.3;
    const face = sprite(`clock:${Math.round(radius)}`, Math.ceil(radius * 2.4), (c, size) => {
      const font =
        getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
      c.translate(size / 2, size / 2);
      c.fillStyle = 'rgba(245, 230, 195, 0.16)';
      c.strokeStyle = 'rgba(230, 200, 140, 0.95)';
      c.shadowColor = 'rgba(230, 190, 110, 0.9)';
      c.shadowBlur = 18;
      c.lineWidth = 6;
      c.beginPath();
      c.arc(0, 0, radius, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const inner = i % 5 === 0 ? 0.82 : 0.87;
        c.moveTo(Math.cos(a) * radius * inner, Math.sin(a) * radius * inner);
        c.lineTo(Math.cos(a) * radius * 0.92, Math.sin(a) * radius * 0.92);
      }
      c.stroke();
      c.fillStyle = 'rgba(240, 215, 160, 1)';
      c.font = `${radius * 0.13}px ${font}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach(
        (numeral, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          c.fillText(numeral, Math.cos(a) * radius * 0.7, Math.sin(a) * radius * 0.7);
        },
      );
    });
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        if (f.emitting && f.particles.length < MAX_PARTICLES && Math.random() < 0.5)
          f.particles.push(
            particle('spark', rand(0, width), rand(0, height), {
              vy: rand(-0.4, 0.4),
              max: rand(50, 90),
              size: rand(1, 2),
              color: '240, 210, 150',
            }),
          );
        const cx = width / 2;
        const cy = height * 0.45;
        const scale = 0.85 + 0.15 * easeOut(f.time / 0.5);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.drawImage(face, -face.width / 2, -face.height / 2);
        const hour = -f.time * 6;
        const minute = -(f.time * f.time) * 14;
        ctx.lineCap = 'round';
        for (const [angle, length, thick] of [
          [hour, radius * 0.5, 12],
          [minute, radius * 0.78, 7],
        ] as const) {
          ctx.strokeStyle = 'rgba(60, 40, 15, 0.95)';
          ctx.lineWidth = thick + 4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(angle - Math.PI / 2) * length,
            Math.sin(angle - Math.PI / 2) * length,
          );
          ctx.stroke();
          ctx.strokeStyle = 'rgba(240, 210, 150, 1)';
          ctx.lineWidth = thick;
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(240, 210, 150, 1)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // O tempo volta: clarão no fim.
        const snap = 1 - Math.abs(f.time - (end - 0.45)) / 0.12;
        if (snap > 0) {
          ctx.fillStyle = `rgba(255, 245, 220, ${snap * 0.7})`;
          ctx.fillRect(0, 0, width, height);
        }
      },
    };
  },
  gold: (width, height) => {
    // Chuva de moedas que quicam e se empilham no pé da tela.
    const pile = document.createElement('canvas');
    pile.width = width;
    pile.height = height;
    const pctx = pile.getContext('2d');
    const column = 26;
    const heights = new Array<number>(Math.ceil(width / column) + 1).fill(0);
    const coins: { x: number; y: number; vx: number; vy: number; rot: number; size: number }[] = [];
    const image = coinSprite();
    return {
      frame(ctx, f) {
        if (f.emitting)
          for (let i = 0; i < 3; i++)
            coins.push({
              x: rand(0, width),
              y: -20,
              vx: rand(-1, 1),
              vy: rand(2, 6),
              rot: rand(0, 6),
              size: rand(11, 17),
            });
        for (let i = coins.length - 1; i >= 0; i--) {
          const coin = coins[i]!;
          coin.vy += 0.5;
          coin.x += coin.vx;
          coin.y += coin.vy;
          coin.rot += 0.25;
          const col = Math.max(0, Math.min(heights.length - 1, Math.floor(coin.x / column)));
          const floor = height - heights[col]!;
          if (coin.y + coin.size * 0.5 >= floor) {
            if (coin.vy > 4) {
              coin.vy *= -0.35;
              coin.vx *= 0.6;
              coin.y = floor - coin.size * 0.5;
            } else {
              if (pctx) {
                pctx.save();
                pctx.translate(coin.x, floor - coin.size * 0.3);
                pctx.scale(1, 0.45);
                pctx.drawImage(image, -coin.size, -coin.size, coin.size * 2, coin.size * 2);
                pctx.restore();
              }
              heights[col] = heights[col]! + coin.size * 0.35;
              if (col > 0) heights[col - 1] = heights[col - 1]! + coin.size * 0.12;
              if (col < heights.length - 1) heights[col + 1] = heights[col + 1]! + coin.size * 0.12;
              coins.splice(i, 1);
            }
          }
        }
        if (f.emitting && Math.random() < 0.5)
          f.particles.push(
            particle('spark', rand(0, width), height - rand(0, 80), {
              max: rand(15, 30),
              size: rand(1.5, 2.5),
              color: '255, 240, 170',
            }),
          );
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.drawImage(pile, 0, 0, width, height);
        for (const coin of coins) {
          ctx.save();
          ctx.translate(coin.x, coin.y);
          ctx.scale(Math.max(0.12, Math.abs(Math.cos(coin.rot))), 1);
          ctx.drawImage(image, -coin.size, -coin.size, coin.size * 2, coin.size * 2);
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },
  vampire: (width, height) => {
    // Lua de sangue nascendo e revoadas de morcegos cruzando a tela.
    const moon = { x: width * 0.78, y: height * 0.24, r: Math.min(width, height) * 0.16 };
    const moonImage = sprite(
      `blood-moon:${Math.round(moon.r)}`,
      Math.ceil(moon.r * 3),
      (c, size) => {
        c.translate(size / 2, size / 2);
        const glow = c.createRadialGradient(0, 0, moon.r * 0.9, 0, 0, moon.r * 1.5);
        glow.addColorStop(0, 'rgba(255, 40, 40, 0.5)');
        glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        c.fillStyle = glow;
        c.fillRect(-size / 2, -size / 2, size, size);
        const g = c.createRadialGradient(-moon.r * 0.3, -moon.r * 0.3, moon.r * 0.1, 0, 0, moon.r);
        g.addColorStop(0, '#ff6a4a');
        g.addColorStop(0.6, '#c01822');
        g.addColorStop(1, '#5a0610');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, moon.r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(90, 0, 10, 0.35)';
        for (const [x, y, r] of [
          [-0.3, -0.2, 0.18],
          [0.25, 0.15, 0.12],
          [0.1, -0.4, 0.08],
          [-0.1, 0.35, 0.1],
        ] as const) {
          c.beginPath();
          c.arc(x * moon.r, y * moon.r, r * moon.r, 0, Math.PI * 2);
          c.fill();
        }
      },
    );
    return {
      frame(ctx, f) {
        const rise = easeOut(f.time / 0.8);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.drawImage(
          moonImage,
          moon.x - moonImage.width / 2,
          moon.y + (1 - rise) * height * 0.3 - moonImage.height / 2,
        );
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          for (let i = 0; i < 3; i++) {
            const fromLeft = Math.random() < 0.5;
            f.particles.push(
              particle('bat', fromLeft ? -30 : width + 30, rand(height * 0.05, height * 0.8), {
                vx: (fromLeft ? 1 : -1) * rand(5, 9),
                vy: rand(-1.5, 1.5),
                max: 200,
                size: rand(10, 22),
              }),
            );
          }
      },
    };
  },
  bard: (width, height) => {
    // Partituras ondulando pela tela com as notas correndo nelas, clave de sol e uma explosão de
    // notas saindo do centro.
    const gap = 16;
    const staffs = [
      { y: height * 0.22, phase: 0 },
      { y: height * 0.72, phase: 2 },
    ];
    const glyphs = ['♪', '♫', '♬', '♩'];
    const notes = staffs.map(() =>
      Array.from({ length: 14 }, () => ({
        x: rand(0, width + 200),
        step: Math.floor(rand(-2, 11)),
        glyph: pick(glyphs),
        color: pick(['255, 210, 120', '255, 150, 200', '150, 220, 255']),
      })),
    );
    const clef = bigGlyphSprite('𝄞', '255, 220, 160');
    const lineY = (staff: { y: number; phase: number }, x: number, t: number, i: number) =>
      staff.y + i * gap + Math.sin(x * 0.006 + t * 2 + staff.phase) * 28;
    let burst = false;
    return {
      frame(ctx, f) {
        const show = easeOut(f.time / 0.5);
        if (!burst) {
          burst = true;
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            f.particles.push(
              particle('rune', width / 2, height / 2, {
                vx: Math.cos(a) * rand(4, 8),
                vy: Math.sin(a) * rand(4, 8),
                drag: 0.97,
                max: rand(70, 100),
                size: rand(26, 40),
                glyph: pick(glyphs),
                color: pick(['255, 210, 120', '255, 150, 200', '150, 220, 255']),
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence * show;
        staffs.forEach((staff, s) => {
          ctx.strokeStyle = 'rgba(255, 225, 170, 0.75)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            for (let x = 0; x <= width + 24; x += 24) {
              const y = lineY(staff, x, f.time, i);
              if (x) ctx.lineTo(x, y);
              else ctx.moveTo(x, y);
            }
            ctx.stroke();
          }
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, clef, 46, lineY(staff, 46, f.time, 2), gap * 4.2, f.presence * show);
          for (const note of notes[s]!) {
            const x =
              ((((note.x - f.time * 260) % (width + 200)) + width + 200) % (width + 200)) - 100;
            const y = lineY(staff, x, f.time, 0) + (note.step * gap) / 2;
            blit(
              ctx,
              runeSprite(note.glyph, note.color),
              x,
              y - gap * 0.6,
              gap * 2.2,
              f.presence * show,
            );
          }
          ctx.restore();
        });
        ctx.restore();
      },
    };
  },
  rainbow: (width, height) => {
    // Um arco-íris cresce de ponta a ponta, com nuvens e brilhos coloridos caindo.
    const cx = width / 2;
    const cy = height * 0.95;
    const radius = Math.min(width * 0.48, height * 0.85);
    const band = radius * 0.035;
    let potBurst = false;
    return {
      frame(ctx, f) {
        const grow = easeOut(f.time / 0.9);
        ctx.save();
        ctx.globalAlpha = f.presence * 0.75;
        RAINBOW.forEach((rgb, i) => {
          ctx.strokeStyle = `rgba(${rgb}, 0.85)`;
          ctx.lineWidth = band;
          ctx.beginPath();
          ctx.arc(cx, cy, radius - i * band, Math.PI, Math.PI + Math.PI * grow);
          ctx.stroke();
        });
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [x, show] of [
          [cx - radius + band * 3, 1],
          [cx + radius - band * 3, grow > 0.95 ? 1 : 0],
        ] as const)
          for (let k = 0; k < 4; k++)
            blit(
              ctx,
              softSprite('255, 255, 255'),
              x + (k - 1.5) * band * 2.2,
              cy - band * 2 + (k % 2) * band,
              band * 4,
              0.35 * f.presence * show,
            );
        ctx.restore();
        // Pote de ouro na ponta do arco-íris.
        const pot = clamp01((f.time - 0.85) / 0.25);
        if (pot > 0) {
          const w = Math.max(42, radius * 0.13);
          const px = cx + radius - band * 3.5;
          const py = Math.min(height - 12, cy);
          if (!potBurst) {
            potBurst = true;
            for (let k = 0; k < 22; k++)
              f.particles.push(
                particle('coin', px, py - w, {
                  vx: rand(-4, 4),
                  vy: -rand(5, 10),
                  gravity: 0.35,
                  vr: 0.25,
                  max: 70,
                  size: rand(6, 10),
                }),
              );
          }
          ctx.save();
          ctx.globalAlpha = f.presence;
          ctx.translate(px, py);
          ctx.scale(pot, pot);
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, softSprite('255, 210, 80'), 0, -w * 0.9, w * 1.8, 0.7);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#1d1a1f';
          for (const side of [-1, 1]) ctx.fillRect(side * w * 0.45 - 4, -w * 0.05, 8, w * 0.18);
          ctx.beginPath();
          ctx.ellipse(0, -w * 0.4, w * 0.75, w * 0.58, 0, 0, Math.PI * 2);
          ctx.fill();
          const coin = coinSprite();
          for (const [x, y] of [
            [-0.5, -0.92],
            [-0.2, -1.08],
            [0.15, -1.04],
            [0.45, -0.92],
            [0, -1.22],
            [-0.32, -1.0],
            [0.3, -1.14],
          ] as const)
            ctx.drawImage(coin, x * w - w * 0.17, y * w - w * 0.17, w * 0.34, w * 0.34);
          ctx.fillStyle = '#2e2a31';
          ctx.beginPath();
          ctx.ellipse(0, -w * 0.88, w * 0.82, w * 0.15, 0, 0, Math.PI);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(-w * 0.25, -w * 0.45, w * 0.35, Math.PI * 0.9, Math.PI * 1.3);
          ctx.stroke();
          ctx.restore();
        }
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          for (let i = 0; i < 3; i++)
            f.particles.push(
              particle('mote', rand(0, width), -10, {
                vy: rand(1.5, 3),
                vx: rand(-0.5, 0.5),
                max: 240,
                size: rand(1.5, 3),
                color: pick(RAINBOW),
              }),
            );
      },
    };
  },
  poison: (width, height) => {
    // Nuvens tóxicas entrando pelos lados, bolhas e um ☣ pulsando.
    const symbol = bigGlyphSprite('☣', '150, 255, 60');
    return {
      frame(ctx, f) {
        if (f.emitting && f.particles.length < MAX_PARTICLES) {
          for (let i = 0; i < 2; i++) {
            f.particles.push(
              particle('wisp', rand(-40, width + 40), height + 60, {
                vx: rand(-0.6, 0.6),
                vy: -rand(1.8, 3.4),
                max: 180,
                size: rand(90, 160),
                color: pick(['120, 220, 60', '90, 180, 40', '160, 255, 90']),
              }),
            );
          }
          for (let i = 0; i < 2; i++)
            f.particles.push(
              particle('bubble', rand(0, width), height + 10, {
                vy: -rand(1.5, 3.5),
                max: 200,
                size: rand(4, 12),
                color: '170, 255, 120',
              }),
            );
        }
        const radius =
          Math.min(width, height) * 0.3 * (1 + Math.sin(f.time * 6) * 0.06) * easeOut(f.time / 0.5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        blit(ctx, symbol, width / 2, height * 0.45, radius, 0.45 * f.presence);
        ctx.restore();
      },
    };
  },
  cat: (width, height, durationMs) => {
    // Um gato espia do rodapé e brinca com o "CRÍTICO!": dá dois tapas e, no terceiro, joga o
    // texto para fora da tela. No fim, mia.
    const center = { x: width / 2, y: height * 0.42 };
    const text = { x: center.x, y: center.y, vx: 0, vy: 0, rot: 0, vr: 0, flying: false };
    const hits = AURA_TIMINGS.catHits.map((at, i) => ({ at, side: i % 2 ? -1 : 1, done: false }));
    const R = Math.min(width, height) * 0.26;
    const pawSize = Math.min(width, height) * 0.12;
    const textSize = Math.min(width * 0.1, 130);
    return {
      frame(ctx, f) {
        const t = f.time;
        const end = durationMs / 1000;
        for (const [i, hit] of hits.entries()) {
          if (hit.done || t < hit.at) continue;
          hit.done = true;
          const last = i === hits.length - 1;
          text.vx = -hit.side * (last ? 26 : 14);
          text.vy = last ? -9 : -3;
          text.vr = -hit.side * (last ? 0.35 : 0.12);
          if (last) {
            text.flying = true;
            screenShake(250, 6);
          }
        }
        if (text.flying) {
          text.vy += 0.6;
        } else {
          text.vx += (center.x - text.x) * 0.04;
          text.vy += (center.y - text.y) * 0.04;
          text.vr += -text.rot * 0.06;
          text.vx *= 0.88;
          text.vy *= 0.88;
          text.vr *= 0.85;
        }
        text.x += text.vx;
        text.y += text.vy;
        text.rot += text.vr;
        // Cabeça do gato espiando do rodapé (olhos seguem o texto).
        const rise = easeOut((t - 0.15) / 0.5) * clamp01((end - 0.2 - t) / 0.5);
        const hx = width / 2;
        const hy = height + R * 0.35 - rise * R * 0.95;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = '#231a2c';
        ctx.beginPath();
        ctx.arc(hx, hy, R, 0, Math.PI * 2);
        for (const side of [-1, 1]) {
          ctx.moveTo(hx + side * R * 0.85, hy - R * 0.35);
          ctx.lineTo(hx + side * R * 0.75, hy - R * 1.35);
          ctx.lineTo(hx + side * R * 0.2, hy - R * 0.85);
        }
        ctx.fill();
        ctx.fillStyle = '#5a3a5e';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(hx + side * R * 0.72, hy - R * 0.55);
          ctx.lineTo(hx + side * R * 0.7, hy - R * 1.12);
          ctx.lineTo(hx + side * R * 0.36, hy - R * 0.8);
          ctx.fill();
        }
        const blink = t > 1.25 && t < 1.38 ? 0.1 : 1;
        const look = Math.max(-1, Math.min(1, (text.x - hx) / (width * 0.4)));
        for (const side of [-1, 1]) {
          const ex = hx + side * R * 0.4;
          const ey = hy - R * 0.2;
          ctx.fillStyle = '#d8ff6a';
          ctx.beginPath();
          ctx.ellipse(ex, ey, R * 0.2, R * 0.16 * blink, side * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0c0a10';
          ctx.beginPath();
          ctx.ellipse(ex + look * R * 0.1, ey, R * 0.05, R * 0.14 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ff9ec0';
        ctx.beginPath();
        ctx.moveTo(hx - R * 0.08, hy + R * 0.06);
        ctx.lineTo(hx + R * 0.08, hy + R * 0.06);
        ctx.lineTo(hx, hy + R * 0.16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 2;
        for (const side of [-1, 1])
          for (const k of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.moveTo(hx + side * R * 0.2, hy + R * 0.15 + k * R * 0.05);
            ctx.lineTo(hx + side * R * 0.75, hy + R * 0.08 + k * R * 0.12);
            ctx.stroke();
          }
        // Texto.
        if (text.y < height + 200 && text.x > -400 && text.x < width + 400) {
          const pop = easeOut(t / 0.15);
          ctx.save();
          ctx.translate(text.x, text.y);
          ctx.rotate(text.rot);
          ctx.scale(2 - pop, 2 - pop);
          canvasCritText(ctx, textSize, '255, 179, 207');
          ctx.restore();
        }
        // Patas: entram pelo lado, batem e voltam.
        for (const hit of hits) {
          const p = clamp01((t - (hit.at - 0.22)) / 0.45);
          if (p <= 0 || p >= 1) continue;
          const swing = Math.sin(p * Math.PI);
          const fromX = hit.side > 0 ? width + pawSize * 2 : -pawSize * 2;
          const toX = text.x + hit.side * textSize * 1.6;
          const x = fromX + (toX - fromX) * swing;
          const y = center.y + pawSize * 0.2;
          ctx.fillStyle = 'rgba(35, 26, 44, 1)';
          ctx.fillRect(Math.min(x, fromX), y - pawSize * 0.45, Math.abs(fromX - x), pawSize * 0.9);
          drawPaw(
            ctx,
            x,
            y,
            pawSize,
            hit.side > 0 ? -Math.PI / 2 : Math.PI / 2,
            'rgba(250, 232, 222, 1)',
            'rgba(255, 150, 185, 1)',
          );
        }
        ctx.restore();
      },
    };
  },
  meteor: (width, height) => {
    // Chuva de meteoros; o último, gigante, acerta o centro com clarão e onda de choque.
    const meteors: { x: number; y: number; vx: number; vy: number; size: number; big: boolean }[] =
      [];
    const target = { x: width / 2, y: height * 0.5 };
    let launched = false;
    let impact = -1;
    return {
      frame(ctx, f) {
        if (f.emitting && f.time < 1.4 && Math.random() < 0.25)
          meteors.push({
            x: rand(width * 0.3, width * 1.2),
            y: -40,
            vx: -rand(7, 11),
            vy: rand(9, 13),
            size: rand(6, 14),
            big: false,
          });
        if (!launched && f.time >= 1.3) {
          launched = true;
          const sx = width * 1.05;
          const sy = -80;
          const frames = 0.55 * 60;
          meteors.push({
            x: sx,
            y: sy,
            vx: (target.x - sx) / frames,
            vy: (target.y - sy) / frames,
            size: 34,
            big: true,
          });
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i]!;
          m.x += m.vx;
          m.y += m.vy;
          const speed = Math.hypot(m.vx, m.vy);
          const length = m.size * 14;
          const tx = m.x - (m.vx / speed) * length;
          const ty = m.y - (m.vy / speed) * length;
          const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
          g.addColorStop(0, 'rgba(255, 220, 150, 0.9)');
          g.addColorStop(0.3, 'rgba(255, 120, 40, 0.5)');
          g.addColorStop(1, 'rgba(255, 60, 20, 0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = m.size * 1.2;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          blit(ctx, glowSprite('255, 160, 60'), m.x, m.y, m.size * 3, 1);
          if (m.big && m.y >= target.y) {
            meteors.splice(i, 1);
            impact = f.time;
            screenShake(500, 14);
            for (let k = 0; k < 40; k++) {
              const a = rand(0, Math.PI * 2);
              f.particles.push(
                particle(k % 3 ? 'ember' : 'rock', target.x, target.y, {
                  vx: Math.cos(a) * rand(4, 14),
                  vy: Math.sin(a) * rand(4, 14) - 3,
                  gravity: 0.3,
                  vr: 0.2,
                  max: 70,
                  size: k % 3 ? rand(1.5, 3) : rand(5, 10),
                  color: '255, 170, 60',
                }),
              );
            }
            continue;
          }
          if (m.y > height + 60 || m.x < -60) meteors.splice(i, 1);
        }
        ctx.restore();
        if (impact >= 0) {
          const since = f.time - impact;
          const flash = Math.max(0, 1 - since / 0.35);
          if (flash > 0) {
            ctx.fillStyle = `rgba(255, 235, 200, ${flash * 0.8})`;
            ctx.fillRect(0, 0, width, height);
          }
          const alpha = Math.max(0, 1 - since / 0.9) * f.presence;
          if (alpha > 0) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 180, 90, ${alpha})`;
            ctx.lineWidth = 10 * (1 - since / 0.9) + 2;
            ctx.beginPath();
            ctx.arc(target.x, target.y, since * Math.max(width, height) * 0.9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, softSprite('255, 120, 40'), target.x, target.y, 160, 0.6 * f.presence);
          ctx.restore();
        }
      },
    };
  },
  party: (width, height) => {
    // Bola de espelhos descendo com luzes girando pela tela, fogos de artifício e confete.
    const ballR = Math.min(width, height) * 0.08;
    const ball = sprite(`disco:${Math.round(ballR)}`, Math.ceil(ballR * 2.2), (c, size) => {
      c.translate(size / 2, size / 2);
      c.beginPath();
      c.arc(0, 0, ballR, 0, Math.PI * 2);
      c.clip();
      const tile = ballR / 6;
      for (let y = -ballR; y < ballR; y += tile)
        for (let x = -ballR; x < ballR; x += tile) {
          const light = 120 + Math.floor(Math.random() * 135);
          c.fillStyle = `rgb(${light}, ${light}, ${Math.min(255, light + 20)})`;
          c.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        }
      const shade = c.createRadialGradient(-ballR * 0.3, -ballR * 0.3, ballR * 0.1, 0, 0, ballR);
      shade.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      shade.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
      c.fillStyle = shade;
      c.fillRect(-ballR, -ballR, ballR * 2, ballR * 2);
    });
    const spots = Array.from({ length: 36 }, () => ({
      angle: rand(0, Math.PI * 2),
      dist: rand(0.15, 0.75),
      size: rand(10, 22),
      color: pick(CONFETTI),
    }));
    const rockets = AURA_TIMINGS.partyLaunches.map((at) => ({
      at,
      x: rand(width * 0.12, width * 0.88),
      top: rand(height * 0.12, height * 0.45),
      color: pick(CONFETTI),
      done: false,
    }));
    return {
      frame(ctx, f) {
        const drop = easeOut(f.time / 0.7);
        const bx = width / 2;
        const by = -ballR + drop * (height * 0.14 + ballR);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.strokeStyle = 'rgba(220, 220, 230, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, by - ballR);
        ctx.stroke();
        ctx.translate(bx, by);
        ctx.rotate(Math.sin(f.time * 1.5) * 0.08);
        ctx.drawImage(ball, -ball.width / 2, -ball.height / 2);
        ctx.restore();
        // Luzes da bola varrendo a tela.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const reach = Math.max(width, height);
        for (const spot of spots) {
          const a = spot.angle + f.time * 0.7;
          blit(
            ctx,
            glowSprite(spot.color),
            bx + Math.cos(a) * spot.dist * reach,
            by + Math.abs(Math.sin(a)) * spot.dist * reach * 0.8,
            spot.size,
            0.55 * f.presence * drop,
          );
        }
        // Fogos: sobem e estouram nos momentos do som.
        for (const r of rockets) {
          const p = (f.time - r.at) / AURA_TIMINGS.fireworkFlight;
          if (p < 0) continue;
          if (p < 1) {
            const y = height - (height - r.top) * easeOut(p);
            blit(ctx, glowSprite('255, 230, 180'), r.x, y, 8, 1);
            if (f.particles.length < MAX_PARTICLES)
              f.particles.push(
                particle('spark', r.x, y + 6, {
                  vy: 1,
                  max: 14,
                  size: 1.2,
                  color: '255, 210, 150',
                }),
              );
          } else if (!r.done) {
            r.done = true;
            for (let k = 0; k < 64; k++) {
              const a = (k / 64) * Math.PI * 2;
              const speed = rand(3, 7);
              f.particles.push(
                particle('spark', r.x, r.top, {
                  vx: Math.cos(a) * speed,
                  vy: Math.sin(a) * speed,
                  gravity: 0.06,
                  drag: 0.97,
                  max: rand(60, 90),
                  size: rand(1.5, 2.6),
                  color: k % 4 ? r.color : '255, 255, 255',
                }),
              );
            }
          }
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          for (let i = 0; i < 2; i++)
            f.particles.push(
              particle('confetti', rand(0, width), -10, {
                vx: rand(-1, 1),
                vy: rand(1.5, 3),
                vr: rand(-0.2, 0.2),
                max: 260,
                size: rand(3, 6),
                color: pick(CONFETTI),
              }),
            );
      },
    };
  },
  frog: (width, height, durationMs) => {
    // Um sapo rei sobe, lança a língua, pega o "CRÍTICO!" e engole.
    const font =
      getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
    const R = Math.min(width, height) * 0.22;
    const textSize = Math.min(width * 0.11, 140);
    const center = { x: width / 2, y: height * 0.4 };
    let fed = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        const end = durationMs / 1000;
        if (!fed) {
          fed = true;
          for (let i = 0; i < 6; i++)
            f.particles.push(
              particle('fly', center.x + rand(-200, 200), center.y + rand(-80, 80), {
                vx: rand(-1, 1),
                vy: rand(-1, 1),
                drag: 0.9,
                max: 70,
                size: 3,
              }),
            );
        }
        const rise = easeOut((t - 0.2) / 0.6) - easeOut((t - (end - 0.9)) / 0.6);
        const fx = width / 2;
        const fy = height + R * 1.4 - rise * R * 1.9;
        const mouth = { x: fx, y: fy + R * 0.15 };
        // Língua: sai em 1,1 s, volta trazendo o texto até 1,6 s.
        const out = clamp01((t - 1.1) / 0.15);
        const back = clamp01((t - 1.25) / 0.35);
        const reach = out * (1 - back);
        const tip = {
          x: mouth.x + (center.x - mouth.x) * reach,
          y: mouth.y + (center.y - mouth.y) * reach,
        };
        const swallowed = t > 1.6;
        const puff = t > 1.6 && t < 2.2 ? Math.sin(((t - 1.6) / 0.6) * Math.PI) : 0;
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Texto (some na boca do sapo).
        if (!swallowed) {
          const pop = easeOut(t / 0.15);
          const carry = back > 0 ? back : 0;
          const tx = carry ? tip.x : center.x;
          const ty = carry ? tip.y : center.y;
          const scale = (2 - pop) * (1 - carry * 0.9);
          ctx.save();
          ctx.translate(tx, ty);
          ctx.scale(scale, scale);
          ctx.font = `${textSize}px ${font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#7ccf3c';
          ctx.shadowColor = '#7ccf3c';
          ctx.shadowBlur = 24;
          ctx.fillStyle = '#fff';
          ctx.strokeText('CRÍTICO!', 0, 0);
          ctx.fillText('CRÍTICO!', 0, 0);
          ctx.restore();
        }
        // Sapo.
        ctx.translate(fx, fy);
        ctx.scale(1 + puff * 0.12, 1 + puff * 0.05);
        ctx.fillStyle = '#4f9a2c';
        ctx.strokeStyle = '#2d5e16';
        ctx.lineWidth = 4;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(side * R * 0.55, -R * 0.55, R * 0.32, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(0, 0, R, R * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#b6d77a';
        ctx.beginPath();
        ctx.ellipse(0, R * 0.25, R * 0.62, R * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        const blink = t > 1.7 && t < 1.85 ? 0.15 : 1;
        for (const side of [-1, 1]) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.ellipse(side * R * 0.55, -R * 0.58, R * 0.24, R * 0.24 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.ellipse(side * R * 0.55, -R * 0.56, R * 0.15, R * 0.08 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#1f3d0e';
        ctx.lineWidth = R * 0.05;
        ctx.beginPath();
        ctx.moveTo(-R * 0.8, R * 0.05);
        ctx.quadraticCurveTo(0, R * 0.35, R * 0.8, R * 0.05);
        ctx.stroke();
        if (reach > 0) {
          ctx.fillStyle = '#3a0f18';
          ctx.beginPath();
          ctx.ellipse(0, R * 0.15, R * 0.3, R * 0.16 * Math.min(1, reach * 3), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Coroa.
        ctx.fillStyle = '#ffcf3c';
        ctx.strokeStyle = '#a07010';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-R * 0.3, -R * 0.55);
        ctx.lineTo(-R * 0.34, -R * 0.92);
        ctx.lineTo(-R * 0.15, -R * 0.72);
        ctx.lineTo(0, -R * 1.0);
        ctx.lineTo(R * 0.15, -R * 0.72);
        ctx.lineTo(R * 0.34, -R * 0.92);
        ctx.lineTo(R * 0.3, -R * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d6283c';
        ctx.beginPath();
        ctx.arc(0, -R * 0.66, R * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Língua por cima do sapo, saindo da boca.
        ctx.save();
        ctx.globalAlpha = f.presence;
        if (reach > 0 || (back > 0 && back < 1)) {
          ctx.strokeStyle = '#e86a8a';
          ctx.lineCap = 'round';
          ctx.lineWidth = R * 0.12;
          ctx.beginPath();
          ctx.moveTo(mouth.x, mouth.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
          ctx.fillStyle = '#f08aa6';
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, R * 0.11, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    };
  },
};

// --------------------------------------------------------------------------------------------
// Falha crítica (1 natural): a versão fracassada de cada aura. "FALHA CRÍTICA" aparece no centro,
// balança e despenca da tela; trombone triste.
// --------------------------------------------------------------------------------------------

interface FailText {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  falling: boolean;
  /** Cor do texto (o veneno deixa o texto verde de enjoo). */
  tint: string | null;
}

type FailScene = (width: number, height: number, durationMs: number, text: FailText) => Scene;

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (const [dx, dy, r] of [
    [-1, 0, 0.6],
    [-0.4, -0.35, 0.75],
    [0.35, -0.3, 0.7],
    [0.95, 0, 0.55],
    [0, 0.15, 0.7],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * size, y + dy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

const rainOn = (particles: Particle[], x: number, y: number) =>
  particles.push(
    particle('drop', x + rand(-60, 60), y, { vy: 6, max: 22, size: 1.6, color: '150, 190, 255' }),
  );

const FAILS: Record<DiceAura, FailScene> = {
  blood: (width, height, durationMs, text) => {
    // Uma gotinha cai do alto e pinga no texto.
    const frames = Math.sqrt((2 * (text.y + 10)) / 0.45);
    let dropped = false;
    let splatted = false;
    return {
      frame(_ctx, f) {
        if (!dropped && f.time > 0.3) {
          dropped = true;
          f.particles.push(
            particle('drop', text.x + 20, -10, {
              gravity: 0.45,
              max: frames,
              size: 4,
              color: RGB.blood,
            }),
          );
        }
        if (!splatted && f.time > 0.3 + frames / 60) {
          splatted = true;
          f.particles.push(
            particle('splat', text.x + 20, text.y - 20, {
              max: 150,
              size: 12,
              color: '150, 0, 18',
            }),
          );
        }
      },
    };
  },
  storm: (_width, _height, _durationMs, text) => ({
    // Uma nuvenzinha chove em cima do texto e solta um raio de nada.
    frame(ctx, f) {
      const x = text.x;
      const y = text.y - 150 - (1 - easeOut(f.time / 0.5)) * 200;
      ctx.save();
      ctx.globalAlpha = f.presence;
      drawCloud(ctx, x, y, 60, 'rgba(110, 115, 130, 0.95)');
      ctx.restore();
      if (f.emitting && Math.random() < 0.6) rainOn(f.particles, x, y + 30);
      if (f.time > 0.7 && f.time < 0.76)
        f.particles.push(
          particle('bolt', 0, 0, {
            path: bolt({ x, y: y + 30 }, { x: x + 10, y: y + 70 }, 6, 3),
            max: 4,
            size: 1.2,
            color: RGB.storm,
          }),
        );
    },
  }),
  frost: (_width, _height, _durationMs, text) => ({
    // Alguns flocos caem... e derretem.
    frame(_ctx, f) {
      if (!f.emitting) return;
      if (f.time < 1.2 && Math.random() < 0.3)
        f.particles.push(
          particle('flake', text.x + rand(-200, 200), -10, {
            vy: rand(1, 2),
            vr: 0.03,
            max: 200,
            size: rand(4, 7),
            color: RGB.frost,
          }),
        );
      if (f.time > 1.2 && Math.random() < 0.3)
        f.particles.push(
          particle('drop', text.x + rand(-180, 180), text.y + 30, {
            vy: 1,
            gravity: 0.2,
            max: 60,
            size: 2,
            color: '190, 230, 255',
          }),
        );
    },
  }),
  arcane: (width, height, _durationMs, text) => {
    // O círculo mágico falha, pisca e explode numa nuvem de fumaça.
    const layers = magicCircleLayers(Math.min(width, height) * 0.22);
    let poof = false;
    return {
      frame(ctx, f) {
        if (f.time < 1)
          magicCircle(
            ctx,
            layers,
            text.x,
            text.y,
            0.8,
            f.time * 0.4,
            (Math.random() < 0.35 ? 0.15 : 0.8) * f.presence,
          );
        if (!poof && f.time >= 1) {
          poof = true;
          screenShake(150, 4);
          for (let i = 0; i < 18; i++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('smoke', text.x + Math.cos(a) * 40, text.y + Math.sin(a) * 40, {
                vx: Math.cos(a) * rand(1, 3),
                vy: Math.sin(a) * rand(1, 3) - 0.5,
                max: 90,
                size: rand(30, 60),
                color: '110, 110, 120',
              }),
            );
          }
        }
      },
    };
  },
  shadow: (width, height) => ({
    // A escuridão tenta fechar mas pisca como lâmpada com mau contato e desiste.
    frame(ctx, f) {
      if (f.time > 1.6 || Math.sin(f.time * 40) * Math.sin(f.time * 13) < 0.2) return;
      ctx.fillStyle = `rgba(3, 1, 8, ${0.75 * f.presence})`;
      ctx.fillRect(0, 0, width, height);
    },
  }),
  holy: (_width, _height, _durationMs, text) => {
    // A auréola desce no texto, fica torta e cai; uma pena solitária.
    const halo = { x: text.x, y: -40, vy: 0, rot: 0 };
    let feather = false;
    return {
      frame(ctx, f) {
        if (f.time < 1.2) {
          halo.y += (text.y - 70 - halo.y) * 0.08;
          halo.rot = Math.sin(f.time * 6) * 0.15;
        } else {
          halo.vy += 0.5;
          halo.y += halo.vy;
          halo.rot += 0.05;
          halo.x += 1;
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(halo.x, halo.y);
        ctx.rotate(halo.rot);
        ctx.strokeStyle = 'rgba(255, 230, 150, 0.9)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 80, 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (!feather && f.time > 0.3) {
          feather = true;
          f.particles.push(particle('feather', text.x - 120, -20, { vy: 0.8, max: 300, size: 16 }));
        }
      },
    };
  },
  gears: (_width, _height, _durationMs, text) => {
    // Uma engrenagem cai quicando no texto e uma mola salta com fumacinha.
    const gear = { x: text.x + 60, y: -40, vy: 0, rot: 0 };
    let bounces = 0;
    let puff = false;
    return {
      frame(ctx, f) {
        gear.vy += 0.5;
        gear.y += gear.vy;
        gear.rot += 0.08;
        if (gear.y > text.y - 40 && bounces < 2 && gear.vy > 0) {
          gear.vy *= -0.5;
          bounces += 1;
          text.vy += 3;
        }
        const image = gearSprite(26, false);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(gear.x, gear.y);
        ctx.rotate(gear.rot);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        ctx.restore();
        const spring = clamp01((f.time - 1.1) / 0.2);
        if (spring <= 0) return;
        const bx = text.x - 120;
        const by = text.y - 20;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.strokeStyle = '#b8bcc6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++)
          ctx.lineTo(
            bx + (i % 2 ? 10 : -10),
            by - i * 8 * spring * (1 + 0.2 * Math.sin(f.time * 20)),
          );
        ctx.stroke();
        ctx.restore();
        if (!puff) {
          puff = true;
          for (let i = 0; i < 8; i++)
            f.particles.push(
              particle('smoke', bx, by, {
                vx: rand(-1, 1),
                vy: -rand(0.5, 1.5),
                max: 70,
                size: rand(20, 35),
                color: '120, 120, 120',
              }),
            );
        }
      },
    };
  },
  forest: (width, height, _durationMs, text) => {
    // Uma folha seca cai e uma mudinha nasce... e murcha.
    let leaf = false;
    return {
      frame(ctx, f) {
        if (!leaf) {
          leaf = true;
          f.particles.push(
            particle('leaf', text.x + 100, -10, {
              vy: 1,
              vx: 0.3,
              vr: 0.05,
              max: 400,
              size: 10,
              color: '150, 110, 50',
            }),
          );
        }
        const length = 140 * easeOut(f.time / 0.8);
        const wilt = clamp01((f.time - 1) / 0.8);
        const bx = width / 2;
        const tipX = bx + 90 * wilt;
        const tipY = height - length * (1 - 0.6 * wilt);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.strokeStyle = '#5a8a2a';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, height);
        ctx.quadraticCurveTo(bx + 60 * wilt, height - length * 0.7, tipX, tipY);
        ctx.stroke();
        ctx.fillStyle = wilt > 0.5 ? '#8a7a3a' : '#6fae45';
        ctx.beginPath();
        ctx.ellipse(tipX, tipY, 18, 8, 0.5 + wilt * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    };
  },
  fire: (_width, _height, _durationMs, text) => ({
    // Um fósforo acende... e apaga numa fumacinha.
    frame(ctx, f) {
      const x = text.x;
      const y = text.y + 90;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.strokeStyle = '#d9b98a';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y + 90);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = f.time > 0.9 ? '#2a2420' : '#c0392b';
      ctx.beginPath();
      ctx.arc(x, y - 4, 9, 0, Math.PI * 2);
      ctx.fill();
      if (f.time < 0.9) {
        ctx.globalCompositeOperation = 'lighter';
        blit(
          ctx,
          flameSprite(Math.floor(rand(0, 3))),
          x,
          y - 22,
          16 + Math.random() * 6 * (1 - f.time),
          1,
        );
      }
      ctx.restore();
      if (f.time > 0.9 && f.emitting && Math.random() < 0.4)
        f.particles.push(
          particle('smoke', x, y - 10, {
            vx: rand(-0.3, 0.3),
            vy: -rand(0.5, 1.2),
            max: 80,
            size: rand(10, 20),
            color: '100, 100, 100',
          }),
        );
    },
  }),
  skeleton: (_width, _height, _durationMs, text) => {
    // A caveira cai na cabeça do texto, desmonta e os ossos se espalham.
    const skull = { y: -120, vy: 0, rot: 0 };
    let hit = false;
    return {
      frame(ctx, f) {
        skull.vy += 0.6;
        skull.y += skull.vy;
        if (!hit && skull.y > text.y - 90) {
          hit = true;
          skull.vy = -7;
          screenShake(150, 5);
          for (let i = 0; i < 6; i++)
            f.particles.push(
              particle('bone', text.x, text.y - 60, {
                vx: rand(-4, 4),
                vy: -rand(3, 7),
                gravity: 0.4,
                vr: rand(-0.3, 0.3),
                max: 90,
                size: rand(10, 16),
              }),
            );
        }
        if (hit) skull.rot += 0.08;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(text.x + 40, skull.y);
        ctx.rotate(skull.rot);
        ctx.scale(0.45, 0.45);
        drawSkull(ctx, hit ? 40 : 0, false);
        ctx.restore();
      },
    };
  },
  cosmic: (width, height, _durationMs, text) => ({
    // O olho cósmico abre com sono, boceja e dorme (Zzz).
    frame(ctx, f) {
      const open = Math.max(0, Math.sin(Math.min(1, f.time / 1.6) * Math.PI)) * 0.35;
      const eyeW = Math.min(width, height) * 0.22;
      const eyeH = eyeW * 0.42 * open;
      const cx = text.x;
      const cy = text.y - 150;
      if (eyeH > 1) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.moveTo(-eyeW, 0);
        ctx.quadraticCurveTo(0, -eyeH * 2, eyeW, 0);
        ctx.quadraticCurveTo(0, eyeH * 2, -eyeW, 0);
        ctx.closePath();
        ctx.fillStyle = '#e8dff5';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#6a5ab0';
        ctx.beginPath();
        ctx.arc(0, eyeH * 0.3, eyeW * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14041c';
        ctx.fillRect(-eyeW, -eyeH * 2, eyeW * 2, eyeH * 1.3);
        ctx.restore();
        ctx.strokeStyle = '#9a8ad0';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
      if (f.emitting && f.time > 1.2 && Math.random() < 0.05)
        f.particles.push(
          particle('rune', cx + eyeW * 0.8, cy - 20, {
            vx: 0.6,
            vy: -1,
            max: 90,
            size: 26,
            glyph: pick(['z', 'Z']),
            color: '200, 190, 255',
          }),
        );
    },
  }),
  tarot: (width, height) => {
    // As cartas caem esparramadas e a única virada é O Louco.
    const fool = cardFaceSprite(MAJOR_ARCANA[0]);
    let fell = false;
    return {
      frame(ctx, f) {
        if (!fell) {
          fell = true;
          for (let i = 0; i < 8; i++)
            f.particles.push(
              particle('card', rand(0, width), -40 - rand(0, 200), {
                vy: rand(2, 4),
                vx: rand(-1, 1),
                vr: rand(-0.08, 0.08),
                gravity: 0.1,
                max: 200,
                size: rand(18, 28),
              }),
            );
        }
        const p = easeOut((f.time - 0.6) / 0.6);
        if (p <= 0) return;
        const size = Math.min(height * 0.35, 240);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(width * 0.78, -size + (height * 0.62 + size) * p);
        ctx.rotate(0.35 * p);
        ctx.drawImage(fool, -size / 2, -size / 2, size, size);
        ctx.restore();
      },
    };
  },
  glitch: (width, height) => ({
    // Tela azul: "Seu dado encontrou um problema".
    frame(ctx, f) {
      if (f.time < 0.15 && Math.random() < 0.5) return;
      const pw = Math.min(width * 0.7, 720);
      const ph = Math.min(height * 0.5, 360);
      const x = (width - pw) / 2;
      const y = height * 0.12;
      ctx.save();
      ctx.globalAlpha = f.presence * 0.95;
      ctx.fillStyle = '#1e5bd6';
      ctx.fillRect(x, y, pw, ph);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `${ph * 0.3}px "Segoe UI", sans-serif`;
      ctx.fillText(':(', x + pw * 0.08, y + ph * 0.06);
      ctx.font = `${ph * 0.075}px "Segoe UI", sans-serif`;
      ctx.fillText('Seu dado encontrou um problema e', x + pw * 0.08, y + ph * 0.5);
      ctx.fillText('precisa ser reiniciado.', x + pw * 0.08, y + ph * 0.6);
      ctx.fillText(
        `${Math.min(100, Math.floor(f.time * 12))}% concluído`,
        x + pw * 0.08,
        y + ph * 0.78,
      );
      ctx.restore();
    },
  }),
  ink: (width, height, _durationMs, text) => {
    // O tinteiro vira: um borrão enorme e escorrido.
    const shape = Array.from({ length: 24 }, () => rand(0.75, 1.25));
    let drips = false;
    return {
      frame(ctx, f) {
        const r = Math.min(width, height) * 0.22 * easeOut(f.time / 0.5);
        ctx.save();
        ctx.globalAlpha = f.presence * 0.95;
        ctx.fillStyle = '#0c0c10';
        ctx.beginPath();
        shape.forEach((k, i) => {
          const a = (i / shape.length) * Math.PI * 2;
          const x = text.x + Math.cos(a) * r * k;
          const y = text.y + Math.sin(a) * r * k;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        if (!drips && f.time > 0.6) {
          drips = true;
          for (let i = 0; i < 6; i++)
            f.particles.push(
              particle('drop', text.x + rand(-r * 0.7, r * 0.7), text.y + r * 0.6, {
                vy: 0.5,
                gravity: 0.08,
                max: 160,
                size: rand(3, 6),
                color: '12, 12, 16',
              }),
            );
        }
      },
    };
  },
  abyss: (width, height) => ({
    // Em vez do kraken, um patinho de borracha atravessa uma poça.
    frame(ctx, f) {
      const level = height - 70 * easeOut(f.time / 0.5);
      ctx.save();
      ctx.globalAlpha = f.presence * 0.8;
      ctx.fillStyle = 'rgba(40, 120, 190, 0.55)';
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width + 24; x += 24)
        ctx.lineTo(x, level + Math.sin(x * 0.03 + f.time * 3) * 5);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.translate(-60 + (width + 120) * (f.time / 2.8), level - 18 + Math.sin(f.time * 4) * 4);
      ctx.rotate(Math.sin(f.time * 4) * 0.1);
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(20, -20, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8a1a';
      ctx.beginPath();
      ctx.moveTo(31, -20);
      ctx.lineTo(44, -16);
      ctx.lineTo(31, -12);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(24, -23, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  }),
  time: (_width, _height, _durationMs, text) => {
    // O relógio dispara, quebra (peças voando) e cai.
    const clock = { y: text.y - 170, vy: 0, rot: 0 };
    let broke = false;
    return {
      frame(ctx, f) {
        const R = 70;
        if (f.time > 1.2) {
          if (!broke) {
            broke = true;
            for (let i = 0; i < 6; i++)
              f.particles.push(
                particle('gear', text.x, clock.y, {
                  vx: rand(-4, 4),
                  vy: -rand(3, 7),
                  gravity: 0.4,
                  vr: 0.3,
                  max: 80,
                  size: rand(5, 9),
                  color: '205, 150, 60',
                }),
              );
          }
          clock.vy += 0.5;
          clock.y += clock.vy;
          clock.rot += 0.04;
        }
        const spin = f.time < 1.2 ? f.time * f.time * 25 : 2.3;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(text.x, clock.y);
        ctx.rotate(clock.rot);
        ctx.fillStyle = 'rgba(245, 230, 195, 0.9)';
        ctx.strokeStyle = '#8a6a2a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#3b2a12';
        ctx.lineCap = 'round';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spin) * R * 0.6, Math.sin(spin) * R * 0.6);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(-spin * 0.3) * R * 0.8, Math.sin(-spin * 0.3) * R * 0.8);
        ctx.stroke();
        ctx.restore();
      },
    };
  },
  gold: (_width, height, _durationMs, text) => {
    // Uma moeda só: cai na cabeça do texto e sai rolando.
    const coin = { x: text.x - 40, y: -30, vx: 0, vy: 0, rot: 0, hit: false };
    return {
      frame(ctx, f) {
        coin.vy += 0.5;
        coin.x += coin.vx;
        coin.y += coin.vy;
        coin.rot += 0.3;
        if (!coin.hit && coin.y > text.y - 50) {
          coin.hit = true;
          coin.vy = -8;
          coin.vx = 5;
          text.vr -= 0.03;
        }
        if (coin.hit && coin.y > height - 20) {
          coin.y = height - 20;
          coin.vy *= -0.4;
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(coin.x, coin.y);
        ctx.scale(Math.max(0.15, Math.abs(Math.cos(coin.rot))), 1);
        ctx.drawImage(coinSprite(), -16, -16, 32, 32);
        ctx.restore();
      },
    };
  },
  frog: (width, height, _durationMs, text) => {
    // O sapo pula, a língua erra o alvo e ele cai de costas.
    const R = Math.min(width, height) * 0.08;
    return {
      frame(ctx, f) {
        const t = f.time;
        const fx = width * 0.25;
        let fy =
          height +
          R -
          Math.sin(Math.min(1, t / 0.9) * Math.PI * 0.5) * (height - text.y + R * 0.5) * 0.55;
        let rot = 0;
        if (t > 1.5) {
          fy += (t - 1.5) ** 2 * 900;
          rot = (t - 1.5) * 4;
        }
        const out = clamp01((t - 0.9) / 0.15) * (1 - clamp01((t - 1.15) / 0.2));
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(fx, fy);
        ctx.rotate(rot);
        ctx.fillStyle = '#4f9a2c';
        ctx.beginPath();
        ctx.ellipse(0, 0, R, R * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const side of [-1, 1]) {
          ctx.fillStyle = '#4f9a2c';
          ctx.beginPath();
          ctx.arc(side * R * 0.5, -R * 0.55, R * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(side * R * 0.5, -R * 0.58, R * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(side * R * 0.5, -R * 0.58, R * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        if (out > 0) {
          // Língua por cima, passando longe do texto.
          ctx.rotate(-rot);
          ctx.strokeStyle = '#e86a8a';
          ctx.lineWidth = R * 0.18;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, R * 0.1);
          ctx.lineTo((width * 0.9 - fx) * out, (text.y - 160 - fy) * out);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  vampire: (width, height) => {
    // Um morcego vem voando direto e se esborracha na tela, escorregando.
    let hit = false;
    return {
      frame(ctx, f) {
        const p = clamp01(f.time / 0.7);
        const slide = clamp01((f.time - 0.7) / 1.5);
        if (p >= 1 && !hit) {
          hit = true;
          screenShake(150, 6);
        }
        const size = 10 + p * p * 110;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(width * 0.3 + p * width * 0.2, height * 0.3 + slide * slide * height * 0.5);
        ctx.scale((size / 20) * (hit ? 1.3 : 1), (size / 20) * (hit ? 0.75 : 1));
        drawParticle(ctx, {
          ...particle('bat', 0, 0, { size: 20, max: 10_000 }),
          life: hit ? 0 : Math.floor(f.time * 60),
        });
        ctx.restore();
      },
    };
  },
  bard: (width, _height, _durationMs, text) => {
    // A partitura arrebenta no meio e as notas despencam.
    let snapped = false;
    return {
      frame(ctx, f) {
        const top = text.y - 140;
        const snap = clamp01((f.time - 0.8) / 0.6);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.strokeStyle = 'rgba(255, 225, 170, 0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const y = top + i * 14;
          const droop = snap * snap * (80 + i * 20);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.quadraticCurveTo(width * 0.25, y, width / 2 - 10, y + droop);
          ctx.moveTo(width, y);
          ctx.quadraticCurveTo(width * 0.75, y, width / 2 + 10, y + droop);
          ctx.stroke();
        }
        ctx.restore();
        if (!snapped && f.time > 0.8) {
          snapped = true;
          for (let i = 0; i < 10; i++)
            f.particles.push(
              particle('rune', rand(width * 0.2, width * 0.8), top + rand(0, 60), {
                vy: -rand(1, 3),
                vx: rand(-1, 1),
                gravity: 0.35,
                max: 120,
                size: rand(24, 34),
                glyph: pick(['♪', '♫', '♩']),
                color: '255, 210, 120',
              }),
            );
        }
      },
    };
  },
  rainbow: (width, height, _durationMs, text) => ({
    // Um arco-íris cinza, pela metade, e uma nuvem chovendo.
    frame(ctx, f) {
      const grow = easeOut(f.time / 0.8) * 0.55;
      const radius = Math.min(width * 0.4, height * 0.7);
      ctx.save();
      ctx.globalAlpha = f.presence * 0.7;
      ['150, 150, 155', '130, 130, 135', '115, 115, 120', '100, 100, 105'].forEach((rgb, i) => {
        ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
        ctx.lineWidth = radius * 0.035;
        ctx.beginPath();
        ctx.arc(
          width / 2,
          height * 0.95,
          radius - i * radius * 0.035,
          Math.PI,
          Math.PI + Math.PI * grow,
        );
        ctx.stroke();
      });
      drawCloud(ctx, text.x, text.y - 160, 55, 'rgba(110, 115, 130, 0.95)');
      ctx.restore();
      if (f.emitting && Math.random() < 0.5) rainOn(f.particles, text.x, text.y - 130);
    },
  }),
  poison: (_width, height, _durationMs, text) => {
    // A bolha de veneno estoura na cara: o texto fica verde e enjoado.
    let popped = false;
    return {
      frame(ctx, f) {
        if (popped) {
          text.vr += Math.sin(f.time * 8) * 0.002;
          return;
        }
        const p = clamp01(f.time / 0.8);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.strokeStyle = 'rgba(170, 255, 120, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(text.x, height - (height - text.y) * easeOut(p), 30 + p * 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (p < 1) return;
        popped = true;
        text.tint = '150, 230, 80';
        for (let i = 0; i < 14; i++) {
          const a = rand(0, Math.PI * 2);
          f.particles.push(
            particle('wisp', text.x + Math.cos(a) * 20, text.y + Math.sin(a) * 20, {
              vx: Math.cos(a) * rand(1, 3),
              vy: Math.sin(a) * rand(1, 3),
              max: 90,
              size: rand(40, 70),
              color: '120, 220, 60',
            }),
          );
        }
      },
    };
  },
  cat: (width, height, _durationMs, text) => {
    // Uma pata empurra o texto devagar para fora da "mesa".
    const size = Math.min(width, height) * 0.1;
    let pushed = false;
    return {
      frame(ctx, f) {
        const p = clamp01((f.time - 0.4) / 0.6);
        const back = clamp01((f.time - 1.1) / 0.4);
        const x =
          width +
          size * 2 -
          (width + size * 2 - (text.x + size * 3)) * Math.sin((p * Math.PI) / 2) * (1 - back);
        if (p > 0.95 && !pushed) {
          pushed = true;
          text.vx = -6;
          text.vr = -0.04;
          text.falling = true;
        }
        if (p <= 0 || back >= 1) return;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = '#231a2c';
        ctx.fillRect(x, text.y - size * 0.4, width - x + size, size * 0.8);
        drawPaw(
          ctx,
          x,
          text.y,
          size,
          -Math.PI / 2,
          'rgba(250, 232, 222, 1)',
          'rgba(255, 150, 185, 1)',
        );
        ctx.restore();
      },
    };
  },
  meteor: (_width, _height, _durationMs, text) => {
    // Em vez de um meteoro, uma pedrinha: bate no texto (pléc) e quica.
    const rock = { x: text.x + 30, y: -20, vx: 0, vy: 4, hit: false };
    return {
      frame(ctx, f) {
        rock.vy += 0.3;
        rock.x += rock.vx;
        rock.y += rock.vy;
        if (!rock.hit && rock.y > text.y - 40) {
          rock.hit = true;
          rock.vy = -5;
          rock.vx = 3;
          text.vr += 0.04;
          text.vy += 4;
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        if (!rock.hit) {
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, glowSprite('255, 160, 60'), rock.x, rock.y, 10, 0.8);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = '#6b625a';
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    };
  },
  party: (width, height, _durationMs, text) => {
    // Um balão murcha voando para todo lado; um confete solitário.
    const balloon = { x: width * 0.5, y: height * 0.7, vx: 0, vy: 0, r: 40 };
    const color = pick(CONFETTI);
    let confetti = false;
    return {
      frame(ctx, f) {
        if (f.time < 2.2) {
          const a = rand(0, Math.PI * 2);
          balloon.vx = (balloon.vx + Math.cos(a) * 2.2) * 0.9;
          balloon.vy = (balloon.vy + Math.sin(a) * 2.2 - 0.3) * 0.9;
          balloon.r = Math.max(8, 40 - f.time * 14);
        } else balloon.vy += 0.5;
        balloon.x = Math.max(20, Math.min(width - 20, balloon.x + balloon.vx));
        balloon.y += balloon.vy;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(${color}, 0.95)`;
        ctx.beginPath();
        ctx.ellipse(
          balloon.x,
          balloon.y,
          balloon.r * 0.85,
          balloon.r,
          Math.atan2(balloon.vy, balloon.vx) + Math.PI / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
        if (!confetti) {
          confetti = true;
          f.particles.push(
            particle('confetti', text.x, -10, { vy: 1, vr: 0.1, max: 300, size: 5, color }),
          );
        }
      },
    };
  },
  wind: (_width, height, _durationMs, text) => ({
    // Um redemoinho de poeira minúsculo, que desmancha.
    frame(ctx, f) {
      const life = clamp01(f.time / 0.6) * (1 - clamp01((f.time - 1.2) / 0.6));
      if (life <= 0) return;
      const base = height - 10;
      const top = base - 160 * life;
      ctx.save();
      ctx.globalAlpha = f.presence * life;
      ctx.strokeStyle = 'rgba(200, 190, 170, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -f.time * 200;
      for (let y = base; y > top; y -= 14) {
        const r = 6 + (base - y) * 0.25;
        ctx.beginPath();
        ctx.ellipse(
          text.x + Math.sin(y * 0.05 + f.time * 6) * 6,
          y,
          r,
          r * 0.25,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
    },
  }),
  ritual: (width, height, _durationMs, text) => {
    // O pentagrama sai torto, as velas apagam e só sobra fumaça.
    const R = Math.min(width, height) * 0.25;
    const points = [0, 1, 2, 3, 4].map((i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5 + rand(-0.25, 0.25);
      const r = R * rand(0.7, 1.15);
      return { x: text.x + Math.cos(a) * r, y: text.y + Math.sin(a) * r };
    });
    const star = [0, 2, 4, 1, 3, 0].map((i) => points[i]!);
    let out = false;
    return {
      frame(ctx, f) {
        const lines = clamp01(f.time / 0.8) * 5;
        ctx.save();
        ctx.globalAlpha = f.presence * (1 - clamp01((f.time - 1.3) / 0.6));
        ctx.strokeStyle = 'rgba(200, 60, 50, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(star[0]!.x, star[0]!.y);
        for (let i = 1; i <= 5; i++) {
          const part = Math.min(1, lines - (i - 1));
          if (part <= 0) break;
          const a = star[i - 1]!;
          const b = star[i]!;
          ctx.lineTo(a.x + (b.x - a.x) * part, a.y + (b.y - a.y) * part);
        }
        ctx.stroke();
        for (const p of points) {
          ctx.fillStyle = '#e8dcc0';
          ctx.fillRect(p.x - 6, p.y - 4, 12, 24);
          if (f.time < 1.1) {
            ctx.globalCompositeOperation = 'lighter';
            blit(ctx, flameSprite(1), p.x, p.y - 12, 10, 1);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        ctx.restore();
        if (!out && f.time >= 1.1) {
          out = true;
          for (const p of points)
            for (let k = 0; k < 3; k++)
              f.particles.push(
                particle('smoke', p.x, p.y - 14, {
                  vx: rand(-0.3, 0.3),
                  vy: -rand(0.6, 1.4),
                  max: 80,
                  size: rand(10, 18),
                  color: '110, 110, 110',
                }),
              );
        }
      },
    };
  },
  claw: (_width, _height, _durationMs, text) => {
    // Um arranhão fraquinho e uma unha quebrada caindo.
    let done = false;
    return {
      frame(_ctx, f) {
        if (done || f.time < 0.4) return;
        done = true;
        f.particles.push(
          particle('scratch', text.x, text.y, { rot: 0.4, max: 90, size: 30, color: RGB.claw }),
        );
        f.particles.push(
          particle('shard', text.x + 30, text.y - 10, {
            vy: -2,
            vx: 1,
            gravity: 0.4,
            vr: 0.3,
            max: 100,
            size: 8,
          }),
        );
      },
    };
  },
};

/** Falha crítica (1 natural) com aura: a versão fracassada do efeito, para todos da mesa. */
export function criticalFailBurst(
  aura: DiceAura,
  options: { durationMs?: number; sound?: boolean } = {},
): void {
  if (reducedMotion()) return;
  const durationMs = options.durationMs ?? 3200;
  if (options.sound !== false) playFailSound();
  const canvas = overlay(null);
  shakeTargets.add(canvas);
  window.setTimeout(() => shakeTargets.delete(canvas), durationMs + 5000);
  const ctx = canvas.getContext('2d');
  const particles: Particle[] = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  const home = { x: width / 2, y: height * 0.42 };
  const text: FailText = { ...home, vx: 0, vy: 0, rot: 0, vr: 0, falling: false, tint: null };
  const scene = FAILS[aura](width, height, durationMs, text);
  const font = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
  const size = Math.min(width * 0.085, 104);
  const started = performance.now();
  let last = 0;
  const tick = (now: number) => {
    if (!ctx) return;
    if (now - last < 15) {
      requestAnimationFrame(tick);
      return;
    }
    last = now;
    fit(canvas, ctx, width, height, 1);
    const elapsed = now - started;
    const time = elapsed / 1000;
    const emitting = elapsed < durationMs - 700;
    const presence =
      Math.min(1, elapsed / 300) * Math.min(1, Math.max(0, (durationMs - elapsed) / 600));
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, `rgba(20, 20, 28, ${0.55 * presence})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    scene.frame(ctx, { time, elapsed, presence, emitting, particles });
    // O texto balança e, aos 1,9 s, despenca.
    if (!text.falling && time > 1.9) {
      text.falling = true;
      text.vr += rand(-0.03, 0.03);
    }
    if (text.falling) text.vy += 0.5;
    else {
      text.vx = (text.vx + (home.x - text.x) * 0.03) * 0.9;
      text.vy = (text.vy + (home.y - text.y) * 0.03) * 0.9;
      text.vr = (text.vr - text.rot * 0.05) * 0.9;
    }
    text.x += text.vx;
    text.y += text.vy;
    text.rot += text.vr;
    if (text.y < height + 200) {
      const pop = 2 - easeOut(time / 0.2);
      ctx.save();
      ctx.globalAlpha = presence;
      ctx.translate(text.x, text.y);
      ctx.rotate(text.rot + Math.sin(time * 2.5) * 0.03);
      ctx.scale(pop, pop);
      ctx.font = `${size}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(${RGB[aura]}, 0.55)`;
      ctx.fillStyle = text.tint ? `rgb(${text.tint})` : '#cfc9d6';
      ctx.strokeText('FALHA CRÍTICA', 0, 0);
      ctx.fillText('FALHA CRÍTICA', 0, 0);
      ctx.restore();
    }
    stepParticles(ctx, particles, height);
    if (elapsed < durationMs || particles.length) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
  window.setTimeout(() => canvas.remove(), durationMs + 5000);
}

/** Partes internas da biblioteca 3D usadas para achar os dados na tela. */
interface ProjectedVector {
  x: number;
  y: number;
  project(camera: unknown): ProjectedVector;
}
interface DiceBoxProjection {
  camera?: unknown;
  renderer?: { domElement?: HTMLCanvasElement };
}
interface DieMesh {
  position?: { clone(): ProjectedVector };
  scale?: { x: number };
  geometry?: { boundingSphere?: { radius: number } | null; computeBoundingSphere?: () => void };
}

/** Posições (e raio aproximado) dos dados indicados, em pixels relativos à cena 3D. */
export function diceScreenPositions(box: unknown, dice: readonly unknown[]): AuraPoint[] {
  const internals = box as DiceBoxProjection;
  const canvas = internals.renderer?.domElement;
  if (!canvas || !internals.camera) return [];
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const out: AuraPoint[] = [];
  for (const die of dice as DieMesh[]) {
    if (!die.position) continue;
    const center = die.position.clone().project(internals.camera);
    const x = ((center.x + 1) / 2) * width;
    const y = ((1 - center.y) / 2) * height;
    let r = 28;
    const geometry = die.geometry;
    if (geometry) {
      if (!geometry.boundingSphere) geometry.computeBoundingSphere?.();
      const world = (geometry.boundingSphere?.radius ?? 0) * (die.scale?.x ?? 1);
      if (world > 0) {
        const side = die.position.clone();
        side.x += world;
        const projected = side.project(internals.camera);
        r = Math.abs(((projected.x + 1) / 2) * width - x) * 0.8;
      }
    }
    out.push({ x, y, r: Math.max(10, Math.min(140, r)) });
  }
  return out;
}
