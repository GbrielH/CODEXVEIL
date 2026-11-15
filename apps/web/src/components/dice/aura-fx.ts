/**
 * Efeitos das auras dos dados (contas de criador), desenhados num canvas 2D por cima da cena:
 *   * enquanto o dado rola, partículas saem dele (raios, gotas, cristais, faíscas, fumaça, luz),
 *     acompanhando a posição do dado na tela;
 *   * no crítico, um efeito na tela inteira por alguns segundos (chuva de raios, de sangue…).
 * Respeita "movimento reduzido": nesse caso não desenha nada.
 */
import type { DiceAura } from '@codexveil/validation';

type Point = { x: number; y: number };

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue?: number;
  /** Raio: lista de pontos do zigue-zague. */
  path?: Point[];
}

const COLORS: Record<DiceAura, string> = {
  blood: '214, 40, 60',
  storm: '140, 220, 255',
  frost: '200, 240, 255',
  arcane: '176, 108, 255',
  shadow: '30, 18, 46',
  holy: '255, 215, 106',
};

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  if (document.querySelector('[data-motion="reduce"]')) return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
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

/** Cria uma partícula do tema, saindo de `origin` (dado) ou caindo do alto (crítico). */
function spawn(
  aura: DiceAura,
  origin: Point,
  scale: number,
  fromSky: boolean,
  width: number,
  height: number,
): Particle {
  if (fromSky) {
    const x = rand(0, width);
    switch (aura) {
      case 'storm': {
        const to = { x: x + rand(-80, 80), y: rand(height * 0.4, height) };
        return {
          x,
          y: 0,
          vx: 0,
          vy: 0,
          life: 0,
          max: rand(10, 20),
          size: rand(2, 4),
          path: bolt({ x, y: 0 }, to, 30, 10),
        };
      }
      case 'blood':
        return {
          x,
          y: rand(-40, 0),
          vx: rand(-0.3, 0.3),
          vy: rand(9, 15),
          life: 0,
          max: 140,
          size: rand(2, 4),
        };
      case 'frost':
        return {
          x,
          y: rand(-40, 0),
          vx: rand(-1.5, 1.5),
          vy: rand(2, 5),
          life: 0,
          max: 220,
          size: rand(2, 5),
        };
      case 'arcane':
        return {
          x,
          y: rand(-40, 0),
          vx: rand(-0.6, 0.6),
          vy: rand(2.5, 5),
          life: 0,
          max: 200,
          size: rand(2, 4),
          hue: rand(260, 300),
        };
      case 'shadow': {
        const side = Math.floor(rand(0, 4));
        const sx = side === 0 ? 0 : side === 1 ? width : rand(0, width);
        const sy = side === 2 ? 0 : side === 3 ? height : rand(0, height);
        return {
          x: sx,
          y: sy,
          vx: (width / 2 - sx) * 0.004,
          vy: (height / 2 - sy) * 0.004,
          life: 0,
          max: 160,
          size: rand(40, 90),
        };
      }
      case 'holy':
        return { x, y: 0, vx: 0, vy: 0, life: 0, max: rand(40, 70), size: rand(30, 90) };
    }
  }
  const angle = rand(0, Math.PI * 2);
  const speed = rand(0.6, 2.2) * scale;
  switch (aura) {
    case 'storm': {
      const length = rand(18, 42) * scale;
      const to = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
      return {
        x: origin.x,
        y: origin.y,
        vx: 0,
        vy: 0,
        life: 0,
        max: rand(5, 10),
        size: rand(1, 2.2),
        path: bolt(origin, to, 6 * scale, 5),
      };
    }
    case 'blood':
      return {
        x: origin.x + rand(-8, 8),
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: -rand(1, 3) * scale,
        life: 0,
        max: rand(30, 50),
        size: rand(1.5, 3.5) * scale,
      };
    case 'frost':
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max: rand(35, 60),
        size: rand(2, 4) * scale,
      };
    case 'arcane':
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max: rand(40, 70),
        size: rand(1.5, 3) * scale,
        hue: rand(260, 300),
      };
    case 'shadow':
      return {
        x: origin.x + rand(-10, 10),
        y: origin.y,
        vx: rand(-0.4, 0.4),
        vy: -rand(0.5, 1.5) * scale,
        life: 0,
        max: rand(40, 70),
        size: rand(10, 20) * scale,
      };
    case 'holy':
      return {
        x: origin.x + rand(-12, 12),
        y: origin.y,
        vx: rand(-0.3, 0.3),
        vy: -rand(0.8, 2) * scale,
        life: 0,
        max: rand(40, 70),
        size: rand(1.5, 3) * scale,
      };
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  aura: DiceAura,
  p: Particle,
  fromSky: boolean,
  height: number,
) {
  const fade = 1 - p.life / p.max;
  const rgb = COLORS[aura];
  ctx.save();
  if (p.path) {
    // Raio: traço branco com brilho azul, piscando.
    ctx.globalAlpha = Math.random() < 0.25 ? 0.2 : fade;
    ctx.strokeStyle = 'rgba(240, 250, 255, 1)';
    ctx.shadowColor = `rgba(${rgb}, 1)`;
    ctx.shadowBlur = fromSky ? 30 : 12;
    ctx.lineWidth = p.size;
    ctx.beginPath();
    ctx.moveTo(p.path[0]!.x, p.path[0]!.y);
    for (const point of p.path.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  } else if (aura === 'holy' && fromSky) {
    // Feixe de luz descendo.
    const gradient = ctx.createLinearGradient(p.x, 0, p.x, height);
    gradient.addColorStop(0, `rgba(${rgb}, ${0.5 * fade})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(p.x - p.size / 2, 0, p.size, height);
  } else if (aura === 'shadow') {
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    gradient.addColorStop(0, `rgba(10, 6, 18, ${0.7 * fade})`);
    gradient.addColorStop(0.6, `rgba(${rgb}, ${0.35 * fade})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else if (aura === 'blood') {
    ctx.globalAlpha = fade;
    ctx.fillStyle = `rgba(${rgb}, 1)`;
    ctx.beginPath();
    // Gota alongada no sentido da queda.
    ctx.ellipse(p.x, p.y, p.size * 0.7, p.size * (fromSky ? 3 : 1.4), 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (aura === 'frost') {
    ctx.globalAlpha = fade;
    ctx.strokeStyle = `rgba(${rgb}, 1)`;
    ctx.shadowColor = `rgba(${rgb}, 0.9)`;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1;
    // Floco de seis pontas.
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3 + p.life * 0.02;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * p.size, p.y - Math.sin(a) * p.size);
      ctx.lineTo(p.x + Math.cos(a) * p.size, p.y + Math.sin(a) * p.size);
      ctx.stroke();
    }
  } else {
    // Arcana e sagrada: faísca brilhante.
    ctx.globalAlpha = fade;
    const color = aura === 'arcane' ? `hsla(${p.hue ?? 280}, 90%, 70%, 1)` : `rgba(${rgb}, 1)`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
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

/**
 * Partículas saindo dos dados enquanto rolam. `positions` devolve, a cada quadro, onde estão os
 * dados (em pixels, relativos a `host`). Devolve a função que encerra o efeito (com esmaecimento).
 */
export function startDiceAura(
  host: HTMLElement,
  aura: DiceAura,
  positions: () => Point[],
  scale = 1,
): () => void {
  if (reducedMotion()) return () => undefined;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const canvas = overlay(host);
  const ctx = canvas.getContext('2d');
  const particles: Particle[] = [];
  let emitting = true;
  let frame = 0;
  const tick = () => {
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (emitting) {
      const rate = aura === 'storm' ? 2 : 3;
      for (const origin of positions())
        for (let i = 0; i < rate; i++)
          particles.push(spawn(aura, origin, scale, false, width, height));
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.life += 1;
      p.x += p.vx;
      p.y += p.vy;
      if (aura === 'blood') p.vy += 0.12 * scale;
      if (p.life >= p.max) {
        particles.splice(i, 1);
        continue;
      }
      draw(ctx, aura, p, false, height);
    }
    if (emitting || particles.length) frame = requestAnimationFrame(tick);
    else canvas.remove();
  };
  frame = requestAnimationFrame(tick);
  return () => {
    emitting = false;
    // Se a aba estiver em segundo plano, a animação para: garante a limpeza.
    window.setTimeout(() => {
      cancelAnimationFrame(frame);
      canvas.remove();
    }, 4000);
  };
}

/** Crítico: o tema toma a tela inteira por alguns segundos (raios caindo, chuva de sangue…). */
export function criticalAuraBurst(aura: DiceAura, durationMs = 3200): void {
  if (reducedMotion()) return;
  const canvas = overlay(null);
  const ctx = canvas.getContext('2d');
  const particles: Particle[] = [];
  const started = performance.now();
  let flash = 0;
  const tick = (now: number) => {
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const elapsed = now - started;
    const emitting = elapsed < durationMs - 600;
    if (emitting) {
      const rate =
        aura === 'storm'
          ? Math.random() < 0.18
            ? 2
            : 0
          : aura === 'holy'
            ? Math.random() < 0.25
              ? 1
              : 0
            : aura === 'shadow'
              ? 2
              : 6;
      for (let i = 0; i < rate; i++) {
        particles.push(spawn(aura, { x: 0, y: 0 }, 1, true, width, height));
        if (aura === 'storm') flash = 0.35;
      }
    }
    // Clarão do raio e escurecimento da sombra.
    if (flash > 0) {
      ctx.fillStyle = `rgba(200, 235, 255, ${flash})`;
      ctx.fillRect(0, 0, width, height);
      flash = Math.max(0, flash - 0.05);
    }
    if (aura === 'shadow') {
      const strength =
        Math.min(1, elapsed / 800) * (emitting ? 1 : Math.max(0, (durationMs - elapsed) / 600));
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.2,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7,
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, `rgba(8, 4, 16, ${0.75 * strength})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.life += 1;
      p.x += p.vx;
      p.y += p.vy;
      if (p.life >= p.max || p.y > height + 60) {
        particles.splice(i, 1);
        continue;
      }
      draw(ctx, aura, p, true, height);
    }
    if (elapsed < durationMs || particles.length) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
  window.setTimeout(() => canvas.remove(), durationMs + 4000);
}

/** Partes internas da biblioteca 3D usadas para achar os dados na tela. */
interface DiceBoxProjection {
  diceList?: { position?: { clone(): { project(camera: unknown): { x: number; y: number } } } }[];
  camera?: unknown;
  renderer?: { domElement?: HTMLCanvasElement };
}

/** Posições dos dados indicados, em pixels relativos ao elemento da cena 3D. */
export function diceScreenPositions(box: unknown, dice: readonly unknown[]): Point[] {
  const internals = box as DiceBoxProjection;
  const canvas = internals.renderer?.domElement;
  if (!canvas || !internals.camera) return [];
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const out: Point[] = [];
  type Die = NonNullable<DiceBoxProjection['diceList']>[number];
  for (const die of dice as Die[]) {
    const position = die.position;
    if (!position) continue;
    const projected = position.clone().project(internals.camera);
    out.push({ x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height });
  }
  return out;
}
