/**
 * Sons dos críticos com aura, sintetizados na hora pela Web Audio API (sem arquivos de áudio):
 * trovão, jorro e coração batendo, gelo trincando, acorde arcano, sussurro sombrio, coro
 * sagrado, engrenagens, vento na floresta, labareda e rugido de dragão.
 * O navegador só libera áudio depois de algum clique na página; antes disso, fica em silêncio.
 */
import type { DiceAura } from '@codexveil/validation';
import { useCallback, useSyncExternalStore } from 'react';

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/**
 * Momentos (em segundos) que a cena e o som do crítico compartilham: lançamentos dos fogos da
 * Festa, pancadas dos tentáculos do Abissal e patadas do Gato.
 */
export const AURA_TIMINGS = {
  partyLaunches: [0.1, 0.45, 0.8, 1.15, 1.5, 1.85, 2.2],
  fireworkFlight: 0.6,
  krakenSlams: [1.1, 1.65, 2.2],
  catHits: [0.9, 1.5, 2.1],
} as const;

/** Volume geral dos efeitos (0 a 1). */
const VOLUME = 0.55;
/** Silencia os sons dos críticos neste navegador (`localStorage`). */
export const AURA_SOUND_KEY = 'codexveil:som-auras';

export function auraSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(AURA_SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

const SOUND_EVENT = 'codexveil:som-auras';

export function setAuraSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(AURA_SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    // Sem armazenamento local: não há como lembrar a escolha.
  }
  window.dispatchEvent(new Event(SOUND_EVENT));
}

function subscribeSound(callback: () => void) {
  window.addEventListener(SOUND_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(SOUND_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Liga/desliga o som dos críticos neste navegador. */
export function useAuraSound(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribeSound, auraSoundEnabled, () => true);
  return [enabled, useCallback((value: boolean) => setAuraSoundEnabled(value), [])];
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return context;
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

/** Envelope: sobe até `peak` em `attack` s e cai até quase zero em `decay` s. */
function envelope(gain: GainNode, t: number, attack: number, peak: number, decay: number) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

interface Kit {
  ctx: AudioContext;
  out: AudioNode;
  now: number;
}

/** Ruído filtrado (trovão, vento, labareda, chiado). */
function noiseBurst(
  kit: Kit,
  at: number,
  options: {
    type: BiquadFilterType;
    freq: number;
    toFreq?: number;
    q?: number;
    attack: number;
    decay: number;
    peak: number;
    rate?: number;
  },
) {
  const { ctx, out } = kit;
  const t = kit.now + at;
  const source = ctx.createBufferSource();
  source.buffer = whiteNoise(ctx);
  source.loop = true;
  source.playbackRate.value = options.rate ?? 1;
  const filter = ctx.createBiquadFilter();
  filter.type = options.type;
  filter.Q.value = options.q ?? 1;
  filter.frequency.setValueAtTime(options.freq, t);
  if (options.toFreq)
    filter.frequency.exponentialRampToValueAtTime(
      options.toFreq,
      t + options.attack + options.decay,
    );
  const gain = ctx.createGain();
  envelope(gain, t, options.attack, options.peak, options.decay);
  source.connect(filter).connect(gain).connect(out);
  source.start(t);
  source.stop(t + options.attack + options.decay + 0.05);
}

/** Oscilador com envelope (e deslize de frequência opcional). */
function tone(
  kit: Kit,
  at: number,
  options: {
    type: OscillatorType;
    freq: number;
    toFreq?: number;
    attack: number;
    decay: number;
    peak: number;
    filter?: number;
    detune?: number;
  },
) {
  const { ctx, out } = kit;
  const t = kit.now + at;
  const osc = ctx.createOscillator();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.freq, t);
  osc.detune.value = options.detune ?? 0;
  if (options.toFreq)
    osc.frequency.exponentialRampToValueAtTime(options.toFreq, t + options.attack + options.decay);
  const gain = ctx.createGain();
  envelope(gain, t, options.attack, options.peak, options.decay);
  let node: AudioNode = osc;
  if (options.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = options.filter;
    node = osc.connect(filter);
  }
  node.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + options.attack + options.decay + 0.05);
}

/** Nota com vibrato e glissando (`points`: [segundos depois de `at`, frequência]). */
function sung(
  kit: Kit,
  at: number,
  points: [number, number][],
  options: {
    type: OscillatorType;
    peak: number;
    attack: number;
    decay: number;
    vibrato?: number;
    depth?: number;
    filter?: number;
  },
) {
  const { ctx, out } = kit;
  const t = kit.now + at;
  const osc = ctx.createOscillator();
  osc.type = options.type;
  osc.frequency.setValueAtTime(points[0]![1], t);
  for (const [dt, freq] of points.slice(1))
    osc.frequency.exponentialRampToValueAtTime(freq, t + dt);
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = options.vibrato ?? 5.5;
  depth.gain.value = options.depth ?? 8;
  lfo.connect(depth).connect(osc.frequency);
  const gain = ctx.createGain();
  envelope(gain, t, options.attack, options.peak, options.decay);
  let node: AudioNode = osc;
  if (options.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = options.filter;
    node = osc.connect(filter);
  }
  node.connect(gain).connect(out);
  const end = t + options.attack + options.decay + 0.1;
  osc.start(t);
  lfo.start(t);
  osc.stop(end);
  lfo.stop(end);
}

const impulses = new Map<number, AudioBuffer>();

/** Eco de sala grande (reverberação) por cima do som seco. */
function withReverb(kit: Kit, seconds = 2.5, wet = 0.35): Kit {
  const { ctx } = kit;
  let buffer = impulses.get(seconds);
  if (!buffer) {
    const length = Math.floor(ctx.sampleRate * seconds);
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    impulses.set(seconds, buffer);
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = buffer;
  const input = ctx.createGain();
  const wetGain = ctx.createGain();
  wetGain.gain.value = wet;
  input.connect(kit.out);
  input.connect(convolver).connect(wetGain).connect(kit.out);
  return { ...kit, out: input };
}

/** Voz (coro, uivo): serra com vibrato passando por formantes (as "vogais"). */
function voice(
  kit: Kit,
  at: number,
  points: [number, number][],
  options: {
    peak: number;
    attack: number;
    decay: number;
    formants: [number, number, number][];
    vibrato?: number;
    depth?: number;
    type?: OscillatorType;
  },
) {
  const { ctx, out } = kit;
  const t = kit.now + at;
  const osc = ctx.createOscillator();
  osc.type = options.type ?? 'sawtooth';
  osc.frequency.setValueAtTime(points[0]![1], t);
  for (const [dt, freq] of points.slice(1))
    osc.frequency.exponentialRampToValueAtTime(freq, t + dt);
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = options.vibrato ?? 5;
  depth.gain.value = options.depth ?? 6;
  lfo.connect(depth).connect(osc.frequency);
  const gain = ctx.createGain();
  envelope(gain, t, options.attack, options.peak, options.decay);
  for (const [freq, q, level] of options.formants) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const mix = ctx.createGain();
    mix.gain.value = level;
    osc.connect(filter).connect(mix).connect(gain);
  }
  gain.connect(out);
  const end = t + options.attack + options.decay + 0.1;
  osc.start(t);
  lfo.start(t);
  osc.stop(end);
  lfo.stop(end);
}

/** Vogais (formantes aproximados). */
const OOH: [number, number, number][] = [
  [350, 6, 1],
  [700, 8, 0.5],
  [2400, 10, 0.12],
];
const AAH: [number, number, number][] = [
  [750, 6, 1],
  [1150, 8, 0.6],
  [2600, 10, 0.2],
];

/** Rugido grave e áspero (kaiju). */
function growl(kit: Kit, at: number, base: number, length: number) {
  const { ctx, out } = kit;
  const t = kit.now + at;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / curve.length) * 2 - 1) * 3.5);
  shaper.curve = curve;
  const rough = ctx.createGain();
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 20;
  depth.gain.value = 0.45;
  lfo.connect(depth).connect(rough.gain);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.linearRampToValueAtTime(1000, t + length * 0.25);
  filter.frequency.exponentialRampToValueAtTime(200, t + length);
  const gain = ctx.createGain();
  envelope(gain, t, 0.2, 0.6, length);
  for (const [mult, detune] of [
    [1, 0],
    [1.02, 12],
    [0.5, 0],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * mult * 1.25, t);
    osc.frequency.exponentialRampToValueAtTime(base * mult * 0.7, t + length);
    osc.detune.value = detune;
    osc.connect(rough);
    osc.start(t);
    osc.stop(t + length + 0.3);
  }
  rough.connect(shaper).connect(filter).connect(gain).connect(out);
  lfo.start(t);
  lfo.stop(t + length + 0.3);
}

