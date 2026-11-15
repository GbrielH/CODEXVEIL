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
  | 'feather';

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
    ctx.font = `${size * 0.55}px "Segoe UI Symbol", "Noto Sans Runic", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `rgba(${rgb}, 1)`;
    ctx.shadowBlur = size * 0.18;
    ctx.fillStyle = 'rgba(235, 215, 255, 1)';
    ctx.fillText(glyph, size / 2, size / 2);
    ctx.fillText(glyph, size / 2, size / 2);
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
};

/** Auras escuras (desenhadas por cima, sem somar luz). */
const DARK: ReadonlySet<DiceAura> = new Set(['shadow', 'blood']);

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
    if (p.life >= p.max || p.y > height + 80) particles.splice(i, 1);
  }
  for (const p of particles) {
    const dark =
      p.kind === 'smoke' ||
      p.kind === 'drop' ||
      p.kind === 'splat' ||
      p.kind === 'gear' ||
      p.kind === 'leaf' ||
      p.kind === 'feather';
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
      particle(DARK.has(aura) && aura === 'shadow' ? 'smoke' : 'wisp', from.x, from.y, {
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
  if (aura === 'shadow') {
    g.addColorStop(0, `rgba(10, 4, 18, ${0.55 * power})`);
    g.addColorStop(1, 'rgba(10, 4, 18, 0)');
  } else {
    ctx.globalCompositeOperation = 'lighter';
    g.addColorStop(0, `rgba(${color}, ${0.35 * power * flicker})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(o.x - o.r * 2, o.y - o.r * 2, o.r * 4, o.r * 4);
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
      const strength = Math.max(0, Math.min(1, power()));
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
function criticalText(aura: DiceAura, durationMs: number) {
  const color = diceAuraLabels[aura].color;
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.textContent = 'Crítico!';
  const font = getComputedStyle(document.body).getPropertyValue('--font-display').trim();
  Object.assign(element.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
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
  document.body.appendChild(element);
  const shake = aura === 'storm' || aura === 'blood';
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
  if (options.text !== false) criticalText(aura, durationMs - 400);
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
      aura === 'shadow'
        ? `rgba(6, 2, 12, ${0.8 * presence})`
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
    for (const g of bigGears) {
      ctx.save();
      ctx.globalAlpha = presence;
      ctx.translate(g.x, g.y);
      ctx.rotate(time * 0.9 * g.dir);
      ctx.drawImage(g.image, -g.image.width / 2, -g.image.height / 2);
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
