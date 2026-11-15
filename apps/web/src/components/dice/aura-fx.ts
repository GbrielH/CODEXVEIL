/**
 * Efeitos das auras dos dados, desenhados num canvas 2D por cima da cena:
 *   * em volta do dado, uma aura "emanando" da borda (como chakra) no elemento escolhido, com
 *     detalhes do tema (raios, jatos de sangue, flocos, runas girando, fumaça, luz, engrenagens,
 *     folhas, chamas, escamas), acompanhando o dado na tela;
 *   * no crítico, o tema toma a tela inteira por alguns segundos, com "CRÍTICO!" no centro e som.
 * Respeita "movimento reduzido": nesse caso não desenha nada (o som também não toca).
 */
import { diceAuraLabels, type DiceAura } from '@codexveil/validation';
import { playCriticalSound } from './aura-sound';

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
  | 'fly';

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
      p.kind === 'fly';
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
        color: aura === 'blood' ? '150, 0, 20' : color,
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
  const mask = 'radial-gradient(ellipse at center, transparent 30%, black 80%)';
  Object.assign(element.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '119',
    pointerEvents: 'none',
    backdropFilter: 'blur(5px) saturate(0.4) brightness(1.15)',
    background:
      'radial-gradient(ellipse at center, transparent 35%, rgba(190, 230, 255, 0.35) 75%, rgba(235, 248, 255, 0.6) 100%)',
    maskImage: mask,
    WebkitMaskImage: mask,
  });
  document.body.appendChild(element);
  element.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
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
  if (options.text !== false && aura !== 'frog')
    criticalText(aura, durationMs - 400, TEXT_TOP[aura] ?? '50%');
  if (options.sound !== false) playCriticalSound(aura);
  if (aura === 'frost') frozenGlass(durationMs);
  const canvas = overlay(null);
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
      ? grow(edgeSeeds(width, height, 34, ['top', 'bottom', 'left', 'right']), {
          length: 26,
          depth: 9,
          spread: 0.75,
          speed: 260,
          jitter: 0.35,
          max: 2600,
        })
      : [];
  const vineSegments =
    aura === 'forest'
      ? grow(edgeSeeds(width, height, 14, ['bottom', 'left', 'right']), {
          length: 34,
          depth: 10,
          spread: 0.9,
          speed: 220,
          jitter: 0.5,
          max: 1400,
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
  const vines = vineSegments.length
    ? growthLayer(width, height, vineSegments, (layer, segment, index) => {
        layer.lineCap = 'round';
        layer.strokeStyle = 'rgba(60, 120, 40, 0.95)';
        layer.lineWidth = segment.w * 2.2;
        layer.beginPath();
        layer.moveTo(segment.x1, segment.y1);
        layer.lineTo(segment.x2, segment.y2);
        layer.stroke();
        if (index % 3 === 0) {
          // Folha na ponta do cipó.
          layer.save();
          layer.fillStyle = 'rgba(100, 180, 60, 0.95)';
          layer.translate(segment.x2, segment.y2);
          layer.rotate(index);
          layer.beginPath();
          layer.ellipse(6, 0, 7, 3.5, 0, 0, Math.PI * 2);
          layer.fill();
          layer.restore();
        }
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
  const bigGears =
    aura === 'gears'
      ? [
          { x: 0, y: 0, r: 170, dir: 1 },
          { x: 215, y: 120, r: 80, dir: -2.1 },
          { x: width, y: height, r: 200, dir: -1 },
          { x: width - 250, y: height - 110, r: 90, dir: 2.2 },
          { x: width, y: 0, r: 120, dir: 1.3 },
          { x: 0, y: height, r: 130, dir: -1.2 },
        ].map((g) => ({
          ...g,
          image: sprite(`big-gear:${g.r}`, g.r * 2 + 40, (layer, size) => {
            layer.translate(size / 2, size / 2);
            gearPath(layer, g.r, Math.round(g.r / 9));
            layer.fillStyle = 'rgba(150, 105, 50, 0.92)';
            layer.strokeStyle = 'rgba(255, 200, 110, 0.8)';
            layer.shadowColor = 'rgba(255, 170, 60, 0.8)';
            layer.shadowBlur = 16;
            layer.lineWidth = 3;
            layer.fill('evenodd');
            layer.stroke();
          }),
        }))
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
        case 'shadow':
          for (let i = 0; i < 2; i++) {
            const seed = pick(edgeSeeds(width, height, 1, ['top', 'bottom', 'left', 'right']));
            particles.push(
              particle('smoke', seed.x, seed.y, {
                vx: (width / 2 - seed.x) * 0.004,
                vy: (height / 2 - seed.y) * 0.004,
                max: 160,
                size: rand(50, 100),
                color,
              }),
            );
          }
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
        case 'gears':
          if (Math.random() < 0.25)
            particles.push(
              particle('gear', rand(0, width), -40, {
                vy: rand(3, 6),
                vr: rand(-0.1, 0.1),
                gravity: 0.08,
                max: 240,
                size: rand(12, 30),
                color: pick(['205, 150, 60', '170, 120, 70', '190, 190, 200']),
              }),
            );
          for (const g of bigGears.slice(0, 4)) {
            if (Math.random() < 0.5) continue;
            const a = rand(0, Math.PI * 2);
            particles.push(
              particle('spark', g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r, {
                vx: rand(-4, 4),
                vy: rand(-6, -1),
                gravity: 0.3,
                max: 50,
                size: rand(1, 2),
                color: '255, 190, 80',
              }),
            );
          }
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
    if (vines) {
      vines.advance(time);
      ctx.globalAlpha = presence;
      ctx.drawImage(vines.canvas, 0, 0, width, height);
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
    for (const g of bigGears) {
      ctx.save();
      ctx.globalAlpha = presence;
      ctx.translate(g.x, g.y);
      ctx.rotate(time * 0.9 * g.dir);
      ctx.drawImage(g.image, -g.image.width / 2, -g.image.height / 2);
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
function pageJolt(filter: string, ms: number) {
  const root = document.documentElement;
  const previous = root.style.filter;
  root.style.filter = filter;
  window.setTimeout(() => {
    root.style.filter = previous;
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

const SCENES: Partial<
  Record<DiceAura, (width: number, height: number, durationMs: number) => Scene>
> = {
  cosmic: (width, height, durationMs) => {
    // A tela racha e um olho gigante abre, olha em volta e pisca.
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
        blit(ctx, softSprite('110, 70, 255'), cx, cy, eyeW * 1.5, 0.55 * f.presence);
        // Rachaduras saindo dos cantos do olho.
        const grow = clamp01(f.time / 0.45);
        ctx.globalAlpha = f.presence;
        ctx.lineJoin = 'round';
        for (const crack of cracks) {
          const count = Math.max(2, Math.round(crack.length * grow));
          for (const [width, style] of [
            [7, 'rgba(140, 100, 255, 0.35)'],
            [2, 'rgba(235, 225, 255, 1)'],
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
        sclera.addColorStop(0, '#f4eeff');
        sclera.addColorStop(1, '#6b4fb8');
        ctx.fillStyle = sclera;
        ctx.fillRect(-eyeW, -eyeH * 2, eyeW * 2, eyeH * 4);
        const look = {
          x: Math.sin(f.time * 1.3) * eyeW * 0.35,
          y: Math.sin(f.time * 2.1) * eyeH * 0.2,
        };
        const iris = eyeW * 0.3;
        const irisFill = ctx.createRadialGradient(look.x, look.y, 0, look.x, look.y, iris);
        irisFill.addColorStop(0, '#fff0ff');
        irisFill.addColorStop(0.35, '#9a7cff');
        irisFill.addColorStop(0.8, '#2b1478');
        irisFill.addColorStop(1, '#0a0028');
        ctx.fillStyle = irisFill;
        ctx.beginPath();
        ctx.arc(look.x, look.y, iris, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(
          look.x,
          look.y,
          iris * 0.22 * (1 + 0.3 * Math.sin(f.time * 3)),
          iris * 0.8,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(look.x - iris * 0.35, look.y - iris * 0.35, iris * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        almond();
        ctx.strokeStyle = 'rgba(200, 180, 255, 0.95)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(140, 100, 255, 1)';
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
    const faces = [
      { symbol: '☾', title: 'A LUA', numeral: 'XVIII' },
      { symbol: '✦', title: 'O CRÍTICO', numeral: 'XX' },
      { symbol: '☀', title: 'O SOL', numeral: 'XIX' },
    ].map(cardFaceSprite);
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
    const radius = Math.min(width, height) * 0.3;
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
            const thickness = radius * 0.17 * (1 - 0.75 * progress) * rand(0.85, 1.15);
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
        ctx.globalAlpha = f.presence;
        ctx.drawImage(layer, 0, 0, width, height);
        ctx.globalAlpha = 1;
      },
    };
  },
  abyss: (width, height, durationMs) => {
    // A tela enche de água; um tentáculo passa; bolhas e peixes luminosos.
    const water = document.createElement('canvas');
    water.width = 4;
    water.height = 256;
    const wctx = water.getContext('2d');
    if (wctx) {
      const g = wctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(40, 140, 200, 0.45)');
      g.addColorStop(1, 'rgba(5, 20, 60, 0.78)');
      wctx.fillStyle = g;
      wctx.fillRect(0, 0, 4, 256);
    }
    return {
      frame(ctx, f) {
        const end = durationMs / 1000;
        const fill = easeOut(f.time / 0.9) * clamp01((end - f.time) / 0.8);
        const level = height - fill * height * 0.88;
        if (f.emitting && f.particles.length < MAX_PARTICLES) {
          for (let i = 0; i < 3; i++)
            f.particles.push(
              particle('bubble', rand(0, width), height + 10, {
                vy: -rand(2, 4),
                max: 160,
                size: rand(3, 9),
                color: '200, 240, 255',
              }),
            );
          if (Math.random() < 0.05)
            f.particles.push(
              particle('fish', -30, rand(level + 40, height - 20), {
                vx: rand(3, 5),
                vy: rand(-0.3, 0.3),
                max: 300,
                size: rand(10, 16),
                color: pick(['120, 255, 230', '90, 200, 255', '255, 140, 220']),
              }),
            );
        }
        // Tentáculo subindo e voltando (por baixo da água).
        const reach = Math.sin(Math.PI * clamp01((f.time - 0.8) / 1.9));
        if (reach > 0) {
          ctx.save();
          ctx.globalAlpha = f.presence;
          for (let i = 0; i <= 28; i++) {
            const u = i / 28;
            const x = width * 0.85 - u * width * 0.5 + Math.sin(u * 5 + f.time * 3) * 60 * u;
            const y = height + 40 - u * height * 0.75 * reach;
            const r = 46 * (1 - u) + 6;
            ctx.fillStyle = '#5a1f4a';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            if (i % 3 === 0) {
              ctx.fillStyle = '#e8a6c8';
              ctx.beginPath();
              ctx.arc(x - r * 0.55, y, r * 0.28, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
        if (fill <= 0) return;
        ctx.save();
        ctx.globalAlpha = f.presence;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width + 24; x += 24)
          ctx.lineTo(x, level + Math.sin(x * 0.02 + f.time * 3) * 8);
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
      },
    };
  },
};

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