const SOUNDS: Record<DiceAura, (kit: Kit) => void> = {
  storm: (kit) => {
    // Estalo do raio seguido do ronco do trovão.
    noiseBurst(kit, 0, { type: 'highpass', freq: 2500, attack: 0.005, decay: 0.25, peak: 0.9 });
    noiseBurst(kit, 0.04, {
      type: 'lowpass',
      freq: 900,
      toFreq: 120,
      attack: 0.03,
      decay: 2.6,
      peak: 1,
      rate: 0.6,
    });
    noiseBurst(kit, 0.6, {
      type: 'lowpass',
      freq: 300,
      toFreq: 80,
      attack: 0.15,
      decay: 2,
      peak: 0.7,
      rate: 0.5,
    });
    noiseBurst(kit, 1.4, { type: 'highpass', freq: 3000, attack: 0.005, decay: 0.18, peak: 0.4 });
  },
  blood: (kit) => {
    // Jorro (chiado molhado) e coração batendo forte.
    noiseBurst(kit, 0, {
      type: 'bandpass',
      freq: 700,
      toFreq: 300,
      q: 2,
      attack: 0.05,
      decay: 1.2,
      peak: 0.6,
    });
    for (const beat of [0.1, 0.38, 1.0, 1.28, 1.9, 2.18])
      tone(kit, beat, {
        type: 'sine',
        freq: 95,
        toFreq: 40,
        attack: 0.01,
        decay: 0.28,
        peak: 0.95,
      });
  },
  frost: (kit) => {
    // No fim, o gelo que cobriu a tela se estilhaça.
    for (let i = 0; i < 10; i++)
      noiseBurst(kit, 2.85 + Math.random() * 0.25, {
        type: 'highpass',
        freq: 3500,
        attack: 0.002,
        decay: 0.12,
        peak: 0.45,
      });
    for (let i = 0; i < 8; i++)
      tone(kit, 2.9 + Math.random() * 0.5, {
        type: 'sine',
        freq: 2500 + Math.random() * 3000,
        attack: 0.003,
        decay: 0.4,
        peak: 0.08,
      });
    // Gelo trincando e tilintar de cristais, com vento gelado.
    for (let i = 0; i < 6; i++)
      noiseBurst(kit, i * 0.07 + Math.random() * 0.04, {
        type: 'highpass',
        freq: 4000,
        attack: 0.002,
        decay: 0.08,
        peak: 0.6,
      });
    for (let i = 0; i < 9; i++)
      tone(kit, 0.25 + i * 0.12, {
        type: 'sine',
        freq: 2000 + Math.random() * 2600,
        attack: 0.005,
        decay: 0.6,
        peak: 0.12,
      });
    noiseBurst(kit, 0, {
      type: 'bandpass',
      freq: 5000,
      toFreq: 2000,
      q: 3,
      attack: 0.6,
      decay: 2.2,
      peak: 0.25,
    });
  },
  arcane: (kit) => {
    // Arpejo místico com eco.
    const notes = [440, 523.25, 659.25, 830.61, 987.77, 1318.5];
    notes.forEach((freq, i) => {
      tone(kit, i * 0.09, { type: 'triangle', freq, attack: 0.01, decay: 1.4, peak: 0.22 });
      tone(kit, i * 0.09 + 0.35, {
        type: 'sine',
        freq: freq * 2,
        attack: 0.01,
        decay: 1,
        peak: 0.06,
      });
    });
    tone(kit, 0, { type: 'sawtooth', freq: 110, attack: 0.5, decay: 2.5, peak: 0.12, filter: 600 });
  },
  shadow: (kit) => {
    // A escuridão se fechando: grave crescendo, sussurros e um baque quando fecha.
    tone(kit, 0, {
      type: 'sawtooth',
      freq: 55,
      toFreq: 38,
      attack: 1.3,
      decay: 2.2,
      peak: 0.4,
      filter: 260,
    });
    tone(kit, 0, {
      type: 'sawtooth',
      freq: 58,
      toFreq: 40,
      attack: 1.3,
      decay: 2.2,
      peak: 0.3,
      filter: 260,
    });
    for (let i = 0; i < 8; i++)
      noiseBurst(kit, 0.2 + Math.random() * 2, {
        type: 'bandpass',
        freq: 800 + Math.random() * 1600,
        q: 8,
        attack: 0.15,
        decay: 0.35,
        peak: 0.12,
      });
    tone(kit, 1.4, { type: 'sine', freq: 50, toFreq: 28, attack: 0.01, decay: 1.6, peak: 0.8 });
    noiseBurst(kit, 1.4, {
      type: 'lowpass',
      freq: 300,
      toFreq: 60,
      attack: 0.01,
      decay: 1.2,
      peak: 0.4,
    });
  },
  holy: (kit) => {
    // Coro: acorde maior suave e sino.
    for (const freq of [261.63, 329.63, 392, 523.25, 659.25]) {
      tone(kit, 0.05, {
        type: 'sawtooth',
        freq,
        attack: 0.5,
        decay: 2.6,
        peak: 0.08,
        filter: 1400,
        detune: -6,
      });
      tone(kit, 0.05, {
        type: 'sawtooth',
        freq,
        attack: 0.5,
        decay: 2.6,
        peak: 0.08,
        filter: 1400,
        detune: 6,
      });
    }
    tone(kit, 0, { type: 'sine', freq: 1046.5, attack: 0.005, decay: 2.2, peak: 0.3 });
    tone(kit, 0, { type: 'sine', freq: 2093, attack: 0.005, decay: 1.4, peak: 0.1 });
  },
  gears: (kit) => {
    // Engrenagens chegando (clangs), catraca acelerando, apito a vapor e chiado.
    for (let i = 0; i < 6; i++) {
      const at = 0.35 + i * 0.12;
      tone(kit, at, {
        type: 'square',
        freq: 160 + i * 25,
        attack: 0.003,
        decay: 0.2,
        peak: 0.18,
        filter: 2500,
      });
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 3200,
        q: 10,
        attack: 0.002,
        decay: 0.25,
        peak: 0.4,
      });
    }
    let at = 1.1;
    for (let gap = 0.12; at < 3; gap = Math.max(0.025, gap * 0.9)) {
      noiseBurst(kit, at, { type: 'highpass', freq: 3000, attack: 0.001, decay: 0.02, peak: 0.25 });
      at += gap;
    }
    for (const freq of [1180, 1480])
      sung(
        kit,
        1.5,
        [
          [0, freq * 0.9],
          [0.15, freq],
        ],
        { type: 'sine', peak: 0.18, attack: 0.05, decay: 1.1, vibrato: 7, depth: 6 },
      );
    noiseBurst(kit, 1.5, { type: 'highpass', freq: 3500, attack: 0.03, decay: 1.2, peak: 0.35 });
  },
  forest: (kit) => {
    // Vento nas folhas e pássaros.
    noiseBurst(kit, 0, {
      type: 'bandpass',
      freq: 500,
      toFreq: 1200,
      q: 0.8,
      attack: 0.8,
      decay: 2.4,
      peak: 0.35,
    });
    for (let i = 0; i < 6; i++) {
      const base = 2400 + Math.random() * 1200;
      tone(kit, 0.3 + i * 0.32 + Math.random() * 0.1, {
        type: 'sine',
        freq: base,
        toFreq: base * 1.5,
        attack: 0.01,
        decay: 0.12,
        peak: 0.12,
      });
      tone(kit, 0.45 + i * 0.32, {
        type: 'sine',
        freq: base * 1.4,
        toFreq: base,
        attack: 0.01,
        decay: 0.1,
        peak: 0.1,
      });
    }
  },
  skeleton: (kit) => {
    // Gargalhada ("ha-ha-ha" com vogal "a" pelos formantes) e ossos chacoalhando.
    const { ctx, out } = kit;
    const laughs = 7;
    for (let i = 0; i < laughs; i++) {
      const t = kit.now + 0.15 + i * 0.17;
      const pitch = 210 - i * 12;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch * 1.15, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, t + 0.14);
      const gain = ctx.createGain();
      envelope(gain, t, 0.015, 0.5, 0.13);
      for (const [freq, q, level] of [
        [800, 6, 1],
        [1150, 8, 0.7],
        [2600, 10, 0.25],
      ] as const) {
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = freq;
        formant.Q.value = q;
        const mix = ctx.createGain();
        mix.gain.value = level;
        osc.connect(formant).connect(mix).connect(gain);
      }
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.2);
      // "H" do riso: sopro antes de cada sílaba.
      noiseBurst(kit, 0.13 + i * 0.17, {
        type: 'bandpass',
        freq: 1500,
        q: 1,
        attack: 0.01,
        decay: 0.05,
        peak: 0.12,
      });
    }
    for (let i = 0; i < 30; i++)
      noiseBurst(kit, Math.random() * 1.8, {
        type: 'bandpass',
        freq: 1800 + Math.random() * 1500,
        q: 6,
        attack: 0.001,
        decay: 0.04,
        peak: 0.3,
      });
    tone(kit, 0, { type: 'sawtooth', freq: 65, attack: 0.4, decay: 2.2, peak: 0.15, filter: 250 });
  },
  cosmic: (kit) => {
    // Vidro rachando, zumbido grave do vazio e brilho distante.
    for (const at of [0, 0.05, 0.12])
      noiseBurst(kit, at, { type: 'highpass', freq: 3000, attack: 0.002, decay: 0.12, peak: 0.6 });
    tone(kit, 0, { type: 'sine', freq: 40, attack: 0.8, decay: 2.6, peak: 0.45 });
    tone(kit, 0, { type: 'sine', freq: 61, attack: 0.8, decay: 2.6, peak: 0.3, detune: 8 });
    noiseBurst(kit, 0.1, {
      type: 'bandpass',
      freq: 400,
      toFreq: 3000,
      q: 2,
      attack: 1.2,
      decay: 0.3,
      peak: 0.25,
    });
    for (let i = 0; i < 6; i++)
      tone(kit, 0.4 + i * 0.3, {
        type: 'sine',
        freq: 1500 + Math.random() * 1500,
        attack: 0.3,
        decay: 1.2,
        peak: 0.05,
      });
  },
  tarot: (kit) => {
    // Cartas embaralhando, três viradas e um sino.
    for (let i = 0; i < 20; i++)
      noiseBurst(kit, i * 0.03, {
        type: 'bandpass',
        freq: 2500,
        q: 3,
        attack: 0.002,
        decay: 0.025,
        peak: 0.35,
      });
    for (const at of [0.9, 1.2, 1.5])
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 1200,
        toFreq: 3000,
        q: 1.5,
        attack: 0.01,
        decay: 0.12,
        peak: 0.45,
      });
    for (const [freq, peak] of [
      [1318.5, 0.25],
      [2637, 0.1],
      [3951, 0.05],
    ] as const)
      tone(kit, 1.6, { type: 'sine', freq, attack: 0.005, decay: 2, peak });
  },
  glitch: (kit) => {
    // Bipes digitais aleatórios, chiado e uma queda de energia.
    for (let i = 0; i < 14; i++)
      tone(kit, i * 0.06, {
        type: 'square',
        freq: 200 + Math.random() * 1800,
        attack: 0.003,
        decay: 0.05,
        peak: 0.12,
      });
    for (const at of [0.3, 0.9, 1.6])
      noiseBurst(kit, at, { type: 'highpass', freq: 1500, attack: 0.005, decay: 0.15, peak: 0.35 });
    for (let i = 0; i < 8; i++)
      tone(kit, 0.6 + i * 0.05, {
        type: 'square',
        freq: i % 2 ? 1200 : 2400,
        attack: 0.002,
        decay: 0.04,
        peak: 0.08,
      });
    tone(kit, 1.2, {
      type: 'sawtooth',
      freq: 1200,
      toFreq: 60,
      attack: 0.01,
      decay: 0.5,
      peak: 0.25,
      filter: 3000,
    });
  },
  ink: (kit) => {
    // Gongo, pincelada e respingos.
    for (const [freq, decay, peak] of [
      [98, 3, 0.45],
      [148.5, 2.6, 0.2],
      [223, 2, 0.12],
      [311, 1.5, 0.08],
    ] as const)
      tone(kit, 0, { type: 'sine', freq, attack: 0.01, decay, peak });
    noiseBurst(kit, 0.15, {
      type: 'bandpass',
      freq: 800,
      toFreq: 2500,
      q: 1.5,
      attack: 0.3,
      decay: 0.7,
      peak: 0.35,
    });
    for (const at of [1.25, 1.32, 1.4])
      noiseBurst(kit, at, { type: 'lowpass', freq: 500, attack: 0.005, decay: 0.08, peak: 0.5 });
  },
  abyss: (kit) => {
    // Mergulho, rugido do kraken, pancadas dos tentáculos e bolhas.
    noiseBurst(kit, 0, {
      type: 'lowpass',
      freq: 600,
      toFreq: 150,
      attack: 0.02,
      decay: 0.9,
      peak: 0.7,
    });
    tone(kit, 0.5, {
      type: 'sawtooth',
      freq: 48,
      toFreq: 36,
      attack: 0.3,
      decay: 1.6,
      peak: 0.45,
      filter: 320,
    });
    tone(kit, 0.5, {
      type: 'sawtooth',
      freq: 51,
      toFreq: 38,
      attack: 0.3,
      decay: 1.6,
      peak: 0.35,
      filter: 320,
    });
    for (const at of AURA_TIMINGS.krakenSlams) {
      tone(kit, at, { type: 'sine', freq: 80, toFreq: 32, attack: 0.005, decay: 0.7, peak: 0.85 });
      noiseBurst(kit, at, {
        type: 'lowpass',
        freq: 2500,
        toFreq: 200,
        attack: 0.005,
        decay: 0.5,
        peak: 0.6,
      });
      for (let i = 0; i < 6; i++)
        noiseBurst(kit, at + 0.03 + Math.random() * 0.2, {
          type: 'highpass',
          freq: 2500,
          attack: 0.002,
          decay: 0.05,
          peak: 0.25,
        });
    }
    for (let i = 0; i < 12; i++) {
      const freq = 300 + Math.random() * 400;
      tone(kit, Math.random() * 2.6, {
        type: 'sine',
        freq,
        toFreq: freq * 2,
        attack: 0.005,
        decay: 0.06,
        peak: 0.12,
      });
    }
  },
  time: (kit) => {
    // Tique-taque acelerando, o tempo voltando e uma badalada.
    let at = 0;
    for (let gap = 0.28; at < 2.6; gap = Math.max(0.05, gap * 0.85)) {
      noiseBurst(kit, at, { type: 'highpass', freq: 4000, attack: 0.001, decay: 0.02, peak: 0.5 });
      at += gap;
    }
    noiseBurst(kit, 0.4, {
      type: 'bandpass',
      freq: 600,
      toFreq: 2400,
      q: 1,
      attack: 1.8,
      decay: 0.2,
      peak: 0.25,
    });
    for (const [freq, peak] of [
      [523.25, 0.3],
      [1046.5, 0.12],
      [1568, 0.06],
    ] as const)
      tone(kit, 3.1, { type: 'sine', freq, attack: 0.005, decay: 2, peak });
  },
  gold: (kit) => {
    // Arpejo de prêmio e moedas tilintando.
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) =>
      tone(kit, i * 0.07, {
        type: 'square',
        freq,
        attack: 0.005,
        decay: 0.15,
        peak: 0.12,
        filter: 4000,
      }),
    );
    for (let i = 0; i < 30; i++)
      tone(kit, 0.3 + Math.random() * 2.5, {
        type: 'sine',
        freq: 2500 + Math.random() * 3000,
        attack: 0.002,
        decay: 0.12,
        peak: 0.12,
      });
  },
  frog: (kit) => {
    // Coaxar, língua (fiu), volta e "gulp".
    const croak = (at: number) => {
      for (let i = 0; i < 6; i++)
        tone(kit, at + i * 0.05, {
          type: 'sawtooth',
          freq: 110,
          toFreq: 85,
          attack: 0.005,
          decay: 0.04,
          peak: 0.35,
          filter: 800,
        });
    };
    croak(0.5);
    tone(kit, 1.1, {
      type: 'sine',
      freq: 400,
      toFreq: 1600,
      attack: 0.005,
      decay: 0.12,
      peak: 0.3,
    });
    tone(kit, 1.25, {
      type: 'sine',
      freq: 1600,
      toFreq: 300,
      attack: 0.005,
      decay: 0.3,
      peak: 0.25,
    });
    tone(kit, 1.7, {
      type: 'sine',
      freq: 220,
      toFreq: 70,
      attack: 0.01,
      decay: 0.25,
      peak: 0.5,
      filter: 600,
    });
    croak(2.3);
  },
  vampire: (kit) => {
    // Guinchos de morcego e acorde de órgão em ré menor.
    for (let i = 0; i < 10; i++) {
      const freq = 6000 + Math.random() * 3000;
      tone(kit, Math.random() * 2, {
        type: 'sine',
        freq,
        toFreq: freq * 1.2,
        attack: 0.003,
        decay: 0.04,
        peak: 0.08,
      });
    }
    for (const freq of [146.83, 174.61, 220, 293.66]) {
      tone(kit, 0, {
        type: 'sawtooth',
        freq,
        attack: 0.3,
        decay: 2.5,
        peak: 0.07,
        filter: 1200,
        detune: -5,
      });
      tone(kit, 0, {
        type: 'sawtooth',
        freq,
        attack: 0.3,
        decay: 2.5,
        peak: 0.07,
        filter: 1200,
        detune: 5,
      });
    }
  },
  bard: (kit) => {
    // Acordes cada vez mais rápidos, as cordas estourando uma a uma e o acorde final.
    const hall = withReverb(kit, 2.5, 0.35);
    const chord = [196, 246.94, 293.66, 392, 493.88, 587.33];
    let at = 0.05;
    for (let gap = 0.32; at < 1.5; gap = Math.max(0.07, gap * 0.82)) {
      chord.forEach((freq, i) =>
        tone(hall, at + i * 0.012, {
          type: 'triangle',
          freq,
          attack: 0.003,
          decay: 0.5,
          peak: 0.07,
        }),
      );
      at += gap;
    }
    for (let i = 0; i < 6; i++) {
      const snap = 1.6 + i * 0.12;
      tone(hall, snap, {
        type: 'sine',
        freq: 1200 + i * 150,
        toFreq: 300,
        attack: 0.002,
        decay: 0.25,
        peak: 0.18,
      });
      noiseBurst(kit, snap, {
        type: 'highpass',
        freq: 2500,
        attack: 0.001,
        decay: 0.05,
        peak: 0.4,
      });
    }
    for (const freq of [98, 196, 293.66, 392, 587.33])
      tone(hall, 2.4, {
        type: 'sawtooth',
        freq,
        attack: 0.005,
        decay: 1.4,
        peak: 0.07,
        filter: 2200,
      });
  },
  rainbow: (kit) => {
    // Glissando de harpa (pentatônica) e brilho.
    const scale = [261.63, 293.66, 329.63, 392, 440];
    for (let i = 0; i < 15; i++)
      tone(kit, i * 0.05, {
        type: 'triangle',
        freq: scale[i % 5]! * 2 ** Math.floor(i / 5),
        attack: 0.005,
        decay: 1,
        peak: 0.08,
      });
    for (const freq of [2093, 2637])
      tone(kit, 0.4, { type: 'sine', freq, attack: 0.5, decay: 1.5, peak: 0.04 });
  },
  poison: (kit) => {
    // Borbulhar, "gloop" grave e chiado de gás.
    tone(kit, 0, { type: 'sine', freq: 120, toFreq: 60, attack: 0.01, decay: 0.4, peak: 0.4 });
    for (let i = 0; i < 25; i++) {
      const freq = 150 + Math.random() * 250;
      tone(kit, Math.random() * 2.5, {
        type: 'sine',
        freq,
        toFreq: freq * 1.8,
        attack: 0.005,
        decay: 0.08,
        peak: 0.15,
      });
    }
    noiseBurst(kit, 0.2, { type: 'highpass', freq: 5000, attack: 0.4, decay: 2, peak: 0.15 });
  },
  cat: (kit) => {
    // Ronronar, tapas no "CRÍTICO!" e um miau no fim.
    tone(kit, 0, { type: 'sawtooth', freq: 26, attack: 0.2, decay: 0.8, peak: 0.25, filter: 180 });
    for (const at of AURA_TIMINGS.catHits) {
      noiseBurst(kit, at - 0.08, {
        type: 'bandpass',
        freq: 900,
        toFreq: 2500,
        q: 1.2,
        attack: 0.05,
        decay: 0.12,
        peak: 0.25,
      });
      tone(kit, at, {
        type: 'sine',
        freq: 180,
        toFreq: 70,
        attack: 0.003,
        decay: 0.12,
        peak: 0.45,
      });
    }
    const { ctx, out } = kit;
    const t = kit.now + AURA_TIMINGS.catHits[2] + 0.35;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.6);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 4;
    formant.frequency.setValueAtTime(900, t);
    formant.frequency.exponentialRampToValueAtTime(2200, t + 0.15);
    formant.frequency.exponentialRampToValueAtTime(1000, t + 0.6);
    const gain = ctx.createGain();
    envelope(gain, t, 0.05, 0.5, 0.6);
    osc.connect(formant).connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.7);
  },
  claw: (kit) => {
    // Dois golpes de garra (três rasgos cada) e um rugido de urso.
    for (const swipe of [0.3, 0.9])
      for (let i = 0; i < 3; i++)
        noiseBurst(kit, swipe + i * 0.035, {
          type: 'bandpass',
          freq: 4500,
          toFreq: 700,
          q: 2,
          attack: 0.005,
          decay: 0.18,
          peak: 0.55,
        });
    const { ctx, out } = kit;
    const t = kit.now + 1.15;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / curve.length) * 2 - 1) * 3.5);
    shaper.curve = curve;
    const growl = ctx.createGain();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 22;
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(growl.gain);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, t);
    filter.frequency.linearRampToValueAtTime(1100, t + 0.35);
    filter.frequency.exponentialRampToValueAtTime(220, t + 1.6);
    const gain = ctx.createGain();
    envelope(gain, t, 0.15, 0.55, 1.5);
    for (const [freq, detune] of [
      [85, 0],
      [87, 12],
      [43, 0],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 1.25, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, t + 1.6);
      osc.detune.value = detune;
      osc.connect(growl);
      osc.start(t);
      osc.stop(t + 1.8);
    }
    growl.connect(shaper).connect(filter).connect(gain).connect(out);
    lfo.start(t);
    lfo.stop(t + 1.8);
  },
  meteor: (kit) => {
    // Rasantes e um impacto enorme.
    for (const at of [0, 0.4, 0.8, 1.3])
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 2000,
        toFreq: 300,
        q: 1.5,
        attack: 0.2,
        decay: 0.6,
        peak: 0.3,
      });
    tone(kit, 1.85, { type: 'sine', freq: 70, toFreq: 30, attack: 0.005, decay: 1.2, peak: 0.9 });
    noiseBurst(kit, 1.85, {
      type: 'lowpass',
      freq: 800,
      toFreq: 100,
      attack: 0.005,
      decay: 1.5,
      peak: 0.8,
    });
  },
  party: (kit) => {
    // Fogos: assobio subindo e estouro com estalinhos; galera ao fundo.
    for (const at of AURA_TIMINGS.partyLaunches) {
      tone(kit, at, {
        type: 'sine',
        freq: 700,
        toFreq: 1700,
        attack: 0.05,
        decay: AURA_TIMINGS.fireworkFlight - 0.05,
        peak: 0.05,
      });
      const bang = at + AURA_TIMINGS.fireworkFlight;
      noiseBurst(kit, bang, {
        type: 'lowpass',
        freq: 1800,
        toFreq: 200,
        attack: 0.003,
        decay: 0.5,
        peak: 0.6,
      });
      tone(kit, bang, { type: 'sine', freq: 90, toFreq: 40, attack: 0.003, decay: 0.3, peak: 0.4 });
      for (let i = 0; i < 6; i++)
        noiseBurst(kit, bang + 0.15 + Math.random() * 0.4, {
          type: 'highpass',
          freq: 3000,
          attack: 0.001,
          decay: 0.03,
          peak: 0.15,
        });
    }
    noiseBurst(kit, 0.6, {
      type: 'bandpass',
      freq: 1200,
      q: 0.7,
      attack: 0.4,
      decay: 2,
      peak: 0.12,
    });
  },
  fire: (kit) => {
    // Labareda subindo e estalos.
    noiseBurst(kit, 0, {
      type: 'lowpass',
      freq: 300,
      toFreq: 3500,
      attack: 0.4,
      decay: 2.2,
      peak: 0.7,
      rate: 0.7,
    });
    for (let i = 0; i < 26; i++)
      noiseBurst(kit, Math.random() * 2.6, {
        type: 'highpass',
        freq: 2000,
        attack: 0.001,
        decay: 0.03,
        peak: 0.25 + Math.random() * 0.3,
      });
  },
  wind: (kit) => {
    // Uivo do vento girando, ronco do tornado e... um mugido.
    const { ctx, out } = kit;
    const t = kit.now;
    const source = ctx.createBufferSource();
    source.buffer = whiteNoise(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(300, t);
    for (let i = 1; i <= 8; i++)
      filter.frequency.linearRampToValueAtTime(i % 2 ? 900 : 380, t + i * 0.4);
    const gain = ctx.createGain();
    envelope(gain, t, 0.6, 0.6, 2.8);
    source.connect(filter).connect(gain).connect(out);
    source.start(t);
    source.stop(t + 3.5);
    noiseBurst(kit, 0, {
      type: 'lowpass',
      freq: 160,
      attack: 0.5,
      decay: 2.8,
      peak: 0.6,
      rate: 0.5,
    });
    const moo = t + 1.6;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, moo);
    osc.frequency.exponentialRampToValueAtTime(105, moo + 0.7);
    const formant = ctx.createBiquadFilter();
    formant.type = 'lowpass';
    formant.frequency.setValueAtTime(400, moo);
    formant.frequency.linearRampToValueAtTime(900, moo + 0.25);
    formant.frequency.linearRampToValueAtTime(350, moo + 0.7);
    const mooGain = ctx.createGain();
    envelope(mooGain, moo, 0.08, 0.3, 0.65);
    osc.connect(formant).connect(mooGain).connect(out);
    osc.start(moo);
    osc.stop(moo + 0.8);
  },
  ritual: (kit) => {
    // Coro grave e dissonante, tambores, sino e sussurros.
    for (const freq of [73.42, 87.31, 103.83, 146.83]) {
      tone(kit, 0, {
        type: 'sawtooth',
        freq,
        attack: 0.8,
        decay: 2.6,
        peak: 0.08,
        filter: 700,
        detune: -7,
      });
      tone(kit, 0, {
        type: 'sawtooth',
        freq,
        attack: 0.8,
        decay: 2.6,
        peak: 0.08,
        filter: 700,
        detune: 7,
      });
    }
    for (const at of [0.5, 1.0, 1.5, 1.75, 2.0])
      tone(kit, at, { type: 'sine', freq: 70, toFreq: 40, attack: 0.005, decay: 0.45, peak: 0.6 });
    for (const [freq, peak] of [
      [196, 0.25],
      [277.18, 0.12],
      [415.3, 0.06],
    ] as const)
      tone(kit, 1.1, { type: 'sine', freq, attack: 0.005, decay: 2.2, peak });
    for (let i = 0; i < 8; i++)
      noiseBurst(kit, 0.3 + Math.random() * 2.2, {
        type: 'bandpass',
        freq: 700 + Math.random() * 1500,
        q: 8,
        attack: 0.15,
        decay: 0.3,
        peak: 0.1,
      });
  },
  necro: (kit) => {
    // Coro grave de mortos ("ooh"), ossos chacoalhando e almas sussurrando, com eco.
    const hall = withReverb(kit, 3, 0.45);
    for (const freq of [73.42, 87.31, 110, 146.83])
      voice(
        hall,
        0.1,
        [
          [0, freq],
          [2.6, freq * 0.98],
        ],
        { peak: 0.09, attack: 0.6, decay: 2.4, formants: OOH, vibrato: 4.5, depth: 2 },
      );
    for (let i = 0; i < 18; i++)
      noiseBurst(kit, 0.5 + Math.random() * 1.8, {
        type: 'bandpass',
        freq: 2200 + Math.random() * 1500,
        q: 8,
        attack: 0.002,
        decay: 0.05,
        peak: 0.25,
      });
    for (let i = 0; i < 6; i++)
      noiseBurst(hall, 0.8 + Math.random() * 1.6, {
        type: 'bandpass',
        freq: 900 + Math.random() * 1200,
        q: 9,
        attack: 0.15,
        decay: 0.3,
        peak: 0.12,
      });
    tone(kit, 0, { type: 'sine', freq: 45, attack: 0.8, decay: 2.4, peak: 0.35 });
  },
  pirate: (kit) => {
    // Ondas, três canhonaços e o baú abrindo.
    noiseBurst(kit, 0, {
      type: 'lowpass',
      freq: 500,
      toFreq: 900,
      attack: 0.8,
      decay: 2.4,
      peak: 0.3,
      rate: 0.5,
    });
    for (const at of [0.8, 1.3, 1.8]) {
      tone(kit, at, { type: 'sine', freq: 70, toFreq: 30, attack: 0.003, decay: 0.8, peak: 0.85 });
      noiseBurst(kit, at, {
        type: 'lowpass',
        freq: 1500,
        toFreq: 150,
        attack: 0.003,
        decay: 0.6,
        peak: 0.6,
      });
    }
    [1318.5, 1568, 2093, 2637].forEach((freq, i) =>
      tone(kit, 2.1 + i * 0.07, { type: 'sine', freq, attack: 0.005, decay: 0.8, peak: 0.12 }),
    );
  },
  samurai: (kit) => {
    // Espada saindo da bainha, quatro cortes rápidos, o corte final e um taiko com eco.
    const hall = withReverb(kit, 2.2, 0.35);
    noiseBurst(kit, 0, {
      type: 'highpass',
      freq: 2000,
      toFreq: 9000,
      attack: 0.18,
      decay: 0.12,
      peak: 0.25,
    });
    tone(hall, 0.18, { type: 'sine', freq: 3400, attack: 0.003, decay: 1.6, peak: 0.07 });
    for (const at of [0.35, 0.48, 0.6, 0.72])
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 7000,
        toFreq: 1500,
        q: 2,
        attack: 0.003,
        decay: 0.09,
        peak: 0.45,
      });
    noiseBurst(kit, 0.9, {
      type: 'bandpass',
      freq: 8000,
      toFreq: 600,
      q: 1.2,
      attack: 0.003,
      decay: 0.3,
      peak: 0.7,
    });
    tone(hall, 0.9, { type: 'sine', freq: 2600, attack: 0.002, decay: 1.8, peak: 0.08 });
    for (const at of [1.1, 1.45]) {
      tone(hall, at, { type: 'sine', freq: 72, toFreq: 38, attack: 0.003, decay: 0.7, peak: 0.85 });
      noiseBurst(hall, at, { type: 'lowpass', freq: 500, attack: 0.003, decay: 0.12, peak: 0.35 });
    }
  },
  kaiju: (kit) => {
    // Dois passos que fazem tudo tremer e o rugido monstruoso, com eco.
    const hall = withReverb(kit, 3, 0.4);
    for (const at of [0.1, 0.5]) {
      tone(hall, at, { type: 'sine', freq: 48, toFreq: 26, attack: 0.005, decay: 0.9, peak: 0.95 });
      noiseBurst(hall, at, {
        type: 'lowpass',
        freq: 300,
        toFreq: 60,
        attack: 0.005,
        decay: 0.6,
        peak: 0.6,
      });
    }
    growl(hall, 1.35, 55, 2.1);
    growl(hall, 1.4, 110, 1.9);
    noiseBurst(hall, 1.35, {
      type: 'bandpass',
      freq: 300,
      toFreq: 1400,
      q: 1.2,
      attack: 0.4,
      decay: 1.6,
      peak: 0.45,
    });
  },
  cyber: (kit) => {
    // Sandevistan: o tempo desacelera (tudo desce de tom e abafa), coração lento e, no fim, o
    // tempo volta de uma vez.
    const hall = withReverb(kit, 2.5, 0.4);
    noiseBurst(kit, 0, {
      type: 'bandpass',
      freq: 3000,
      toFreq: 200,
      q: 1.5,
      attack: 0.05,
      decay: 0.6,
      peak: 0.45,
    });
    tone(hall, 0, {
      type: 'sawtooth',
      freq: 880,
      toFreq: 70,
      attack: 0.02,
      decay: 0.8,
      peak: 0.18,
      filter: 2500,
    });
    tone(hall, 0.3, { type: 'sine', freq: 55, attack: 0.6, decay: 2, peak: 0.3 });
    for (const at of [0.6, 1.4, 2.2]) {
      tone(kit, at, { type: 'sine', freq: 60, toFreq: 35, attack: 0.01, decay: 0.35, peak: 0.7 });
      tone(kit, at + 0.22, {
        type: 'sine',
        freq: 52,
        toFreq: 32,
        attack: 0.01,
        decay: 0.3,
        peak: 0.5,
      });
    }
    noiseBurst(kit, 2.7, {
      type: 'bandpass',
      freq: 200,
      toFreq: 4000,
      q: 1.5,
      attack: 0.15,
      decay: 0.1,
      peak: 0.5,
    });
    tone(kit, 2.75, { type: 'sine', freq: 90, toFreq: 40, attack: 0.003, decay: 0.4, peak: 0.6 });
  },
  werewolf: (kit) => {
    // Vento frio e o uivo: começa grave, sobe, sustenta tremendo e cai; um segundo lobo responde.
    const valley = withReverb(kit, 3.5, 0.55);
    noiseBurst(kit, 0, {
      type: 'bandpass',
      freq: 500,
      toFreq: 900,
      q: 1,
      attack: 0.8,
      decay: 2.4,
      peak: 0.1,
    });
    const howl = (at: number, k: number, peak: number) => {
      const contour: [number, number][] = [
        [0, 330 * k],
        [0.45, 640 * k],
        [1.2, 610 * k],
        [1.8, 560 * k],
        [2.2, 380 * k],
      ];
      voice(valley, at, contour, {
        peak,
        attack: 0.25,
        decay: 1.95,
        formants: [
          [700 * k, 3, 1],
          [1300 * k, 5, 0.25],
        ],
        vibrato: 3.5,
        depth: 4,
        type: 'sine',
      });
      voice(
        valley,
        at,
        contour.map(([t, f]) => [t, f * 2] as [number, number]),
        {
          peak: peak * 0.25,
          attack: 0.25,
          decay: 1.95,
          formants: [[1400 * k, 3, 1]],
          vibrato: 3.5,
          depth: 8,
          type: 'triangle',
        },
      );
    };
    howl(0.7, 1, 0.3);
    howl(1.5, 1.19, 0.14);
  },
  siren: (kit) => {
    // Canto da sereia: coro "ooh" em lá menor e uma melodia por cima, debaixo d'água (muito eco).
    const deep = withReverb(kit, 3.5, 0.6);
    for (const freq of [220, 261.63, 329.63])
      voice(
        deep,
        0.1,
        [
          [0, freq],
          [2.8, freq],
        ],
        { peak: 0.06, attack: 0.8, decay: 2.2, formants: OOH, vibrato: 5, depth: 3 },
      );
    const melody: [number, number][] = [
      [0.3, 659.25],
      [0.9, 783.99],
      [1.5, 880],
      [2.1, 783.99],
    ];
    for (const [at, freq] of melody)
      voice(
        deep,
        at,
        [
          [0, freq],
          [0.6, freq],
        ],
        {
          peak: 0.1,
          attack: 0.15,
          decay: 0.75,
          formants: AAH,
          vibrato: 5.5,
          depth: 7,
          type: 'triangle',
        },
      );
  },
  alchemy: (kit) => {
    // Borbulhar dos frascos, brilho mágico e o "plim" do ouro.
    for (let i = 0; i < 20; i++) {
      const freq = 200 + Math.random() * 300;
      tone(kit, Math.random() * 1.4, {
        type: 'sine',
        freq,
        toFreq: freq * 1.8,
        attack: 0.005,
        decay: 0.08,
        peak: 0.12,
      });
    }
    noiseBurst(kit, 0.4, {
      type: 'bandpass',
      freq: 3000,
      toFreq: 8000,
      q: 2,
      attack: 1,
      decay: 0.2,
      peak: 0.12,
    });
    for (const [freq, peak] of [
      [1568, 0.22],
      [2093, 0.12],
      [3136, 0.06],
    ] as const)
      tone(kit, 1.4, { type: 'sine', freq, attack: 0.003, decay: 1.6, peak });
  },
  ghost: (kit) => {
    // Um vulto passa voando (sopro subindo e um grito curto), o teremim e a mão batendo no vidro.
    const hall = withReverb(kit, 3, 0.5);
    noiseBurst(hall, 0.1, {
      type: 'bandpass',
      freq: 400,
      toFreq: 2600,
      q: 2,
      attack: 0.6,
      decay: 0.25,
      peak: 0.45,
    });
    sung(
      hall,
      0.7,
      [
        [0, 1100],
        [0.25, 1900],
      ],
      { type: 'sine', peak: 0.12, attack: 0.02, decay: 0.35, vibrato: 9, depth: 40 },
    );
    sung(
      hall,
      1,
      [
        [0, 420],
        [0.9, 700],
        [1.8, 380],
      ],
      { type: 'sine', peak: 0.14, attack: 0.3, decay: 1.7, vibrato: 6, depth: 20 },
    );
    noiseBurst(hall, 2, { type: 'lowpass', freq: 1500, attack: 0.003, decay: 0.15, peak: 0.6 });
    tone(hall, 2, { type: 'sine', freq: 140, toFreq: 70, attack: 0.003, decay: 0.2, peak: 0.4 });
  },
  cthulhu: (kit) => {
    // O mar ruge, trovões, um grave dissonante de trompa, pancadas dos tentáculos, a tela quebrando
    // e o urro do Grande Antigo, tudo com eco imenso.
    const abyss = withReverb(kit, 4, 0.55);
    noiseBurst(abyss, 0, {
      type: 'lowpass',
      freq: 300,
      toFreq: 900,
      attack: 1,
      decay: 2.6,
      peak: 0.45,
      rate: 0.5,
    });
    for (const freq of [41.2, 43.65, 61.74, 87.31])
      tone(abyss, 0.2, {
        type: 'sawtooth',
        freq,
        attack: 0.8,
        decay: 2.6,
        peak: 0.12,
        filter: 400,
      });
    for (const at of [0.3, 0.9])
      noiseBurst(abyss, at, { type: 'highpass', freq: 1500, attack: 0.005, decay: 0.3, peak: 0.4 });
    for (const at of [0.7, 0.95, 1.2, 1.45]) {
      tone(abyss, at, {
        type: 'sine',
        freq: 70,
        toFreq: 28,
        attack: 0.004,
        decay: 0.8,
        peak: 0.85,
      });
      noiseBurst(abyss, at, {
        type: 'lowpass',
        freq: 2200,
        toFreq: 150,
        attack: 0.004,
        decay: 0.5,
        peak: 0.55,
      });
    }
    growl(abyss, 1.3, 45, 2);
    for (let i = 0; i < 16; i++)
      noiseBurst(kit, 2.1 + Math.random() * 0.4, {
        type: 'highpass',
        freq: 3000,
        attack: 0.002,
        decay: 0.15,
        peak: 0.35,
      });
  },
  heaven: (kit) => {
    // O tempo acelerando: tique-taque que vira zumbido, um tom que sobe sem parar e o clarão final.
    let at = 0;
    for (let gap = 0.3; at < 2.6; gap = Math.max(0.018, gap * 0.86)) {
      noiseBurst(kit, at, {
        type: 'highpass',
        freq: 4000,
        attack: 0.001,
        decay: 0.015,
        peak: 0.35,
      });
      at += gap;
    }
    for (let k = 0; k < 5; k++)
      tone(kit, k * 0.5, {
        type: 'sawtooth',
        freq: 110 * 2 ** (k * 0.5),
        toFreq: 440 * 2 ** (k * 0.5),
        attack: 0.1,
        decay: 0.45,
        peak: 0.08,
        filter: 3000,
      });
    noiseBurst(kit, 1.8, {
      type: 'bandpass',
      freq: 300,
      toFreq: 6000,
      q: 1,
      attack: 0.8,
      decay: 0.2,
      peak: 0.3,
    });
    for (const freq of [523.25, 659.25, 783.99, 1046.5])
      tone(withReverb(kit, 3, 0.5), 2.7, {
        type: 'sine',
        freq,
        attack: 0.01,
        decay: 2,
        peak: 0.12,
      });
  },
  purple: (kit) => {
    // Zumbido azul (puxa) e vermelho (empurra), os dois se aproximando, a fusão e o disparo.
    const hall = withReverb(kit, 3, 0.45);
    sung(
      hall,
      0,
      [
        [0, 110],
        [1.3, 150],
      ],
      { type: 'sine', peak: 0.2, attack: 0.3, decay: 1.1, vibrato: 7, depth: 4 },
    );
    sung(
      hall,
      0,
      [
        [0, 165],
        [1.3, 150],
      ],
      { type: 'triangle', peak: 0.15, attack: 0.3, decay: 1.1, vibrato: 9, depth: 6 },
    );
    noiseBurst(hall, 0.6, {
      type: 'bandpass',
      freq: 200,
      toFreq: 4000,
      q: 1.2,
      attack: 0.8,
      decay: 0.1,
      peak: 0.35,
    });
    tone(hall, 1.5, { type: 'sine', freq: 70, toFreq: 30, attack: 0.003, decay: 1.4, peak: 0.95 });
    tone(hall, 1.5, {
      type: 'sine',
      freq: 1800,
      toFreq: 900,
      attack: 0.003,
      decay: 1.4,
      peak: 0.08,
    });
    noiseBurst(hall, 1.8, {
      type: 'lowpass',
      freq: 3000,
      toFreq: 200,
      attack: 0.01,
      decay: 1,
      peak: 0.6,
    });
  },
  wheel: (kit) => {
    // A roda gira em estalos metálicos pesados (com eco), até o sino da adaptação.
    const hall = withReverb(kit, 3, 0.5);
    for (const at of [0.6, 1.1, 1.6]) {
      tone(hall, at, {
        type: 'square',
        freq: 85,
        toFreq: 60,
        attack: 0.002,
        decay: 0.35,
        peak: 0.35,
        filter: 1200,
      });
      noiseBurst(hall, at, {
        type: 'bandpass',
        freq: 1300,
        q: 5,
        attack: 0.002,
        decay: 0.3,
        peak: 0.6,
      });
      for (const freq of [523, 690, 1012])
        tone(hall, at, { type: 'sine', freq, attack: 0.002, decay: 0.9, peak: 0.05 });
    }
    for (const freq of [392, 587.33, 783.99])
      tone(hall, 1.9, { type: 'sine', freq, attack: 0.01, decay: 2, peak: 0.12 });
  },
  capture: (kit) => {
    // Arremesso, a esfera abre e suga, fecha, três balançadas e o clique da captura.
    noiseBurst(kit, 0.25, {
      type: 'bandpass',
      freq: 800,
      toFreq: 2500,
      q: 1.5,
      attack: 0.05,
      decay: 0.2,
      peak: 0.3,
    });
    tone(kit, 0.7, {
      type: 'square',
      freq: 600,
      toFreq: 1200,
      attack: 0.003,
      decay: 0.06,
      peak: 0.12,
      filter: 3000,
    });
    sung(
      kit,
      0.72,
      [
        [0, 500],
        [0.28, 1800],
      ],
      { type: 'sine', peak: 0.15, attack: 0.02, decay: 0.28, vibrato: 20, depth: 30 },
    );
    tone(kit, 1, {
      type: 'square',
      freq: 900,
      attack: 0.002,
      decay: 0.05,
      peak: 0.12,
      filter: 3000,
    });
    for (const at of [1.5, 2, 2.5]) {
      tone(kit, at, { type: 'sine', freq: 220, toFreq: 160, attack: 0.003, decay: 0.1, peak: 0.3 });
      noiseBurst(kit, at, { type: 'highpass', freq: 3000, attack: 0.001, decay: 0.02, peak: 0.25 });
    }
    tone(kit, 2.85, {
      type: 'square',
      freq: 1400,
      attack: 0.002,
      decay: 0.05,
      peak: 0.12,
      filter: 4000,
    });
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone(kit, 2.95 + i * 0.08, {
        type: 'square',
        freq,
        attack: 0.005,
        decay: 0.15,
        peak: 0.08,
        filter: 3500,
      }),
    );
  },
  darklord: (kit) => {
    // Respiração mecânica pesada, a lâmina acendendo ("snap-hiss" e zumbido) e os golpes.
    const hall = withReverb(kit, 2.5, 0.35);
    for (const at of [0, 1.9]) {
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 1100,
        toFreq: 900,
        q: 1.2,
        attack: 0.5,
        decay: 0.3,
        peak: 0.35,
        rate: 0.6,
      });
      noiseBurst(kit, at + 0.85, {
        type: 'bandpass',
        freq: 600,
        toFreq: 450,
        q: 1.2,
        attack: 0.1,
        decay: 0.75,
        peak: 0.35,
        rate: 0.6,
      });
      tone(kit, at + 0.82, {
        type: 'square',
        freq: 120,
        attack: 0.002,
        decay: 0.03,
        peak: 0.08,
        filter: 1500,
      });
    }
    noiseBurst(hall, 1, { type: 'highpass', freq: 1500, attack: 0.003, decay: 0.25, peak: 0.6 });
    // Zumbido da lâmina: duas serras quase iguais batendo entre si.
    for (const base of [88, 90.5])
      sung(
        hall,
        1,
        [
          [0, base],
          [1.6, base],
        ],
        {
          type: 'sawtooth',
          peak: 0.12,
          attack: 0.05,
          decay: 1.6,
          vibrato: 2,
          depth: 1.5,
          filter: 700,
        },
      );
    for (const at of [1.5, 1.85, 2.2, 2.45])
      sung(
        hall,
        at,
        [
          [0, 160],
          [0.18, 70],
        ],
        {
          type: 'sawtooth',
          peak: 0.16,
          attack: 0.02,
          decay: 0.25,
          vibrato: 0,
          depth: 0,
          filter: 1400,
        },
      );
    noiseBurst(hall, 2.45, { type: 'highpass', freq: 2500, attack: 0.002, decay: 0.3, peak: 0.45 });
  },
  notebook: (kit) => {
    // Caneta riscando o papel, um coração batendo devagar e um coro grave.
    const hall = withReverb(kit, 3, 0.45);
    for (let i = 0; i < 70; i++)
      noiseBurst(kit, 0.6 + i * 0.018 + Math.random() * 0.01, {
        type: 'bandpass',
        freq: 3500 + Math.random() * 2500,
        q: 2,
        attack: 0.002,
        decay: 0.03,
        peak: 0.12,
      });
    for (const at of [0.2, 1.2, 2.2]) {
      tone(kit, at, { type: 'sine', freq: 60, toFreq: 35, attack: 0.01, decay: 0.3, peak: 0.6 });
      tone(kit, at + 0.24, {
        type: 'sine',
        freq: 52,
        toFreq: 32,
        attack: 0.01,
        decay: 0.28,
        peak: 0.45,
      });
    }
    for (const freq of [110, 130.81, 155.56])
      voice(
        hall,
        0.4,
        [
          [0, freq],
          [2.4, freq],
        ],
        { peak: 0.06, attack: 0.8, decay: 2, formants: OOH, vibrato: 4, depth: 2 },
      );
  },
  orbs: (kit) => {
    // Cada esfera chega com um brilho, o céu escurece com trovão e o dragão surge rugindo.
    const hall = withReverb(kit, 3.5, 0.5);
    for (let i = 0; i < 7; i++)
      tone(hall, 0.15 + i * 0.12, {
        type: 'sine',
        freq: 880 * 2 ** (i / 7),
        attack: 0.005,
        decay: 0.8,
        peak: 0.08,
      });
    noiseBurst(hall, 1, {
      type: 'lowpass',
      freq: 200,
      attack: 0.3,
      decay: 1.6,
      peak: 0.6,
      rate: 0.5,
    });
    growl(hall, 1.5, 95, 1.6);
    sung(
      hall,
      1.55,
      [
        [0, 600],
        [0.5, 900],
        [1.4, 500],
      ],
      {
        type: 'sawtooth',
        peak: 0.06,
        attack: 0.1,
        decay: 1.4,
        vibrato: 6,
        depth: 15,
        filter: 2000,
      },
    );
    for (const freq of [523.25, 783.99, 1046.5])
      tone(hall, 2.6, { type: 'sine', freq, attack: 0.01, decay: 1.6, peak: 0.1 });
  },
  haki: (kit) => {
    // Lembra o haki do rei dos animes: um "VUUM" grave que infla e explode, estática elétrica
    // estalando e um vento de choque, a cada pulso.
    const hall = withReverb(kit, 2.8, 0.45);
    for (const at of [0, 0.55, 1.1, 1.65]) {
      sung(
        hall,
        at,
        [
          [0, 40],
          [0.12, 90],
          [0.6, 35],
        ],
        {
          type: 'sawtooth',
          peak: 0.35,
          attack: 0.08,
          decay: 0.55,
          vibrato: 30,
          depth: 6,
          filter: 500,
        },
      );
      tone(hall, at + 0.08, {
        type: 'sine',
        freq: 60,
        toFreq: 28,
        attack: 0.005,
        decay: 0.7,
        peak: 0.9,
      });
      noiseBurst(hall, at + 0.06, {
        type: 'bandpass',
        freq: 600,
        toFreq: 2400,
        q: 0.8,
        attack: 0.05,
        decay: 0.5,
        peak: 0.45,
      });
      for (let k = 0; k < 8; k++)
        noiseBurst(kit, at + 0.05 + Math.random() * 0.4, {
          type: 'highpass',
          freq: 2500 + Math.random() * 3000,
          attack: 0.001,
          decay: 0.03,
          peak: 0.35,
        });
    }
    tone(hall, 0, { type: 'sawtooth', freq: 41, attack: 0.4, decay: 2.4, peak: 0.2, filter: 200 });
  },
  sakura: (kit) => {
    // Koto: notas pentatônicas dedilhadas e o vento das pétalas.
    const hall = withReverb(kit, 3, 0.45);
    [523, 587, 698, 784, 880, 1047].forEach((freq, i) =>
      tone(hall, 0.2 + i * 0.16, { type: 'triangle', freq, attack: 0.003, decay: 0.9, peak: 0.12 }),
    );
    noiseBurst(hall, 0.9, {
      type: 'bandpass',
      freq: 1200,
      toFreq: 600,
      q: 0.8,
      attack: 0.4,
      decay: 1.6,
      peak: 0.25,
    });
  },
  phoenix: (kit) => {
    // Brasa acendendo, labareda e o grito agudo da ave.
    const hall = withReverb(kit, 3, 0.4);
    noiseBurst(hall, 0.1, {
      type: 'lowpass',
      freq: 400,
      toFreq: 2500,
      attack: 0.6,
      decay: 0.5,
      peak: 0.4,
    });
    noiseBurst(hall, 0.9, {
      type: 'bandpass',
      freq: 900,
      q: 0.7,
      attack: 0.05,
      decay: 1.4,
      peak: 0.6,
    });
    sung(
      hall,
      1.1,
      [
        [0, 1400],
        [0.3, 2200],
        [1, 1600],
      ],
      { type: 'sawtooth', peak: 0.07, attack: 0.05, decay: 1, vibrato: 9, depth: 40, filter: 3000 },
    );
  },
  kitsune: (kit) => {
    // Sinos de templo distantes e um uivo etéreo.
    const hall = withReverb(kit, 4, 0.55);
    for (let i = 0; i < 9; i++)
      tone(hall, 0.2 + i * 0.1, {
        type: 'sine',
        freq: 1320 + (i % 3) * 220,
        attack: 0.002,
        decay: 1.2,
        peak: 0.06,
      });
    sung(
      hall,
      1.2,
      [
        [0, 500],
        [0.6, 800],
        [1.6, 450],
      ],
      { type: 'sine', peak: 0.08, attack: 0.3, decay: 1.4, vibrato: 5, depth: 12 },
    );
  },
  mirror: (kit) => {
    // Estalo, vidro trincando e cacos tilintando ao cair.
    noiseBurst(kit, 0.35, { type: 'highpass', freq: 3000, attack: 0.001, decay: 0.25, peak: 0.6 });
    for (let i = 0; i < 12; i++)
      tone(kit, 1.3 + i * 0.09 + Math.random() * 0.05, {
        type: 'sine',
        freq: 2500 + Math.random() * 2500,
        attack: 0.001,
        decay: 0.15,
        peak: 0.07,
      });
  },
  aurora: (kit) => {
    // Coro suave que cresce, como luz cantando.
    const hall = withReverb(kit, 5, 0.6);
    [262, 330, 392, 494].forEach((freq, i) =>
      tone(hall, 0.3 + i * 0.25, { type: 'sine', freq, attack: 0.8, decay: 2.2, peak: 0.06 }),
    );
  },
  zombie: (kit) => {
    // Terra remexida e gemidos da horda.
    noiseBurst(kit, 0.3, {
      type: 'lowpass',
      freq: 300,
      attack: 0.1,
      decay: 1.2,
      peak: 0.5,
      rate: 0.6,
    });
    growl(kit, 0.6, 70, 1.4);
    growl(kit, 1.2, 85, 1.2);
  },
  sungod: (kit) => {
    // Batuque animado, o soco de borracha esticando (boing) e uma gargalhada alegre.
    const hall = withReverb(kit, 2, 0.3);
    [0, 0.22, 0.44, 0.55, 0.66, 0.88].forEach((at, i) => {
      tone(hall, at, {
        type: 'sine',
        freq: i % 3 === 2 ? 140 : 95,
        toFreq: 50,
        attack: 0.003,
        decay: 0.25,
        peak: 0.6,
      });
      noiseBurst(hall, at, {
        type: 'bandpass',
        freq: 1800,
        q: 1,
        attack: 0.002,
        decay: 0.05,
        peak: 0.15,
      });
    });
    sung(
      kit,
      0.95,
      [
        [0, 180],
        [0.25, 700],
      ],
      { type: 'sine', peak: 0.25, attack: 0.01, decay: 0.25, vibrato: 18, depth: 25 },
    );
    tone(hall, 1.2, { type: 'sine', freq: 90, toFreq: 35, attack: 0.003, decay: 0.6, peak: 0.95 });
    noiseBurst(hall, 1.2, {
      type: 'lowpass',
      freq: 2500,
      toFreq: 200,
      attack: 0.003,
      decay: 0.4,
      peak: 0.6,
    });
    for (let i = 0; i < 8; i++) {
      const pitch = 300 + (i % 2) * 40 - i * 6;
      voice(
        hall,
        1.7 + i * 0.16,
        [
          [0, pitch * 1.15],
          [0.12, pitch * 0.85],
        ],
        { peak: 0.3, attack: 0.01, decay: 0.12, formants: AAH, vibrato: 0, depth: 0 },
      );
    }
  },
  tarrasque: (kit) => {
    // Terremoto longo, a terra rachando, espinhos rompendo o chão e um urro colossal.
    const hall = withReverb(kit, 3.5, 0.45);
    noiseBurst(hall, 0, {
      type: 'lowpass',
      freq: 90,
      attack: 0.3,
      decay: 2.8,
      peak: 0.9,
      rate: 0.4,
    });
    for (const at of [0.1, 0.4, 0.7])
      tone(hall, at, { type: 'sine', freq: 45, toFreq: 22, attack: 0.005, decay: 0.8, peak: 0.8 });
    for (let i = 0; i < 16; i++)
      noiseBurst(kit, 0.6 + Math.random() * 1.2, {
        type: 'highpass',
        freq: 1800,
        attack: 0.002,
        decay: 0.12,
        peak: 0.3,
      });
    growl(hall, 1.6, 38, 2.2);
    growl(hall, 1.65, 76, 2);
  },
  sans: (kit) => {
    // Chiptune de batalha (baixo em onda quadrada), canhões carregando e o raio disparando.
    const notes = [146.83, 146.83, 293.66, 220, 207.65, 196, 174.61, 146.83];
    for (let r = 0; r < 2; r++)
      notes.forEach((freq, i) =>
        tone(kit, r * 0.9 + i * 0.11, {
          type: 'square',
          freq: freq * (r ? 1.12 : 1),
          attack: 0.003,
          decay: 0.09,
          peak: 0.08,
          filter: 2500,
        }),
      );
    for (const at of [1, 1.6]) {
      tone(kit, at - 0.35, {
        type: 'square',
        freq: 200,
        toFreq: 1400,
        attack: 0.01,
        decay: 0.35,
        peak: 0.07,
        filter: 3000,
      });
      noiseBurst(kit, at, {
        type: 'lowpass',
        freq: 5000,
        toFreq: 800,
        attack: 0.005,
        decay: 0.5,
        peak: 0.5,
      });
      tone(kit, at, {
        type: 'sawtooth',
        freq: 110,
        attack: 0.005,
        decay: 0.5,
        peak: 0.15,
        filter: 1500,
      });
    }
  },
  hollow: (kit) => {
    // Piano melancólico com eco, três golpes de agulha e a explosão de alma.
    const hall = withReverb(kit, 3.5, 0.55);
    [523.25, 466.16, 392, 311.13, 392].forEach((freq, i) =>
      tone(hall, i * 0.32, { type: 'triangle', freq, attack: 0.005, decay: 1.6, peak: 0.12 }),
    );
    for (const at of [0.4, 0.6, 0.8])
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 6000,
        toFreq: 1500,
        q: 2,
        attack: 0.003,
        decay: 0.12,
        peak: 0.45,
      });
    tone(hall, 1.2, { type: 'sine', freq: 60, toFreq: 30, attack: 0.005, decay: 1.4, peak: 0.8 });
    noiseBurst(hall, 1.2, {
      type: 'bandpass',
      freq: 400,
      toFreq: 3000,
      q: 1,
      attack: 0.02,
      decay: 0.8,
      peak: 0.35,
    });
  },
  doom: (kit) => {
    // Zumbido metálico de armadura, feitiço esmeralda, descargas e a explosão final.
    const hall = withReverb(kit, 3, 0.45);
    for (const base of [55, 56.5])
      sung(
        hall,
        0,
        [
          [0, base],
          [2.4, base],
        ],
        {
          type: 'sawtooth',
          peak: 0.12,
          attack: 0.4,
          decay: 2.2,
          vibrato: 2,
          depth: 1,
          filter: 400,
        },
      );
    noiseBurst(hall, 0.3, {
      type: 'bandpass',
      freq: 2000,
      toFreq: 7000,
      q: 3,
      attack: 0.8,
      decay: 0.4,
      peak: 0.15,
    });
    for (let i = 0; i < 12; i++)
      noiseBurst(kit, 0.5 + Math.random() * 1.5, {
        type: 'highpass',
        freq: 3000,
        attack: 0.001,
        decay: 0.05,
        peak: 0.3,
      });
    for (const at of [0.5, 0.75, 1])
      tone(hall, at, {
        type: 'square',
        freq: 120,
        toFreq: 80,
        attack: 0.002,
        decay: 0.3,
        peak: 0.25,
        filter: 1200,
      });
    tone(hall, 1.9, { type: 'sine', freq: 70, toFreq: 30, attack: 0.003, decay: 1.2, peak: 0.9 });
  },
  zoro: (kit) => {
    // Três lâminas saindo da bainha, três cortes, o redemoinho de lâminas e o clique da bainha.
    const hall = withReverb(kit, 2.5, 0.35);
    for (let i = 0; i < 3; i++) {
      noiseBurst(kit, i * 0.08, {
        type: 'highpass',
        freq: 2500,
        toFreq: 9000,
        attack: 0.1,
        decay: 0.1,
        peak: 0.2,
      });
      tone(hall, 0.1 + i * 0.08, {
        type: 'sine',
        freq: 3000 + i * 400,
        attack: 0.002,
        decay: 1,
        peak: 0.05,
      });
    }
    for (const at of [0.4, 0.6, 0.8])
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 7000,
        toFreq: 1200,
        q: 2,
        attack: 0.003,
        decay: 0.12,
        peak: 0.55,
      });
    noiseBurst(hall, 1.2, {
      type: 'bandpass',
      freq: 400,
      toFreq: 2500,
      q: 1.5,
      attack: 0.3,
      decay: 0.9,
      peak: 0.45,
    });
    tone(kit, 2.5, {
      type: 'square',
      freq: 1800,
      attack: 0.002,
      decay: 0.04,
      peak: 0.2,
      filter: 4000,
    });
    noiseBurst(hall, 2.55, {
      type: 'bandpass',
      freq: 5000,
      toFreq: 800,
      q: 1,
      attack: 0.003,
      decay: 0.4,
      peak: 0.6,
    });
  },
  blackhole: (kit) => {
    // Um grave que desce sem fim, o chiado do disco e o colapso.
    const hall = withReverb(kit, 4, 0.5);
    sung(
      hall,
      0,
      [
        [0, 120],
        [2.2, 30],
      ],
      { type: 'sawtooth', peak: 0.2, attack: 0.4, decay: 2, vibrato: 3, depth: 2, filter: 300 },
    );
    noiseBurst(hall, 0.3, {
      type: 'bandpass',
      freq: 3000,
      toFreq: 300,
      q: 2,
      attack: 1.5,
      decay: 0.5,
      peak: 0.2,
    });
    tone(hall, 2.3, { type: 'sine', freq: 50, toFreq: 20, attack: 0.003, decay: 1.4, peak: 1 });
    tone(hall, 2.3, {
      type: 'sine',
      freq: 2400,
      toFreq: 1200,
      attack: 0.003,
      decay: 1.2,
      peak: 0.06,
    });
  },
  fullmetal: (kit) => {
    // Palmas, a transmutação crepitando em azul e o chão rompendo em pedra.
    const hall = withReverb(kit, 2.5, 0.35);
    noiseBurst(hall, 0.3, {
      type: 'bandpass',
      freq: 1500,
      q: 1,
      attack: 0.002,
      decay: 0.08,
      peak: 0.8,
    });
    for (let i = 0; i < 24; i++)
      noiseBurst(kit, 0.4 + Math.random() * 0.7, {
        type: 'highpass',
        freq: 3500,
        attack: 0.001,
        decay: 0.03,
        peak: 0.3,
      });
    sung(
      hall,
      0.4,
      [
        [0, 300],
        [0.6, 900],
      ],
      {
        type: 'square',
        peak: 0.05,
        attack: 0.05,
        decay: 0.6,
        vibrato: 30,
        depth: 20,
        filter: 3000,
      },
    );
    for (let i = 0; i < 10; i++)
      noiseBurst(hall, 1 + i * 0.05, {
        type: 'lowpass',
        freq: 900,
        attack: 0.003,
        decay: 0.12,
        peak: 0.4,
      });
    tone(hall, 1, { type: 'sine', freq: 65, toFreq: 30, attack: 0.003, decay: 0.9, peak: 0.85 });
  },
  sahur: (kit) => {
    // Batidas de madeira ("tung, tung, tung") e a pancada final.
    const hall = withReverb(kit, 2, 0.3);
    for (const at of [0.3, 0.7, 1.1]) {
      tone(hall, at, {
        type: 'sine',
        freq: 320,
        toFreq: 160,
        attack: 0.002,
        decay: 0.18,
        peak: 0.6,
      });
      noiseBurst(hall, at, {
        type: 'bandpass',
        freq: 900,
        q: 3,
        attack: 0.002,
        decay: 0.08,
        peak: 0.45,
      });
      voice(
        hall,
        at + 0.02,
        [
          [0, 140],
          [0.15, 110],
        ],
        { peak: 0.2, attack: 0.01, decay: 0.15, formants: OOH, vibrato: 0, depth: 0 },
      );
    }
    tone(hall, 1.6, { type: 'sine', freq: 260, toFreq: 70, attack: 0.002, decay: 0.6, peak: 0.95 });
    noiseBurst(hall, 1.6, {
      type: 'lowpass',
      freq: 2000,
      toFreq: 200,
      attack: 0.002,
      decay: 0.4,
      peak: 0.6,
    });
  },
  spider: (kit) => {
    // "Tchuf" das teias disparando de todos os cantos e a teia esticando.
    for (const at of [0.2, 0.35, 0.5, 0.65, 0.9, 1.05]) {
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 2500,
        toFreq: 6000,
        q: 3,
        attack: 0.003,
        decay: 0.08,
        peak: 0.45,
      });
      tone(kit, at, {
        type: 'sine',
        freq: 900,
        toFreq: 1800,
        attack: 0.003,
        decay: 0.07,
        peak: 0.12,
      });
    }
    sung(
      kit,
      1.3,
      [
        [0, 220],
        [0.6, 160],
        [1, 260],
      ],
      { type: 'triangle', peak: 0.12, attack: 0.05, decay: 1, vibrato: 12, depth: 10 },
    );
    tone(withReverb(kit, 2, 0.3), 2.2, {
      type: 'sine',
      freq: 520,
      toFreq: 1040,
      attack: 0.005,
      decay: 0.4,
      peak: 0.15,
    });
  },
  akatsuki: (kit) => {
    // Vento noturno, um grave sombrio e uma revoada de corvos grasnando.
    const hall = withReverb(kit, 3, 0.45);
    noiseBurst(hall, 0, {
      type: 'bandpass',
      freq: 500,
      toFreq: 900,
      q: 1,
      attack: 0.8,
      decay: 2.2,
      peak: 0.15,
    });
    tone(hall, 0, { type: 'sawtooth', freq: 49, attack: 0.6, decay: 2.4, peak: 0.18, filter: 250 });
    for (let i = 0; i < 9; i++) {
      const base = 650 + Math.random() * 250;
      voice(
        hall,
        0.4 + Math.random() * 1.8,
        [
          [0, base],
          [0.18, base * 0.75],
        ],
        {
          peak: 0.12,
          attack: 0.01,
          decay: 0.18,
          formants: [
            [1200, 4, 1],
            [2400, 6, 0.4],
          ],
          vibrato: 0,
          depth: 0,
          type: 'sawtooth',
        },
      );
    }
    for (let i = 0; i < 20; i++)
      noiseBurst(kit, 0.4 + Math.random() * 1.5, {
        type: 'bandpass',
        freq: 600,
        q: 2,
        attack: 0.01,
        decay: 0.05,
        peak: 0.12,
      });
  },
  hisoka: (kit) => {
    // Cartas zunindo, o elástico esticando e voltando e uma risadinha.
    for (let i = 0; i < 10; i++)
      noiseBurst(kit, 0.2 + i * 0.07, {
        type: 'bandpass',
        freq: 4000,
        toFreq: 1500,
        q: 2,
        attack: 0.002,
        decay: 0.06,
        peak: 0.25,
      });
    sung(
      kit,
      0.9,
      [
        [0, 120],
        [0.7, 260],
      ],
      { type: 'triangle', peak: 0.12, attack: 0.05, decay: 0.7, vibrato: 14, depth: 12 },
    );
    sung(
      kit,
      1.8,
      [
        [0, 400],
        [0.12, 90],
      ],
      { type: 'sine', peak: 0.3, attack: 0.003, decay: 0.2, vibrato: 25, depth: 30 },
    );
    for (let i = 0; i < 5; i++)
      voice(
        withReverb(kit, 2, 0.3),
        2.1 + i * 0.13,
        [
          [0, 190],
          [0.1, 160],
        ],
        { peak: 0.14, attack: 0.01, decay: 0.1, formants: AAH, vibrato: 0, depth: 0 },
      );
  },
  valorant: (kit) => {
    // Tiros secos, o artefato plantado bipando cada vez mais rápido e a detonação.
    for (const at of [0.1, 0.22, 0.34]) {
      noiseBurst(kit, at, { type: 'highpass', freq: 1200, attack: 0.001, decay: 0.08, peak: 0.6 });
      tone(kit, at, { type: 'sine', freq: 140, toFreq: 60, attack: 0.001, decay: 0.08, peak: 0.4 });
    }
    let at = 0.6;
    for (let gap = 0.28; at < 2; gap = Math.max(0.05, gap * 0.8)) {
      tone(kit, at, {
        type: 'square',
        freq: 2100,
        attack: 0.002,
        decay: 0.05,
        peak: 0.08,
        filter: 5000,
      });
      at += gap;
    }
    const hall = withReverb(kit, 3, 0.45);
    tone(hall, 2.05, { type: 'sine', freq: 65, toFreq: 25, attack: 0.003, decay: 1.5, peak: 1 });
    noiseBurst(hall, 2.05, {
      type: 'lowpass',
      freq: 4000,
      toFreq: 150,
      attack: 0.003,
      decay: 1.2,
      peak: 0.8,
    });
  },
  league: (kit) => {
    // Sinos de subir de nível, cinco toques crescentes e um coro dourado.
    const hall = withReverb(kit, 3, 0.45);
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone(hall, i * 0.08, { type: 'sine', freq, attack: 0.005, decay: 1, peak: 0.12 }),
    );
    for (let i = 0; i < 5; i++) {
      tone(hall, 0.7 + i * 0.25, {
        type: 'triangle',
        freq: 392 * 2 ** (i / 6),
        attack: 0.005,
        decay: 0.5,
        peak: 0.12,
      });
      tone(hall, 0.7 + i * 0.25, {
        type: 'sine',
        freq: 784 * 2 ** (i / 6),
        attack: 0.005,
        decay: 0.4,
        peak: 0.05,
      });
    }
    for (const freq of [261.63, 329.63, 392, 523.25])
      voice(
        hall,
        2,
        [
          [0, freq],
          [1.2, freq],
        ],
        { peak: 0.06, attack: 0.3, decay: 1.2, formants: AAH, vibrato: 5, depth: 4 },
      );
  },
  // Foxy: o som vem do próprio vídeo do crítico.
  foxy: () => {},
  mario: (kit) => {
    // Blocos batendo, moedinhas, um "boing" de pulo e uma fanfarra 8-bit.
    for (let i = 0; i < 5; i++) {
      const at = 0.3 + i * 0.2;
      tone(kit, at, {
        type: 'square',
        freq: 200,
        toFreq: 120,
        attack: 0.002,
        decay: 0.06,
        peak: 0.12,
        filter: 2000,
      });
      tone(kit, at + 0.04, {
        type: 'triangle',
        freq: 1568,
        attack: 0.002,
        decay: 0.25,
        peak: 0.12,
      });
    }
    sung(
      kit,
      1.4,
      [
        [0, 300],
        [0.2, 900],
      ],
      { type: 'square', peak: 0.06, attack: 0.005, decay: 0.2, vibrato: 0, depth: 0, filter: 3000 },
    );
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((freq, i) =>
      tone(kit, 1.8 + i * 0.1, {
        type: 'square',
        freq,
        attack: 0.005,
        decay: i === 5 ? 0.6 : 0.09,
        peak: 0.08,
        filter: 3500,
      }),
    );
  },
  retro: (kit) => {
    // Modem discando, "plim" de janela abrindo sem parar, uma voz robótica e o erro final.
    for (const [at, freq] of [
      [0, 697],
      [0.08, 1209],
      [0.16, 770],
      [0.24, 1336],
      [0.32, 852],
    ] as const)
      tone(kit, at, { type: 'sine', freq, attack: 0.005, decay: 0.07, peak: 0.12 });
    noiseBurst(kit, 0.45, {
      type: 'bandpass',
      freq: 1800,
      toFreq: 2400,
      q: 6,
      attack: 0.02,
      decay: 0.5,
      peak: 0.25,
    });
    tone(kit, 0.5, {
      type: 'square',
      freq: 2100,
      toFreq: 980,
      attack: 0.02,
      decay: 0.45,
      peak: 0.06,
      filter: 4000,
    });
    for (let i = 0; i < 14; i++) {
      const at = 0.2 + i * 0.15;
      tone(kit, at, { type: 'sine', freq: 1319, attack: 0.003, decay: 0.12, peak: 0.07 });
      tone(kit, at + 0.06, { type: 'sine', freq: 988, attack: 0.003, decay: 0.18, peak: 0.07 });
    }
    for (let i = 0; i < 6; i++)
      voice(
        kit,
        1 + i * 0.14,
        [
          [0, 150],
          [0.12, 150],
        ],
        {
          peak: 0.18,
          attack: 0.01,
          decay: 0.12,
          formants: i % 2 ? OOH : AAH,
          vibrato: 0,
          depth: 0,
          type: 'square',
        },
      );
    tone(withReverb(kit, 2, 0.3), 2.4, {
      type: 'square',
      freq: 220,
      toFreq: 110,
      attack: 0.005,
      decay: 0.6,
      peak: 0.15,
      filter: 1500,
    });
  },
};

