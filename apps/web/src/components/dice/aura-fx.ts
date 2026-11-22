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
  | 'scratch'
  | 'bee'
  | 'ghost';

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
  necro: '80, 230, 150',
  pirate: '220, 120, 70',
  samurai: '255, 160, 190',
  kaiju: '150, 200, 70',
  cyber: '252, 238, 10',
  werewolf: '200, 210, 235',
  siren: '80, 225, 200',
  alchemy: '235, 200, 110',
  ghost: '225, 235, 255',
  haki: '224, 16, 46',
  cthulhu: '60, 190, 140',
  sungod: '255, 245, 200',
  heaven: '150, 215, 255',
  tarrasque: '200, 120, 60',
  purple: '162, 75, 255',
  wheel: '212, 178, 90',
  capture: '240, 192, 64',
  darklord: '255, 36, 36',
  notebook: '190, 190, 205',
  orbs: '255, 163, 26',
  sakura: '255, 179, 207',
  phoenix: '255, 138, 42',
  kitsune: '124, 200, 255',
  mirror: '216, 236, 248',
  aurora: '92, 255, 176',
  zombie: '143, 191, 106',
  sans: '53, 217, 255',
  hollow: '239, 51, 79',
  doom: '84, 227, 111',
  zoro: '215, 25, 63',
  blackhole: '184, 124, 255',
  fullmetal: '243, 180, 63',
  sahur: '240, 163, 74',
  spider: '239, 51, 64',
  akatsuki: '215, 25, 63',
  hisoka: '255, 79, 163',
  valorant: '255, 70, 85',
  league: '200, 155, 60',
  mario: '255, 204, 51',
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
      if (p.color === 'haki') {
        // Raio preto com brilho vermelho (haki do rei).
        ctx.globalAlpha = Math.random() < 0.2 ? 0.3 : fade;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(p.path[0]!.x, p.path[0]!.y);
        for (const point of p.path.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = 'rgba(255, 30, 50, 0.6)';
        ctx.lineWidth = p.size * 4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(8, 0, 4, 1)';
        ctx.lineWidth = p.size * 1.6;
        ctx.stroke();
        break;
      }
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
    case 'bee':
      ctx.globalAlpha = Math.min(1, fade * 3);
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.drawImage(beeSprite(), -p.size, -p.size, p.size * 2, p.size * 2);
      break;
    case 'ghost':
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.8;
      ctx.translate(p.x + Math.sin(p.life * 0.08 + p.rot) * p.size * 0.5, p.y);
      ctx.drawImage(ghostSprite(), -p.size, -p.size, p.size * 2, p.size * 2);
      break;
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
    if (p.kind === 'fly' || p.kind === 'bee') {
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
      p.kind === 'shard' ||
      (p.kind === 'bolt' && p.color === 'haki') ||
      p.kind === 'bee' ||
      p.kind === 'ghost';
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
    case 'necro':
      if (chance(0.5))
        out.push(
          particle('mote', from.x, from.y, {
            vy: -rand(0.6, 1.4) * s,
            max: rand(30, 45),
            size: rand(1, 1.8) * s,
            color: pick(['80, 230, 150', '160, 90, 230']),
          }),
        );
      if (chance(0.04))
        out.push(
          particle('bone', from.x, from.y, {
            vx: Math.cos(a) * s,
            vy: -s,
            gravity: 0.06 * s,
            vr: 0.2,
            max: 40,
            size: 4 * s,
          }),
        );
      break;
    case 'pirate':
      if (chance(0.15))
        out.push(
          particle('smoke', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(30, 45),
            size: rand(6, 10) * s,
            color: '120, 115, 110',
          }),
        );
      if (chance(0.06))
        out.push(
          particle('coin', from.x, from.y, {
            vx: Math.cos(a) * 1.5 * s,
            vy: -rand(1.5, 2.5) * s,
            gravity: 0.12 * s,
            vr: 0.25,
            max: 40,
            size: 3.5 * s,
          }),
        );
      break;
    case 'samurai':
      if (chance(0.35))
        out.push(
          particle('leaf', from.x, from.y, {
            vx: Math.cos(a + 1.2) * 1.2 * s,
            vy: Math.sin(a + 1.2) * 1.2 * s,
            vr: 0.08,
            max: rand(40, 60),
            size: rand(2.5, 4) * s,
            color: pick(['255, 180, 205', '255, 210, 225', '250, 150, 185']),
          }),
        );
      break;
    case 'kaiju':
      if (chance(0.12))
        out.push(
          particle('rock', from.x, from.y, {
            vx: Math.cos(a) * s,
            vy: -rand(1, 2) * s,
            gravity: 0.12 * s,
            vr: 0.15,
            max: 35,
            size: rand(1.5, 2.5) * s,
          }),
        );
      if (chance(0.2))
        out.push(
          particle('smoke', from.x, o.y + o.r, {
            vx: rand(-0.6, 0.6),
            vy: -rand(0.2, 0.5),
            max: 40,
            size: rand(6, 10) * s,
            color: '120, 100, 70',
          }),
        );
      break;
    case 'cyber':
      for (let i = 0; i < 2; i++)
        if (chance(0.6)) {
          const at = edge(o, rand(0, Math.PI * 2), rand(1, 1.5));
          out.push(
            particle('pixel', at.x, at.y, {
              vx: (Math.random() < 0.5 ? -1 : 1) * rand(1, 3) * s,
              max: rand(10, 20),
              size: rand(1.5, 2.5) * s,
              color: pick(['252, 238, 10', '0, 240, 255', '255, 43, 214']),
              glyph: Math.random() < 0.4 ? 'bar' : undefined,
            }),
          );
        }
      break;
    case 'werewolf':
      if (chance(0.4))
        out.push(
          particle('mote', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(30, 45),
            size: rand(1, 1.6) * s,
            color: '220, 230, 250',
          }),
        );
      if (chance(0.03)) {
        const at = edge(o, a, 1.4);
        out.push(
          particle('scratch', at.x, at.y, {
            rot: rand(-0.8, 0.8),
            max: 30,
            size: 5 * s,
            color: '200, 210, 235',
          }),
        );
      }
      break;
    case 'siren':
      if (chance(0.35))
        out.push(
          particle('bubble', from.x, from.y, {
            vy: -rand(0.5, 1.1) * s,
            max: rand(35, 50),
            size: rand(1.8, 3.5) * s,
            color: '170, 255, 235',
          }),
        );
      if (chance(0.3))
        out.push(
          particle('spark', from.x, from.y, {
            vy: -rand(0.3, 0.8) * s,
            max: rand(25, 40),
            size: rand(1, 1.6) * s,
            color: pick(['255, 190, 230', '170, 255, 235']),
          }),
        );
      break;
    case 'alchemy':
      if (chance(0.4))
        out.push(
          particle('bubble', from.x, from.y, {
            vy: -rand(0.5, 1.2) * s,
            max: rand(30, 45),
            size: rand(1.8, 3) * s,
            color: pick(['255, 120, 200', '120, 220, 255', '255, 220, 110', '160, 255, 140']),
          }),
        );
      if (chance(0.08))
        out.push(
          particle('rune', from.x, from.y, {
            vy: -rand(0.5, 1) * s,
            max: 45,
            size: rand(10, 13) * s,
            glyph: pick(['☿', '☉', '☽', '♄', '♃', '♂', '♀']),
            color: '235, 200, 110',
          }),
        );
      break;
    case 'ghost':
      if (chance(0.06))
        out.push(
          particle('ghost', from.x, from.y, {
            vy: -rand(0.6, 1.2) * s,
            max: rand(50, 70),
            size: rand(6, 9) * s,
          }),
        );
      break;
    case 'sungod':
      if (chance(0.25))
        out.push(
          particle('wisp', from.x, from.y, {
            vy: -rand(0.5, 1.2) * s,
            max: rand(30, 45),
            size: rand(10, 16) * s,
            color: '255, 255, 245',
          }),
        );
      if (chance(0.2))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-1, 1) * s,
            vy: -rand(1, 2) * s,
            gravity: 0.05,
            max: 30,
            size: 1.6 * s,
            color: '255, 255, 255',
          }),
        );
      break;
    case 'heaven':
      for (let i = 0; i < 2; i++)
        if (chance(0.7))
          out.push(
            particle('mote', from.x, from.y, {
              vx: -Math.sin(a) * 4 * s,
              vy: Math.cos(a) * 4 * s,
              drag: 0.9,
              max: rand(12, 20),
              size: rand(1, 1.6) * s,
              color: pick(['150, 215, 255', '255, 230, 150']),
            }),
          );
      break;
    case 'tarrasque':
      if (chance(0.15))
        out.push(
          particle('rock', from.x, from.y, {
            vx: Math.cos(a) * s,
            vy: -rand(1, 2) * s,
            gravity: 0.12 * s,
            vr: 0.15,
            max: 35,
            size: rand(1.5, 2.5) * s,
          }),
        );
      if (chance(0.2))
        out.push(
          particle('smoke', from.x, o.y + o.r, {
            vx: rand(-0.6, 0.6),
            vy: -rand(0.2, 0.5),
            max: 40,
            size: rand(6, 10) * s,
            color: '130, 90, 60',
          }),
        );
      break;
    case 'sans':
      if (chance(0.32))
        out.push(
          particle('bone', from.x, from.y, {
            vx: Math.cos(a) * rand(0.8, 1.8) * s,
            vy: Math.sin(a) * rand(0.8, 1.8) * s,
            vr: rand(-0.18, 0.18),
            max: rand(30, 50),
            size: rand(2, 4) * s,
            color: '235, 250, 255',
          }),
        );
      if (chance(0.2))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-1, 1) * s,
            vy: -rand(0.5, 1.5) * s,
            max: 30,
            size: 1.8 * s,
            color: RGB.sans,
          }),
        );
      break;
    case 'hollow':
      if (chance(0.32))
        out.push(
          particle('flame', from.x, from.y, {
            vx: rand(-1, 1) * s,
            vy: -rand(0.8, 1.8) * s,
            max: rand(28, 42),
            size: rand(3, 6) * s,
            color: RGB.hollow,
          }),
        );
      if (chance(0.12))
        out.push(
          particle('mote', from.x, from.y, {
            vy: -rand(0.5, 1.2) * s,
            max: 36,
            size: 2 * s,
            color: '245, 245, 255',
          }),
        );
      break;
    case 'doom':
      if (chance(0.3))
        out.push(
          particle('rune', from.x, from.y, {
            vx: Math.cos(a) * 0.5 * s,
            vy: Math.sin(a) * 0.5 * s,
            vr: 0.08,
            max: 45,
            size: rand(9, 14) * s,
            glyph: rune(),
            color: RGB.doom,
          }),
        );
      if (chance(0.18))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-1.5, 1.5) * s,
            vy: -rand(0.8, 1.8) * s,
            max: 30,
            size: 1.8 * s,
            color: RGB.doom,
          }),
        );
      break;
    case 'zoro':
      if (chance(0.3))
        out.push(
          particle('scratch', from.x, from.y, {
            vr: rand(-0.08, 0.08),
            max: 24,
            size: rand(4, 7) * s,
            color: RGB.zoro,
          }),
        );
      if (chance(0.18))
        out.push(
          particle('bolt', from.x, from.y, {
            path: bolt(
              from,
              { x: from.x + rand(-18, 18) * s, y: from.y + rand(-18, 18) * s },
              4,
              4,
            ),
            max: 12,
            size: 1.5 * s,
            color: 'haki',
          }),
        );
      break;
    case 'blackhole':
      if (chance(0.6))
        out.push(
          particle('mote', from.x, from.y, {
            vx: -Math.cos(a) * rand(1.2, 2.8) * s,
            vy: -Math.sin(a) * rand(1.2, 2.8) * s,
            drag: 0.96,
            max: rand(20, 34),
            size: rand(1.2, 2.2) * s,
            color: pick(['255, 170, 80', '184, 124, 255', '100, 170, 255']),
          }),
        );
      break;
    case 'fullmetal':
      if (chance(0.3))
        out.push(
          particle('rune', from.x, from.y, {
            vx: Math.cos(a) * 0.6 * s,
            vy: Math.sin(a) * 0.6 * s,
            vr: -0.08,
            max: 42,
            size: rand(8, 13) * s,
            glyph: pick(['☿', '⊙', '△', '◯']),
            color: RGB.fullmetal,
          }),
        );
      if (chance(0.2))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-1.2, 1.2) * s,
            vy: -rand(0.8, 1.8) * s,
            max: 28,
            size: 1.7 * s,
            color: '120, 190, 255',
          }),
        );
      break;
    case 'sahur':
      if (chance(0.28))
        out.push(
          particle('rock', from.x, from.y, {
            vx: rand(-1.4, 1.4) * s,
            vy: -rand(0.6, 1.7) * s,
            gravity: 0.12,
            vr: 0.15,
            max: 36,
            size: rand(2, 4) * s,
            color: '145, 88, 42',
          }),
        );
      if (chance(0.22))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-1.2, 1.2) * s,
            vy: -rand(0.7, 1.6) * s,
            max: 30,
            size: 1.8 * s,
            color: RGB.sahur,
          }),
        );
      break;
    case 'spider':
      if (chance(0.38))
        out.push(
          particle('wisp', from.x, from.y, {
            vx: Math.cos(a) * rand(0.3, 0.9) * s,
            vy: Math.sin(a) * rand(0.3, 0.9) * s,
            max: 32,
            size: rand(3, 6) * s,
            color: pick([RGB.spider, '245, 250, 255']),
          }),
        );
      break;
    case 'akatsuki':
      if (chance(0.3))
        out.push(
          particle('feather', from.x, from.y, {
            vx: Math.cos(a) * rand(0.6, 1.4) * s,
            vy: Math.sin(a) * rand(0.4, 1.2) * s,
            vr: rand(-0.12, 0.12),
            max: 42,
            size: rand(3, 6) * s,
            color: pick(['18, 18, 24', RGB.akatsuki]),
          }),
        );
      break;
    case 'hisoka':
      if (chance(0.28))
        out.push(
          particle('card', from.x, from.y, {
            vx: Math.cos(a) * rand(0.6, 1.8) * s,
            vy: Math.sin(a) * rand(0.6, 1.8) * s,
            vr: rand(-0.15, 0.15),
            max: 44,
            size: rand(3, 5) * s,
            color: RGB.hisoka,
          }),
        );
      break;
    case 'valorant':
      if (chance(0.36))
        out.push(
          particle('shard', from.x, from.y, {
            vx: Math.cos(a) * rand(0.8, 2) * s,
            vy: Math.sin(a) * rand(0.8, 2) * s,
            vr: rand(-0.2, 0.2),
            max: 34,
            size: rand(2, 4) * s,
            color: pick([RGB.valorant, '85, 220, 255']),
          }),
        );
      break;
    case 'league':
      if (chance(0.4))
        out.push(
          particle('mote', from.x, from.y, {
            vx: Math.cos(a) * rand(0.4, 1.2) * s,
            vy: Math.sin(a) * rand(0.4, 1.2) * s,
            max: 38,
            size: rand(1.5, 3) * s,
            color: pick([RGB.league, '95, 150, 255', '175, 80, 255']),
          }),
        );
      break;
    case 'mario':
      if (chance(0.3))
        out.push(
          particle('coin', from.x, from.y, {
            vx: Math.cos(a) * rand(0.4, 1.2) * s,
            vy: -rand(0.8, 1.8) * s,
            gravity: 0.08,
            vr: 0.15,
            max: 38,
            size: rand(2.5, 4) * s,
            color: RGB.mario,
          }),
        );
      break;
    case 'purple':
      if (chance(0.7)) {
        const blue = Math.random() < 0.5;
        out.push(
          particle('mote', from.x, from.y, {
            vx: -Math.sin(a) * (blue ? 2 : -2) * s,
            vy: Math.cos(a) * (blue ? 2 : -2) * s,
            drag: 0.95,
            max: rand(20, 30),
            size: rand(1, 1.8) * s,
            color: blue ? '90, 150, 255' : '255, 80, 80',
          }),
        );
      }
      break;
    case 'wheel':
      if (chance(0.3))
        out.push(
          particle('spark', from.x, from.y, {
            vy: -rand(0.5, 1.2) * s,
            max: 30,
            size: 1.4 * s,
            color: '255, 220, 140',
          }),
        );
      if (chance(0.04))
        out.push(
          particle('rune', from.x, from.y, {
            vy: -0.8 * s,
            max: 45,
            size: 13 * s,
            glyph: '☸',
            color: '212, 178, 90',
          }),
        );
      break;
    case 'capture':
      if (chance(0.35))
        out.push(
          particle('spark', from.x, from.y, {
            vx: rand(-0.6, 0.6),
            vy: -rand(0.5, 1.2) * s,
            max: 30,
            size: 1.5 * s,
            color: '255, 215, 110',
          }),
        );
      break;
    case 'darklord':
      if (chance(0.3))
        out.push(
          particle('spark', from.x, from.y, {
            vx: Math.cos(a) * 2 * s,
            vy: Math.sin(a) * 2 * s,
            gravity: 0.1 * s,
            max: 20,
            size: 1.3 * s,
            color: '255, 60, 60',
          }),
        );
      if (chance(0.15))
        out.push(
          particle('smoke', from.x, from.y, {
            vy: -rand(0.4, 0.8) * s,
            max: 40,
            size: rand(6, 10) * s,
            color: '20, 10, 10',
          }),
        );
      break;
    case 'notebook':
      if (chance(0.08))
        out.push(
          particle('rune', from.x, from.y, {
            vy: -rand(0.5, 1) * s,
            max: 45,
            size: rand(10, 13) * s,
            glyph: pick(['✒', '✝', '☠']),
            color: '190, 190, 205',
          }),
        );
      if (chance(0.2))
        out.push(
          particle('smoke', from.x, from.y, {
            vy: -rand(0.4, 0.8) * s,
            max: 40,
            size: rand(6, 10) * s,
            color: '15, 15, 20',
          }),
        );
      break;
    case 'sakura':
      if (chance(0.3))
        out.push(
          particle('leaf', from.x, from.y, {
            vx: rand(-0.6, 0.6) * s,
            vy: rand(0.2, 0.8) * s,
            max: 50,
            size: rand(3, 5) * s,
            color: '255, 190, 215',
          }),
        );
      break;
    case 'phoenix':
      if (chance(0.5))
        out.push(
          particle('ember', from.x, from.y, {
            vy: -rand(0.6, 1.4) * s,
            max: rand(25, 40),
            size: rand(1.2, 2.2) * s,
            color: '255, 150, 50',
          }),
        );
      if (chance(0.06))
        out.push(
          particle('feather', from.x, from.y, {
            vy: -rand(0.3, 0.8) * s,
            max: 50,
            size: rand(5, 8) * s,
            color: '255, 120, 40',
          }),
        );
      break;
    case 'kitsune':
      if (chance(0.25))
        out.push(
          particle('wisp', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(30, 45),
            size: rand(3, 5) * s,
            color: '110, 190, 255',
          }),
        );
      break;
    case 'mirror':
      if (chance(0.12))
        out.push(
          particle('shard', from.x, from.y, {
            vx: rand(-1, 1) * s,
            vy: rand(-1, 0) * s,
            gravity: 0.1,
            vr: 0.1,
            max: 40,
            size: rand(3, 6) * s,
          }),
        );
      break;
    case 'aurora':
      if (chance(0.4))
        out.push(
          particle('mote', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(30, 45),
            size: rand(1.2, 2) * s,
            color: pick(['92, 255, 176', '120, 200, 255', '200, 120, 255']),
          }),
        );
      break;
    case 'zombie':
      if (chance(0.3))
        out.push(
          particle('smoke', from.x, from.y, {
            vy: -rand(0.3, 0.7) * s,
            max: 40,
            size: rand(6, 10) * s,
            color: '90, 150, 70',
          }),
        );
      break;
    case 'orbs':
      if (chance(0.5))
        out.push(
          particle('mote', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(25, 40),
            size: rand(1.2, 2) * s,
            color: '255, 180, 60',
          }),
        );
      break;
    case 'cthulhu':
      if (chance(0.4))
        out.push(
          particle('smoke', from.x, from.y, {
            vy: -rand(0.4, 1) * s,
            max: rand(30, 45),
            size: rand(7, 11) * s,
            color: '20, 70, 50',
          }),
        );
      if (chance(0.08))
        out.push(
          particle('rune', from.x, from.y, {
            vy: -rand(0.5, 1) * s,
            max: 45,
            size: rand(10, 13) * s,
            glyph: pick(['ᛟ', 'ᛉ', 'ᛞ', '⍟', '☉']),
            color: '60, 190, 140',
          }),
        );
      break;
    case 'haki':
      // Raios pretos com contorno vermelho estalando em volta do dado.
      if (chance(0.5)) {
        const to = edge(o, a + rand(-0.4, 0.4), rand(1.4, 2.1));
        out.push(
          particle('bolt', 0, 0, {
            path: bolt(from, to, 6 * s, 5),
            max: rand(4, 8),
            size: rand(1.4, 2.4),
            color: 'haki',
          }),
        );
      }
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
  if (aura === 'haki') {
    // Pulsação escura em volta do dado.
    const pulse = (time * 1.8) % 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = (1 - pulse) * 0.6 * power;
    ctx.strokeStyle = 'rgba(20, 0, 6, 1)';
    ctx.lineWidth = Math.max(2, o.r * 0.12);
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * (1 + pulse * 1.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 30, 50, 0.7)';
    ctx.lineWidth = Math.max(1, o.r * 0.03);
    ctx.stroke();
  }
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
  if (aura === 'darklord')
    Object.assign(element.style, {
      color: '#ffe0e0',
      textShadow: '0 0 10px #ff2020, 0 0 30px #a00000, 0 4px 0 rgba(0, 0, 0, 0.8)',
      WebkitTextStroke: '2px #7a0000',
    });
  if (aura === 'purple')
    Object.assign(element.style, {
      color: '#f3e6ff',
      textShadow: '0 0 12px #a24bff, 0 0 34px #5a1aa8, 0 0 60px #2a0060',
      WebkitTextStroke: '2px #6a2ab8',
    });
  if (aura === 'cthulhu')
    Object.assign(element.style, {
      color: '#c8ffe4',
      textShadow: '0 0 12px #3fbf8a, 0 0 32px #0d5a3c, 0 4px 0 rgba(0, 0, 0, 0.8)',
      WebkitTextStroke: '2px #145a40',
    });
  if (aura === 'haki')
    Object.assign(element.style, {
      color: '#0a0004',
      textShadow: '0 0 10px #ff1e32, 0 0 28px #b0001a, 0 0 60px #6a0010',
      WebkitTextStroke: '2px #ff2a40',
    });
  if (aura === 'alchemy')
    Object.assign(element.style, {
      color: '#ffe9a8',
      textShadow: '0 0 10px #ffd34a, 0 0 30px #e8a020, 0 4px 0 rgba(90, 50, 0, 0.7)',
      WebkitTextStroke: '2px #b07a10',
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
  const shake =
    aura === 'storm' ||
    aura === 'blood' ||
    aura === 'glitch' ||
    aura === 'haki' ||
    aura === 'cthulhu';
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
  if (
    options.text !== false &&
    aura !== 'frog' &&
    aura !== 'cat' &&
    aura !== 'ghost' &&
    aura !== 'cyber' &&
    aura !== 'sungod' &&
    aura !== 'capture' &&
    aura !== 'notebook'
  )
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
  const scene =
    REVISED_SCENES[aura]?.(width, height, durationMs) ??
    SCENES[aura]?.(width, height, durationMs) ??
    null;
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
          : aura === 'ritual' || aura === 'haki' || aura === 'cthulhu'
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

/** Abelha (sprite). */
function beeSprite() {
  return sprite('bee', 32, (ctx, size) => {
    const c = size / 2;
    ctx.fillStyle = 'rgba(230, 245, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(c - 2, c - 7, 6, 4, -0.4, 0, Math.PI * 2);
    ctx.ellipse(c + 3, c - 7, 6, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcf1a';
    ctx.beginPath();
    ctx.ellipse(c, c, 10, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1408';
    for (const x of [-3, 2]) ctx.fillRect(c + x, c - 6, 2.5, 12);
    ctx.beginPath();
    ctx.arc(c + 9, c, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Fantasminha de lençol (sprite). */
function ghostSprite() {
  return sprite('ghost', 64, (ctx, size) => {
    const c = size / 2;
    ctx.fillStyle = 'rgba(240, 245, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(c, c - 6, 18, Math.PI, 0);
    ctx.lineTo(c + 18, c + 20);
    for (let i = 0; i < 4; i++)
      ctx.quadraticCurveTo(c + 13.5 - i * 9, c + 26, c + 9 - i * 9, c + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a1c28';
    for (const x of [-6, 6]) {
      ctx.beginPath();
      ctx.ellipse(c + x, c - 6, 3, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(c, c + 4, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Neblina no vidro (fantasma): borra a página por trás do efeito. */
function fogGlass(durationMs: number) {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '119',
    pointerEvents: 'none',
    backdropFilter: 'blur(3px) saturate(0.6)',
    background: 'rgba(120, 135, 165, 0.12)',
  });
  document.body.appendChild(element);
  element.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }],
    {
      duration: durationMs,
      fill: 'forwards',
    },
  );
  window.setTimeout(() => element.remove(), durationMs + 100);
}

/** Braço de esqueleto saindo do chão (base em y = 0, apontando para cima). */
function drawBoneArm(ctx: CanvasRenderingContext2D, length: number, t: number, phase: number) {
  ctx.strokeStyle = '#ece4cd';
  ctx.fillStyle = '#ece4cd';
  ctx.lineCap = 'round';
  const bend = Math.sin(t * 3 + phase) * 0.25;
  const elbow = { x: Math.sin(bend) * length * 0.5, y: -length * 0.5 };
  const wrist = { x: elbow.x + Math.sin(bend * 2.2) * length * 0.45, y: elbow.y - length * 0.45 };
  ctx.lineWidth = length * 0.06;
  for (const offset of [-length * 0.025, length * 0.025]) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(elbow.x + offset, elbow.y);
    ctx.lineTo(wrist.x + offset, wrist.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(elbow.x, elbow.y, length * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(wrist.x, wrist.y - length * 0.04, length * 0.08, length * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dedos se fechando e abrindo.
  ctx.lineWidth = length * 0.035;
  const grip = 0.5 + Math.sin(t * 5 + phase) * 0.5;
  for (let k = 0; k < 4; k++) {
    const base = { x: wrist.x - length * 0.07 + k * length * 0.047, y: wrist.y - length * 0.09 };
    const a = -Math.PI / 2 + (k - 1.5) * 0.25;
    const mid = {
      x: base.x + Math.cos(a) * length * 0.11,
      y: base.y + Math.sin(a) * length * 0.11,
    };
    const curl = a + grip * 1.2 * (k < 2 ? -1 : 1) * 0.6;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.lineTo(mid.x + Math.cos(curl) * length * 0.09, mid.y + Math.sin(curl) * length * 0.09);
    ctx.stroke();
  }
}

/** Olho reptiliano/de lobo (centro na origem): íris quente, pupila em fenda e brilho. */
function drawBeastEye(
  ctx: CanvasRenderingContext2D,
  w: number,
  open: number,
  tilt: number,
  colors: [string, string, string],
  pupil: number,
) {
  const h = w * 0.42 * open;
  if (h < 1) return;
  ctx.save();
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.quadraticCurveTo(0, -h * 2, w, 0);
  ctx.quadraticCurveTo(0, h * 2, -w, 0);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  const iris = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  iris.addColorStop(0, colors[0]);
  iris.addColorStop(0.45, colors[1]);
  iris.addColorStop(1, colors[2]);
  ctx.fillStyle = iris;
  ctx.fillRect(-w, -h * 2, w * 2, h * 4);
  ctx.fillStyle = '#050202';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * pupil, h * 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.3, -h * 0.45, w * 0.06, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = Math.max(2, w * 0.04);
  ctx.stroke();
  ctx.restore();
}

/** Navio pirata (linha d'água em y = 0). */
function drawShip(ctx: CanvasRenderingContext2D, s: number, t: number) {
  ctx.save();
  ctx.rotate(Math.sin(t * 2) * 0.04);
  ctx.fillStyle = '#4a2c16';
  ctx.beginPath();
  ctx.moveTo(-s * 1.4, -s * 0.35);
  ctx.lineTo(s * 1.5, -s * 0.35);
  ctx.lineTo(s * 1.1, s * 0.25);
  ctx.lineTo(-s * 1.1, s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a180a';
  ctx.lineWidth = s * 0.06;
  for (const x of [-0.7, 0, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(x * s, -s * 0.35);
    ctx.lineTo(x * s, -s * 1.7);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(235, 225, 200, 0.95)';
  for (const [x, h] of [
    [-0.7, 0.9],
    [0, 1.1],
    [0.7, 0.85],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x * s - s * 0.35, -s * 0.5);
    ctx.quadraticCurveTo(
      x * s,
      -s * 0.5 - s * h * 0.5 + Math.sin(t * 3) * s * 0.05,
      x * s - s * 0.35,
      -s * 0.5 - s * h,
    );
    ctx.lineTo(x * s + s * 0.35, -s * 0.5 - s * h);
    ctx.quadraticCurveTo(x * s + s * 0.2, -s * 0.5 - s * h * 0.5, x * s + s * 0.35, -s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#0d0d10';
  ctx.fillRect(0, -s * 1.75, s * 0.45, s * 0.28);
  ctx.fillStyle = '#f0f0f0';
  ctx.font = `${s * 0.24}px "Segoe UI Symbol", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('☠', s * 0.22, -s * 1.61);
  ctx.restore();
}

/** Fonte de títulos do site (para textos desenhados no canvas). */
function displayFont() {
  return getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
}

/** Esfera de captura (centro na origem): metade de cima abre pela dobradiça de trás. */
function drawCaptureBall(ctx: CanvasRenderingContext2D, r: number, open: number, glow: number) {
  ctx.save();
  ctx.fillStyle = '#d8d8e0';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(-r, 0);
  ctx.rotate(-open * 1.1);
  ctx.translate(r, 0);
  const top = ctx.createLinearGradient(0, -r, 0, 0);
  top.addColorStop(0, '#6b3fb8');
  top.addColorStop(1, '#3b1f6b');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f0c040';
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.55, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#121216';
  ctx.fillRect(-r, -r * 0.08, r * 2, r * 0.16);
  ctx.fillStyle = '#121216';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glow > 0 ? `rgba(255, 220, 110, ${0.6 + glow * 0.4})` : '#f0c040';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#121216';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Roda de oito raios com manoplas (Roda da Adaptação). */
function wheelSprite(radius: number) {
  const R = Math.round(radius);
  return sprite(`adapt-wheel:${R}`, Math.ceil(R * 2.7), (c, size) => {
    c.translate(size / 2, size / 2);
    const metal = c.createLinearGradient(-R, -R, R, R);
    metal.addColorStop(0, '#f6dc8a');
    metal.addColorStop(0.5, '#b58a2e');
    metal.addColorStop(1, '#6e4f14');
    c.strokeStyle = metal;
    c.fillStyle = metal;
    c.lineCap = 'round';
    c.lineWidth = R * 0.11;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = R * 0.06;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
      c.lineTo(Math.cos(a) * R * 1.22, Math.sin(a) * R * 1.22);
      c.stroke();
      c.beginPath();
      c.arc(Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25, R * 0.08, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(0, 0, R * 0.22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#3b2a08';
    c.beginPath();
    c.arc(0, 0, R * 0.09, 0, Math.PI * 2);
    c.fill();
  });
}

/** Esfera alaranjada com pontinhos (1 a 7). */
function drawOrb(ctx: CanvasRenderingContext2D, r: number, pips: number, gray: number) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, gray ? '#d0d0d0' : '#fff2c0');
  g.addColorStop(0.5, gray ? '#8a8a8a' : '#ffa31a');
  g.addColorStop(1, gray ? '#4a4a4a' : '#c25a00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = gray ? '#666' : '#fff8e0';
  for (let k = 0; k < pips; k++) {
    const a = (k / pips) * Math.PI * 2 - Math.PI / 2;
    const d = pips === 1 ? 0 : r * 0.38;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
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
        ctx.save();
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
  necro: (width, height, durationMs) => {
    // Um círculo necromântico se acende no chão, braços de esqueleto rompem dele agarrando o ar e
    // almas sobem em espiral até sumir acima do texto.
    const cx = width / 2;
    const cy = height * 0.84;
    const rx = Math.min(width * 0.4, height * 0.7);
    const ry = rx * 0.22;
    const arms = Array.from({ length: 9 }, (_, i) => ({
      angle: (i / 9) * Math.PI * 2 + rand(-0.15, 0.15),
      k: rand(0.45, 0.9),
      delay: 0.5 + i * 0.07,
      phase: rand(0, 6),
      length: Math.min(width, height) * rand(0.16, 0.24),
    }));
    return {
      frame(ctx, f) {
        const draw = clamp01(f.time / 0.6);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 12, 8, ${0.55 * clamp01(f.time / 0.5)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        // Coluna de luz verde subindo do círculo.
        const column = ctx.createLinearGradient(0, cy, 0, 0);
        column.addColorStop(0, `rgba(80, 230, 150, ${0.3 * draw})`);
        column.addColorStop(1, 'rgba(80, 230, 150, 0)');
        ctx.fillStyle = column;
        ctx.fillRect(cx - rx * 0.8, 0, rx * 1.6, cy);
        ctx.strokeStyle = 'rgba(90, 255, 160, 0.85)';
        for (const [k, w] of [
          [1, 4],
          [0.82, 2],
        ] as const) {
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx * k, ry * k, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * draw);
          ctx.stroke();
        }
        if (draw >= 1) {
          ctx.beginPath();
          for (let i = 0; i <= 5; i++) {
            const a = -Math.PI / 2 + f.time * 0.3 + ((i * 2) % 5) * ((Math.PI * 2) / 5);
            const x = cx + Math.cos(a) * rx * 0.8;
            const y = cy + Math.sin(a) * ry * 0.8;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 - f.time * 0.4;
            blit(
              ctx,
              runeSprite(RUNES[(i * 3) % RUNES.length]!, '80, 230, 150'),
              cx + Math.cos(a) * rx * 0.91,
              cy + Math.sin(a) * ry * 0.91,
              12,
              0.9,
            );
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // Braços rompendo do círculo (os de trás primeiro).
        const order = [...arms].sort((a, b) => Math.sin(a.angle) - Math.sin(b.angle));
        for (const arm of order) {
          // Sobem do círculo e afundam de volta antes de ele apagar.
          const sink = easeOut((f.time - (durationMs / 1000 - 1.1)) / 0.5);
          const rise = easeOut((f.time - arm.delay) / 0.45) * (1 - sink);
          if (rise <= 0) continue;
          const x = cx + Math.cos(arm.angle) * rx * arm.k;
          const y = cy + Math.sin(arm.angle) * ry * arm.k;
          const depth = 0.7 + 0.3 * ((Math.sin(arm.angle) + 1) / 2);
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(depth, depth * rise);
          ctx.rotate(Math.cos(arm.angle) * 0.25);
          drawBoneArm(ctx, arm.length, f.time, arm.phase);
          ctx.restore();
        }
        ctx.restore();
        // Almas em espiral.
        if (f.emitting && f.particles.length < MAX_PARTICLES && f.time > 0.6) {
          const a = rand(0, Math.PI * 2);
          f.particles.push(
            particle(
              Math.random() < 0.25 ? 'skull' : 'wisp',
              cx + Math.cos(a) * rx * 0.6,
              cy + Math.sin(a) * ry * 0.6,
              {
                vx: -Math.sin(a) * 2.5 + (cx - (cx + Math.cos(a) * rx * 0.6)) * 0.004,
                vy: -rand(2.5, 4),
                max: rand(70, 100),
                size: rand(14, 30),
                color: pick(['80, 230, 150', '140, 255, 190']),
              },
            ),
          );
        }
      },
    };
  },
  pirate: (width, height) => {
    // Um navio cruza o mar disparando canhões; no fim, o baú do tesouro abre.
    const sea = height * 0.8;
    const s = Math.min(width, height) * 0.11;
    const shots = [0.8, 1.3, 1.8].map((at) => ({ at, done: false }));
    let opened = false;
    return {
      frame(ctx, f) {
        const shipX = -s * 2 + (width + s * 4) * (f.time / 3.4);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(shipX, sea + Math.sin(f.time * 2) * 4);
        drawShip(ctx, s, f.time);
        ctx.restore();
        for (const shot of shots) {
          if (shot.done || f.time < shot.at) continue;
          shot.done = true;
          screenShake(150, 5);
          const mx = shipX + s * 1.2;
          const my = sea - s * 0.15;
          for (let k = 0; k < 8; k++)
            f.particles.push(
              particle('smoke', mx, my, {
                vx: rand(1, 4),
                vy: -rand(0.5, 1.5),
                max: 70,
                size: rand(20, 40),
                color: '160, 155, 150',
              }),
            );
          f.particles.push(
            particle('rock', mx, my, {
              vx: rand(9, 13),
              vy: -rand(9, 12),
              gravity: 0.25,
              max: 120,
              size: 7,
            }),
          );
          f.particles.push(
            particle('spark', mx, my, { max: 10, size: 14, color: '255, 200, 120' }),
          );
        }
        ctx.save();
        ctx.globalAlpha = f.presence * 0.85;
        ctx.fillStyle = 'rgba(20, 70, 120, 0.8)';
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width + 30; x += 30)
          ctx.lineTo(x, sea + Math.sin(x * 0.02 + f.time * 2.5) * 10);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Baú do tesouro.
        const show = easeOut((f.time - 1.9) / 0.3);
        if (show <= 0) return;
        const bx = width * 0.85;
        const by = height - 30;
        const bw = s * 1.3;
        const lid = clamp01((f.time - 2.1) / 0.3);
        if (!opened && lid > 0) {
          opened = true;
          for (let k = 0; k < 20; k++)
            f.particles.push(
              particle('coin', bx, by - bw * 0.5, {
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
        ctx.globalAlpha = f.presence * show;
        if (lid > 0) {
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, softSprite('255, 210, 80'), bx, by - bw * 0.6, bw * 1.4, 0.8 * lid);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = '#6b3d16';
        ctx.fillRect(bx - bw / 2, by - bw * 0.55, bw, bw * 0.55);
        ctx.fillStyle = '#d9a441';
        ctx.fillRect(bx - bw / 2, by - bw * 0.3, bw, bw * 0.06);
        ctx.save();
        ctx.translate(bx - bw / 2, by - bw * 0.55);
        ctx.rotate(-lid * 1.2);
        ctx.fillStyle = '#7a4a1e';
        ctx.fillRect(0, -bw * 0.3, bw, bw * 0.3);
        ctx.fillStyle = '#d9a441';
        ctx.fillRect(0, -bw * 0.06, bw, bw * 0.06);
        ctx.restore();
        ctx.restore();
      },
    };
  },
  samurai: (width, height) => {
    // Sol vermelho, pincelada de nanquim, quatro cortes relâmpago cruzando a tela e o corte final
    // que parte o sol ao meio; pétalas de cerejeira o tempo todo.
    const cx = width / 2;
    const cy = height * 0.45;
    const sunR = Math.min(width, height) * 0.3;
    const slashes = [0.35, 0.48, 0.6, 0.72].map((at) => {
      const a = rand(0, Math.PI);
      const reach = Math.hypot(width, height);
      const ox = cx + rand(-width * 0.2, width * 0.2);
      const oy = cy + rand(-height * 0.2, height * 0.2);
      return {
        at,
        x1: ox - Math.cos(a) * reach,
        y1: oy - Math.sin(a) * reach,
        x2: ox + Math.cos(a) * reach,
        y2: oy + Math.sin(a) * reach,
      };
    });
    const final = { at: 0.9, x1: -50, y1: cy + 30, x2: width + 50, y2: cy - 30 };
    const brush = Array.from({ length: 40 }, (_, i) => ({ u: i / 39, w: rand(0.7, 1.15) }));
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(14, 4, 8, ${0.6 * clamp01(f.time / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        // Sol (parte em dois depois do corte final).
        const split = f.time > final.at ? easeOut((f.time - final.at) / 0.3) * 14 : 0;
        const sunIn = easeOut(f.time / 0.4);
        for (const side of split > 0 ? [-1, 1] : [0]) {
          ctx.save();
          ctx.beginPath();
          if (side === -1) {
            ctx.moveTo(-50, -height);
            ctx.lineTo(width + 50, -height);
            ctx.lineTo(final.x2, final.y2);
            ctx.lineTo(final.x1, final.y1);
            ctx.closePath();
          } else if (side === 1) {
            ctx.moveTo(final.x1, final.y1);
            ctx.lineTo(final.x2, final.y2);
            ctx.lineTo(width + 50, height * 2);
            ctx.lineTo(-50, height * 2);
            ctx.closePath();
          } else ctx.rect(0, 0, width, height);
          ctx.clip();
          ctx.translate(side * split * 0.6, side * split);
          ctx.fillStyle = '#c4161c';
          ctx.shadowColor = 'rgba(255, 60, 60, 0.6)';
          ctx.shadowBlur = 40;
          ctx.beginPath();
          ctx.arc(cx, cy, sunR * (0.7 + 0.3 * sunIn), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Pincelada de nanquim sob o texto.
        const stroke = clamp01((f.time - 0.15) / 0.25);
        if (stroke > 0) {
          ctx.fillStyle = 'rgba(10, 8, 10, 0.92)';
          ctx.beginPath();
          const left = width * 0.12;
          const span = width * 0.76 * stroke;
          brush.forEach(({ u, w }) =>
            ctx.lineTo(left + span * u, height * 0.62 - 22 * Math.sin(u * Math.PI) * w),
          );
          [...brush]
            .reverse()
            .forEach(({ u, w }) =>
              ctx.lineTo(left + span * u, height * 0.62 + 16 * Math.sin(u * Math.PI) ** 0.6 * w),
            );
          ctx.closePath();
          ctx.fill();
        }
        // Cortes.
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const sl of [...slashes, final]) {
          const age = f.time - sl.at;
          if (age < 0 || age > 0.6) continue;
          const fade = 1 - age / 0.6;
          for (const [w, style] of [
            [sl === final ? 22 : 12, `rgba(255, 150, 190, ${0.35 * fade})`],
            [sl === final ? 4 : 2, `rgba(255, 255, 255, ${fade})`],
          ] as const) {
            ctx.strokeStyle = style;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(sl.x1, sl.y1);
            ctx.lineTo(sl.x2, sl.y2);
            ctx.stroke();
          }
        }
        const flash = 1 - Math.abs(f.time - final.at) / 0.1;
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 245, 250, ${flash * 0.6})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES)
          for (let i = 0; i < 2; i++)
            f.particles.push(
              particle('leaf', -20, rand(0, height), {
                vx: rand(4, 8),
                vy: rand(-0.5, 1.5),
                vr: rand(-0.1, 0.1),
                max: 220,
                size: rand(6, 10),
                color: pick(['255, 180, 205', '255, 210, 225', '250, 150, 185']),
              }),
            );
      },
    };
  },
  kaiju: (width, height, durationMs) => {
    // Tudo escurece; dois passos fazem a tela tremer e cair poeira; olhos de réptil gigantes se
    // abrem no escuro, cheios de raiva, e o rugido sai em ondas de choque.
    const eyeW = Math.min(width * 0.15, 170);
    const gap = Math.min(width * 0.2, 250);
    const eyeY = height * 0.3;
    const mouth = { x: width / 2, y: eyeY + eyeW * 1.6 };
    const steps = [0.1, 0.5].map((at) => ({ at, done: false }));
    let roared = false;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        for (const step of steps) {
          if (step.done || f.time < step.at) continue;
          step.done = true;
          screenShake(260, 10);
          for (let k = 0; k < 14; k++)
            f.particles.push(
              particle(k % 3 ? 'smoke' : 'rock', rand(0, width), -10, {
                vy: rand(1, 3),
                gravity: 0.15,
                vr: 0.2,
                max: 120,
                size: k % 3 ? rand(10, 22) : rand(3, 6),
                color: '110, 90, 60',
              }),
            );
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(6, 3, 1, ${0.82 * clamp01(f.time / 0.6)})`;
        ctx.fillRect(0, 0, width, height);
        const open = easeOut((f.time - 0.7) / 0.45) * clamp01((end - 0.3 - f.time) / 0.4);
        if (open > 0) {
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, softSprite('255, 120, 20'), width / 2, eyeY, gap * 2.4, 0.35 * open);
          ctx.globalCompositeOperation = 'source-over';
          for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(width / 2 + side * gap, eyeY + (f.time > 1.35 ? rand(-2, 2) : 0));
            drawBeastEye(
              ctx,
              eyeW,
              open,
              side * 0.12,
              ['#fff6b0', '#ff9a1a', '#7a1a00'],
              f.time > 1.35 ? 0.05 : 0.09,
            );
            // Sobrancelha de escamas, franzida.
            ctx.fillStyle = '#0a0502';
            ctx.beginPath();
            ctx.moveTo(-eyeW * 1.2, -eyeW * 0.25 - side * eyeW * 0.25);
            ctx.lineTo(eyeW * 1.2, -eyeW * 0.25 + side * eyeW * 0.25);
            ctx.lineTo(eyeW * 1.2, -eyeW * 1.2);
            ctx.lineTo(-eyeW * 1.2, -eyeW * 1.2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
        // Rugido: ondas de choque saindo da "boca", tremor forte e destroços.
        if (!roared && f.time >= 1.4) {
          roared = true;
          screenShake(800, 18);
          for (let k = 0; k < 30; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle(k % 2 ? 'rock' : 'smoke', mouth.x, mouth.y, {
                vx: Math.cos(a) * rand(5, 14),
                vy: Math.sin(a) * rand(5, 14),
                drag: 0.97,
                vr: 0.2,
                max: 80,
                size: k % 2 ? rand(4, 9) : rand(30, 60),
                color: '120, 90, 60',
              }),
            );
          }
        }
        if (f.time > 1.4) {
          ctx.globalCompositeOperation = 'lighter';
          blit(
            ctx,
            softSprite('255, 110, 30'),
            mouth.x,
            mouth.y,
            eyeW * 2.2,
            0.5 * (0.7 + 0.3 * Math.sin(f.time * 30)) * clamp01((end - 0.5 - f.time) / 0.5),
          );
          for (let k = 0; k < 4; k++) {
            const age = f.time - 1.4 - k * 0.15;
            if (age <= 0 || age > 1.1) continue;
            ctx.strokeStyle = `rgba(255, 170, 90, ${(1 - age / 1.1) * 0.8})`;
            ctx.lineWidth = 8 * (1 - age / 1.1) + 1;
            ctx.beginPath();
            ctx.arc(mouth.x, mouth.y, age * Math.max(width, height) * 1.1, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      },
    };
  },
  cyber: (width, height, durationMs) => {
    // Sandevistan: o implante liga, a tela esverdeia e o tempo quase para — chuva e cacos de vidro
    // ficam suspensos no ar e o "CRÍTICO!" atravessa a tela deixando rastros coloridos; no fim, o
    // tempo volta de uma vez.
    const font =
      getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
    const size = Math.min(width * 0.1, 130);
    const home = { x: width / 2, y: height * 0.42 };
    const trail: { x: number; y: number; t: number }[] = [];
    const frozen = Array.from({ length: 140 }, () => ({
      x: rand(0, width),
      y: rand(0, height),
      kind: Math.random() < 0.75 ? 'rain' : 'glass',
      rot: rand(0, Math.PI),
      size: rand(4, 10),
    }));
    const colors = ['80, 255, 140', '252, 238, 10', '255, 43, 214', '0, 240, 255'];
    let snapped = false;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const slow = f.time > 0.25 && f.time < end - 0.9;
        if (!snapped && f.time >= end - 0.9) {
          snapped = true;
          screenShake(250, 8);
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Tela verde com bordas separando as cores.
        ctx.fillStyle = `rgba(20, 255, 120, ${slow ? 0.12 : 0.04})`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.fillRect(0, 0, 6, height);
        ctx.fillStyle = 'rgba(255, 43, 214, 0.18)';
        ctx.fillRect(width - 6, 0, 6, height);
        // Chuva e cacos parados no ar (andam devagarinho).
        for (const item of frozen) {
          item.y += slow ? 0.25 : 14;
          if (item.y > height + 20) item.y = -20;
          if (item.kind === 'rain') {
            ctx.strokeStyle = 'rgba(190, 255, 220, 0.55)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(item.x, item.y);
            ctx.lineTo(item.x, item.y + (slow ? item.size : item.size * 6));
            ctx.stroke();
          } else {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rot + (slow ? f.time * 0.05 : f.time));
            ctx.fillStyle = 'rgba(200, 255, 230, 0.35)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.moveTo(0, -item.size);
            ctx.lineTo(item.size * 0.7, item.size * 0.6);
            ctx.lineTo(-item.size * 0.5, item.size * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }
        // HUD.
        ctx.font = `bold ${Math.min(width, height) * 0.028}px ui-monospace, Consolas, monospace`;
        ctx.fillStyle = 'rgba(252, 238, 10, 0.95)';
        ctx.textBaseline = 'top';
        ctx.fillText('SANDEVISTAN // ATIVADO', 24, 24);
        ctx.fillStyle = 'rgba(80, 255, 140, 0.9)';
        ctx.fillText(`TEMPO x${slow ? '0.05' : '1.00'}`, 24, 24 + Math.min(width, height) * 0.04);
        // "CRÍTICO!" atravessa a tela em zigue-zague, deixando rastros que ficam no ar.
        const dash = easeOut((f.time - 0.3) / 1.2);
        const x = -width * 0.3 + (home.x + width * 0.3) * dash;
        const y = home.y + Math.sin(dash * Math.PI * 3) * height * 0.12 * (1 - dash);
        if (
          f.time > 0.3 &&
          dash < 1 &&
          (!trail.length || Math.abs(trail[trail.length - 1]!.x - x) > 40)
        )
          trail.push({ x, y, t: f.time });
        ctx.font = `${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        trail.forEach((echo, i) => {
          const age = f.time - echo.t;
          ctx.globalAlpha = f.presence * Math.max(0, 0.55 - age * (slow ? 0.12 : 1.5));
          ctx.fillStyle = `rgb(${colors[i % colors.length]})`;
          ctx.fillText('CRÍTICO!', echo.x, echo.y);
        });
        ctx.globalAlpha = f.presence;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgb(80, 255, 140)';
        ctx.shadowColor = 'rgb(80, 255, 140)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#fff';
        ctx.strokeText('CRÍTICO!', x, y);
        ctx.fillText('CRÍTICO!', x, y);
        ctx.restore();
      },
    };
  },
  werewolf: (width, height, durationMs) => {
    // Lua cheia gigante e, no penhasco à frente dela, o lobo uiva; no uivo a lua pulsa, um clarão
    // prateado varre a tela e a noite se enche de brilho.
    const moonR = Math.min(width, height) * 0.36;
    const moon = sprite(`big-moon:${Math.round(moonR)}`, Math.ceil(moonR * 2.8), (c, size) => {
      c.translate(size / 2, size / 2);
      const glow = c.createRadialGradient(0, 0, moonR * 0.95, 0, 0, moonR * 1.4);
      glow.addColorStop(0, 'rgba(225, 235, 255, 0.5)');
      glow.addColorStop(1, 'rgba(225, 235, 255, 0)');
      c.fillStyle = glow;
      c.fillRect(-size / 2, -size / 2, size, size);
      const g = c.createRadialGradient(-moonR * 0.25, -moonR * 0.25, moonR * 0.1, 0, 0, moonR);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, '#e3e8f4');
      g.addColorStop(1, '#aeb8d2');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, moonR, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(140, 152, 180, 0.35)';
      for (const [x, y, r] of [
        [-0.35, -0.15, 0.2],
        [0.3, 0.2, 0.14],
        [0.05, -0.45, 0.1],
        [-0.05, 0.4, 0.12],
        [0.45, -0.3, 0.07],
      ] as const) {
        c.beginPath();
        c.arc(x * moonR, y * moonR, r * moonR, 0, Math.PI * 2);
        c.fill();
      }
    });
    // Lobo sentado uivando (caixa 200 × 200, chão em y = 200), com curvas suaves.
    const wolf = new Path2D(
      'M120 200 C150 200 170 190 176 174 C182 157 171 149 160 157 C151 164 148 174 140 177 L139 140 ' +
        'C137 115 128 95 112 80 L104 58 L98 40 L94 33 L98 14 L86 25 C80 20 72 14 64 6 L57 2 L53 8 ' +
        'C58 13 61 19 63 25 L57 27 C63 34 69 41 71 52 C73 70 70 90 65 110 C61 130 62 150 66 170 ' +
        'L60 200 L74 200 L80 162 C84 176 88 190 86 200 Z',
    );
    const cliff = new Path2D(
      'M-40 210 L-40 196 C20 190 60 184 100 186 C150 188 200 178 260 186 L300 196 L300 210 Z',
    );
    const mx = width / 2;
    const my = height * 0.4;
    const howlAt = 0.75;
    let howled = false;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const rise = easeOut(f.time / 0.7);
        if (!howled && f.time >= howlAt) {
          howled = true;
          screenShake(200, 4);
        }
        const howl = f.time > howlAt ? Math.max(0, 1 - (f.time - howlAt) / 1.6) : 0;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 6, 18, ${0.8 * clamp01(f.time / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        // Lua (pulsa no uivo).
        const pulse = 1 + howl * 0.05 * Math.sin(f.time * 18);
        const moonY = my + (1 - rise) * height * 0.35;
        ctx.save();
        ctx.translate(mx, moonY);
        ctx.scale(pulse, pulse);
        ctx.drawImage(moon, -moon.width / 2, -moon.height / 2);
        ctx.restore();
        if (howl > 0) {
          ctx.globalCompositeOperation = 'lighter';
          blit(
            ctx,
            softSprite('210, 225, 255'),
            mx,
            moonY,
            moonR * (1.6 + (1 - howl) * 1.2),
            howl * 0.5,
          );
          ctx.globalCompositeOperation = 'source-over';
        }
        // Nuvens finas passando.
        ctx.globalAlpha = f.presence * 0.7;
        drawCloud(ctx, -260 + f.time * 150, moonY + moonR * 0.55, 70, 'rgba(10, 12, 24, 0.9)');
        drawCloud(
          ctx,
          width + 200 - f.time * 110,
          moonY - moonR * 0.7,
          55,
          'rgba(10, 12, 24, 0.85)',
        );
        ctx.globalAlpha = f.presence;
        // Penhasco e lobo, em silhueta na frente da lua (o lobo sobe junto com o uivo).
        const scale = (moonR * 1.15) / 200;
        ctx.save();
        ctx.translate(mx - 130 * scale, moonY + moonR * 1.05 - 200 * scale);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#05060c';
        ctx.fill(cliff);
        ctx.translate(40, -12 - howl * 4);
        ctx.fill(wolf);
        ctx.restore();
        // Clarão prateado varrendo a tela no uivo.
        const sweep = clamp01((f.time - howlAt) / 0.5);
        if (sweep > 0 && sweep < 1) {
          const x = -width * 0.3 + sweep * width * 1.6;
          const g = ctx.createLinearGradient(x - 160, 0, x + 160, 0);
          g.addColorStop(0, 'rgba(220, 230, 255, 0)');
          g.addColorStop(0.5, 'rgba(220, 230, 255, 0.35)');
          g.addColorStop(1, 'rgba(220, 230, 255, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 160, 0, 320, height);
        }
        ctx.restore();
        if (
          f.emitting &&
          f.particles.length < MAX_PARTICLES &&
          f.time < end - 0.6 &&
          Math.random() < 0.4
        )
          f.particles.push(
            particle('mote', rand(0, width), rand(0, height), {
              vy: -rand(0.2, 0.8),
              max: rand(60, 100),
              size: rand(1, 2),
              color: '220, 230, 255',
            }),
          );
      },
    };
  },
  siren: (width, height) => {
    // Fundo do mar: a tela afunda em azul, raios de luz balançam, águas-vivas brilhantes sobem e
    // anéis perolados hipnóticos pulsam em volta do texto.
    const cx = width / 2;
    const cy = height * 0.42;
    const rays = Array.from({ length: 7 }, (_, i) => ({
      x: width * (0.08 + i * 0.14),
      phase: rand(0, 6),
      w: rand(40, 110),
    }));
    const jellies = Array.from({ length: 4 }, (_, i) => ({
      x: width * (0.15 + i * 0.23) + rand(-30, 30),
      y: height + 60 + i * 50,
      size: rand(26, 44),
      rgb: pick(['255, 140, 220', '120, 220, 255', '190, 150, 255']),
      phase: rand(0, 6),
    }));
    const maxR = Math.hypot(width, height) * 0.6;
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        const water = ctx.createLinearGradient(0, 0, 0, height);
        water.addColorStop(0, `rgba(20, 110, 140, ${0.45 * clamp01(f.time / 0.5)})`);
        water.addColorStop(1, `rgba(2, 18, 40, ${0.8 * clamp01(f.time / 0.5)})`);
        ctx.fillStyle = water;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        // Raios de luz vindos da superfície.
        for (const ray of rays) {
          const sway = Math.sin(f.time * 0.8 + ray.phase) * 60;
          const g = ctx.createLinearGradient(0, 0, 0, height * 0.9);
          g.addColorStop(0, 'rgba(180, 255, 240, 0.18)');
          g.addColorStop(1, 'rgba(180, 255, 240, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(ray.x - ray.w / 2, 0);
          ctx.lineTo(ray.x + ray.w / 2, 0);
          ctx.lineTo(ray.x + sway + ray.w * 1.4, height * 0.9);
          ctx.lineTo(ray.x + sway - ray.w * 0.4, height * 0.9);
          ctx.closePath();
          ctx.fill();
        }
        // Anéis perolados pulsando para fora do texto.
        for (let k = 0; k < 7; k++) {
          const r = ((f.time * 90 + k * (maxR / 7)) % maxR) + 20;
          const a = (1 - r / maxR) * 0.5;
          ctx.strokeStyle = `hsla(${(f.time * 60 + k * 40) % 360}, 80%, 80%, ${a})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 1.4, r * 0.7, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Águas-vivas subindo, pulsando.
        for (const j of jellies) {
          j.y -= 1.6 + Math.max(0, Math.sin(f.time * 3 + j.phase)) * 2.2;
          const pulse = 1 + Math.sin(f.time * 3 + j.phase) * 0.12;
          blit(ctx, softSprite(j.rgb), j.x, j.y, j.size * 2.2, 0.45);
          ctx.fillStyle = `rgba(${j.rgb}, 0.55)`;
          ctx.beginPath();
          ctx.ellipse(j.x, j.y, j.size * pulse, (j.size * 0.7) / pulse, 0, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = `rgba(${j.rgb}, 0.5)`;
          ctx.lineWidth = 2;
          for (let t = 0; t < 5; t++) {
            const tx = j.x - j.size * 0.7 + t * j.size * 0.35;
            ctx.beginPath();
            ctx.moveTo(tx, j.y);
            for (let k = 1; k <= 6; k++)
              ctx.lineTo(tx + Math.sin(f.time * 4 + k + t) * 5, j.y + k * j.size * 0.25);
            ctx.stroke();
          }
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES) {
          if (Math.random() < 0.5)
            f.particles.push(
              particle('bubble', rand(0, width), height + 10, {
                vy: -rand(1.5, 3.5),
                max: 180,
                size: rand(3, 9),
                color: '190, 245, 255',
              }),
            );
          if (Math.random() < 0.08)
            f.particles.push(
              particle('rune', rand(width * 0.2, width * 0.8), height * 0.8, {
                vy: -rand(1, 2),
                vx: rand(-0.4, 0.4),
                max: 140,
                size: rand(22, 32),
                glyph: pick(['♪', '♫']),
                color: pick(['255, 170, 230', '150, 240, 255']),
              }),
            );
        }
      },
    };
  },
  alchemy: (width, height) => {
    // Círculo de transmutação se desenha, frascos borbulham e um clarão dourado transforma tudo.
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width, height) * 0.34;
    const symbols = ['☿', '☉', '☽', '♄', '♃', '♂', '♀'];
    const flasks = [
      { x: width * 0.2, rgb: '255, 90, 180' },
      { x: width * 0.5, rgb: '90, 200, 255' },
      { x: width * 0.8, rgb: '140, 255, 120' },
    ];
    let flashed = false;
    return {
      frame(ctx, f) {
        const draw = clamp01(f.time / 1);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(235, 200, 110, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * draw);
        ctx.stroke();
        if (draw > 0.3) {
          ctx.beginPath();
          ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
          ctx.stroke();
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(f.time * 0.4);
          for (const offset of [0, Math.PI]) {
            ctx.beginPath();
            for (let i = 0; i <= 3; i++) {
              const a = offset + (i / 3) * Math.PI * 2 - Math.PI / 2;
              ctx.lineTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
            }
            ctx.stroke();
          }
          ctx.strokeRect(-R * 0.38, -R * 0.38, R * 0.76, R * 0.76);
          ctx.restore();
          symbols.forEach((glyph, i) => {
            const a = (i / symbols.length) * Math.PI * 2 - f.time * 0.3;
            blit(
              ctx,
              runeSprite(glyph, '235, 200, 110'),
              cx + Math.cos(a) * R * 0.91,
              cy + Math.sin(a) * R * 0.91,
              R * 0.08,
              clamp01((draw - 0.3) * 3),
            );
          });
        }
        ctx.globalCompositeOperation = 'source-over';
        // Frascos borbulhando.
        for (const flask of flasks) {
          const fy = height - 40;
          ctx.fillStyle = `rgba(${flask.rgb}, 0.75)`;
          ctx.beginPath();
          ctx.arc(flask.x, fy - 30, 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(230, 240, 255, 0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(flask.x, fy - 30, 32, Math.PI * 0.3 - Math.PI * 1.6, Math.PI * 0.3);
          ctx.moveTo(flask.x - 9, fy - 61);
          ctx.lineTo(flask.x - 9, fy - 95);
          ctx.moveTo(flask.x + 9, fy - 61);
          ctx.lineTo(flask.x + 9, fy - 95);
          ctx.stroke();
          if (f.emitting && Math.random() < 0.3)
            f.particles.push(
              particle('bubble', flask.x + rand(-5, 5), fy - 95, {
                vy: -rand(1, 2.5),
                vx: rand(-0.3, 0.3),
                max: 60,
                size: rand(3, 6),
                color: flask.rgb,
              }),
            );
        }
        const flash = 1 - Math.abs(f.time - 1.4) / 0.25;
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 235, 170, ${flash * 0.7})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
        if (!flashed && f.time >= 1.4) {
          flashed = true;
          for (let k = 0; k < 50; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle(
                'spark',
                cx + Math.cos(a) * R * rand(0.2, 1),
                cy + Math.sin(a) * R * rand(0.2, 1),
                {
                  vy: -rand(0.5, 2),
                  max: rand(50, 90),
                  size: rand(1.5, 3),
                  color: '255, 215, 110',
                },
              ),
            );
          }
        }
      },
    };
  },
  ghost: (width, height) => {
    // A tela esfria e escurece; um rosto fantasma avança contra a tela e some num clarão; o vidro
    // embaça em volta do texto e "CRÍTICO!" é escrito com o dedo (as letras escorrem); no fim, uma
    // mão bate no vidro.
    const font =
      getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
    const size = Math.min(width * 0.1, 130);
    const cx = width / 2;
    const cy = height * 0.42;
    let dripped = false;
    let textWidth = 0;
    const hand = { x: width * 0.68, y: height * 0.3 };
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(6, 10, 24, ${0.7 * clamp01(f.time / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        // Rosto avançando (0,15 s a 0,9 s).
        const rush = clamp01((f.time - 0.15) / 0.75);
        if (rush > 0 && rush < 1) {
          const scale = 0.2 + rush * rush * 3.2;
          ctx.save();
          ctx.globalAlpha = f.presence * Math.sin(rush * Math.PI) * 0.85;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          const head = ctx.createRadialGradient(0, -10, 10, 0, 0, 120);
          head.addColorStop(0, 'rgba(235, 245, 255, 0.95)');
          head.addColorStop(1, 'rgba(235, 245, 255, 0)');
          ctx.fillStyle = head;
          ctx.beginPath();
          ctx.ellipse(0, 0, 100, 130, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(4, 6, 14, 0.95)';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(side * 34, -22, 18, 28, side * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.ellipse(0, 50, 22, 40 + Math.sin(f.time * 20) * 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const flash = 1 - Math.abs(f.time - 0.9) / 0.08;
        if (flash > 0) {
          ctx.fillStyle = `rgba(220, 235, 255, ${flash * 0.5})`;
          ctx.fillRect(0, 0, width, height);
        }
        // Mancha de neblina no vidro.
        const fog = clamp01((f.time - 0.8) / 0.4);
        if (fog > 0) {
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width * 0.45, 520));
          g.addColorStop(0, `rgba(205, 215, 230, ${0.55 * fog})`);
          g.addColorStop(0.7, `rgba(205, 215, 230, ${0.35 * fog})`);
          g.addColorStop(1, 'rgba(205, 215, 230, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(
            cx,
            cy,
            Math.min(width * 0.45, 520),
            Math.min(height * 0.32, 260),
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        // Escrita com o dedo: letras "limpas" (escuras) na neblina.
        ctx.font = `${size}px ${font}`;
        textWidth ||= ctx.measureText('CRÍTICO!').width;
        const write = clamp01((f.time - 1) / 1);
        const left = cx - textWidth / 2;
        if (write > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(left - 20, cy - size, (textWidth + 40) * write, size * 2);
          ctx.clip();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(10, 16, 32, 0.85)';
          ctx.fillText('CRÍTICO!', cx, cy);
          ctx.restore();
        }
        // Mão batendo no vidro.
        const slap = clamp01((f.time - 2) / 0.08);
        if (slap > 0) {
          const slide = Math.max(0, f.time - 2.1) * 40;
          ctx.fillStyle = `rgba(200, 212, 230, ${0.55 * slap})`;
          ctx.beginPath();
          ctx.ellipse(hand.x, hand.y + slide, 46, 56, 0, 0, Math.PI * 2);
          for (let k = 0; k < 4; k++) {
            ctx.moveTo(hand.x - 36 + k * 24 + 10, hand.y - 70 + slide);
            ctx.ellipse(
              hand.x - 36 + k * 24,
              hand.y - 70 + slide - (k === 1 || k === 2 ? 14 : 0),
              9,
              34,
              0,
              0,
              Math.PI * 2,
            );
          }
          ctx.moveTo(hand.x + 70, hand.y + slide);
          ctx.ellipse(hand.x + 58, hand.y - 6 + slide, 10, 30, -0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        if (!dripped && write >= 1) {
          dripped = true;
          for (let k = 0; k < 9; k++)
            f.particles.push(
              particle('drop', left + rand(0, textWidth), cy + size * 0.35, {
                vy: 0.3,
                gravity: 0.03,
                max: 160,
                size: rand(2, 3),
                color: '30, 40, 60',
              }),
            );
        }
        if (f.emitting && f.particles.length < MAX_PARTICLES && Math.random() < 0.03)
          f.particles.push(
            particle('ghost', -40, rand(height * 0.15, height * 0.85), {
              vx: rand(2, 4),
              vy: rand(-0.5, 0.5),
              max: 260,
              size: rand(22, 36),
            }),
          );
      },
    };
  },
  cthulhu: (width, height, durationMs) => {
    // Ele chega destruindo tudo: céu verde-podre com relâmpagos, o mar sobe, tentáculos gigantes
    // rompem e esmagam a tela, o Grande Antigo surge do mar e abre os olhos, e no fim a própria
    // tela se estilhaça.
    const sea = height * 0.78;
    const headR = Math.min(width * 0.2, height * 0.3);
    const cx = width / 2;
    const arms = [
      { x: width * 0.06, angle: -Math.PI / 2 + 0.35, side: 1, delay: 0.5, slam: 0.7, thick: 56 },
      { x: width * 0.94, angle: -Math.PI / 2 - 0.35, side: -1, delay: 0.6, slam: 0.95, thick: 60 },
      { x: width * 0.24, angle: -Math.PI / 2 + 0.15, side: 1, delay: 0.75, slam: 1.2, thick: 46 },
      { x: width * 0.76, angle: -Math.PI / 2 - 0.15, side: -1, delay: 0.85, slam: 1.45, thick: 48 },
    ];
    const slammed = new Set<number>();
    const cracks: Point[][] = [];
    let shattered = false;
    const beard = Array.from({ length: 9 }, (_, i) => ({
      x: (i - 4) * headR * 0.16,
      phase: rand(0, 6),
      length: headR * rand(0.9, 1.4),
    }));
    const tentacle = (
      ctx: CanvasRenderingContext2D,
      x0: number,
      y0: number,
      angle: number,
      length: number,
      thick: number,
      bend: number,
      t: number,
      phase: number,
    ) => {
      let x = x0;
      let y = y0;
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        const a = angle + bend * u * u + Math.sin(u * 4 + t * 3 + phase) * 0.35 * u;
        const r = thick * (1 - u) + 4;
        ctx.fillStyle = '#16382a';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (i % 2 === 0) {
          ctx.fillStyle = '#5fa080';
          ctx.beginPath();
          ctx.arc(
            x + Math.cos(a + Math.PI / 2) * r * 0.55,
            y + Math.sin(a + Math.PI / 2) * r * 0.55,
            r * 0.22,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        x += Math.cos(a) * (length / 24);
        y += Math.sin(a) * (length / 24);
      }
      return { x, y };
    };
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Céu podre e relâmpagos verdes.
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, `rgba(10, 30, 22, ${0.85 * clamp01(f.time / 0.4)})`);
        sky.addColorStop(1, `rgba(2, 8, 6, ${0.9 * clamp01(f.time / 0.4)})`);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        if (Math.random() < 0.06) {
          f.particles.push(
            particle('bolt', 0, 0, {
              path: bolt(
                { x: rand(0, width), y: 0 },
                { x: rand(0, width), y: sea * rand(0.4, 0.9) },
                40,
                12,
              ),
              max: rand(6, 12),
              size: 3,
              color: '120, 255, 180',
            }),
          );
          ctx.fillStyle = 'rgba(120, 255, 180, 0.15)';
          ctx.fillRect(0, 0, width, height);
        }
        // O Grande Antigo surgindo do mar: asas, cabeça, barba de tentáculos e os olhos.
        const rise = easeOut((f.time - 0.6) / 1.1);
        const headY = sea + headR * 1.2 - rise * headR * 1.9;
        if (rise > 0) {
          ctx.fillStyle = '#0c1f17';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(cx + side * headR * 0.6, headY);
            ctx.lineTo(cx + side * headR * 2.6, headY - headR * 1.5);
            for (let k = 0; k < 4; k++)
              ctx.quadraticCurveTo(
                cx + side * headR * (2.3 - k * 0.45),
                headY - headR * (0.9 - k * 0.1),
                cx + side * headR * (2.1 - k * 0.45),
                headY - headR * (1.1 - k * 0.25),
              );
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = '#16382a';
          ctx.beginPath();
          ctx.ellipse(cx, headY - headR * 0.3, headR * 0.85, headR * 1.05, 0, 0, Math.PI * 2);
          ctx.fill();
          for (const b of beard)
            tentacle(
              ctx,
              cx + b.x,
              headY + headR * 0.3,
              Math.PI / 2,
              b.length,
              headR * 0.09,
              Math.sin(f.time * 2 + b.phase) * 0.8,
              f.time,
              b.phase,
            );
          const open = easeOut((f.time - 1.2) / 0.4);
          for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(cx + side * headR * 0.38, headY - headR * 0.25);
            ctx.globalCompositeOperation = 'lighter';
            blit(ctx, softSprite('255, 210, 60'), 0, 0, headR * 0.5, 0.6 * open);
            ctx.globalCompositeOperation = 'source-over';
            drawBeastEye(
              ctx,
              headR * 0.22,
              open,
              side * 0.25,
              ['#fff6b0', '#ffcc33', '#7a2a00'],
              0.08,
            );
            ctx.restore();
          }
        }
        // Mar subindo.
        ctx.fillStyle = 'rgba(6, 28, 22, 0.92)';
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width + 30; x += 30)
          ctx.lineTo(
            x,
            sea +
              Math.sin(x * 0.015 + f.time * 2.5) * 16 +
              (1 - clamp01(f.time / 0.6)) * height * 0.3,
          );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        // Tentáculos esmagando a tela.
        arms.forEach((arm, index) => {
          const grow = easeOut((f.time - arm.delay) / 0.5);
          if (grow <= 0) return;
          const slam = clamp01((f.time - arm.slam) / 0.2);
          const bend = -0.5 * arm.side + slam * 2.4 * arm.side;
          const tip = tentacle(
            ctx,
            arm.x,
            height + 60,
            arm.angle,
            height * 0.95 * grow,
            arm.thick,
            bend,
            f.time,
            index,
          );
          if (slam >= 1 && !slammed.has(index)) {
            slammed.add(index);
            screenShake(380, 16);
            pageJolt('grayscale(1) contrast(1.6) brightness(0.7)', 120);
            for (let k = 0; k < 8; k++) {
              const a = rand(0, Math.PI * 2);
              const l = rand(100, 320);
              cracks.push(
                bolt(tip, { x: tip.x + Math.cos(a) * l, y: tip.y + Math.sin(a) * l }, 18, 8),
              );
            }
            for (let k = 0; k < 16; k++) {
              const a = rand(0, Math.PI * 2);
              f.particles.push(
                particle('rock', tip.x, tip.y, {
                  vx: Math.cos(a) * rand(3, 10),
                  vy: Math.sin(a) * rand(3, 10) - 3,
                  gravity: 0.35,
                  vr: 0.2,
                  max: 70,
                  size: rand(4, 10),
                }),
              );
            }
          }
        });
        // Rachaduras por toda a tela.
        ctx.lineJoin = 'round';
        for (const crack of cracks)
          for (const [w, style] of [
            [6, 'rgba(0, 0, 0, 0.7)'],
            [1.6, 'rgba(150, 255, 200, 0.85)'],
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
        // No fim, a tela inteira se estilhaça e os pedaços despencam.
        if (!shattered && f.time >= end - 1.5) {
          shattered = true;
          screenShake(600, 20);
          pageJolt('invert(1) hue-rotate(120deg)', 160);
          for (let k = 0; k < 60; k++)
            f.particles.push(
              particle('shard', rand(0, width), rand(0, height), {
                vx: rand(-3, 3),
                vy: rand(-3, 1),
                gravity: 0.45,
                vr: rand(-0.2, 0.2),
                max: 110,
                size: rand(18, 48),
              }),
            );
        }
      },
    };
  },
  heaven: (width, height, durationMs) => {
    // O tempo acelera: dias e noites passam cada vez mais rápido, sol e lua giram pelo céu,
    // estrelas viram riscos e o relógio dispara; no fim, um clarão e o universo recomeça.
    let phase = 0;
    let last = 0;
    const stars = Array.from({ length: 70 }, () => ({
      r: rand(0.1, 1.2),
      a: rand(0, Math.PI * 2),
    }));
    const pole = { x: width / 2, y: -height * 0.1 };
    const mix = (a: number[], b: number[], k: number) =>
      a.map((v, i) => Math.round(v + (b[i]! - v) * k)).join(', ');
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const dt = Math.max(0, f.time - last);
        last = f.time;
        const speed = 0.3 + f.time ** 3 * 0.9;
        phase += speed * dt;
        const day = (Math.sin(phase * Math.PI * 2) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = f.presence;
        const top =
          day > 0.5
            ? mix([255, 140, 70], [90, 170, 240], (day - 0.5) * 2)
            : mix([8, 10, 30], [255, 140, 70], day * 2);
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, `rgba(${top}, 0.8)`);
        sky.addColorStop(1, 'rgba(5, 6, 20, 0.85)');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        // Estrelas riscando em volta do polo (mais longas quanto mais rápido).
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(220, 235, 255, ${0.7 * (1 - day)})`;
        ctx.lineWidth = 1.5;
        const span = Math.min(1.5, speed * 0.12);
        const reach = Math.hypot(width, height);
        for (const star of stars) {
          ctx.beginPath();
          ctx.arc(pole.x, pole.y, star.r * reach, star.a + phase * 2, star.a + phase * 2 + span);
          ctx.stroke();
        }
        // Sol e lua girando no céu.
        const angle = phase * Math.PI * 2;
        const ox = width / 2;
        const oy = height * 0.85;
        const rx = width * 0.45;
        const ry = height * 0.7;
        blit(
          ctx,
          softSprite('255, 220, 120'),
          ox + Math.cos(angle) * rx,
          oy - Math.sin(angle) * ry,
          90,
          0.9,
        );
        blit(
          ctx,
          glowSprite('255, 250, 220'),
          ox + Math.cos(angle) * rx,
          oy - Math.sin(angle) * ry,
          50,
          1,
        );
        blit(
          ctx,
          softSprite('210, 225, 255'),
          ox - Math.cos(angle) * rx,
          oy + Math.sin(angle) * ry,
          60,
          0.7,
        );
        ctx.globalCompositeOperation = 'source-over';
        // Relógio disparando.
        const R = Math.min(width, height) * 0.16;
        const cx = width / 2;
        const cy = height * 0.42;
        ctx.strokeStyle = 'rgba(230, 240, 255, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.stroke();
        for (const [mult, length, w] of [
          [1, 0.55, 7],
          [12, 0.82, 3],
        ] as const) {
          const a = phase * Math.PI * 2 * mult - Math.PI / 2;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * R * length, cy + Math.sin(a) * R * length);
          ctx.stroke();
        }
        const flash = 1 - Math.abs(f.time - (end - 0.7)) / 0.2;
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.9})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      },
    };
  },
  purple: (width, height, durationMs) => {
    // O azul puxa tudo para si, o vermelho empurra tudo para longe; os dois se encontram no
    // centro e viram o vazio roxo, que dispara e apaga uma faixa inteira da tela.
    const cy = height * 0.45;
    const cx = width / 2;
    const R0 = Math.min(width, height) * 0.07;
    let fired = false;
    let merged = false;
    const orb = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      rgb: string,
      t: number,
    ) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.25, `rgba(${rgb}, 0.95)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${rgb}, 0.7)`;
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(x, y, r * (1.2 + k * 0.3), t * (3 + k) + k, t * (3 + k) + k + 2.2);
        ctx.stroke();
      }
    };
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const t = f.time;
        const merge = easeOut((t - 1.1) / 0.4);
        const grow = easeOut(t / 0.5);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(6, 2, 16, ${0.75 * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        if (merge < 1) {
          const bx = width * 0.25 + (cx - width * 0.25) * merge;
          const rx = width * 0.75 - (width * 0.75 - cx) * merge;
          orb(ctx, bx, cy, R0 * grow, '70, 140, 255', t);
          orb(ctx, rx, cy, R0 * grow, '255, 60, 60', -t);
          if (f.emitting && f.particles.length < MAX_PARTICLES) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('mote', bx + Math.cos(a) * 220, cy + Math.sin(a) * 220, {
                vx: -Math.cos(a) * 6,
                vy: -Math.sin(a) * 6,
                max: 36,
                size: 2,
                color: '120, 170, 255',
              }),
            );
            f.particles.push(
              particle('mote', rx, cy, {
                vx: Math.cos(a) * 7,
                vy: Math.sin(a) * 7,
                max: 40,
                size: 2,
                color: '255, 110, 110',
              }),
            );
          }
        } else {
          if (!merged) {
            merged = true;
            screenShake(300, 8);
          }
          const fire = clamp01((t - 1.9) / 0.6);
          if (fire > 0 && !fired) {
            fired = true;
            screenShake(600, 16);
          }
          const x = cx + fire * width * 0.8;
          // Faixa apagada pelo disparo.
          if (fire > 0) {
            const band = R0 * 3;
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgba(4, 0, 10, ${0.95 * clamp01((end - t) / 0.6)})`;
            ctx.fillRect(cx, cy - band, x - cx, band * 2);
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(190, 120, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy - band);
            ctx.lineTo(x, cy - band);
            ctx.moveTo(cx, cy + band);
            ctx.lineTo(x, cy + band);
            ctx.stroke();
          }
          orb(ctx, x, cy, R0 * (2.2 + Math.sin(t * 20) * 0.1), '170, 80, 255', t);
        }
        const flash = 1 - Math.abs(t - 1.5) / 0.12;
        if (flash > 0) {
          ctx.fillStyle = `rgba(230, 200, 255, ${flash * 0.6})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      },
    };
  },
  wheel: (width, height) => {
    // A roda de oito raios surge acima do texto e gira em estalos pesados (cada um com um pulso);
    // no fim, a luz dourada da adaptação.
    const R = Math.min(width, height) * 0.2;
    const cx = width / 2;
    const cy = height * 0.3;
    const steps = [0.6, 1.1, 1.6].map((at) => ({ at, done: false }));
    const image = wheelSprite(R);
    return {
      frame(ctx, f) {
        const t = f.time;
        let angle = 0;
        for (const step of steps) {
          angle += easeOut((t - step.at) / 0.15) * (Math.PI / 4);
          if (step.done || t < step.at) continue;
          step.done = true;
          screenShake(200, 8);
          for (let k = 0; k < 16; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('spark', cx + Math.cos(a) * R, cy + Math.sin(a) * R, {
                vx: Math.cos(a) * rand(2, 6),
                vy: Math.sin(a) * rand(2, 6),
                gravity: 0.15,
                max: 40,
                size: rand(1.5, 2.5),
                color: '255, 220, 140',
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(10, 8, 4, ${0.6 * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        const glow = clamp01((t - 1.8) / 0.4);
        ctx.globalCompositeOperation = 'lighter';
        if (glow > 0) {
          blit(ctx, softSprite('255, 210, 110'), cx, cy, R * 3, 0.6 * glow);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * 0.4);
          ctx.fillStyle = `rgba(255, 220, 140, ${0.12 * glow})`;
          for (let k = 0; k < 12; k += 2) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R * 4, (k / 12) * Math.PI * 2, ((k + 1) / 12) * Math.PI * 2);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
        for (const step of steps) {
          const age = t - step.at;
          if (age <= 0 || age > 0.6) continue;
          ctx.strokeStyle = `rgba(255, 220, 140, ${(1 - age / 0.6) * 0.8})`;
          ctx.lineWidth = 6 * (1 - age / 0.6) + 1;
          ctx.beginPath();
          ctx.arc(cx, cy, R * (1.3 + age * 2.5), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        const pop = easeOut(t / 0.4);
        ctx.translate(cx, cy);
        ctx.scale(pop, pop);
        ctx.rotate(angle);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        ctx.restore();
      },
    };
  },
  capture: (width, height) => {
    // O "CRÍTICO!" aparece, a esfera vem voando, abre e o suga; cai, balança três vezes e clica:
    // capturado!
    const font = displayFont();
    const size = Math.min(width * 0.1, 130);
    const cx = width / 2;
    const cy = height * 0.4;
    const r = Math.min(width, height) * 0.07;
    const floor = height * 0.72;
    let clicked = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        // Caminho da esfera.
        let bx: number;
        let by: number;
        if (t < 0.7) {
          const u = clamp01((t - 0.3) / 0.4);
          bx = -60 + (cx + 60) * u;
          by =
            height * 0.9 - (height * 0.9 - (cy - 150)) * u - Math.sin(Math.PI * u) * height * 0.25;
        } else if (t < 1.05) {
          bx = cx;
          by = cy - 150;
        } else {
          const u = clamp01((t - 1.05) / 0.3);
          bx = cx;
          by = cy - 150 + (floor - (cy - 150)) * u * u;
          if (u >= 1)
            by =
              floor - Math.max(0, Math.sin(((t - 1.35) / 0.2) * Math.PI)) * 18 * (t < 1.55 ? 1 : 0);
        }
        const open = clamp01((t - 0.65) / 0.1) * (1 - clamp01((t - 1) / 0.08));
        let rot = 0;
        for (const at of [1.5, 2, 2.5])
          if (t > at && t < at + 0.3) rot = Math.sin(((t - at) / 0.3) * Math.PI * 2) * 0.35;
        if (!clicked && t > 2.85) {
          clicked = true;
          for (let k = 0; k < 20; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('spark', bx, by, {
                vx: Math.cos(a) * rand(2, 6),
                vy: Math.sin(a) * rand(2, 6),
                max: 40,
                size: rand(2, 3),
                color: '255, 220, 110',
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Texto: aparece e é sugado para dentro da esfera.
        const suck = clamp01((t - 0.7) / 0.3);
        if (suck < 1) {
          const pop = easeOut(t / 0.2);
          const tx = cx + (bx - cx) * suck;
          const ty = cy + (by - cy) * suck;
          ctx.save();
          ctx.translate(tx, ty);
          ctx.scale(pop * (1 - suck), pop * (1 - suck));
          canvasCritText(ctx, size, '240, 192, 64');
          ctx.restore();
        }
        if (open > 0 && suck < 1) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255, 220, 120, 0.35)';
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(cx - size * 2, cy + size * 0.6);
          ctx.lineTo(cx + size * 2, cy + size * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.translate(bx, by);
        ctx.rotate(rot + (t < 0.7 ? t * 14 : 0));
        drawCaptureBall(ctx, r, open, clicked ? 1 : 0);
        ctx.restore();
        // Depois do clique, o "CRÍTICO!" aparece carimbado em cima da esfera.
        if (clicked) {
          const stamp = easeOut((t - 2.9) / 0.2);
          ctx.save();
          ctx.globalAlpha = f.presence;
          ctx.translate(cx, floor - r * 2.4);
          ctx.scale(stamp * 0.6, stamp * 0.6);
          canvasCritText(ctx, size, '240, 192, 64');
          ctx.restore();
        }
        void font;
      },
    };
  },
  darklord: (width, height) => {
    // Escuridão e respiração mecânica; a lâmina vermelha acende e retalha a tela em golpes que
    // deixam cortes em brasa; o último corta a tela de ponta a ponta.
    const pivot = { x: width / 2, y: height * 0.8 };
    const L = Math.min(width, height) * 0.6;
    const keys: [number, number][] = [
      [1.5, -Math.PI / 2],
      [1.7, -Math.PI / 2 - 1.3],
      [1.95, -Math.PI / 2 + 1.3],
      [2.2, -Math.PI / 2 - 0.9],
      [2.45, -Math.PI / 2 + 1.5],
    ];
    const trail: { x: number; y: number; t: number }[] = [];
    let finalCut = false;
    const angleAt = (t: number) => {
      if (t <= keys[0]![0]) return keys[0]![1];
      for (let i = 1; i < keys.length; i++) {
        const [t1, a1] = keys[i]!;
        const [t0, a0] = keys[i - 1]!;
        if (t <= t1) return a0 + (a1 - a0) * easeOut((t - t0) / (t1 - t0));
      }
      return keys[keys.length - 1]![1];
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        const lit = easeOut((t - 1) / 0.15);
        const angle = angleAt(t);
        const tip = {
          x: pivot.x + Math.cos(angle) * L * lit,
          y: pivot.y + Math.sin(angle) * L * lit,
        };
        if (t > 1.5 && t < 2.5) trail.push({ ...tip, t });
        if (!finalCut && t >= 2.45) {
          finalCut = true;
          screenShake(500, 14);
          for (let k = 0; k < 30; k++)
            f.particles.push(
              particle('spark', rand(0, width), rand(0, height), {
                vx: rand(-4, 4),
                vy: rand(-4, 2),
                gravity: 0.2,
                max: 40,
                size: rand(1.5, 2.5),
                color: '255, 120, 100',
              }),
            );
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        const breath = 0.85 + Math.sin(t * 2.5) * 0.05;
        ctx.fillStyle = `rgba(2, 0, 0, ${breath * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        // Cortes em brasa deixados pela ponta da lâmina.
        ctx.lineCap = 'round';
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1]!;
          const b = trail[i]!;
          const age = t - b.t;
          const alpha = Math.max(0, 1 - age / 1.2);
          if (alpha <= 0) continue;
          ctx.strokeStyle = `rgba(255, 60, 40, ${0.5 * alpha})`;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255, 220, 200, ${alpha})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        // Corte final de ponta a ponta.
        if (finalCut) {
          const alpha = Math.max(0, 1 - (t - 2.45) / 1);
          for (const [w, style] of [
            [30, `rgba(255, 30, 30, ${0.25 * alpha})`],
            [12, `rgba(255, 60, 40, ${0.6 * alpha})`],
            [3, `rgba(255, 235, 225, ${alpha})`],
          ] as const) {
            ctx.strokeStyle = style;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(-40, height * 0.15);
            ctx.lineTo(width + 40, height * 0.75);
            ctx.stroke();
          }
        }
        // A lâmina.
        if (lit > 0) {
          const flicker = 1 + Math.random() * 0.12;
          for (const [w, style] of [
            [34 * flicker, 'rgba(255, 20, 20, 0.14)'],
            [18 * flicker, 'rgba(255, 40, 40, 0.4)'],
            [7, 'rgba(255, 225, 225, 1)'],
          ] as const) {
            ctx.strokeStyle = style;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(pivot.x + Math.cos(angle) * 20, pivot.y + Math.sin(angle) * 20);
            ctx.lineTo(tip.x, tip.y);
            ctx.stroke();
          }
          blit(
            ctx,
            softSprite('255, 30, 30'),
            (pivot.x + tip.x) / 2,
            (pivot.y + tip.y) / 2,
            L * 0.6,
            0.25,
          );
        }
        ctx.globalCompositeOperation = 'source-over';
        // Empunhadura.
        ctx.translate(pivot.x, pivot.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = '#2a2a30';
        ctx.fillRect(-9, 0, 18, 70);
        ctx.fillStyle = '#b8bcc6';
        ctx.fillRect(-11, 4, 22, 10);
        ctx.fillRect(-11, 40, 22, 6);
        ctx.restore();
      },
    };
  },
  notebook: (width, height) => {
    // Um caderno negro se abre e uma caneta escreve "CRÍTICO" à mão, letra por letra, à luz de
    // vela; ao terminar, a palavra arde em vermelho.
    const pageW = Math.min(width * 0.3, 360);
    const pageH = pageW * 1.3;
    const cx = width / 2;
    const cy = height * 0.45;
    const size = pageW * 0.26;
    const script = '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive';
    let textWidth = 0;
    return {
      frame(ctx, f) {
        const t = f.time;
        const open = easeOut(t / 0.5);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 3, 6, ${0.8 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        blit(
          ctx,
          flameSprite(1),
          cx - pageW * 1.35,
          cy + pageH * 0.3 - 30 + Math.sin(t * 13) * 2,
          22 + Math.random() * 4,
          1,
        );
        blit(
          ctx,
          softSprite('255, 170, 80'),
          cx - pageW * 1.35,
          cy + pageH * 0.2,
          pageW * 1.2,
          0.25,
        );
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#e8e2d0';
        ctx.fillRect(cx - pageW * 1.35 - 7, cy + pageH * 0.3 - 20, 14, 70);
        // Capa e páginas.
        ctx.fillStyle = '#0c0c10';
        ctx.fillRect(
          cx - pageW - 14,
          cy - pageH / 2 - 12,
          pageW + 14 + (pageW + 14) * open,
          pageH + 24,
        );
        ctx.fillStyle = '#efe9dc';
        ctx.fillRect(cx - pageW, cy - pageH / 2, pageW - 4, pageH);
        ctx.save();
        ctx.translate(cx + 4, 0);
        ctx.scale(open, 1);
        ctx.fillRect(0, cy - pageH / 2, pageW - 4, pageH);
        ctx.restore();
        ctx.strokeStyle = 'rgba(80, 90, 130, 0.25)';
        ctx.lineWidth = 1;
        for (let y = cy - pageH / 2 + 40; y < cy + pageH / 2; y += 28) {
          ctx.beginPath();
          ctx.moveTo(cx - pageW + 16, y);
          ctx.lineTo(cx - 16, y);
          if (open > 0.95) {
            ctx.moveTo(cx + 20, y);
            ctx.lineTo(cx + pageW - 16, y);
          }
          ctx.stroke();
        }
        // Escrita à mão.
        ctx.font = `italic ${size}px ${script}`;
        textWidth ||= ctx.measureText('CRÍTICO').width;
        const write = clamp01((t - 0.6) / 1.2);
        const left = cx + pageW / 2 - textWidth / 2;
        if (write > 0) {
          const burn = clamp01((t - 2) / 0.3);
          ctx.save();
          ctx.beginPath();
          ctx.rect(left - 10, cy - size, (textWidth + 20) * write, size * 2);
          ctx.clip();
          ctx.textBaseline = 'middle';
          ctx.fillStyle = burn > 0 ? `rgb(${Math.round(20 + 200 * burn)}, 10, 10)` : '#141018';
          if (burn > 0) {
            ctx.shadowColor = 'rgba(255, 40, 40, 0.9)';
            ctx.shadowBlur = 20 * burn;
          }
          ctx.fillText('CRÍTICO', left, cy);
          ctx.restore();
          if (write < 1) {
            const px = left + textWidth * write;
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(px, cy + Math.sin(t * 30) * size * 0.2);
            ctx.lineTo(px + 60, cy - 90);
            ctx.stroke();
          }
        }
        ctx.restore();
      },
    };
  },
  orbs: (width, height) => {
    // Sete esferas chegam de todos os lados e formam um círculo, brilham juntas, o céu escurece e
    // um dragão de luz sobe em espiral pela tela.
    const cx = width / 2;
    const cy = height * 0.45;
    const ring = Math.min(width, height) * 0.28;
    const r = Math.min(width, height) * 0.045;
    const orbs = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      const from = rand(0, Math.PI * 2);
      return {
        tx: cx + Math.cos(a) * ring,
        ty: cy + Math.sin(a) * ring,
        fx: cx + Math.cos(from) * Math.hypot(width, height),
        fy: cy + Math.sin(from) * Math.hypot(width, height),
        delay: i * 0.1,
      };
    });
    const trail: Point[] = [];
    return {
      frame(ctx, f) {
        const t = f.time;
        const dark = clamp01((t - 1) / 0.4);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 6, 14, ${0.4 + dark * 0.45})`;
        ctx.fillRect(0, 0, width, height);
        const pulse = t > 1 ? 0.6 + 0.4 * Math.sin(t * 6) : 0;
        orbs.forEach((o, i) => {
          const u = easeOut((t - o.delay) / 0.6);
          if (u <= 0) return;
          const x = o.fx + (o.tx - o.fx) * u;
          const y = o.fy + (o.ty - o.fy) * u;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, softSprite('255, 170, 40'), x, y, r * 3, 0.4 + pulse * 0.5);
          ctx.restore();
          ctx.save();
          ctx.translate(x, y);
          drawOrb(ctx, r, i + 1, 0);
          ctx.restore();
        });
        // O dragão de luz.
        if (t > 1.4) {
          const u = (t - 1.4) / 1.6;
          const head = {
            x: cx + Math.sin(u * 7) * width * 0.32,
            y: height * 1.05 - u * height * 1.25,
          };
          trail.push(head);
          if (trail.length > 120) trail.shift();
          ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < trail.length; k += 2) {
            const p = trail[k]!;
            const along = k / trail.length;
            const rad = 6 + along * 22;
            ctx.fillStyle = `rgba(${Math.round(120 + along * 135)}, 220, 120, ${0.25 + along * 0.5})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
            ctx.fill();
            if (k % 8 === 0) blit(ctx, softSprite('160, 255, 160'), p.x, p.y, rad * 2.5, 0.35);
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#3c8a3c';
          ctx.beginPath();
          ctx.ellipse(head.x, head.y, 34, 26, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#e8d8a0';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(head.x + side * 14, head.y - 18);
            ctx.quadraticCurveTo(head.x + side * 34, head.y - 50, head.x + side * 22, head.y - 64);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(head.x + side * 20, head.y + 10);
            ctx.quadraticCurveTo(
              head.x + side * 60,
              head.y + 20,
              head.x + side * 80,
              head.y + Math.sin(t * 6) * 10,
            );
            ctx.stroke();
          }
          ctx.globalCompositeOperation = 'lighter';
          for (const side of [-1, 1])
            blit(ctx, glowSprite('255, 40, 40'), head.x + side * 12, head.y - 4, 7, 1);
        }
        ctx.restore();
      },
    };
  },
  haki: (width, height) => {
    // Haki do Rei: a cada batida, uma onda de pressão sai do centro, a tela escurece, a página
    // perde a cor por um instante (todo mundo "desmaia") e raios pretos rasgam a tela inteira.
    const cx = width / 2;
    const cy = height * 0.45;
    const beats = [0, 0.55, 1.1, 1.65].map((at) => ({ at, done: false }));
    const reach = Math.hypot(width, height);
    return {
      frame(ctx, f) {
        for (const beat of beats) {
          if (beat.done || f.time < beat.at) continue;
          beat.done = true;
          screenShake(260, 12);
          pageJolt('grayscale(1) brightness(0.6) contrast(1.4)', 140);
          for (let k = 0; k < 7; k++) {
            const a = rand(0, Math.PI * 2);
            const from = { x: cx + Math.cos(a) * 30, y: cy + Math.sin(a) * 30 };
            const to = {
              x: cx + Math.cos(a) * reach * rand(0.4, 0.7),
              y: cy + Math.sin(a) * reach * rand(0.4, 0.7),
            };
            f.particles.push(
              particle('bolt', 0, 0, {
                path: bolt(from, to, 40, 14),
                max: rand(10, 18),
                size: rand(2.5, 4),
                color: 'haki',
              }),
            );
          }
          for (let k = 0; k < 16; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('smoke', cx + Math.cos(a) * 60, cy + Math.sin(a) * 60, {
                vx: Math.cos(a) * rand(6, 12),
                vy: Math.sin(a) * rand(6, 12),
                drag: 0.95,
                max: 60,
                size: rand(30, 60),
                color: '40, 0, 10',
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Escurece a cada batida.
        const lastBeat = Math.max(...beats.filter((b) => f.time >= b.at).map((b) => b.at), -1);
        const dark = lastBeat >= 0 ? Math.max(0, 1 - (f.time - lastBeat) / 0.4) : 0;
        ctx.fillStyle = `rgba(10, 0, 4, ${0.35 + dark * 0.4})`;
        ctx.fillRect(0, 0, width, height);
        // Ondas de pressão.
        for (const beat of beats) {
          const age = f.time - beat.at;
          if (age <= 0 || age > 1) continue;
          const r = age * reach * 0.8;
          ctx.strokeStyle = `rgba(10, 0, 4, ${(1 - age) * 0.85})`;
          ctx.lineWidth = 22 * (1 - age) + 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255, 30, 50, ${(1 - age) * 0.7})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Raios contínuos estalando perto do centro.
        if (f.emitting && Math.random() < 0.5) {
          const a = rand(0, Math.PI * 2);
          f.particles.push(
            particle('bolt', 0, 0, {
              path: bolt(
                { x: cx, y: cy },
                { x: cx + Math.cos(a) * rand(120, 300), y: cy + Math.sin(a) * rand(120, 300) },
                20,
                8,
              ),
              max: rand(5, 9),
              size: rand(1.8, 3),
              color: 'haki',
            }),
          );
        }
        ctx.globalCompositeOperation = 'lighter';
        blit(
          ctx,
          softSprite('255, 20, 40'),
          cx,
          cy,
          Math.min(width, height) * 0.35,
          (0.25 + dark * 0.3) * f.presence,
        );
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
  gears: (width, height, durationMs) => {
    // Uma máquina se monta em volta do texto: engrenagens chegam voando de todos os lados e
    // engatam na engrenagem central; o manômetro sobe até o vermelho, os pistões bombeiam e, quando
    // a pressão estoura, apita o apito a vapor, jatos de vapor saem e tudo dispara a girar.
    const cx = width / 2;
    const cy = height / 2;
    const big = Math.min(width, height) * 0.2;
    const small = big * 0.46;
    const distance = (big + small) * 0.9;
    const planets = Array.from({ length: 6 }, (_, i) => ({
      angle: (i / 6) * Math.PI * 2 + Math.PI / 6,
      delay: 0.35 + i * 0.12,
      steel: i % 2 === 1,
    }));
    const outer = big * 0.32;
    const outerDistance = distance + (small + outer) * 0.9;
    const outers = planets
      .filter((_, i) => i % 2 === 0)
      .map((p, i) => ({ angle: p.angle, delay: 0.9 + i * 0.1 }));
    let spin = 0;
    let lastTime = 0;
    let blown = false;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const dt = Math.max(0, f.time - lastTime);
        lastTime = f.time;
        // Gira devagar enquanto monta, acelera quando a pressão estoura.
        const speed = f.time < 1.5 ? 0.6 : 0.6 + (f.time - 1.5) * 5;
        spin += speed * dt;
        const pressure = clamp01(f.time / 1.5);
        if (!blown && f.time >= 1.5) {
          blown = true;
          screenShake(300, 6);
          for (const side of [-1, 1])
            for (let k = 0; k < 14; k++)
              f.particles.push(
                particle('wisp', side < 0 ? 40 : width - 40, cy + rand(-30, 30), {
                  vx: -side * rand(6, 12),
                  vy: rand(-1.5, 1.5),
                  drag: 0.96,
                  max: rand(50, 80),
                  size: rand(40, 80),
                  color: '235, 235, 240',
                }),
              );
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Pistões nas laterais.
        const pump = Math.sin(f.time * (f.time < 1.5 ? 8 : 22));
        for (const side of [-1, 1]) {
          const x = side < 0 ? 0 : width;
          ctx.fillStyle = '#5e3c12';
          ctx.fillRect(side < 0 ? x : x - 90, cy - 40, 90, 80);
          ctx.fillStyle = '#c8ccd6';
          const rod = 60 + pump * 30;
          ctx.fillRect(side < 0 ? x + 90 : x - 90 - rod, cy - 10, rod, 20);
          ctx.fillStyle = '#b07a2a';
          ctx.fillRect(side < 0 ? x + 90 + rod - 12 : x - 90 - rod, cy - 22, 12, 44);
        }
        // Engrenagem central (atrás do texto).
        const center = gearSprite(big, false);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(spin);
        ctx.drawImage(center, -center.width / 2, -center.height / 2);
        ctx.restore();
        // Engrenagens chegando e engatando.
        for (const p of planets) {
          const arrive = easeOut((f.time - p.delay) / 0.4);
          if (arrive <= 0) continue;
          const d = distance + (1 - arrive) * Math.max(width, height);
          const image = gearSprite(small, p.steel);
          ctx.save();
          ctx.translate(cx + Math.cos(p.angle) * d, cy + Math.sin(p.angle) * d);
          ctx.rotate(-spin * (big / small) + (1 - arrive) * 6);
          ctx.drawImage(image, -image.width / 2, -image.height / 2);
          ctx.restore();
          if (arrive >= 1 && f.emitting && Math.random() < 0.15) {
            const mx = cx + Math.cos(p.angle) * big;
            const my = cy + Math.sin(p.angle) * big;
            f.particles.push(
              particle('spark', mx, my, {
                vx: rand(-3, 3),
                vy: rand(-4, 0),
                gravity: 0.25,
                max: 30,
                size: rand(1, 2),
                color: '255, 190, 80',
              }),
            );
          }
        }
        for (const o of outers) {
          const arrive = easeOut((f.time - o.delay) / 0.4);
          if (arrive <= 0) continue;
          const d = outerDistance + (1 - arrive) * Math.max(width, height);
          const image = gearSprite(outer, true);
          ctx.save();
          ctx.translate(cx + Math.cos(o.angle) * d, cy + Math.sin(o.angle) * d);
          ctx.rotate(spin * (big / outer));
          ctx.drawImage(image, -image.width / 2, -image.height / 2);
          ctx.restore();
        }
        // Manômetro no alto: o ponteiro sobe até o vermelho e treme.
        const gx = cx;
        const gy = Math.max(70, cy - distance - small - 50);
        const gr = 46;
        ctx.fillStyle = '#efe4c8';
        ctx.strokeStyle = '#7a5418';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(gx, gy, gr - 10, -Math.PI * 0.05, Math.PI * 0.25);
        ctx.stroke();
        const needle =
          -Math.PI * 1.15 + pressure * Math.PI * 1.35 + (pressure >= 1 ? rand(-0.08, 0.08) : 0);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.cos(needle) * (gr - 8), gy + Math.sin(needle) * (gr - 8));
        ctx.stroke();
        ctx.restore();
        if (f.time > 1.5 && f.time < end - 0.8 && Math.random() < 0.3)
          f.particles.push(
            particle('wisp', gx + rand(-10, 10), gy - gr, {
              vy: -rand(2, 4),
              vx: rand(-1, 1),
              max: 50,
              size: rand(20, 40),
              color: '235, 235, 240',
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
    // Cordas de alaúde gigantes atravessam a tela vibrando cada vez mais forte; no auge, estouram
    // uma a uma, chicoteando, com uma explosão de notas e faíscas.
    const strings = Array.from({ length: 6 }, (_, i) => ({
      y: height * (0.22 + i * 0.1),
      snapAt: 1.6 + i * 0.12,
      done: false,
      width: 1.5 + i * 0.6,
    }));
    const glyphs = ['♪', '♫', '♬', '♩'];
    const noteColors = ['255, 210, 120', '255, 150, 200', '150, 220, 255'];
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        // Ponte e cravelhas (as pontas onde as cordas se prendem).
        ctx.fillStyle = '#3a2412';
        ctx.fillRect(width * 0.04 - 10, height * 0.18, 20, height * 0.56);
        ctx.fillRect(width * 0.96 - 10, height * 0.18, 20, height * 0.56);
        const intensity = clamp01(f.time / 1.5);
        ctx.lineCap = 'round';
        for (const [i, str] of strings.entries()) {
          const x1 = width * 0.04;
          const x2 = width * 0.96;
          const amp = 4 + intensity * intensity * 26;
          if (f.time < str.snapAt) {
            // Corda inteira vibrando (onda estacionária) e brilhando mais com a intensidade.
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(255, 210, 120, ${0.2 + intensity * 0.35})`;
            ctx.lineWidth = str.width * 4;
            const path = () => {
              ctx.beginPath();
              for (let k = 0; k <= 40; k++) {
                const u = k / 40;
                const y = str.y + Math.sin(u * Math.PI) * Math.sin(f.time * (40 + i * 6)) * amp;
                if (k) ctx.lineTo(x1 + (x2 - x1) * u, y);
                else ctx.moveTo(x1, y);
              }
            };
            path();
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = '#f3e2b0';
            ctx.lineWidth = str.width;
            path();
            ctx.stroke();
            if (f.emitting && Math.random() < 0.05 + intensity * 0.15)
              f.particles.push(
                particle('rune', rand(x1, x2), str.y, {
                  vy: -rand(1, 3),
                  vx: rand(-1, 1),
                  max: 80,
                  size: rand(20, 32),
                  glyph: pick(glyphs),
                  color: pick(noteColors),
                }),
              );
          } else {
            if (!str.done) {
              str.done = true;
              screenShake(140, 6);
              const mid = { x: width / 2 + rand(-width * 0.15, width * 0.15), y: str.y };
              for (let k = 0; k < 14; k++) {
                const a = rand(0, Math.PI * 2);
                f.particles.push(
                  particle('spark', mid.x, mid.y, {
                    vx: Math.cos(a) * rand(3, 8),
                    vy: Math.sin(a) * rand(3, 8),
                    gravity: 0.15,
                    max: 40,
                    size: rand(1.5, 2.5),
                    color: '255, 220, 140',
                  }),
                );
              }
              for (let k = 0; k < 6; k++)
                f.particles.push(
                  particle('rune', mid.x, mid.y, {
                    vx: rand(-6, 6),
                    vy: rand(-7, -2),
                    gravity: 0.2,
                    max: 90,
                    size: rand(26, 40),
                    glyph: pick(glyphs),
                    color: pick(noteColors),
                  }),
                );
            }
            // As duas metades chicoteiam e enrolam em direção às pontas.
            const age = f.time - str.snapAt;
            const curl = clamp01(age / 0.4);
            ctx.strokeStyle = '#f3e2b0';
            ctx.lineWidth = str.width;
            for (const side of [-1, 1]) {
              const anchor = side < 0 ? x1 : x2;
              const length = ((x2 - x1) / 2) * (1 - curl * 0.7);
              ctx.beginPath();
              ctx.moveTo(anchor, str.y);
              for (let k = 1; k <= 20; k++) {
                const u = k / 20;
                const bend = u * u * curl * 2.4;
                const x = anchor - side * Math.cos(bend) * length * u;
                const y = str.y + Math.sin(bend) * length * u * 0.5 * (i % 2 ? 1 : -1);
                ctx.lineTo(x, y);
              }
              ctx.stroke();
            }
          }
        }
        // Clarão dourado quando a última corda estoura.
        const last = strings[strings.length - 1]!;
        const flash = 1 - Math.abs(f.time - last.snapAt) / 0.15;
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 230, 170, ${flash * 0.5})`;
          ctx.fillRect(0, 0, width, height);
        }
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
  sakura: (width, height) => {
    // Um galho cresce pelo canto, as flores abrem e uma ventania de pétalas atravessa a tela.
    const branch = bolt({ x: -20, y: height * 0.15 }, { x: width * 0.55, y: height * 0.3 }, 40, 12);
    const blossoms = branch.slice(2).map((p, i) => ({ ...p, at: 0.4 + i * 0.08, r: rand(10, 18) }));
    const petals = Array.from({ length: 140 }, () => ({
      x: rand(-width * 0.5, width),
      y: rand(-height * 0.2, height),
      v: rand(3, 7),
      s: rand(5, 10),
      spin: rand(0, 6),
    }));
    const petal = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#ffc4da';
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s);
      ctx.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s);
      ctx.fill();
      ctx.restore();
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, `rgba(255, 210, 225, ${0.55 * clamp01(t / 0.4)})`);
        sky.addColorStop(1, `rgba(120, 60, 110, ${0.6 * clamp01(t / 0.4)})`);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        // Lua cheia rosada.
        ctx.globalCompositeOperation = 'lighter';
        blit(ctx, softSprite('255, 220, 235'), width * 0.78, height * 0.22, 120, 0.7);
        ctx.globalCompositeOperation = 'source-over';
        // Galho crescendo.
        const grown = clamp01(t / 0.8) * (branch.length - 1);
        ctx.strokeStyle = '#3a2228';
        ctx.lineCap = 'round';
        for (let i = 0; i < Math.floor(grown); i++) {
          ctx.lineWidth = 14 - i * 0.9;
          ctx.beginPath();
          ctx.moveTo(branch[i]!.x, branch[i]!.y);
          ctx.lineTo(branch[i + 1]!.x, branch[i + 1]!.y);
          ctx.stroke();
        }
        for (const b of blossoms) {
          const open = easeOut((t - b.at) / 0.3);
          if (open <= 0) continue;
          for (let k = 0; k < 5; k++)
            petal(
              ctx,
              b.x + Math.cos((k / 5) * 6.28) * b.r * 0.5 * open,
              b.y + Math.sin((k / 5) * 6.28) * b.r * 0.5 * open,
              b.r * 0.6 * open,
              (k / 5) * 6.28 + Math.PI / 2,
            );
          ctx.fillStyle = '#ffef9a';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r * 0.18 * open, 0, Math.PI * 2);
          ctx.fill();
        }
        // Ventania de pétalas.
        const gust = clamp01((t - 0.9) / 0.5);
        if (gust > 0)
          for (const p of petals) {
            p.x += p.v * gust * 1.6;
            p.y += Math.sin(t * 3 + p.spin) * 1.2 + 0.8;
            if (p.x > width + 20) p.x = -20;
            if (p.y > height + 20) p.y = -20;
            petal(ctx, p.x, p.y, p.s, t * 4 + p.spin);
          }
        ctx.restore();
      },
    };
  },
  phoenix: (width, height) => {
    // Cinzas no chão; uma brasa acende, vira chama e a fênix ergue as asas de fogo, subindo.
    const cx = width / 2;
    const ground = height * 0.85;
    let burst = false;
    const wing = (ctx: CanvasRenderingContext2D, side: number, open: number, flap: number) => {
      ctx.save();
      ctx.scale(side, 1);
      for (let k = 0; k < 7; k++) {
        const a = -0.2 - k * 0.18 * open + flap * 0.3;
        const len = (180 + k * 22) * open;
        const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        g.addColorStop(0, 'rgba(255, 240, 160, 0.95)');
        g.addColorStop(0.5, 'rgba(255, 120, 30, 0.85)');
        g.addColorStop(1, 'rgba(200, 20, 10, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a - 0.2) * len * 0.6,
          Math.sin(a - 0.2) * len * 0.6,
          Math.cos(a) * len,
          Math.sin(a) * len,
        );
        ctx.quadraticCurveTo(Math.cos(a + 0.15) * len * 0.5, Math.sin(a + 0.15) * len * 0.5, 0, 12);
        ctx.fill();
      }
      ctx.restore();
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        const rise = easeOut((t - 0.9) / 1.6);
        if (!burst && t > 0.9) {
          burst = true;
          screenShake(400, 10);
          for (let k = 0; k < 60; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('ember', cx, ground - 20, {
                vx: Math.cos(a) * rand(2, 9),
                vy: Math.sin(a) * rand(2, 9) - 3,
                max: 70,
                size: rand(1.5, 3),
                color: '255, 170, 60',
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(20, 4, 2, ${0.7 * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        // Monte de cinzas com a brasa.
        ctx.fillStyle = '#2c2522';
        ctx.beginPath();
        ctx.ellipse(cx, ground, 160, 40, 0, Math.PI, 0);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const ember = t < 0.9 ? clamp01(t / 0.8) : 1 - rise * 0.6;
        blit(ctx, softSprite('255, 120, 30'), cx, ground - 20, 40 + ember * 80, ember);
        if (t > 0.9) {
          const y = ground - 80 - rise * height * 0.4;
          const flap = Math.sin(t * 7);
          blit(ctx, softSprite('255, 150, 40'), cx, y, 260, 0.5);
          ctx.save();
          ctx.translate(cx, y);
          wing(ctx, 1, rise, flap);
          wing(ctx, -1, rise, flap);
          // Corpo e cabeça.
          ctx.fillStyle = 'rgba(255, 220, 120, 0.95)';
          ctx.beginPath();
          ctx.ellipse(0, 10, 22, 50, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, -48, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 250, 220, 1)';
          ctx.beginPath();
          ctx.moveTo(10, -50);
          ctx.lineTo(30, -44);
          ctx.lineTo(10, -40);
          ctx.fill();
          // Cauda de fogo.
          for (let k = 0; k < 3; k++) {
            ctx.strokeStyle = `rgba(255, ${140 - k * 40}, 40, 0.7)`;
            ctx.lineWidth = 10 - k * 2;
            ctx.beginPath();
            ctx.moveTo(0, 55);
            ctx.quadraticCurveTo((k - 1) * 60 + flap * 20, 140, (k - 1) * 40, 220 * rise);
            ctx.stroke();
          }
          ctx.restore();
          if (f.emitting && f.particles.length < MAX_PARTICLES)
            f.particles.push(
              particle('flame', cx + rand(-40, 40), y + 60, {
                vy: rand(1, 3),
                max: 40,
                size: rand(8, 16),
                color: '255, 140, 40',
              }),
            );
        }
        ctx.restore();
      },
    };
  },
  kitsune: (width, height) => {
    // Fogos-fátuos azuis acendem um a um; atrás deles, a sombra de uma raposa com nove caudas
    // abre as caudas em leque e os olhos brilham.
    const cx = width / 2;
    const cy = height * 0.52;
    const lights = Array.from({ length: 9 }, (_, i) => ({
      a: -Math.PI + (i / 8) * Math.PI,
      at: 0.2 + i * 0.1,
    }));
    return {
      frame(ctx, f) {
        const t = f.time;
        const fan = easeOut((t - 1) / 0.8);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 6, 24, ${0.8 * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        const R = Math.min(width, height) * 0.38;
        // Caudas.
        if (fan > 0)
          for (let k = 0; k < 9; k++) {
            const a = -Math.PI / 2 + (k - 4) * 0.28 * fan + Math.sin(t * 2 + k) * 0.05;
            const tipX = cx + Math.cos(a) * R;
            const tipY = cy + Math.sin(a) * R;
            const g = ctx.createLinearGradient(cx, cy, tipX, tipY);
            g.addColorStop(0, '#1a1a3a');
            g.addColorStop(0.85, '#2a2a5a');
            g.addColorStop(1, '#bfe6ff');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(cx - 14, cy);
            ctx.quadraticCurveTo(
              cx + Math.cos(a - 0.3) * R * 0.6,
              cy + Math.sin(a - 0.3) * R * 0.6,
              tipX,
              tipY,
            );
            ctx.quadraticCurveTo(
              cx + Math.cos(a + 0.3) * R * 0.6,
              cy + Math.sin(a + 0.3) * R * 0.6,
              cx + 14,
              cy,
            );
            ctx.closePath();
            ctx.fill();
          }
        // Corpo e cabeça (silhueta).
        ctx.fillStyle = '#0e0e24';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 40, 60, 80, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 45, cy - 40);
        ctx.lineTo(cx - 50, cy - 110);
        ctx.lineTo(cx - 15, cy - 70);
        ctx.lineTo(cx + 15, cy - 70);
        ctx.lineTo(cx + 50, cy - 110);
        ctx.lineTo(cx + 45, cy - 40);
        ctx.lineTo(cx, cy + 5);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const eyes = clamp01((t - 1.4) / 0.3);
        for (const side of [-1, 1])
          blit(ctx, glowSprite('120, 220, 255'), cx + side * 18, cy - 40, 12, eyes);
        // Fogos-fátuos em arco.
        for (const l of lights) {
          const on = clamp01((t - l.at) / 0.2);
          if (on <= 0) continue;
          const x = cx + Math.cos(l.a) * R * 1.1;
          const y = cy + 60 + Math.sin(l.a) * R * 0.9 + Math.sin(t * 3 + l.a * 4) * 8;
          blit(ctx, softSprite('80, 170, 255'), x, y, 40, on * 0.8);
          blit(ctx, glowSprite('200, 240, 255'), x, y, 12, on);
        }
        ctx.restore();
      },
    };
  },
  mirror: (width, height) => {
    // Um estalo: rachaduras correm a partir do centro, a tela vira um espelho partido e os cacos
    // caem, cada um refletindo um brilho.
    const cx = width / 2;
    const cy = height * 0.45;
    const cracks = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + rand(-0.1, 0.1);
      return bolt(
        { x: cx, y: cy },
        { x: cx + Math.cos(a) * width, y: cy + Math.sin(a) * width },
        30,
        9,
      );
    });
    const shards = Array.from({ length: 24 }, () => {
      const a = rand(0, Math.PI * 2);
      const d = rand(40, Math.min(width, height) * 0.45);
      return {
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d,
        vx: rand(-2, 2),
        vy: rand(-2, 1),
        r: rand(14, 34),
        rot: rand(0, 6),
        vr: rand(-0.1, 0.1),
      };
    });
    let snapped = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        if (!snapped && t > 0.35) {
          snapped = true;
          screenShake(250, 9);
        }
        const run = clamp01((t - 0.35) / 0.35);
        const fall = Math.max(0, t - 1.3);
        ctx.save();
        ctx.globalAlpha = f.presence;
        const glass = ctx.createLinearGradient(0, 0, width, height);
        glass.addColorStop(0, 'rgba(180, 210, 230, 0.35)');
        glass.addColorStop(0.5, 'rgba(240, 250, 255, 0.15)');
        glass.addColorStop(1, 'rgba(120, 150, 180, 0.35)');
        ctx.fillStyle = glass;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2;
        for (const c of cracks) {
          const n = Math.max(1, Math.floor(c.length * run));
          ctx.beginPath();
          ctx.moveTo(c[0]!.x, c[0]!.y);
          for (let i = 1; i < n; i++) ctx.lineTo(c[i]!.x, c[i]!.y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, 30 * run, 0, Math.PI * 2);
        ctx.stroke();
        if (fall > 0)
          for (const s of shards) {
            s.vy += 0.35;
            s.x += s.vx;
            s.y += s.vy;
            s.rot += s.vr;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot);
            ctx.fillStyle = 'rgba(200, 225, 245, 0.55)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.moveTo(0, -s.r);
            ctx.lineTo(s.r * 0.7, s.r * 0.4);
            ctx.lineTo(-s.r * 0.6, s.r * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            blit(
              ctx,
              glowSprite('255, 255, 255'),
              s.r * 0.1,
              -s.r * 0.3,
              6,
              0.5 + 0.5 * Math.sin(t * 9 + s.rot),
            );
            ctx.restore();
          }
        ctx.restore();
      },
    };
  },
  aurora: (width, height) => {
    // Noite polar: estrelas, montanhas nevadas e cortinas verdes e roxas ondulando no céu.
    const stars = Array.from({ length: 90 }, () => ({
      x: rand(0, width),
      y: rand(0, height * 0.6),
      r: rand(0.5, 1.6),
    }));
    const curtains = [
      { y: 0.18, rgb: '80, 255, 160', speed: 1.1 },
      { y: 0.28, rgb: '120, 200, 255', speed: 0.8 },
      { y: 0.36, rgb: '200, 110, 255', speed: 1.4 },
    ];
    return {
      frame(ctx, f) {
        const t = f.time;
        const on = clamp01((t - 0.3) / 0.8);
        ctx.save();
        ctx.globalAlpha = f.presence;
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, `rgba(2, 6, 20, ${0.85 * clamp01(t / 0.4)})`);
        sky.addColorStop(1, `rgba(10, 30, 50, ${0.85 * clamp01(t / 0.4)})`);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        for (const s of stars) {
          ctx.globalAlpha = f.presence * (0.5 + 0.5 * Math.sin(t * 3 + s.x));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = f.presence;
        ctx.globalCompositeOperation = 'lighter';
        for (const c of curtains) {
          for (let x = 0; x < width; x += 6) {
            const wave =
              Math.sin(x * 0.006 + t * c.speed) * 40 + Math.sin(x * 0.017 - t * c.speed * 1.7) * 18;
            const top = height * c.y + wave;
            const len = 120 + Math.sin(x * 0.01 + t * 2) * 50;
            const g = ctx.createLinearGradient(0, top, 0, top + len);
            g.addColorStop(0, `rgba(${c.rgb}, 0)`);
            g.addColorStop(0.3, `rgba(${c.rgb}, ${0.22 * on})`);
            g.addColorStop(1, `rgba(${c.rgb}, 0)`);
            ctx.fillStyle = g;
            ctx.fillRect(x, top, 7, len);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // Montanhas nevadas.
        ctx.fillStyle = '#0a1420';
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let k = 0; k <= 8; k++)
          ctx.lineTo((k / 8) * width, height * (0.78 + ((k * 37) % 7) * 0.025));
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      },
    };
  },
  zombie: (width, height) => {
    // O chão racha e mãos podres saem da terra, uma após a outra, se debatendo; névoa verde.
    const ground = height * 0.88;
    const hands = Array.from({ length: 9 }, (_, i) => ({
      x: width * (0.08 + i * 0.105) + rand(-20, 20),
      at: 0.3 + rand(0, 1.2),
      s: rand(0.8, 1.3),
      phase: rand(0, 6),
    }));
    const hand = (ctx: CanvasRenderingContext2D, up: number, wave: number) => {
      ctx.fillStyle = '#6f8a5a';
      ctx.strokeStyle = '#2a3520';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-14, -up, 28, up);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(0, -up);
      ctx.rotate(wave * 0.3);
      ctx.beginPath();
      ctx.ellipse(0, -14, 20, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        ctx.save();
        ctx.translate(-14 + k * 9.5, -26);
        ctx.rotate((k - 1.5) * 0.15 + Math.sin(wave * 3 + k) * 0.2);
        ctx.beginPath();
        ctx.rect(-3.5, -24, 7, 26);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(8, 14, 6, ${0.75 * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        blit(ctx, softSprite('140, 220, 120'), width * 0.8, height * 0.2, 90, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        for (const h of hands) {
          const up = easeOut((t - h.at) / 0.5) * 110 * h.s;
          if (up <= 0) continue;
          ctx.save();
          ctx.translate(h.x, ground);
          ctx.scale(h.s, h.s);
          hand(ctx, up / h.s, Math.sin(t * 5 + h.phase));
          ctx.restore();
          if (f.emitting && Math.random() < 0.1)
            f.particles.push(
              particle('rock', h.x, ground, {
                vx: rand(-3, 3),
                vy: -rand(2, 5),
                gravity: 0.3,
                max: 40,
                size: rand(3, 6),
                color: '70, 50, 30',
              }),
            );
        }
        // Terra e lápides.
        ctx.fillStyle = '#1a1208';
        ctx.fillRect(0, ground, width, height - ground);
        ctx.fillStyle = '#3a3a40';
        for (let k = 0; k < 4; k++) {
          const x = width * (0.15 + k * 0.24);
          ctx.beginPath();
          ctx.moveTo(x - 24, ground);
          ctx.lineTo(x - 24, ground - 40);
          ctx.arc(x, ground - 40, 24, Math.PI, 0);
          ctx.lineTo(x + 24, ground);
          ctx.fill();
        }
        if (f.emitting && f.particles.length < MAX_PARTICLES && Math.random() < 0.35)
          f.particles.push(
            particle('smoke', rand(0, width), ground, {
              vy: -rand(0.3, 0.8),
              vx: rand(-0.5, 0.5),
              max: 90,
              size: rand(30, 60),
              color: '90, 160, 80',
            }),
          );
        ctx.restore();
      },
    };
  },
  sungod: (width, height) => {
    // Desenho animado em preto e branco: o sol gigante gargalha, nuvens de borracha quicam, um
    // braço de borracha estica pela tela inteira e soca (POW!) e o "CRÍTICO!" pula como borracha.
    const font = displayFont();
    const size = Math.min(width * 0.12, 150);
    const cx = width / 2;
    const cy = height * 0.58;
    const clouds = Array.from({ length: 6 }, () => ({
      x: rand(0, width),
      y: rand(height * 0.35, height * 0.95),
      s: rand(36, 70),
      v: rand(0.5, 1.2),
      phase: rand(0, 6),
    }));
    let pow = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(250, 246, 235, ${0.92 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        const sx = width * 0.78;
        const sy = height * 0.2;
        const R = Math.min(width, height) * 0.15 * (1 + 0.06 * Math.sin(t * 9));
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.5);
        ctx.fillStyle = 'rgba(20, 20, 20, 0.07)';
        for (let k = 0; k < 16; k += 2) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(
            0,
            0,
            Math.hypot(width, height),
            (k / 16) * Math.PI * 2,
            ((k + 1) / 16) * Math.PI * 2,
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        const laugh = t > 1.65 ? Math.abs(Math.sin(t * 20)) : 0;
        ctx.save();
        ctx.translate(sx + (laugh ? rand(-2, 2) : 0), sy);
        ctx.fillStyle = '#fffdf5';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(side * R * 0.35, -R * 0.15, R * 0.14, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        }
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(0, R * 0.25, R * 0.45, R * (0.22 + laugh * 0.12), 0, 0, Math.PI);
        ctx.fill();
        ctx.restore();
        for (const c of clouds) {
          c.x = (c.x + c.v + width + 200) % (width + 200);
          const y = c.y - Math.abs(Math.sin(t * 4 + c.phase)) * 20;
          drawCloud(ctx, c.x - 100, y, c.s + 4, '#111');
          drawCloud(ctx, c.x - 100, y, c.s, '#fffdf5');
        }
        // Braço de borracha esticando e o soco.
        const stretch = t < 1.2 ? easeOut((t - 0.8) / 0.4) : 1 - easeOut((t - 1.45) / 0.3);
        if (stretch > 0) {
          const fx = -40 + (width * 0.62 + 40) * stretch;
          const fy = height * 0.36 + Math.sin(stretch * Math.PI) * -40;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 46;
          ctx.beginPath();
          ctx.moveTo(-60, height * 0.5);
          ctx.quadraticCurveTo(fx * 0.5, fy - 60, fx, fy);
          ctx.stroke();
          ctx.strokeStyle = '#fffdf5';
          ctx.lineWidth = 36;
          ctx.stroke();
          ctx.fillStyle = '#fffdf5';
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(fx, fy, 62, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(fx + 34, fy - 36 + k * 24, 13, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
          }
          if (!pow && stretch >= 1) {
            pow = true;
            screenShake(300, 12);
          }
        }
        if (pow && t < 1.9) {
          const px = width * 0.62 + 70;
          const py = height * 0.34;
          const k = easeOut((t - 1.2) / 0.15);
          ctx.fillStyle = '#ffe14a';
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 6;
          ctx.beginPath();
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            const r = (i % 2 ? 60 : 120) * k;
            ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#111';
          ctx.font = `bold ${46 * k}px ${font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('POW!', px, py);
        }
        // "CRÍTICO!" de borracha.
        const pop = easeOut(t / 0.25);
        const squash = 1 + Math.sin(t * 12) * 0.2 * Math.max(0, 1 - t / 2.6);
        ctx.translate(cx, cy - Math.abs(Math.sin(t * 6)) * 40 * Math.max(0, 1 - t / 2.6));
        ctx.scale(pop / squash, pop * squash);
        ctx.font = `${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111';
        ctx.fillStyle = '#fff';
        ctx.strokeText('CRÍTICO!', 0, 0);
        ctx.fillText('CRÍTICO!', 0, 0);
        ctx.restore();
      },
    };
  },
  tarrasque: (width, height) => {
    // A terra treme, uma fenda de lava se abre e um dorso de espinhos do tamanho de uma
    // cordilheira rompe o chão; os chifres e o olho aparecem e o urro sacode tudo.
    const ground = height * 0.8;
    const H = height * 0.5;
    const spikes = Array.from({ length: 16 }, (_, i) => {
      const u = i / 15;
      return {
        x: width * (0.22 + u * 0.7),
        h: H * Math.sin(Math.PI * (0.1 + u * 0.85)) ** 0.8 * rand(0.75, 1.1),
        lean: rand(-12, 12),
        delay: 0.6 + u * 0.5,
        burst: false,
      };
    });
    const crack = bolt({ x: -20, y: ground + 24 }, { x: width + 20, y: ground + 18 }, 26, 18);
    const quakes = [0.1, 0.4, 0.7].map((at) => ({ at, done: false }));
    let roared = false;
    return {
      frame(ctx, f) {
        for (const q of quakes) {
          if (q.done || f.time < q.at) continue;
          q.done = true;
          screenShake(260, 10);
        }
        if (!roared && f.time >= 1.6) {
          roared = true;
          screenShake(900, 20);
          for (let k = 0; k < 30; k++) {
            const a = -rand(0.2, Math.PI - 0.2);
            f.particles.push(
              particle(k % 2 ? 'rock' : 'smoke', width * 0.14, ground - H * 0.3, {
                vx: Math.cos(a) * rand(4, 12),
                vy: Math.sin(a) * rand(4, 12),
                gravity: 0.25,
                vr: 0.2,
                max: 90,
                size: k % 2 ? rand(4, 10) : rand(30, 60),
                color: '120, 90, 60',
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(20, 8, 2, ${0.72 * clamp01(f.time / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#2b1d14';
        const body = easeOut((f.time - 0.6) / 1);
        ctx.beginPath();
        ctx.ellipse(width * 0.57, ground, width * 0.4, H * 0.38 * body, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#7a5434';
        ctx.lineWidth = 3;
        for (const sp of spikes) {
          const rise = easeOut((f.time - sp.delay) / 0.35);
          if (rise <= 0) continue;
          if (!sp.burst) {
            sp.burst = true;
            for (let k = 0; k < 4; k++)
              f.particles.push(
                particle('rock', sp.x, ground, {
                  vx: rand(-3, 3),
                  vy: -rand(3, 7),
                  gravity: 0.3,
                  vr: 0.2,
                  max: 60,
                  size: rand(3, 6),
                }),
              );
          }
          const tipY = ground - sp.h * rise;
          ctx.beginPath();
          ctx.moveTo(sp.x - width * 0.028, ground - sp.h * rise * 0.4);
          ctx.lineTo(sp.x + sp.lean, tipY);
          ctx.lineTo(sp.x + width * 0.028, ground - sp.h * rise * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        const head = clamp01((f.time - 1.1) / 0.5);
        if (head > 0) {
          const hx = width * 0.14;
          const hy = ground - H * 0.28 * easeOut(head);
          ctx.fillStyle = '#2b1d14';
          ctx.beginPath();
          ctx.ellipse(hx, hy, width * 0.09, H * 0.2, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#d8c8a8';
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(hx + side * 20, hy - H * 0.12);
            ctx.quadraticCurveTo(hx + side * 60, hy - H * 0.4, hx + side * 20, hy - H * 0.5);
            ctx.stroke();
          }
          ctx.save();
          ctx.translate(hx + 30, hy - 10);
          drawBeastEye(ctx, 34, easeOut(head), -0.3, ['#fff6b0', '#ff7a1a', '#5a1000'], 0.07);
          ctx.restore();
        }
        const gap = 18 * clamp01((f.time - 0.3) / 0.8);
        if (gap > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255, 120, 30, 0.9)';
          ctx.lineWidth = gap;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          crack.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 230, 150, 0.9)';
          ctx.lineWidth = gap * 0.3;
          ctx.stroke();
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES && Math.random() < 0.3)
          f.particles.push(
            particle('ember', rand(0, width), ground + 20, {
              vy: -rand(2, 5),
              vx: rand(-1, 1),
              max: 80,
              size: rand(1.2, 2.4),
              color: '255, 150, 60',
            }),
          );
      },
    };
  },
  sans: (width, height) => {
    // Batalha em pixel: tela preta, caixa de combate branca em volta do texto, ossos atravessando a
    // caixa, um olho azul e amarelo flamejando no escuro e dois canhões-caveira disparando raios.
    const bw = Math.min(width * 0.62, 640);
    const bh = 190;
    const bx = (width - bw) / 2;
    const by = height * 0.5 - bh / 2;
    const bones: { x: number; h: number; top: boolean; v: number }[] = [];
    const blasters = [
      { at: 1, x: width * 0.12, y: height * 0.18, dir: 1 },
      { at: 1.6, x: width * 0.88, y: height * 0.82, dir: -1 },
    ];
    const fired = new Set<number>();
    const bone = (ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 5, Math.min(y1, y2), 10, Math.abs(y2 - y1));
      for (const y of [y1, y2])
        for (const dx of [-5, 5]) {
          ctx.beginPath();
          ctx.arc(x + dx, y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        if (t > 0.3 && t < 2.4 && Math.random() < 0.12)
          bones.push({
            x: Math.random() < 0.5 ? bx - 10 : bx + bw + 10,
            h: rand(40, bh - 50),
            top: Math.random() < 0.5,
            v: 0,
          });
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.92 * clamp01(t / 0.2)})`;
        ctx.fillRect(0, 0, width, height);
        // Olho flamejante.
        ctx.globalCompositeOperation = 'lighter';
        const flame = 0.7 + Math.random() * 0.3;
        blit(ctx, softSprite('60, 200, 255'), width / 2, by - 70, 46 * flame, 0.9);
        blit(ctx, softSprite('255, 230, 60'), width / 2 + 4, by - 76, 24 * flame, 0.8);
        blit(ctx, glowSprite('200, 240, 255'), width / 2, by - 70, 10, 1);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx + 3, by + 3, bw - 6, bh - 6);
        ctx.clip();
        for (const b of bones) {
          b.v = b.x < width / 2 ? 6 : -6;
          if (b.v === 0) continue;
        }
        for (const b of bones) {
          b.x += b.x < bx + bw / 2 ? 5 : -5;
          bone(ctx, b.x, b.top ? by : by + bh, b.top ? by + b.h : by + bh - b.h);
        }
        ctx.restore();
        // Canhões-caveira: abrem a boca e disparam um raio branco.
        for (const [i, bl] of blasters.entries()) {
          const appear = easeOut((t - bl.at + 0.5) / 0.3);
          if (appear <= 0) continue;
          const open = clamp01((t - bl.at + 0.15) / 0.15);
          const beam = t > bl.at && t < bl.at + 0.45;
          if (beam && !fired.has(i)) {
            fired.add(i);
            screenShake(300, 8);
          }
          ctx.save();
          ctx.translate(bl.x, bl.y);
          ctx.rotate(bl.dir > 0 ? 0.6 : Math.PI + 0.6);
          ctx.scale(appear, appear);
          ctx.fillStyle = '#f4f4f4';
          ctx.beginPath();
          ctx.ellipse(0, 0, 60, 46, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(30, 20);
          ctx.lineTo(95, 30 + open * 30);
          ctx.lineTo(40, 46);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(30, -10);
          ctx.lineTo(95, -10 - open * 10);
          ctx.lineTo(40, 14);
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(10, -12, 12, 16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, glowSprite('120, 220, 255'), 10, -12, 9, open);
          if (beam) {
            const w = 70 * (1 - (t - bl.at) / 0.45) + 20;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillRect(90, 10 - w / 2, Math.hypot(width, height), w);
            ctx.fillStyle = 'rgba(160, 220, 255, 0.35)';
            ctx.fillRect(90, 10 - w, Math.hypot(width, height), w * 2);
          }
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },
  hollow: (width, height) => {
    // Reino sombrio e melancólico: poeira pálida caindo, três golpes de agulha em crescente e uma
    // explosão de alma — luz branca com tentáculos de vazio negro se espalhando.
    const cx = width / 2;
    const cy = height * 0.45;
    const slashes = [
      { at: 0.4, x: width * 0.35, y: height * 0.4, a: -0.4 },
      { at: 0.6, x: width * 0.65, y: height * 0.5, a: 2.6 },
      { at: 0.8, x: width * 0.5, y: height * 0.35, a: 1.2 },
    ];
    const tendrils = Array.from({ length: 14 }, (_, i) => ({
      a: (i / 14) * Math.PI * 2 + rand(-0.2, 0.2),
      phase: rand(0, 6),
      length: rand(0.35, 0.6),
    }));
    let burst = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, `rgba(10, 18, 36, ${0.85 * clamp01(t / 0.4)})`);
        bg.addColorStop(1, `rgba(2, 4, 10, ${0.92 * clamp01(t / 0.4)})`);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
        ctx.lineCap = 'round';
        for (const sl of slashes) {
          const age = t - sl.at;
          if (age < 0 || age > 0.35) continue;
          const k = 1 - age / 0.35;
          ctx.save();
          ctx.translate(sl.x, sl.y);
          ctx.rotate(sl.a);
          ctx.globalCompositeOperation = 'lighter';
          for (const [w, alpha] of [
            [26, 0.25],
            [8, 1],
          ] as const) {
            ctx.strokeStyle = `rgba(235, 240, 255, ${alpha * k})`;
            ctx.lineWidth = w * k;
            ctx.beginPath();
            ctx.arc(0, 0, 140, -1.1, 1.1);
            ctx.stroke();
          }
          ctx.restore();
        }
        if (!burst && t >= 1.2) {
          burst = true;
          screenShake(400, 10);
          for (let k = 0; k < 30; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('mote', cx, cy, {
                vx: Math.cos(a) * rand(3, 9),
                vy: Math.sin(a) * rand(3, 9),
                drag: 0.96,
                max: 70,
                size: rand(2, 4),
                color: '240, 245, 255',
              }),
            );
          }
        }
        if (t > 1.2) {
          const g = easeOut((t - 1.2) / 0.5);
          ctx.strokeStyle = '#020204';
          for (const td of tendrils) {
            let x = cx;
            let y = cy;
            const len = Math.hypot(width, height) * td.length * g;
            for (let k = 1; k <= 10; k++) {
              const u = k / 10;
              const a = td.a + Math.sin(u * 5 + t * 3 + td.phase) * 0.35;
              const nx = x + Math.cos(a) * (len / 10);
              const ny = y + Math.sin(a) * (len / 10);
              ctx.lineWidth = 26 * (1 - u) + 2;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(nx, ny);
              ctx.stroke();
              x = nx;
              y = ny;
            }
          }
          ctx.globalCompositeOperation = 'lighter';
          blit(
            ctx,
            softSprite('240, 245, 255'),
            cx,
            cy,
            160 * (0.6 + g),
            0.9 * (1 - clamp01((t - 2) / 0.8)),
          );
          ctx.strokeStyle = `rgba(240, 245, 255, ${1 - g})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, g * Math.max(width, height) * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES && Math.random() < 0.5)
          f.particles.push(
            particle('mote', rand(0, width), -10, {
              vy: rand(0.5, 1.2),
              vx: rand(-0.2, 0.2),
              max: 300,
              size: rand(1, 2),
              color: '200, 215, 240',
            }),
          );
      },
    };
  },
  doom: (width, height) => {
    // Feitiçaria e armadura: placas de metal rebitadas se fecham pelas bordas com frestas verdes,
    // círculos de runas esmeralda giram no centro, raios verdes estalam e uma explosão final.
    const cx = width / 2;
    const cy = height * 0.45;
    let boom = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        const close = easeOut((t - 0.2) / 0.6);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 12, 6, ${0.8 * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        // Placas de armadura.
        const plate = Math.min(width, height) * 0.16 * close;
        const metal = ctx.createLinearGradient(0, 0, width, height);
        metal.addColorStop(0, '#6a7078');
        metal.addColorStop(0.5, '#3a3f46');
        metal.addColorStop(1, '#585e66');
        ctx.fillStyle = metal;
        ctx.fillRect(0, 0, width, plate);
        ctx.fillRect(0, height - plate, width, plate);
        ctx.fillRect(0, 0, plate, height);
        ctx.fillRect(width - plate, 0, plate, height);
        ctx.fillStyle = '#9aa0a8';
        for (let x = plate / 2; x < width; x += 60)
          for (const y of [plate / 2, height - plate / 2]) {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(84, 227, 111, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(plate, plate, width - plate * 2, height - plate * 2);
        // Runas esmeralda.
        const R = Math.min(width, height) * 0.28;
        const spell = easeOut((t - 0.5) / 0.5);
        for (const [k, speed] of [
          [1, 0.4],
          [0.74, -0.6],
          [0.48, 0.9],
        ] as const) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * speed);
          ctx.strokeStyle = `rgba(84, 227, 111, ${0.8 * spell})`;
          ctx.beginPath();
          ctx.arc(0, 0, R * k * spell, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            blit(
              ctx,
              runeSprite(RUNES[(i * 5) % RUNES.length]!, '84, 227, 111'),
              Math.cos(a) * R * k * spell * 0.9,
              Math.sin(a) * R * k * spell * 0.9,
              R * 0.06,
              spell,
            );
          }
          ctx.restore();
        }
        if (f.emitting && Math.random() < 0.25) {
          const a = rand(0, Math.PI * 2);
          f.particles.push(
            particle('bolt', 0, 0, {
              path: bolt(
                { x: cx, y: cy },
                { x: cx + Math.cos(a) * R * 1.4, y: cy + Math.sin(a) * R * 1.4 },
                18,
                8,
              ),
              max: 7,
              size: 2.5,
              color: '84, 227, 111',
            }),
          );
        }
        if (!boom && t >= 1.9) {
          boom = true;
          screenShake(500, 14);
        }
        if (t > 1.9) {
          const k = easeOut((t - 1.9) / 0.5);
          blit(
            ctx,
            softSprite('84, 227, 111'),
            cx,
            cy,
            R * 3 * k,
            0.8 * (1 - clamp01((t - 2.3) / 0.6)),
          );
        }
        ctx.restore();
      },
    };
  },
  zoro: (width, height) => {
    // Estilo de três espadas: três cortes cruzam a tela formando um triângulo, um redemoinho de
    // lâminas verdes sobe girando e, quando a bainha estala, tudo se parte num clarão.
    const cx = width / 2;
    const cy = height * 0.45;
    const cuts = [
      { at: 0.4, a: 0 },
      { at: 0.6, a: Math.PI / 3 },
      { at: 0.8, a: -Math.PI / 3 },
    ];
    let clicked = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 14, 8, ${0.75 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const reach = Math.hypot(width, height);
        for (const c of cuts) {
          const age = t - c.at;
          if (age < 0) continue;
          const k = Math.max(0, 1 - age / 1.6);
          const grow = clamp01(age / 0.08);
          for (const [w, style] of [
            [24, `rgba(80, 255, 140, ${0.25 * k})`],
            [4, `rgba(240, 255, 245, ${k})`],
          ] as const) {
            ctx.strokeStyle = style;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(
              cx - Math.cos(c.a) * reach * 0.5 * grow,
              cy - Math.sin(c.a) * reach * 0.5 * grow,
            );
            ctx.lineTo(
              cx + Math.cos(c.a) * reach * 0.5 * grow,
              cy + Math.sin(c.a) * reach * 0.5 * grow,
            );
            ctx.stroke();
          }
        }
        // Redemoinho de lâminas.
        const spin = easeOut((t - 1.1) / 0.4) * (1 - clamp01((t - 2.4) / 0.2));
        if (spin > 0) {
          for (let i = 0; i < 22; i++) {
            const u = i / 22;
            const a = t * 9 + u * Math.PI * 6;
            const r = 40 + u * Math.min(width, height) * 0.4;
            const y = cy + (0.5 - u) * height * 0.6;
            ctx.strokeStyle = `rgba(120, 255, 170, ${0.7 * spin})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(cx, y, r, r * 0.25, 0, a, a + 0.9);
            ctx.stroke();
          }
        }
        if (!clicked && t >= 2.5) {
          clicked = true;
          screenShake(400, 12);
        }
        const flash = 1 - Math.abs(t - 2.55) / 0.12;
        if (flash > 0) {
          ctx.fillStyle = `rgba(220, 255, 230, ${flash * 0.7})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      },
    };
  },
  blackhole: (width, height, durationMs) => {
    // Um buraco negro: disco de acreção girando, anel de luz curvada em volta do horizonte, tudo é
    // sugado em espiral cada vez mais rápido e, no fim, colapsa num clarão.
    const cx = width / 2;
    const cy = height * 0.45;
    const R = Math.min(width, height) * 0.12;
    let collapsed = false;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const t = f.time;
        const shrink = 1 - easeOut((t - (end - 1.2)) / 0.5);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(2, 0, 8, ${0.85 * clamp01(t / 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 7; k++) {
          ctx.setLineDash([R * 0.6, R * 0.3]);
          ctx.lineDashOffset = -t * (200 + k * 60);
          ctx.strokeStyle = `rgba(${255 - k * 20}, ${150 - k * 15}, ${80 + k * 25}, ${0.5 - k * 0.05})`;
          ctx.lineWidth = 8 - k * 0.6;
          ctx.beginPath();
          ctx.ellipse(
            cx,
            cy,
            R * (1.7 + k * 0.35) * shrink,
            R * (0.45 + k * 0.08) * shrink,
            -0.15,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        ctx.setLineDash([]);
        blit(ctx, softSprite('255, 200, 140'), cx, cy, R * 2.2 * shrink, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx, cy, R * shrink, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255, 220, 180, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.08 * shrink, 0, Math.PI * 2);
        ctx.stroke();
        if (!collapsed && shrink <= 0.02) {
          collapsed = true;
          screenShake(600, 16);
        }
        if (collapsed) {
          const k = clamp01((t - (end - 0.7)) / 0.6);
          ctx.fillStyle = `rgba(255, 240, 255, ${(1 - k) * 0.8})`;
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = `rgba(200, 150, 255, ${1 - k})`;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(cx, cy, k * Math.max(width, height), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES && !collapsed)
          for (let i = 0; i < 3; i++) {
            const a = rand(0, Math.PI * 2);
            const d = Math.max(width, height) * 0.6;
            const speed = 2 + t * 3;
            f.particles.push(
              particle('mote', cx + Math.cos(a) * d, cy + Math.sin(a) * d, {
                vx: (-Math.cos(a) + -Math.sin(a) * 0.8) * speed,
                vy: (-Math.sin(a) + Math.cos(a) * 0.8) * speed,
                max: Math.floor(d / speed / 1.3),
                size: rand(1, 2.5),
                color: pick(['255, 255, 255', '200, 160, 255', '255, 200, 140']),
              }),
            );
          }
      },
    };
  },
  fullmetal: (width, height) => {
    // Palmas! Um círculo de transmutação acende no chão, relâmpagos azuis de alquimia crepitam e
    // o chão rompe em pontas de pedra ao redor.
    const cx = width / 2;
    const cy = height * 0.82;
    const rx = Math.min(width * 0.38, height * 0.7);
    const ry = rx * 0.22;
    const spikes = Array.from({ length: 12 }, (_, i) => ({
      a: (i / 12) * Math.PI * 2,
      h: rand(80, 200),
      delay: 1 + i * 0.03,
    }));
    let clapped = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        if (!clapped && t >= 0.3) {
          clapped = true;
          screenShake(150, 6);
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(6, 8, 16, ${0.7 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        const clap = 1 - Math.abs(t - 0.3) / 0.12;
        if (clap > 0) {
          ctx.fillStyle = `rgba(200, 230, 255, ${clap * 0.6})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.globalCompositeOperation = 'lighter';
        const draw = clamp01((t - 0.35) / 0.4);
        ctx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
        ctx.lineWidth = 3;
        for (const k of [1, 0.85, 0.6]) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2 * draw);
          ctx.stroke();
        }
        if (draw >= 1) {
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t * 0.2;
            ctx.lineTo(cx + Math.cos(a) * rx * 0.85, cy + Math.sin(a) * ry * 0.85);
          }
          ctx.stroke();
        }
        if (t > 0.4 && t < 1.6 && Math.random() < 0.5) {
          const a = rand(0, Math.PI * 2);
          const from = { x: cx + Math.cos(a) * rx * 0.7, y: cy + Math.sin(a) * ry * 0.7 };
          f.particles.push(
            particle('bolt', 0, 0, {
              path: bolt(from, { x: from.x + rand(-60, 60), y: from.y - rand(60, 180) }, 18, 6),
              max: 6,
              size: 2,
              color: '120, 200, 255',
            }),
          );
        }
        ctx.globalCompositeOperation = 'source-over';
        for (const sp of spikes) {
          const rise = easeOut((t - sp.delay) / 0.25);
          if (rise <= 0) continue;
          const x = cx + Math.cos(sp.a) * rx * 1.1;
          const y = cy + Math.sin(sp.a) * ry * 1.1;
          ctx.fillStyle = '#6a625a';
          ctx.strokeStyle = '#3a342e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 18, y);
          ctx.lineTo(x + Math.cos(sp.a) * 20, y - sp.h * rise);
          ctx.lineTo(x + 18, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  sahur: (width, height) => {
    // Madrugada: lua crescente e estrelas; um taco de madeira gigante bate três vezes ("TUNG!")
    // fazendo tudo tremer e soltar farpas, e a quarta pancada estoura um "SAHUR!".
    const font = displayFont();
    const hits = [0.3, 0.7, 1.1, 1.6].map((at, i) => ({
      at,
      x: width * (0.3 + (i % 2) * 0.4),
      y: height * (0.4 + (i % 3) * 0.08),
      done: false,
      word: i === 3 ? 'SAHUR!' : 'TUNG!',
    }));
    const stars = Array.from({ length: 40 }, () => ({
      x: rand(0, width),
      y: rand(0, height * 0.6),
      s: rand(1, 2.5),
    }));
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(8, 10, 30, ${0.82 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#f6e7b0';
        ctx.beginPath();
        ctx.arc(width * 0.85, height * 0.16, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(8, 10, 30, 1)';
        ctx.beginPath();
        ctx.arc(width * 0.85 + 22, height * 0.16 - 10, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        for (const st of stars) ctx.fillRect(st.x, st.y, st.s, st.s);
        for (const hit of hits) {
          const age = t - hit.at;
          if (age < -0.18) continue;
          if (!hit.done && age >= 0) {
            hit.done = true;
            screenShake(hit.word === 'SAHUR!' ? 500 : 220, hit.word === 'SAHUR!' ? 16 : 9);
            for (let k = 0; k < 10; k++)
              f.particles.push(
                particle('rock', hit.x, hit.y, {
                  vx: rand(-6, 6),
                  vy: rand(-7, -1),
                  gravity: 0.35,
                  vr: 0.3,
                  max: 60,
                  size: rand(2, 5),
                }),
              );
          }
          // O taco descendo até o ponto da batida.
          if (age < 0.15) {
            const swing = clamp01((age + 0.18) / 0.18);
            ctx.save();
            ctx.translate(hit.x + 160, hit.y - 200);
            ctx.rotate(-1.2 + swing * 1.4);
            const wood = ctx.createLinearGradient(0, 0, 0, 260);
            wood.addColorStop(0, '#b07a3a');
            wood.addColorStop(1, '#6e4520');
            ctx.fillStyle = wood;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(10, 0);
            ctx.lineTo(26, 250);
            ctx.quadraticCurveTo(0, 275, -26, 250);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(60, 35, 15, 0.6)';
            ctx.lineWidth = 2;
            for (let k = 0; k < 4; k++) {
              ctx.beginPath();
              ctx.moveTo(-6 + k * 4, 30);
              ctx.lineTo(-14 + k * 9, 240);
              ctx.stroke();
            }
            ctx.restore();
          }
          if (age >= 0 && age < 0.8) {
            const pop = easeOut(age / 0.12) * (1 - clamp01((age - 0.5) / 0.3));
            const big = hit.word === 'SAHUR!' ? 2 : 1;
            ctx.save();
            ctx.translate(hit.x, hit.y);
            ctx.rotate(-0.1);
            ctx.scale(pop * big, pop * big);
            ctx.font = `bold 64px ${font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 10;
            ctx.strokeStyle = '#2a1408';
            ctx.fillStyle = '#ffcf4a';
            ctx.strokeText(hit.word, 0, 0);
            ctx.fillText(hit.word, 0, 0);
            ctx.restore();
          }
        }
        ctx.restore();
      },
    };
  },
  spider: (width, height) => {
    // Noite na cidade: teias disparam dos quatro cantos até o centro, uma teia gigante se tece em
    // volta do texto e estremece quando esticada.
    const cx = width / 2;
    const cy = height * 0.45;
    const R = Math.min(width, height) * 0.42;
    const shots = [
      { at: 0.2, x: 0, y: 0 },
      { at: 0.35, x: width, y: 0 },
      { at: 0.5, x: 0, y: height },
      { at: 0.65, x: width, y: height },
    ];
    const buildings = Array.from({ length: 14 }, (_, i) => ({
      x: (i / 14) * width,
      w: width / 14 + 4,
      h: rand(height * 0.15, height * 0.4),
    }));
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(6, 8, 22, ${0.78 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        for (const b of buildings) {
          ctx.fillStyle = '#0a0c18';
          ctx.fillRect(b.x, height - b.h, b.w, b.h);
          ctx.fillStyle = 'rgba(255, 220, 120, 0.5)';
          for (let y = height - b.h + 12; y < height - 10; y += 22)
            for (let x = b.x + 6; x < b.x + b.w - 8; x += 14)
              if ((x * 7 + y * 3) % 5 < 2) ctx.fillRect(x, y, 5, 8);
        }
        ctx.strokeStyle = 'rgba(240, 240, 250, 0.9)';
        ctx.lineCap = 'round';
        for (const sh of shots) {
          const k = easeOut((t - sh.at) / 0.18);
          if (k <= 0) continue;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(sh.x, sh.y);
          ctx.lineTo(sh.x + (cx - sh.x) * k, sh.y + (cy - sh.y) * k);
          ctx.stroke();
        }
        const weave = clamp01((t - 0.8) / 0.6);
        if (weave > 0) {
          const tug = t > 1.3 ? Math.sin((t - 1.3) * 14) * 6 * Math.max(0, 1 - (t - 1.3) / 1.2) : 0;
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * R * weave, cy + Math.sin(a) * R * weave * 0.8);
            ctx.stroke();
          }
          const rings = Math.floor(weave * 9);
          for (let r = 1; r <= rings; r++) {
            ctx.beginPath();
            for (let i = 0; i <= 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              const rr = (r / 9) * R + tug;
              const sag = Math.sin((i % 1) * Math.PI) * 4;
              ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8 + sag);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
      },
    };
  },
  akatsuki: (width, height) => {
    // Céu negro com lua vermelha; nuvens vermelhas de contorno branco atravessam a tela e uma
    // revoada de corvos varre tudo.
    const clouds = Array.from({ length: 7 }, (_, i) => ({
      x: rand(-200, width),
      y: height * (0.15 + i * 0.12),
      s: rand(40, 70),
      v: rand(0.8, 1.8),
    }));
    const crows = Array.from({ length: 46 }, () => ({
      x: rand(-width, -40),
      y: rand(height * 0.1, height * 0.85),
      v: rand(8, 14),
      phase: rand(0, 6),
      s: rand(8, 18),
      delay: rand(0.6, 1.4),
    }));
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 2, 4, ${0.85 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        const moonR = Math.min(width, height) * 0.16;
        ctx.globalCompositeOperation = 'lighter';
        blit(ctx, softSprite('255, 40, 40'), width * 0.78, height * 0.25, moonR * 2, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#b3121f';
        ctx.beginPath();
        ctx.arc(width * 0.78, height * 0.25, moonR, 0, Math.PI * 2);
        ctx.fill();
        for (const c of clouds) {
          c.x += c.v;
          if (c.x > width + 200) c.x = -200;
          drawCloud(ctx, c.x, c.y, c.s + 5, '#ffffff');
          drawCloud(ctx, c.x, c.y, c.s, '#c4161c');
        }
        ctx.strokeStyle = '#050304';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const cr of crows) {
          if (t < cr.delay) continue;
          cr.x += cr.v;
          const flap = Math.sin(t * 16 + cr.phase) * cr.s * 0.5;
          ctx.lineWidth = cr.s * 0.25;
          ctx.beginPath();
          ctx.moveTo(cr.x - cr.s, cr.y - flap);
          ctx.quadraticCurveTo(cr.x - cr.s * 0.4, cr.y - cr.s * 0.2, cr.x, cr.y);
          ctx.quadraticCurveTo(cr.x + cr.s * 0.4, cr.y - cr.s * 0.2, cr.x + cr.s, cr.y - flap);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  hisoka: (width, height) => {
    // Cartas de baralho voam como lâminas e cravam em volta do texto; fios elásticos rosa esticam
    // das cartas até o centro, balançam e voltam de uma vez.
    const cx = width / 2;
    const cy = height * 0.45;
    const suits = ['♠', '♥', '♦', '♣'];
    const cards = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return {
        tx: cx + Math.cos(a) * Math.min(width, height) * 0.38,
        ty: cy + Math.sin(a) * Math.min(width, height) * 0.3,
        rot: rand(-0.6, 0.6),
        suit: suits[i % 4]!,
        at: 0.2 + i * 0.07,
      };
    });
    const card = (ctx: CanvasRenderingContext2D, suit: string) => {
      ctx.fillStyle = '#fbfbf6';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-22, -32, 44, 64, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = suit === '♥' || suit === '♦' ? '#d4183a' : '#111';
      ctx.font = 'bold 26px "Segoe UI Symbol", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(suit, 0, 2);
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(20, 4, 20, ${0.7 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        const stretch = clamp01((t - 0.9) / 0.6);
        const snap = clamp01((t - 1.8) / 0.12);
        for (const c of cards) {
          const fly = clamp01((t - c.at) / 0.22);
          if (fly <= 0) continue;
          const x = width + 60 + (c.tx - width - 60) * fly;
          const y = cy + (c.ty - cy) * fly;
          if (stretch > 0 && snap < 1) {
            const wob = Math.sin(t * 10 + c.at * 20) * 20 * (1 - snap);
            ctx.strokeStyle = 'rgba(255, 79, 163, 0.85)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            const ex = x + (cx - x) * stretch * (1 - snap);
            const ey = y + (cy - y) * stretch * (1 - snap);
            ctx.quadraticCurveTo((x + ex) / 2 + wob, (y + ey) / 2 - wob, ex, ey);
            ctx.stroke();
          }
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(fly < 1 ? t * 20 : c.rot);
          card(ctx, c.suit);
          ctx.restore();
        }
        ctx.restore();
        if (f.emitting && Math.random() < 0.2)
          f.particles.push(
            particle('rune', rand(0, width), rand(0, height), {
              vy: -0.6,
              max: 60,
              size: rand(18, 26),
              glyph: pick(suits),
              color: '255, 79, 163',
            }),
          );
      },
    };
  },
  valorant: (width, height, durationMs) => {
    // Rodada tática: mira fechando no centro, fumaças vermelhas nas laterais, o artefato plantado
    // pisca cada vez mais rápido e detona numa esfera de luz.
    const cx = width / 2;
    const cy = height * 0.45;
    const spike = { x: width / 2, y: height * 0.82 };
    let boomed = false;
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(10, 10, 16, ${0.7 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        // Mira.
        const gap = 40 * (1 - easeOut(t / 0.6)) + 8;
        ctx.strokeStyle = 'rgba(120, 255, 200, 0.95)';
        ctx.lineWidth = 3;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          ctx.beginPath();
          ctx.moveTo(cx + dx * gap, cy - 140 + dy * gap);
          ctx.lineTo(cx + dx * (gap + 18), cy - 140 + dy * (gap + 18));
          ctx.stroke();
        }
        // Artefato plantado piscando.
        const blinkRate = 2 + t * t * 4;
        const on = Math.sin(t * blinkRate * Math.PI * 2) > 0;
        ctx.fillStyle = '#2a2a34';
        ctx.beginPath();
        ctx.moveTo(spike.x, spike.y - 40);
        ctx.lineTo(spike.x + 26, spike.y);
        ctx.lineTo(spike.x, spike.y + 20);
        ctx.lineTo(spike.x - 26, spike.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        if (on && !boomed) blit(ctx, glowSprite('255, 70, 85'), spike.x, spike.y - 8, 16, 1);
        ctx.globalCompositeOperation = 'source-over';
        if (!boomed && t >= 2.05) {
          boomed = true;
          screenShake(700, 18);
        }
        if (boomed) {
          const k = easeOut((t - 2.05) / 0.5);
          ctx.globalCompositeOperation = 'lighter';
          blit(
            ctx,
            softSprite('255, 90, 100'),
            spike.x,
            spike.y,
            Math.max(width, height) * k,
            0.9 * (1 - clamp01((t - 2.5) / (end - 2.5))),
          );
          ctx.fillStyle = `rgba(255, 245, 245, ${0.7 * (1 - k)})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES && t < 1.8 && Math.random() < 0.4)
          f.particles.push(
            particle(
              'wisp',
              Math.random() < 0.5 ? rand(0, width * 0.2) : rand(width * 0.8, width),
              rand(height * 0.2, height * 0.8),
              { vy: -rand(0.2, 0.6), max: 120, size: rand(50, 90), color: '255, 70, 85' },
            ),
          );
      },
    };
  },
  league: (width, height) => {
    // Subida de nível: um anel dourado sobe do chão com raios, cinco espadas douradas acendem uma
    // a uma e tudo termina num clarão dourado e azul.
    const cx = width / 2;
    const cy = height * 0.5;
    const sword = (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.fillStyle = '#f0d27a';
      ctx.strokeStyle = '#6a4a10';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.14, -s * 0.2);
      ctx.lineTo(-s * 0.14, -s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-s * 0.35, -s * 0.2, s * 0.7, s * 0.1);
      ctx.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.45);
    };
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(4, 10, 20, ${0.7 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        const rise = easeOut(t / 0.6);
        const ringY = height * 0.9 - rise * height * 0.4;
        ctx.strokeStyle = 'rgba(240, 200, 100, 0.9)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(cx, ringY, width * 0.25, width * 0.05, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.translate(cx, ringY);
        ctx.rotate(t * 0.6);
        ctx.fillStyle = 'rgba(240, 200, 100, 0.1)';
        for (let k = 0; k < 12; k += 2) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(
            0,
            0,
            Math.max(width, height),
            (k / 12) * Math.PI * 2,
            ((k + 1) / 12) * Math.PI * 2,
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 5; i++) {
          const lit = clamp01((t - 0.7 - i * 0.25) / 0.1);
          const x = cx + (i - 2) * Math.min(width * 0.12, 120);
          ctx.save();
          ctx.globalAlpha = f.presence * (0.25 + lit * 0.75);
          ctx.translate(x, cy - 120);
          ctx.scale(1 + lit * 0.2, 1 + lit * 0.2);
          sword(ctx, 50);
          ctx.restore();
          if (lit > 0 && lit < 0.2) {
            ctx.globalCompositeOperation = 'lighter';
            blit(ctx, softSprite('120, 200, 255'), x, cy - 130, 70, 0.8);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        const flash = 1 - Math.abs(t - 2) / 0.2;
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 230, 160, ${flash * 0.6})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
        if (f.emitting && f.particles.length < MAX_PARTICLES && Math.random() < 0.5)
          f.particles.push(
            particle('spark', cx + rand(-width * 0.25, width * 0.25), ringY, {
              vy: -rand(1, 3),
              max: 60,
              size: rand(1.5, 2.5),
              color: pick(['240, 200, 100', '120, 200, 255']),
            }),
          );
      },
    };
  },
  mario: (width, height) => {
    // Fase de plataforma: uma fileira de blocos dourados é batida um a um soltando moedas, canos
    // verdes sobem do chão e uma estrela pula pela tela com rastro de arco-íris.
    const n = 5;
    const size = Math.min(width * 0.08, 70);
    const blocks = Array.from({ length: n }, (_, i) => ({
      x: width / 2 + (i - (n - 1) / 2) * size * 1.1,
      at: 0.3 + i * 0.2,
      done: false,
    }));
    const star = { x: width * 0.2, y: height * 0.6, vx: 7, vy: -9 };
    let starOut = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(80, 140, 255, ${0.55 * clamp01(t / 0.3)})`;
        ctx.fillRect(0, 0, width, height);
        const y0 = height * 0.22;
        for (const b of blocks) {
          const age = t - b.at;
          if (age >= 0 && !b.done) {
            b.done = true;
            f.particles.push(
              particle('coin', b.x, y0 - size * 0.6, {
                vy: -9,
                gravity: 0.5,
                vr: 0.4,
                max: 34,
                size: size * 0.28,
              }),
            );
          }
          const bump = age >= 0 && age < 0.15 ? Math.sin((age / 0.15) * Math.PI) * 14 : 0;
          ctx.fillStyle = age >= 0 ? '#b07a2a' : '#f0b030';
          ctx.strokeStyle = '#5a3a08';
          ctx.lineWidth = 4;
          ctx.fillRect(b.x - size / 2, y0 - size / 2 - bump, size, size);
          ctx.strokeRect(b.x - size / 2, y0 - size / 2 - bump, size, size);
          ctx.fillStyle = age >= 0 ? '#7a5418' : '#fff3c0';
          ctx.font = `bold ${size * 0.6}px "Segoe UI Symbol", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', b.x, y0 - bump + 2);
        }
        // Canos.
        const pipe = easeOut((t - 0.8) / 0.4);
        for (const px of [width * 0.15, width * 0.85]) {
          const h = height * 0.22 * pipe;
          ctx.fillStyle = '#2f9a3a';
          ctx.strokeStyle = '#0f4a18';
          ctx.lineWidth = 4;
          ctx.fillRect(px - 40, height - h, 80, h);
          ctx.strokeRect(px - 40, height - h, 80, h);
          ctx.fillRect(px - 50, height - h - 26, 100, 26);
          ctx.strokeRect(px - 50, height - h - 26, 100, 26);
        }
        // Estrela pulando.
        if (t > 1.3) {
          if (!starOut) {
            starOut = true;
            star.x = width * 0.15;
            star.y = height * 0.7;
          }
          star.vy += 0.45;
          star.x += star.vx;
          star.y += star.vy;
          if (star.y > height - 40) star.vy = -13;
          if (star.x > width - 30 || star.x < 30) star.vx *= -1;
          f.particles.push(
            particle('mote', star.x, star.y, { max: 24, size: 5, color: pick(RAINBOW) }),
          );
          ctx.fillStyle = '#ffe14a';
          ctx.strokeStyle = '#8a5a00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + t * 4;
            const r = i % 2 ? 14 : 34;
            ctx.lineTo(star.x + Math.cos(a) * r, star.y + Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
};

// --------------------------------------------------------------------------------------------
// Revisão cinematográfica: as auras abaixo têm direção em atos (entrada, preparação, impacto e
// dissipação). A arte raster funciona como recorte móvel; cenário, golpes e reação são animação.
// --------------------------------------------------------------------------------------------

const REVISED_SCENES: Partial<
  Record<DiceAura, (width: number, height: number, durationMs: number) => Scene>
> = {
  // Os nove temas da primeira rodada preservam a cena existente, mas ganham golpes e estados
  // independentes — nada aqui é apenas zoom de uma ilustração.
  // Novos temas: personagens, cenários e ataques agora são camadas independentes.
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
  /** Tamanho (a picada de abelha faz o texto inchar). */
  scale: number;
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
  shadow: (width, height, _durationMs, text) => {
    // Flashbang: uma granada quica até o texto e estoura num clarão branco que demora a passar.
    const grenade = { x: -20, y: text.y + 120, vx: 9, vy: -6, rot: 0 };
    let banged = false;
    return {
      frame(ctx, f) {
        if (f.time < 0.7) {
          grenade.vy += 0.5;
          grenade.x += grenade.vx;
          grenade.y += grenade.vy;
          grenade.rot += 0.3;
          if (grenade.y > text.y + 140) {
            grenade.y = text.y + 140;
            grenade.vy *= -0.5;
            grenade.vx *= 0.7;
          }
          ctx.save();
          ctx.globalAlpha = f.presence;
          ctx.translate(grenade.x, grenade.y);
          ctx.rotate(grenade.rot);
          ctx.fillStyle = '#4a5240';
          ctx.fillRect(-9, -16, 18, 32);
          ctx.fillStyle = '#8a8f80';
          ctx.fillRect(-6, -22, 12, 7);
          ctx.restore();
        } else if (!banged) {
          banged = true;
          screenShake(300, 10);
        }
        const white = f.time >= 0.7 ? Math.max(0, 1 - (f.time - 0.9) / 2) : 0;
        if (white > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, white) * f.presence})`;
          ctx.fillRect(0, 0, width, height);
        }
      },
    };
  },
  holy: (_width, height, _durationMs, text) => {
    // Em vez de anjo, sobe um diabinho: dá risada, cutuca o texto com o tridente e ele cai.
    let poked = false;
    return {
      frame(ctx, f) {
        const rise = easeOut((f.time - 0.2) / 0.4);
        if (rise <= 0) return;
        const bounce = Math.abs(Math.sin(f.time * 9)) * (f.time > 0.6 && f.time < 1.3 ? 6 : 0);
        const x = text.x + 190;
        const y = text.y + 40 + (1 - rise) * height * 0.6 - bounce;
        const poke = clamp01((f.time - 1.35) / 0.15) * (1 - clamp01((f.time - 1.6) / 0.2));
        if (!poked && f.time > 1.45) {
          poked = true;
          text.vx = -3;
          text.vr = -0.05;
          text.falling = true;
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(x, y);
        // Rabo com ponta de flecha.
        ctx.strokeStyle = '#b3121f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(18, 40);
        ctx.quadraticCurveTo(60, 50 + Math.sin(f.time * 6) * 10, 52, 10);
        ctx.stroke();
        ctx.fillStyle = '#b3121f';
        ctx.beginPath();
        ctx.moveTo(52, 2);
        ctx.lineTo(62, 14);
        ctx.lineTo(44, 14);
        ctx.fill();
        // Corpo, cabeça e chifres.
        ctx.fillStyle = '#d42a2a';
        ctx.beginPath();
        ctx.ellipse(0, 30, 22, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -12, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1e2c4';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * 12, -30);
          ctx.quadraticCurveTo(side * 26, -52, side * 18, -58);
          ctx.lineTo(side * 20, -32);
          ctx.fill();
        }
        // Olhos e sorriso maroto.
        ctx.fillStyle = '#ffe14a';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * 9, -16, 5, 4, side * -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#3a0508';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -6, 11, 0.2, Math.PI - 0.2);
        ctx.stroke();
        // Tridente.
        const reach = -40 - poke * 120;
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-10, 30);
        ctx.lineTo(reach, 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(reach - 4, -2);
        ctx.lineTo(reach - 18, 4);
        ctx.moveTo(reach, 10);
        ctx.lineTo(reach - 22, 10);
        ctx.moveTo(reach - 4, 22);
        ctx.lineTo(reach - 18, 16);
        ctx.stroke();
        ctx.restore();
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
    // O olho cósmico abre todo imponente... e leva um dedo no olho: fecha, lacrimeja e fica vermelho.
    frame(ctx, f) {
      const eyeW = Math.min(width, height) * 0.22;
      const cx = text.x;
      const cy = text.y - 160;
      const poked = f.time > 1;
      const open = poked ? Math.max(0.05, 0.25 - (f.time - 1) * 0.3) : easeOut(f.time / 0.5) * 0.9;
      const eyeH = eyeW * 0.42 * open;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.translate(cx, cy);
      if (poked) {
        ctx.globalCompositeOperation = 'lighter';
        blit(ctx, softSprite('255, 60, 80'), 0, 0, eyeW * 1.4, 0.35);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.beginPath();
      ctx.moveTo(-eyeW, 0);
      ctx.quadraticCurveTo(0, -eyeH * 2, eyeW, 0);
      ctx.quadraticCurveTo(0, eyeH * 2, -eyeW, 0);
      ctx.closePath();
      ctx.fillStyle = poked ? '#f3c4c8' : '#efe8f8';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#6a5ab0';
      ctx.beginPath();
      ctx.arc(0, 0, eyeW * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeW * 0.05, eyeW * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#9a8ad0';
      ctx.lineWidth = 3;
      ctx.stroke();
      // O dedo vem da direita e cutuca.
      const finger =
        f.time < 1 ? easeOut((f.time - 0.5) / 0.5) : 1 - clamp01((f.time - 1.15) / 0.4);
      if (finger > 0) {
        const tip = eyeW * 0.15 + (1 - finger) * width * 0.6;
        ctx.fillStyle = '#e8b896';
        ctx.strokeStyle = '#9a6a48';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(tip, -eyeW * 0.12, width, eyeW * 0.24, eyeW * 0.12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f6dccb';
        ctx.beginPath();
        ctx.roundRect(tip + eyeW * 0.04, -eyeW * 0.09, eyeW * 0.16, eyeW * 0.18, eyeW * 0.05);
        ctx.fill();
      }
      ctx.restore();
      if (poked && f.emitting && Math.random() < 0.25)
        f.particles.push(
          particle('drop', cx + rand(-eyeW * 0.5, eyeW * 0.5), cy + eyeH + 4, {
            vy: 1,
            gravity: 0.25,
            max: 60,
            size: 3,
            color: '150, 200, 255',
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
  necro: (width, height) => {
    // Só uma mão de zumbi sai da terra, acena... e cai.
    const ground = height - 30;
    return {
      frame(ctx, f) {
        const rise = easeOut((f.time - 0.3) / 0.5);
        const drop = Math.max(0, f.time - 1.6);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = '#1c140e';
        ctx.fillRect(0, ground, width, height - ground);
        ctx.beginPath();
        ctx.rect(0, 0, width, ground + 2);
        ctx.clip();
        ctx.translate(width / 2, ground + (1 - rise) * 120 + drop * drop * 900);
        ctx.rotate(Math.sin(f.time * 6) * 0.25 + drop * 3);
        ctx.fillStyle = '#7a9a6a';
        ctx.fillRect(-8, -70, 16, 70);
        ctx.beginPath();
        ctx.ellipse(0, -80, 16, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7a9a6a';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(-10 + k * 7, -90);
          ctx.lineTo(-12 + k * 8, -110);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  pirate: (width, height) => ({
    // Um barquinho de papel afunda numa poça.
    frame(ctx, f) {
      const level = height - 50;
      const sink = clamp01((f.time - 1) / 1.2);
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.translate(width / 2 + f.time * 30, level + sink * 50);
      ctx.rotate(sink * 0.6);
      ctx.fillStyle = '#f2f2ee';
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(40, 0);
      ctx.lineTo(28, 16);
      ctx.lineTo(-28, 16);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(0, -38);
      ctx.lineTo(20, 0);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = f.presence * 0.8;
      ctx.fillStyle = 'rgba(40, 110, 170, 0.7)';
      ctx.fillRect(0, level + 10, width, height - level);
      ctx.restore();
      if (f.emitting && sink > 0 && Math.random() < 0.3)
        f.particles.push(
          particle('bubble', width / 2 + f.time * 30 + rand(-20, 20), level + 20, {
            vy: -rand(0.5, 1),
            max: 30,
            size: rand(2, 4),
            color: '200, 240, 255',
          }),
        );
    },
  }),
  samurai: (_width, _height, _durationMs, text) => {
    // A katana sai da bainha e a ponta quebra.
    let broke = false;
    return {
      frame(ctx, f) {
        const out = clamp01(f.time / 0.5);
        const x = text.x - 200;
        const y = text.y + 110;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.strokeStyle = '#2a1a10';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 60, y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.strokeStyle = '#dfe4ec';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + out * (broke ? 260 : 400), y - out * 10);
        ctx.stroke();
        ctx.restore();
        if (!broke && f.time > 0.9) {
          broke = true;
          f.particles.push(
            particle('shard', x + 330, y - 8, {
              vx: 2,
              vy: -3,
              gravity: 0.4,
              vr: 0.3,
              max: 100,
              size: 14,
            }),
          );
        }
      },
    };
  },
  kaiju: (width, height) => ({
    // Em vez do monstro, uma lagartixa atravessa a tela.
    frame(ctx, f) {
      const x = -60 + (width + 120) * (f.time / 3);
      const y = height - 40;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.translate(x, y);
      ctx.fillStyle = '#8fbf3f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(26, -2, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8fbf3f';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.quadraticCurveTo(-50, Math.sin(f.time * 12) * 10, -64, 0);
      for (const lx of [-12, 12]) {
        const step = Math.sin(f.time * 14 + lx) * 6;
        ctx.moveTo(lx, 4);
        ctx.lineTo(lx + step, 16);
        ctx.moveTo(lx, -4);
        ctx.lineTo(lx - step, -16);
      }
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(31, -5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  }),
  cyber: (width, height, _durationMs, text) => ({
    // Ciberpsicose: tudo fica vermelho e instável, o HUD grita erro e o texto treme sem parar.
    frame(ctx, f) {
      text.tint = '255, 60, 60';
      text.vx += rand(-3, 3);
      text.vr += rand(-0.01, 0.01);
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.fillStyle = `rgba(160, 0, 20, ${0.25 + Math.random() * 0.15})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = pick([
          'rgba(255, 0, 40, 0.35)',
          'rgba(0, 240, 255, 0.2)',
          'rgba(255, 255, 255, 0.15)',
        ]);
        ctx.fillRect(
          rand(-100, width * 0.4),
          rand(0, height),
          rand(width * 0.3, width),
          rand(3, 24),
        );
      }
      ctx.globalCompositeOperation = 'source-over';
      if (Math.sin(f.time * 14) > -0.3) {
        ctx.font = `bold ${Math.min(width, height) * 0.03}px ui-monospace, Consolas, monospace`;
        ctx.fillStyle = 'rgba(255, 60, 60, 0.95)';
        ctx.textBaseline = 'top';
        ctx.fillText('ERRO CRÍTICO // CIBERPSICOSE DETECTADA', 24, 24);
        ctx.fillText(
          `HUMANIDADE: ${Math.max(0, 41 - Math.floor(f.time * 20))}%`,
          24,
          24 + Math.min(width, height) * 0.045,
        );
      }
      ctx.restore();
    },
  }),
  werewolf: (width, height) => ({
    // A lua fica atrás de uma nuvem e, no morro, um cachorrinho late.
    frame(ctx, f) {
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.fillStyle = '#e8ecf6';
      ctx.beginPath();
      ctx.arc(width * 0.62, height * 0.28, Math.min(width, height) * 0.12, 0, Math.PI * 2);
      ctx.fill();
      drawCloud(
        ctx,
        width * 0.62 - 20 + Math.sin(f.time) * 10,
        height * 0.3,
        80,
        'rgba(60, 62, 75, 0.97)',
      );
      ctx.fillStyle = '#0b0c14';
      ctx.beginPath();
      ctx.ellipse(width * 0.3, height + height * 0.05, width * 0.45, height * 0.2, 0, Math.PI, 0);
      ctx.fill();
      ctx.translate(width * 0.3, height * 0.86 - Math.abs(Math.sin(f.time * 10)) * 6);
      ctx.fillStyle = '#0b0c14';
      ctx.beginPath();
      ctx.ellipse(0, -14, 20, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(20, -26, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-14, -8, 4, 10);
      ctx.fillRect(10, -8, 4, 10);
      ctx.restore();
      if (f.emitting && Math.random() < 0.04)
        f.particles.push(
          particle('rune', width * 0.3 + 40, height * 0.86 - 50, {
            vy: -1,
            vx: 0.8,
            max: 50,
            size: 22,
            glyph: 'au!',
            color: '230, 230, 240',
          }),
        );
    },
  }),
  siren: (width, _height, _durationMs, text) => {
    // O canto sai desafinado: ondas tortas e vermelhas, e um vidro trinca.
    let cracked = false;
    const cracks: Point[][] = [];
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.strokeStyle = 'rgba(255, 90, 90, 0.7)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          for (let x = 0; x <= width * clamp01(f.time / 1); x += 16)
            ctx.lineTo(x, text.y + 130 + i * 30 + (Math.random() - 0.5) * 30);
          ctx.stroke();
        }
        if (!cracked && f.time > 1) {
          cracked = true;
          for (let k = 0; k < 8; k++) {
            const a = rand(0, Math.PI * 2);
            cracks.push(
              bolt(
                { x: text.x, y: text.y },
                {
                  x: text.x + Math.cos(a) * rand(80, 220),
                  y: text.y + Math.sin(a) * rand(80, 220),
                },
                12,
                6,
              ),
            );
          }
        }
        ctx.strokeStyle = 'rgba(235, 245, 255, 0.85)';
        ctx.lineWidth = 1.5;
        for (const crack of cracks) {
          ctx.beginPath();
          crack.forEach((point, i) =>
            i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
          );
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  alchemy: (_width, _height, _durationMs, text) => {
    // O frasco explode: fumaça preta e o texto fica todo chamuscado.
    let boom = false;
    return {
      frame(ctx, f) {
        const x = text.x;
        const y = text.y + 120;
        if (f.time < 0.9) {
          ctx.save();
          ctx.globalAlpha = f.presence;
          ctx.fillStyle = `rgba(160, 255, 120, 0.8)`;
          ctx.beginPath();
          ctx.arc(x + Math.sin(f.time * 40) * 3, y, 26 + f.time * 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (!boom) {
          boom = true;
          screenShake(200, 8);
          text.tint = '70, 70, 70';
          for (let k = 0; k < 20; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('smoke', x, y, {
                vx: Math.cos(a) * rand(1, 4),
                vy: Math.sin(a) * rand(1, 4) - 1,
                max: 100,
                size: rand(30, 60),
                color: '30, 30, 30',
              }),
            );
          }
        }
      },
    };
  },
  ghost: (width, height, durationMs) => {
    // O fantasma escreve errado ("CRÍITCO"), percebe e apaga com a mão.
    fogGlass(durationMs);
    const font =
      getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'serif';
    const size = Math.min(width * 0.08, 100);
    return {
      frame(ctx, f) {
        const write = clamp01((f.time - 0.3) / 1);
        const wipe = clamp01((f.time - 1.6) / 0.5);
        ctx.save();
        ctx.font = `${size}px ${font}`;
        const w = ctx.measureText('CRÍITCO').width;
        ctx.globalAlpha = f.presence;
        ctx.beginPath();
        ctx.rect(
          width / 2 - w / 2 - 10 + (w + 20) * wipe,
          height * 0.2 - size,
          (w + 20) * (write - wipe),
          size * 2,
        );
        ctx.clip();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('CRÍITCO', width / 2, height * 0.2);
        ctx.restore();
      },
    };
  },
  cthulhu: (width, height, _durationMs, text) => {
    // Em vez do Grande Antigo, um polvinho fofo pula de uma poça, acena, mergulha no ar em direção
    // ao texto e solta uma nuvem enorme de tinta que borra tudo e escorre.
    const x0 = width * 0.3;
    const level = height - 60;
    const blot = Array.from({ length: 22 }, () => rand(0.7, 1.3));
    let inked = -1;
    return {
      frame(ctx, f) {
        const t = f.time;
        const jump = clamp01((t - 0.9) / 0.45);
        const rise = easeOut((t - 0.2) / 0.5);
        const x = x0 + (text.x - x0) * jump;
        const y =
          level - rise * 60 - Math.sin(jump * Math.PI) * 180 + (text.y - level + 60) * jump * 0.6;
        if (inked < 0 && jump >= 1) {
          inked = t;
          text.tint = '30, 25, 40';
          screenShake(150, 5);
          for (let k = 0; k < 16; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('drop', text.x, text.y, {
                vx: Math.cos(a) * rand(3, 8),
                vy: Math.sin(a) * rand(3, 8),
                gravity: 0.3,
                max: 60,
                size: rand(3, 6),
                color: '20, 15, 30',
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = 'rgba(30, 90, 120, 0.75)';
        ctx.beginPath();
        ctx.ellipse(x0, level + 25, 120, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        if (inked >= 0) {
          const r = Math.min(width, height) * 0.2 * easeOut((t - inked) / 0.35);
          ctx.fillStyle = 'rgba(14, 10, 22, 0.92)';
          ctx.beginPath();
          blot.forEach((k, i) => {
            const a = (i / blot.length) * Math.PI * 2;
            const px = text.x + Math.cos(a) * r * k;
            const py = text.y + Math.sin(a) * r * k * 0.7;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          });
          ctx.closePath();
          ctx.fill();
          if (f.emitting && Math.random() < 0.3)
            f.particles.push(
              particle('drop', text.x + rand(-r, r), text.y + r * 0.5, {
                vy: 0.4,
                gravity: 0.06,
                max: 120,
                size: rand(3, 5),
                color: '14, 10, 22',
              }),
            );
        }
        if (rise > 0 && inked < 0) {
          ctx.translate(x, y);
          ctx.rotate(Math.sin(t * 6) * 0.15);
          ctx.fillStyle = '#ff8aa8';
          ctx.beginPath();
          ctx.ellipse(0, 0, 46, 40, 0, Math.PI, 0);
          ctx.lineTo(46, 14);
          ctx.lineTo(-46, 14);
          ctx.fill();
          ctx.strokeStyle = '#ff8aa8';
          ctx.lineWidth = 9;
          ctx.lineCap = 'round';
          for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            ctx.moveTo(-36 + k * 18, 12);
            ctx.lineTo(-36 + k * 18 + Math.sin(t * 9 + k) * 9, 40);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(42, -4);
          ctx.quadraticCurveTo(70, -30, 64 + Math.sin(t * 12) * 14, -62);
          ctx.stroke();
          ctx.fillStyle = '#1a1020';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(side * 15, -12, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(side * 15 + 2, -14, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1a1020';
          }
          ctx.strokeStyle = '#1a1020';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, -2, 7, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  heaven: (width, height) => ({
    // O tempo, em vez de acelerar, trava: o relógio para e só passa um caracol.
    frame(ctx, f) {
      const cx = width / 2;
      const cy = height * 0.2;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.strokeStyle = 'rgba(230, 240, 255, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.stroke();
      const jitter = f.time < 0.7 ? 0 : Math.sin(f.time * 40) * 0.03;
      for (const [a, length] of [
        [-Math.PI / 2 + jitter, 0.8],
        [0.4, 0.55],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 60 * length, cy + Math.sin(a) * 60 * length);
        ctx.stroke();
      }
      const x = -60 + f.time * 60;
      const y = height - 30;
      ctx.fillStyle = '#c9b48a';
      ctx.beginPath();
      ctx.ellipse(x, y, 34, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9a6a3a';
      ctx.beginPath();
      ctx.arc(x - 4, y - 14, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 30; k++) {
        const a = k * 0.5;
        ctx.lineTo(x - 4 + Math.cos(a) * k * 0.5, y - 14 + Math.sin(a) * k * 0.5);
      }
      ctx.stroke();
      ctx.restore();
    },
  }),
  purple: (width, _height, _durationMs, text) => {
    // O "CRÍTICO!" é cortado ao meio: um risco atravessa e a metade de cima escorrega e cai.
    const font = displayFont();
    const size = Math.min(width * 0.1, 120);
    const y0 = text.y - 170;
    return {
      frame(ctx, f) {
        const cut = f.time > 0.8;
        const slide = Math.max(0, f.time - 0.85);
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.font = `${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const half of cut ? [-1, 1] : [0]) {
          ctx.save();
          // Cada metade se move com o próprio recorte (antes o recorte ficava parado e o texto
          // inteiro entrava nele ao cair, parecendo dois "CRÍTICO!").
          if (half === -1) {
            ctx.translate(width / 2 - slide * 160, y0 - slide * 40 + slide * slide * 400);
            ctx.rotate(-slide * 0.4);
            ctx.translate(-width / 2, -y0);
          } else if (half === 1) ctx.translate(slide * 30, slide * slide * 200);
          ctx.beginPath();
          if (half === -1) ctx.rect(0, y0 - size, width, size);
          else if (half === 1) ctx.rect(0, y0, width, size);
          else ctx.rect(0, y0 - size, width, size * 2);
          ctx.clip();
          ctx.fillStyle = '#f3e6ff';
          ctx.shadowColor = '#a24bff';
          ctx.shadowBlur = 18;
          ctx.fillText('CRÍTICO!', width / 2, y0);
          ctx.restore();
        }
        const line = 1 - Math.abs(f.time - 0.8) / 0.1;
        if (line > 0) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${line})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, y0);
          ctx.lineTo(width, y0);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  wheel: (width, height) => {
    // Milhares de cortes picotam a roda até ela se desfazer em pedaços.
    const R = Math.min(width, height) * 0.16;
    const cx = width / 2;
    const cy = height * 0.25;
    const image = wheelSprite(R);
    const cuts: [number, number, number, number, number][] = [];
    let broke = false;
    return {
      frame(ctx, f) {
        const t = f.time;
        if (t > 0.9 && t < 1.9)
          for (let k = 0; k < 4; k++) {
            const a = rand(0, Math.PI);
            const ox = cx + rand(-R * 1.5, R * 1.5);
            const oy = cy + rand(-R * 1.5, R * 1.5);
            cuts.push([
              ox - Math.cos(a) * R,
              oy - Math.sin(a) * R,
              ox + Math.cos(a) * R,
              oy + Math.sin(a) * R,
              t,
            ]);
          }
        if (!broke && t >= 1.9) {
          broke = true;
          for (let k = 0; k < 30; k++)
            f.particles.push(
              particle('shard', cx + rand(-R, R), cy + rand(-R, R), {
                vx: rand(-4, 4),
                vy: rand(-4, 0),
                gravity: 0.35,
                vr: 0.2,
                max: 90,
                size: rand(10, 22),
              }),
            );
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        if (!broke) {
          ctx.save();
          ctx.translate(cx + (t > 0.9 ? rand(-3, 3) : 0), cy);
          ctx.drawImage(image, -image.width / 2, -image.height / 2);
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const [x1, y1, x2, y2, born] of cuts) {
          const alpha = Math.max(0, 1 - (t - born) / 0.5);
          if (alpha <= 0) continue;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
  capture: (width, height, _durationMs, text) => {
    // A esfera pega o "CRÍTICO!", balança duas vezes... e estoura: ele escapa e foge da tela.
    const r = Math.min(width, height) * 0.06;
    const bx = width / 2;
    const by = text.y - 170;
    const size = Math.min(width * 0.07, 80);
    let popped = false;
    const escaped = { x: bx, y: by, vx: 0, vy: 0, rot: 0 };
    return {
      frame(ctx, f) {
        const t = f.time;
        let rot = 0;
        for (const at of [1.2, 1.6])
          if (t > at && t < at + 0.3) rot = Math.sin(((t - at) / 0.3) * Math.PI * 2) * 0.35;
        if (!popped && t >= 2) {
          popped = true;
          escaped.vx = 7;
          escaped.vy = -9;
          for (let k = 0; k < 12; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('spark', bx, by, {
                vx: Math.cos(a) * 4,
                vy: Math.sin(a) * 4,
                max: 30,
                size: 2,
                color: '255, 220, 110',
              }),
            );
          }
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        if (t < 0.7) {
          ctx.save();
          ctx.translate(bx, by - 10 + (1 - clamp01(t / 0.7)) * -60);
          ctx.scale(1 - clamp01((t - 0.4) / 0.3), 1 - clamp01((t - 0.4) / 0.3));
          canvasCritText(ctx, size, '240, 192, 64');
          ctx.restore();
        }
        if (popped) {
          escaped.vy += 0.4;
          escaped.x += escaped.vx;
          escaped.y += escaped.vy;
          escaped.rot += 0.2;
          ctx.save();
          ctx.translate(escaped.x, escaped.y);
          ctx.rotate(escaped.rot);
          canvasCritText(ctx, size, '240, 192, 64');
          ctx.restore();
        }
        ctx.translate(bx, by);
        ctx.rotate(rot);
        drawCaptureBall(
          ctx,
          r,
          popped ? 1 : clamp01((t - 0.35) / 0.1) * (1 - clamp01((t - 0.7) / 0.08)),
          0,
        );
        ctx.restore();
      },
    };
  },
  darklord: (width, height) => ({
    // A lâmina engasga, pisca e se recolhe, deixando só fumaça.
    frame(ctx, f) {
      const x = width / 2;
      const y = height * 0.75;
      const L = Math.min(width, height) * 0.45;
      const length =
        L * (f.time < 0.4 ? easeOut(f.time / 0.15) : Math.max(0, 1 - (f.time - 0.6) / 0.5));
      ctx.save();
      ctx.globalAlpha = f.presence;
      if (length > 0 && !(f.time > 0.4 && Math.random() < 0.35)) {
        ctx.globalCompositeOperation = 'lighter';
        for (const [w, style] of [
          [18, 'rgba(255, 40, 40, 0.4)'],
          [6, 'rgba(255, 225, 225, 1)'],
        ] as const) {
          ctx.strokeStyle = style;
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - length);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(x - 9, y, 18, 70);
      ctx.restore();
      if (f.time > 1 && f.time < 2 && f.emitting && Math.random() < 0.4)
        f.particles.push(
          particle('smoke', x, y, {
            vy: -rand(0.5, 1.2),
            vx: rand(-0.3, 0.3),
            max: 70,
            size: rand(10, 18),
            color: '90, 90, 90',
          }),
        );
    },
  }),
  notebook: (width, height) => {
    // Em vez do caderno, cai uma maçã mordida, quica e sai rolando.
    const apple = { x: width * 0.4, y: -40, vx: 2, vy: 0, rot: 0 };
    return {
      frame(ctx, f) {
        apple.vy += 0.5;
        apple.x += apple.vx;
        apple.y += apple.vy;
        apple.rot += apple.vx * 0.02;
        if (apple.y > height - 50) {
          apple.y = height - 50;
          apple.vy *= -0.45;
          apple.vx = 3;
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(apple.x, apple.y);
        ctx.rotate(apple.rot);
        ctx.fillStyle = '#c4161c';
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.arc(30, -6, 13, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.ellipse(-10, -12, 6, 10, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(3, -40);
        ctx.stroke();
        ctx.fillStyle = '#4f9a2c';
        ctx.beginPath();
        ctx.ellipse(12, -38, 10, 5, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    };
  },
  orbs: (width, height) => {
    // As sete esferas se juntam... e racham, virando pedra apagada.
    const cx = width / 2;
    const cy = height * 0.25;
    const r = Math.min(width, height) * 0.035;
    const cracks = Array.from({ length: 7 }, () =>
      bolt({ x: -r * 0.8, y: -r * 0.6 }, { x: r * 0.7, y: r * 0.7 }, r * 0.3, 5),
    );
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        for (let i = 0; i < 7; i++) {
          const cracked = f.time > 0.9 + i * 0.12;
          const x = cx + (i - 3) * r * 2.6;
          ctx.save();
          ctx.translate(x, cy + (cracked ? Math.min(30, (f.time - 0.9 - i * 0.12) * 40) : 0));
          drawOrb(ctx, r, i + 1, cracked ? 1 : 0);
          if (cracked) {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            cracks[i]!.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },
  haki: (width, height, _durationMs, text) => {
    // O haki sai fraquinho: a tela escurece de leve, o anel de pressão nem chega a abrir e murcha,
    // três raiozinhos pretos estalam, o texto sua frio... e só uma mosca desmaia.
    let fired = false;
    return {
      frame(ctx, f) {
        if (!fired && f.time > 0.3) {
          fired = true;
          for (let k = 0; k < 3; k++) {
            const a = rand(0, Math.PI * 2);
            f.particles.push(
              particle('bolt', 0, 0, {
                path: bolt(
                  { x: text.x, y: text.y },
                  { x: text.x + Math.cos(a) * 90, y: text.y + Math.sin(a) * 60 },
                  10,
                  5,
                ),
                max: 10,
                size: 2,
                color: 'haki',
              }),
            );
          }
          f.particles.push(
            particle('fly', text.x + 120, text.y - 160, {
              gravity: 0.3,
              vr: 0.3,
              max: 140,
              size: 6,
            }),
          );
          for (let k = 0; k < 4; k++)
            f.particles.push(
              particle('drop', text.x + rand(-120, 120), text.y - 40, {
                vy: 0.5,
                gravity: 0.15,
                max: 50,
                size: 4,
                color: '150, 200, 255',
              }),
            );
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        const dim = Math.max(0, 1 - Math.abs(f.time - 0.5) / 0.4);
        ctx.fillStyle = `rgba(20, 0, 6, ${0.35 * dim})`;
        ctx.fillRect(0, 0, width, height);
        const age = f.time - 0.3;
        if (age > 0 && age < 0.8) {
          const r = 40 + Math.sin((age / 0.8) * Math.PI) * 90;
          ctx.strokeStyle = `rgba(10, 0, 4, ${0.8 * (1 - age / 0.8)})`;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(text.x, text.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255, 40, 60, ${0.6 * (1 - age / 0.8)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
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
  sakura: (_width, _height, _durationMs, text) => ({
    // Uma única pétala cai devagar... e pousa no texto, que espirra.
    frame(ctx, f) {
      const y = Math.min(text.y - 30, -40 + f.time * 120);
      const x = text.x + Math.sin(f.time * 3) * 40;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.translate(x, y);
      ctx.rotate(f.time * 2);
      ctx.fillStyle = '#ffc4da';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(9, -2, 0, 10);
      ctx.quadraticCurveTo(-9, -2, 0, -10);
      ctx.fill();
      ctx.restore();
    },
  }),
  phoenix: (_width, _height, _durationMs, text) => {
    // A fênix tenta renascer, sai uma galinha chamuscada tossindo fumaça.
    let done = false;
    return {
      frame(ctx, f) {
        if (!done && f.time > 0.6) {
          done = true;
          for (let k = 0; k < 8; k++)
            f.particles.push(
              particle('smoke', text.x, text.y - 60, {
                vx: rand(-1, 1),
                vy: -rand(0.5, 1.5),
                max: 60,
                size: rand(14, 26),
                color: '60, 60, 60',
              }),
            );
        }
        if (f.time < 0.6) return;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(text.x, text.y - 90 + Math.abs(Math.sin(f.time * 8)) * -6);
        ctx.fillStyle = '#3a2a22';
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(18, -18, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8a020';
        ctx.beginPath();
        ctx.moveTo(27, -18);
        ctx.lineTo(37, -15);
        ctx.lineTo(27, -12);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(20, -20, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    };
  },
  kitsune: (_width, _height, _durationMs, text) => ({
    // Em vez da raposa de nove caudas, aparece um filhote com uma cauda só, que boceja.
    frame(ctx, f) {
      const show = easeOut((f.time - 0.3) / 0.4);
      if (show <= 0) return;
      ctx.save();
      ctx.globalAlpha = f.presence * show;
      ctx.translate(text.x, text.y - 100);
      ctx.fillStyle = '#e8873a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-14, -12);
      ctx.lineTo(-18, -30);
      ctx.lineTo(-4, -16);
      ctx.moveTo(14, -12);
      ctx.lineTo(18, -30);
      ctx.lineTo(4, -16);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(34, 6 + Math.sin(f.time * 4) * 4, 16, 8, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      const yawn = f.time > 1.2 ? Math.abs(Math.sin((f.time - 1.2) * 2)) * 6 : 1;
      ctx.beginPath();
      ctx.ellipse(0, 6, 4, yawn, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  }),
  mirror: (_width, _height, _durationMs, text) => ({
    // O espelho racha... só um cantinho, com um "tic" triste.
    frame(ctx, f) {
      const run = clamp01((f.time - 0.4) / 0.3);
      if (run <= 0) return;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(text.x + 140, text.y - 40);
      ctx.lineTo(text.x + 140 - 20 * run, text.y - 40 + 14 * run);
      ctx.lineTo(text.x + 140 - 32 * run, text.y - 40 + 10 * run);
      ctx.stroke();
      ctx.restore();
    },
  }),
  aurora: (width, _height, _durationMs, text) => ({
    // A aurora tenta acender, pisca e apaga como uma lâmpada queimada.
    frame(ctx, f) {
      const flicker = f.time < 1.4 && Math.sin(f.time * 40) > 0.3 ? 0.25 : 0;
      if (!flicker) return;
      ctx.save();
      ctx.globalAlpha = f.presence * flicker;
      const g = ctx.createLinearGradient(0, text.y - 260, 0, text.y - 120);
      g.addColorStop(0, 'rgba(80, 255, 160, 0)');
      g.addColorStop(0.5, 'rgba(80, 255, 160, 1)');
      g.addColorStop(1, 'rgba(80, 255, 160, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, text.y - 260, width, 140);
      ctx.restore();
    },
  }),
  zombie: (_width, _height, _durationMs, text) => ({
    // Uma mão sai da terra, acena... e cai um dedo.
    frame(ctx, f) {
      const up = easeOut((f.time - 0.2) / 0.5) * 60;
      if (up <= 0) return;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.translate(text.x - 120, text.y + 60);
      ctx.fillStyle = '#6f8a5a';
      ctx.fillRect(-8, -up, 16, up);
      ctx.beginPath();
      ctx.ellipse(0, -up - 8, 12, 10, Math.sin(f.time * 6) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      const drop = Math.max(0, f.time - 1.2);
      ctx.fillRect(10, -up - 22 + drop * drop * 300, 5, 14);
      ctx.restore();
    },
  }),
  sungod: (width, _height, _durationMs, text) => ({
    // Um soberano misterioso aparece num trono vazio, com olhos brilhando no escuro.
    frame(ctx, f) {
      const show = easeOut((f.time - 0.3) / 0.6);
      if (show <= 0) return;
      const x = width / 2;
      const y = text.y - 60;
      ctx.save();
      ctx.globalAlpha = f.presence * show;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, width, text.y + 400);
      ctx.fillStyle = '#0a0a10';
      ctx.beginPath();
      ctx.moveTo(x - 90, y);
      ctx.lineTo(x - 90, y - 230);
      ctx.lineTo(x, y - 290);
      ctx.lineTo(x + 90, y - 230);
      ctx.lineTo(x + 90, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#16161e';
      ctx.beginPath();
      ctx.ellipse(x, y - 150, 34, 46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 55, y);
      ctx.quadraticCurveTo(x - 50, y - 120, x, y - 110);
      ctx.quadraticCurveTo(x + 50, y - 120, x + 55, y);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (const side of [-1, 1])
        blit(ctx, glowSprite('255, 255, 255'), x + side * 12, y - 155, 6, 1);
      ctx.restore();
    },
  }),
  tarrasque: (width, height) => ({
    // O monstro... está dormindo. Ronca.
    frame(ctx, f) {
      const x = width * 0.7;
      const y = height - 20;
      const breathe = 1 + Math.sin(f.time * 2.5) * 0.04;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.fillStyle = '#2b1d14';
      ctx.beginPath();
      ctx.ellipse(x, y, 160, 70 * breathe, 0, Math.PI, 0);
      ctx.fill();
      for (let k = 0; k < 7; k++) {
        const sx = x - 120 + k * 40;
        ctx.beginPath();
        ctx.moveTo(sx - 12, y - 50 * breathe);
        ctx.lineTo(sx, y - 90 * breathe);
        ctx.lineTo(sx + 12, y - 50 * breathe);
        ctx.fill();
      }
      ctx.restore();
      if (f.emitting && Math.random() < 0.04)
        f.particles.push(
          particle('rune', x - 150, y - 80, {
            vx: -0.6,
            vy: -1.2,
            max: 80,
            size: rand(22, 32),
            glyph: pick(['z', 'Z']),
            color: '220, 220, 230',
          }),
        );
    },
  }),
  sans: (width, height) => ({
    // Caixa de diálogo de jogo antigo: "* Mas nada aconteceu." letra por letra.
    frame(ctx, f) {
      const msg = '* Mas nada aconteceu.';
      const shown = msg.slice(0, Math.floor(clamp01((f.time - 0.4) / 1.1) * msg.length));
      const w = Math.min(width * 0.7, 700);
      const x = (width - w) / 2;
      const y = height * 0.72;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, w, 110);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.strokeRect(x, y, w, 110);
      ctx.fillStyle = '#fff';
      ctx.font = '28px ui-monospace, Consolas, monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(shown, x + 28, y + 55);
      ctx.restore();
    },
  }),
  hollow: (width, _height, _durationMs, text) => ({
    // Três máscaras brancas; a última trinca e se desfaz.
    frame(ctx, f) {
      ctx.save();
      ctx.globalAlpha = f.presence;
      for (let i = 0; i < 3; i++) {
        const broken = i === 2 && f.time > 0.9;
        const x = width / 2 + (i - 1) * 70;
        const y = text.y - 170 + (broken ? (f.time - 0.9) ** 2 * 600 : 0);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(broken ? (f.time - 0.9) * 3 : 0);
        ctx.fillStyle = broken ? 'rgba(240, 240, 250, 0.6)' : '#f4f4fa';
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a0c14';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * 9, -2, 6, 10, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (broken) {
          ctx.strokeStyle = '#0a0c14';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-10, -28);
          ctx.lineTo(2, -4);
          ctx.lineTo(-4, 10);
          ctx.lineTo(8, 28);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    },
  }),
  doom: (width, _height, _durationMs, text) => {
    // O feitiço verde soluça e uma placa da armadura despenca.
    const plate = { y: text.y - 250, vy: 0, rot: 0 };
    return {
      frame(ctx, f) {
        if (f.time > 0.9) {
          plate.vy += 0.6;
          plate.y += plate.vy;
          plate.rot += 0.05;
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        if (f.time < 0.8 && Math.random() < 0.5) {
          ctx.globalCompositeOperation = 'lighter';
          blit(ctx, glowSprite('84, 227, 111'), text.x + rand(-40, 40), text.y - 90, 14, 1);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.translate(width / 2 + 120, plate.y);
        ctx.rotate(plate.rot);
        ctx.fillStyle = '#4a5058';
        ctx.fillRect(-60, -30, 120, 60);
        ctx.fillStyle = '#9aa0a8';
        for (const [x, y] of [
          [-48, -18],
          [48, -18],
          [-48, 18],
          [48, 18],
        ] as const) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    };
  },
  zoro: (width, _height, _durationMs, text) => ({
    // Perdido de novo: uma bússola com o ponteiro rodando sem rumo e interrogações por todo lado.
    frame(ctx, f) {
      const x = width / 2;
      const y = text.y - 170;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.fillStyle = '#efe6cf';
      ctx.strokeStyle = '#7a5a28';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const a = f.time * 9 + Math.sin(f.time * 13) * 2;
      ctx.fillStyle = '#d4183a';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 48, y + Math.sin(a) * 48);
      ctx.lineTo(x + Math.cos(a + 1.6) * 8, y + Math.sin(a + 1.6) * 8);
      ctx.lineTo(x + Math.cos(a - 1.6) * 8, y + Math.sin(a - 1.6) * 8);
      ctx.fill();
      ctx.restore();
      if (f.emitting && Math.random() < 0.08)
        f.particles.push(
          particle('rune', x + rand(-200, 200), y + rand(-60, 60), {
            vy: -1,
            max: 50,
            size: rand(24, 36),
            glyph: '?',
            color: '120, 255, 170',
          }),
        );
    },
  }),
  blackhole: (_width, _height, _durationMs, text) => ({
    // Um buraquinho negro do tamanho de uma ervilha engole uma estrelinha e some ("plop").
    frame(ctx, f) {
      const x = text.x;
      const y = text.y - 150;
      const r = 10 * clamp01(f.time / 0.4) * (1 - clamp01((f.time - 0.8) / 0.1));
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.fillStyle = '#000';
      ctx.strokeStyle = 'rgba(255, 200, 140, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const s = clamp01((f.time - 0.3) / 0.5);
      if (s < 1) {
        ctx.globalCompositeOperation = 'lighter';
        blit(ctx, glowSprite('255, 255, 255'), x + 60 * (1 - s), y - 30 * (1 - s), 5, 1);
      }
      ctx.restore();
    },
  }),
  fullmetal: (width, height, _durationMs, text) => ({
    // Rebote: o círculo fica vermelho e escuro e mãos de sombra puxam o texto para baixo.
    frame(ctx, f) {
      const cx = width / 2;
      const cy = height * 0.82;
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.strokeStyle = `rgba(200, 30, 40, ${0.8 * clamp01(f.time / 0.3)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 200, 44, 0, 0, Math.PI * 2);
      ctx.stroke();
      const reach = easeOut((f.time - 0.6) / 0.6);
      ctx.strokeStyle = '#050205';
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const bx = cx - 150 + i * 60;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(bx, cy);
        ctx.quadraticCurveTo(
          bx + Math.sin(f.time * 4 + i) * 30,
          cy - 120 * reach,
          text.x + (i - 2.5) * 30,
          cy - (cy - text.y) * reach,
        );
        ctx.stroke();
      }
      ctx.restore();
      if (f.time > 1.2) text.falling = true;
    },
  }),
  sahur: (width, _height, _durationMs, text) => {
    // O taco desce, faz "tunc"... e racha ao meio, as farpas caindo.
    let broke = false;
    return {
      frame(ctx, f) {
        const x = width / 2 + 120;
        const swing = clamp01((f.time - 0.3) / 0.2);
        if (!broke && f.time > 0.5) {
          broke = true;
          for (let k = 0; k < 10; k++)
            f.particles.push(
              particle('rock', x - 60, text.y - 80, {
                vx: rand(-3, 3),
                vy: rand(-4, 0),
                gravity: 0.3,
                vr: 0.3,
                max: 70,
                size: rand(2, 4),
              }),
            );
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(x, text.y - 260);
        ctx.rotate(-1.1 + swing * 1.1);
        ctx.fillStyle = '#9a6a30';
        ctx.fillRect(-10, 0, 20, broke ? 120 : 220);
        if (broke) {
          ctx.save();
          ctx.translate(0, 130 + (f.time - 0.5) ** 2 * 500);
          ctx.rotate((f.time - 0.5) * 3);
          ctx.fillRect(-12, 0, 24, 100);
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },
  spider: (width, _height, _durationMs, text) => ({
    // A teia sai meleca, gruda torta na tela, e uma aranhinha desce pelo fio.
    frame(ctx, f) {
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.strokeStyle = 'rgba(240, 240, 250, 0.7)';
      ctx.lineWidth = 2;
      const k = clamp01((f.time - 0.3) / 0.3);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(text.x - 60, text.y - 120);
        ctx.lineTo(text.x - 60 + Math.cos(i) * 80 * k, text.y - 120 + Math.sin(i * 1.7) * 60 * k);
        ctx.stroke();
      }
      const drop = Math.min(160, f.time * 90);
      const x = width * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, drop + 40);
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x, drop + 48, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      for (let l = 0; l < 4; l++)
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x, drop + 48);
          ctx.lineTo(x + side * 16, drop + 40 + l * 6 + Math.sin(f.time * 10 + l) * 2);
          ctx.stroke();
        }
      ctx.restore();
    },
  }),
  akatsuki: (width, _height, _durationMs, text) => ({
    // Uma nuvem só, que desbota para cinza, e um corvo que passa e derruba uma pena.
    frame(ctx, f) {
      ctx.save();
      ctx.globalAlpha = f.presence;
      const gray = clamp01((f.time - 0.6) / 0.8);
      drawCloud(ctx, text.x, text.y - 170, 64, '#fff');
      drawCloud(
        ctx,
        text.x,
        text.y - 170,
        59,
        `rgb(${Math.round(196 - gray * 70)}, ${Math.round(22 + gray * 104)}, ${Math.round(28 + gray * 98)})`,
      );
      const cx = -40 + f.time * 260;
      ctx.strokeStyle = '#050304';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 14, text.y - 260 - Math.sin(f.time * 16) * 7);
      ctx.quadraticCurveTo(cx - 5, text.y - 263, cx, text.y - 260);
      ctx.quadraticCurveTo(cx + 5, text.y - 263, cx + 14, text.y - 260 - Math.sin(f.time * 16) * 7);
      ctx.stroke();
      ctx.restore();
      if (f.time > 0.9 && f.time < 0.95)
        f.particles.push(
          particle('feather', width * 0.5, text.y - 250, { vy: 0.7, max: 200, size: 14 }),
        );
    },
  }),
  hisoka: (_width, _height, _durationMs, text) => {
    // Uma carta cai rodando e o chiclete rosa gruda no texto (que fica rosa e despenca).
    let stuck = false;
    return {
      frame(ctx, f) {
        const y = -40 + f.time * 260;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.translate(text.x + 140, y);
        ctx.rotate(f.time * 4);
        ctx.fillStyle = '#fbfbf6';
        ctx.fillRect(-20, -28, 40, 56);
        ctx.fillStyle = '#d4183a';
        ctx.font = 'bold 24px "Segoe UI Symbol", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', 0, 0);
        ctx.restore();
        if (!stuck && f.time > 0.8) {
          stuck = true;
          text.tint = '255, 120, 190';
        }
      },
    };
  },
  valorant: (_width, _height, _durationMs, text) => {
    // A rajada erra tudo: furos de bala em volta do texto e a mira tremendo.
    const holes = Array.from({ length: 8 }, (_, i) => ({
      x: text.x + rand(-260, 260),
      y: text.y + rand(-160, 120),
      at: 0.3 + i * 0.09,
    }));
    return {
      frame(ctx, f) {
        ctx.save();
        ctx.globalAlpha = f.presence;
        for (const h of holes) {
          if (f.time < h.at) continue;
          ctx.fillStyle = '#0c0c10';
          ctx.beginPath();
          ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(200, 200, 210, 0.6)';
          ctx.lineWidth = 1.5;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + h.x;
            ctx.beginPath();
            ctx.moveTo(h.x + Math.cos(a) * 7, h.y + Math.sin(a) * 7);
            ctx.lineTo(h.x + Math.cos(a) * 18, h.y + Math.sin(a) * 18);
            ctx.stroke();
          }
        }
        const jx = text.x + Math.sin(f.time * 30) * 30;
        const jy = text.y - 150 + Math.cos(f.time * 23) * 20;
        ctx.strokeStyle = 'rgba(120, 255, 200, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(jx - 20, jy);
        ctx.lineTo(jx + 20, jy);
        ctx.moveTo(jx, jy - 20);
        ctx.lineTo(jx, jy + 20);
        ctx.stroke();
        ctx.restore();
      },
    };
  },
  league: (_width, _height, _durationMs, text) => {
    // Derrota: o cristal azul trinca e se parte, e tudo fica cinza.
    let shattered = false;
    return {
      frame(ctx, f) {
        const x = text.x;
        const y = text.y - 170;
        if (!shattered && f.time > 1.3) {
          shattered = true;
          for (let k = 0; k < 20; k++)
            f.particles.push(
              particle('shard', x, y, {
                vx: rand(-5, 5),
                vy: rand(-5, 1),
                gravity: 0.3,
                vr: 0.2,
                max: 80,
                size: rand(8, 18),
              }),
            );
        }
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.fillStyle = `rgba(40, 40, 46, ${0.4 * clamp01(f.time / 1.2)})`;
        ctx.fillRect(0, 0, x * 2, y + 600);
        if (!shattered) {
          ctx.fillStyle = '#5ab8ff';
          ctx.strokeStyle = '#1a4a7a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, y - 60);
          ctx.lineTo(x + 34, y);
          ctx.lineTo(x, y + 60);
          ctx.lineTo(x - 34, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (f.time > 0.8) {
            ctx.strokeStyle = '#0a1a2a';
            ctx.beginPath();
            ctx.moveTo(x - 10, y - 40);
            ctx.lineTo(x + 6, y - 5);
            ctx.lineTo(x - 8, y + 20);
            ctx.lineTo(x + 4, y + 50);
            ctx.stroke();
          }
        }
        ctx.restore();
      },
    };
  },
  mario: (width, height, _durationMs, text) => ({
    // Um buraco se abre no chão e o texto despenca nele.
    frame(ctx, f) {
      const open = easeOut((f.time - 0.3) / 0.3);
      ctx.save();
      ctx.globalAlpha = f.presence;
      ctx.fillStyle = '#b06a2a';
      ctx.fillRect(0, height - 60, width / 2 - 120 * open, 60);
      ctx.fillRect(width / 2 + 120 * open, height - 60, width / 2, 60);
      ctx.fillStyle = '#000';
      ctx.fillRect(width / 2 - 120 * open, height - 60, 240 * open, 60);
      ctx.restore();
      if (f.time > 0.7) text.falling = true;
    },
  }),
};

/** Falha crítica (1 natural) com aura: a versão fracassada do efeito, para todos da mesa. */
export function criticalFailBurst(
  aura: DiceAura,
  options: { durationMs?: number; sound?: boolean } = {},
): void {
  if (reducedMotion()) return;
  const durationMs = options.durationMs ?? 3200;
  if (options.sound !== false) playFailSound(aura);
  const canvas = overlay(null);
  shakeTargets.add(canvas);
  window.setTimeout(() => shakeTargets.delete(canvas), durationMs + 5000);
  const ctx = canvas.getContext('2d');
  const particles: Particle[] = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  const home = { x: width / 2, y: height * 0.42 };
  const text: FailText = {
    ...home,
    vx: 0,
    vy: 0,
    rot: 0,
    vr: 0,
    falling: false,
    tint: null,
    scale: 1,
  };
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
      ctx.scale(pop * text.scale, pop * text.scale);
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