/** Falha crítica: trombone triste ("uón, uón, uón, uóóóón"). */
/** Sons extras de algumas falhas (por cima do trombone). */
const FAIL_EXTRAS: Partial<Record<DiceAura, (kit: Kit) => void>> = {
  heaven: (kit) => {
    // O relógio trava: um último "tic" e silêncio.
    tone(kit, 0.6, {
      type: 'square',
      freq: 1500,
      attack: 0.002,
      decay: 0.03,
      peak: 0.15,
      filter: 4000,
    });
  },
  purple: (kit) => {
    // O corte.
    noiseBurst(kit, 0.8, {
      type: 'bandpass',
      freq: 6000,
      toFreq: 1000,
      q: 1.5,
      attack: 0.003,
      decay: 0.15,
      peak: 0.6,
    });
  },
  wheel: (kit) => {
    // Os cortes picotando a roda.
    for (let i = 0; i < 40; i++)
      noiseBurst(kit, 0.9 + i * 0.025, {
        type: 'bandpass',
        freq: 5000 + Math.random() * 3000,
        q: 2,
        attack: 0.001,
        decay: 0.03,
        peak: 0.2,
      });
  },
  capture: (kit) => {
    // Balança... e a esfera estoura.
    for (const at of [1.2, 1.6])
      tone(kit, at, { type: 'sine', freq: 220, toFreq: 160, attack: 0.003, decay: 0.1, peak: 0.3 });
    noiseBurst(kit, 2, { type: 'lowpass', freq: 2000, attack: 0.002, decay: 0.2, peak: 0.5 });
  },
  darklord: (kit) => {
    // A lâmina engasga e desliga.
    sung(
      kit,
      0.4,
      [
        [0, 90],
        [0.8, 25],
      ],
      {
        type: 'sawtooth',
        peak: 0.2,
        attack: 0.02,
        decay: 0.8,
        vibrato: 18,
        depth: 10,
        filter: 800,
      },
    );
    for (let i = 0; i < 6; i++)
      noiseBurst(kit, 0.5 + Math.random() * 0.6, {
        type: 'highpass',
        freq: 3000,
        attack: 0.001,
        decay: 0.04,
        peak: 0.25,
      });
  },
  notebook: (kit) => {
    // Mordida crocante na maçã.
    for (let i = 0; i < 6; i++)
      noiseBurst(kit, 0.6 + i * 0.03, {
        type: 'bandpass',
        freq: 2200,
        q: 2,
        attack: 0.002,
        decay: 0.04,
        peak: 0.35,
      });
  },
  orbs: (kit) => {
    // As esferas rachando.
    for (let i = 0; i < 7; i++)
      noiseBurst(kit, 0.9 + i * 0.12, {
        type: 'highpass',
        freq: 2500,
        attack: 0.002,
        decay: 0.12,
        peak: 0.35,
      });
  },
  cthulhu: (kit) => {
    // O polvinho: um "blub" e o esguicho de tinta.
    tone(kit, 0.5, { type: 'sine', freq: 300, toFreq: 700, attack: 0.01, decay: 0.12, peak: 0.25 });
    noiseBurst(kit, 1.1, {
      type: 'bandpass',
      freq: 900,
      toFreq: 300,
      q: 2,
      attack: 0.01,
      decay: 0.25,
      peak: 0.35,
    });
  },
  haki: (kit) => {
    // Pressão fraquinha: um "vum" que murcha e uma estática pífia.
    sung(
      kit,
      0.3,
      [
        [0, 80],
        [0.4, 40],
      ],
      {
        type: 'sawtooth',
        peak: 0.15,
        attack: 0.05,
        decay: 0.4,
        vibrato: 25,
        depth: 4,
        filter: 500,
      },
    );
    for (let i = 0; i < 3; i++)
      noiseBurst(kit, 0.4 + i * 0.1, {
        type: 'highpass',
        freq: 3000,
        attack: 0.001,
        decay: 0.03,
        peak: 0.15,
      });
  },
  shadow: (kit) => {
    // Flashbang: estouro e o zumbido no ouvido.
    noiseBurst(kit, 0.7, {
      type: 'lowpass',
      freq: 4000,
      toFreq: 300,
      attack: 0.002,
      decay: 0.4,
      peak: 0.9,
    });
    tone(kit, 0.7, { type: 'sine', freq: 90, toFreq: 40, attack: 0.002, decay: 0.3, peak: 0.6 });
    tone(kit, 0.75, { type: 'sine', freq: 4200, attack: 0.05, decay: 2.4, peak: 0.08 });
  },
  holy: (kit) => {
    // O diabinho dá risada.
    for (let i = 0; i < 6; i++)
      tone(kit, 0.6 + i * 0.12, {
        type: 'square',
        freq: 520 - i * 25,
        toFreq: 440 - i * 25,
        attack: 0.01,
        decay: 0.09,
        peak: 0.08,
        filter: 2200,
      });
  },
  cosmic: (kit) => {
    // Cutucada e o "ai!" do olho.
    tone(kit, 1, { type: 'sine', freq: 300, toFreq: 120, attack: 0.003, decay: 0.1, peak: 0.4 });
    sung(
      kit,
      1.05,
      [
        [0, 900],
        [0.25, 500],
      ],
      { type: 'triangle', peak: 0.15, attack: 0.01, decay: 0.3, vibrato: 12, depth: 30 },
    );
  },
  cyber: (kit) => {
    // Ciberpsicose: chiado, coração disparado e um grito distorcido.
    for (let i = 0; i < 10; i++)
      tone(kit, 0.2 + i * 0.22, {
        type: 'sine',
        freq: 70,
        toFreq: 40,
        attack: 0.005,
        decay: 0.12,
        peak: 0.5,
      });
    noiseBurst(kit, 0.3, { type: 'highpass', freq: 2500, attack: 0.05, decay: 2, peak: 0.18 });
    tone(kit, 0.9, {
      type: 'sawtooth',
      freq: 300,
      toFreq: 900,
      attack: 0.05,
      decay: 0.8,
      peak: 0.12,
      filter: 3000,
    });
  },
  phoenix: (kit) => {
    // Cocoricó rouco.
    sung(
      kit,
      0.7,
      [
        [0, 700],
        [0.15, 1100],
        [0.4, 600],
      ],
      { type: 'square', peak: 0.05, attack: 0.02, decay: 0.4, filter: 1800 },
    );
  },
  mirror: (kit) => {
    tone(kit, 0.45, { type: 'sine', freq: 3200, attack: 0.001, decay: 0.08, peak: 0.12 });
  },
  zombie: (kit) => {
    tone(kit, 1.25, {
      type: 'sine',
      freq: 180,
      toFreq: 120,
      attack: 0.005,
      decay: 0.15,
      peak: 0.2,
    });
  },
  sungod: (kit) => {
    // O soberano oculto: um grave sinistro.
    tone(withReverb(kit, 3, 0.5), 0.3, {
      type: 'sawtooth',
      freq: 46,
      attack: 0.6,
      decay: 1.8,
      peak: 0.25,
      filter: 240,
    });
  },
  tarrasque: (kit) => {
    // Ronco gigante.
    for (const at of [0.4, 1.4])
      noiseBurst(kit, at, {
        type: 'lowpass',
        freq: 250,
        attack: 0.4,
        decay: 0.5,
        peak: 0.4,
        rate: 0.4,
      });
  },
  sans: (kit) => {
    // Os bipes da caixa de diálogo, letra por letra.
    for (let i = 0; i < 18; i++)
      tone(kit, 0.4 + i * 0.06, {
        type: 'square',
        freq: 520,
        attack: 0.002,
        decay: 0.03,
        peak: 0.06,
        filter: 3000,
      });
  },
  hollow: (kit) => {
    // A máscara trincando.
    for (let i = 0; i < 5; i++)
      noiseBurst(kit, 0.9 + i * 0.04, {
        type: 'highpass',
        freq: 3000,
        attack: 0.001,
        decay: 0.05,
        peak: 0.3,
      });
  },
  doom: (kit) => {
    // Faísca que morre e a placa de metal caindo.
    noiseBurst(kit, 0.3, { type: 'highpass', freq: 3000, attack: 0.002, decay: 0.2, peak: 0.25 });
    tone(withReverb(kit, 2, 0.3), 1.2, {
      type: 'square',
      freq: 180,
      toFreq: 120,
      attack: 0.002,
      decay: 0.5,
      peak: 0.25,
      filter: 2000,
    });
  },
  zoro: (kit) => {
    // Perdido: a bússola girando sem parar.
    for (let i = 0; i < 12; i++)
      tone(kit, 0.3 + i * 0.08, {
        type: 'square',
        freq: 900 + (i % 2) * 200,
        attack: 0.002,
        decay: 0.03,
        peak: 0.05,
        filter: 3000,
      });
  },
  blackhole: (kit) => {
    // Um "plop" minúsculo.
    tone(kit, 0.8, { type: 'sine', freq: 600, toFreq: 120, attack: 0.002, decay: 0.12, peak: 0.3 });
  },
  fullmetal: (kit) => {
    // Rebote: um grave invertido e mãos escuras puxando.
    sung(
      withReverb(kit, 3, 0.5),
      0.4,
      [
        [0, 40],
        [1.2, 120],
      ],
      { type: 'sawtooth', peak: 0.2, attack: 0.3, decay: 1, vibrato: 4, depth: 3, filter: 400 },
    );
  },
  sahur: (kit) => {
    // O taco racha: um "tunc" fraco e madeira quebrando.
    tone(kit, 0.5, { type: 'sine', freq: 200, toFreq: 120, attack: 0.002, decay: 0.12, peak: 0.3 });
    for (let i = 0; i < 6; i++)
      noiseBurst(kit, 0.55 + i * 0.03, {
        type: 'bandpass',
        freq: 1500,
        q: 2,
        attack: 0.001,
        decay: 0.04,
        peak: 0.3,
      });
  },
  spider: (kit) => {
    // Uma teia meleca e uma aranhinha descendo pelo fio.
    noiseBurst(kit, 0.3, {
      type: 'bandpass',
      freq: 2000,
      toFreq: 600,
      q: 2,
      attack: 0.01,
      decay: 0.2,
      peak: 0.3,
    });
  },
  akatsuki: (kit) => {
    // Um corvo só, sem graça.
    voice(
      kit,
      0.5,
      [
        [0, 700],
        [0.2, 520],
      ],
      { peak: 0.14, attack: 0.01, decay: 0.2, formants: [[1200, 4, 1]], vibrato: 0, depth: 0 },
    );
  },
  hisoka: (kit) => {
    // Carta caindo e o chiclete grudando.
    sung(
      kit,
      0.8,
      [
        [0, 300],
        [0.4, 120],
      ],
      { type: 'triangle', peak: 0.12, attack: 0.01, decay: 0.4, vibrato: 10, depth: 8 },
    );
  },
  valorant: (kit) => {
    // Rajada errando: balas batendo em volta.
    for (let i = 0; i < 6; i++)
      noiseBurst(kit, 0.3 + i * 0.09, {
        type: 'highpass',
        freq: 1500,
        attack: 0.001,
        decay: 0.06,
        peak: 0.4,
      });
  },
  league: (kit) => {
    // O cristal trincando e se partindo.
    for (let i = 0; i < 8; i++)
      noiseBurst(kit, 0.9 + i * 0.05, {
        type: 'highpass',
        freq: 3500,
        attack: 0.001,
        decay: 0.08,
        peak: 0.3,
      });
  },
  mario: (kit) => {
    // Caindo no buraco: notas descendo.
    [784, 659, 523, 392, 330].forEach((freq, i) =>
      tone(kit, 0.4 + i * 0.14, {
        type: 'square',
        freq,
        attack: 0.003,
        decay: 0.12,
        peak: 0.07,
        filter: 3000,
      }),
    );
  },
  retro: (kit) => {
    // Varredura do antivírus (bipes) e o "ameaça removida".
    for (let i = 0; i < 10; i++)
      tone(kit, 0.3 + i * 0.12, {
        type: 'square',
        freq: 1500,
        attack: 0.002,
        decay: 0.03,
        peak: 0.05,
        filter: 4000,
      });
    tone(kit, 1.8, { type: 'sine', freq: 880, attack: 0.005, decay: 0.2, peak: 0.12 });
    tone(kit, 1.95, { type: 'sine', freq: 1320, attack: 0.005, decay: 0.4, peak: 0.12 });
  },
};

export function playFailSound(aura?: DiceAura) {
  if (!auraSoundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    const kit = { ctx, out: master, now: ctx.currentTime + 0.02 };
    if (aura) FAIL_EXTRAS[aura]?.(kit);
    const notes: [number, number, number][] = [
      [0.25, 293.66, 0.35],
      [0.7, 277.18, 0.35],
      [1.15, 261.63, 0.35],
      [1.6, 246.94, 1.1],
    ];
    for (const [at, freq, decay] of notes) {
      tone(kit, at, {
        type: 'sawtooth',
        freq,
        toFreq: freq * 0.97,
        attack: 0.04,
        decay,
        peak: 0.16,
        filter: 1100,
      });
      tone(kit, at, {
        type: 'square',
        freq: freq / 2,
        attack: 0.04,
        decay,
        peak: 0.05,
        filter: 700,
      });
    }
  } catch (error) {
    console.error('[codexveil] som da falha indisponível', error);
  }
}

/** Toca o som do crítico da aura (se o navegador permitir e o som estiver ligado). */
export function playCriticalSound(aura: DiceAura) {
  if (!auraSoundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor).connect(ctx.destination);
    SOUNDS[aura]({ ctx, out: master, now: ctx.currentTime + 0.02 });
  } catch (error) {
    console.error('[codexveil] som da aura indisponível', error);
  }
}
