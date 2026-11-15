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
    // Grave sombrio crescendo e sussurro.
    tone(kit, 0, {
      type: 'sawtooth',
      freq: 55,
      toFreq: 40,
      attack: 0.8,
      decay: 2.4,
      peak: 0.4,
      filter: 300,
    });
    tone(kit, 0, {
      type: 'sawtooth',
      freq: 58,
      toFreq: 41,
      attack: 0.8,
      decay: 2.4,
      peak: 0.3,
      filter: 300,
    });
    noiseBurst(kit, 0.2, {
      type: 'bandpass',
      freq: 1200,
      toFreq: 500,
      q: 4,
      attack: 1,
      decay: 1.6,
      peak: 0.25,
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
    // Clangor metálico, catraca e motor girando.
    for (const at of [0, 0.25, 0.6]) {
      tone(kit, at, {
        type: 'square',
        freq: 180 + Math.random() * 60,
        attack: 0.003,
        decay: 0.3,
        peak: 0.25,
        filter: 2500,
      });
      noiseBurst(kit, at, {
        type: 'bandpass',
        freq: 3200,
        q: 12,
        attack: 0.002,
        decay: 0.4,
        peak: 0.6,
      });
    }
    for (let i = 0; i < 24; i++)
      noiseBurst(kit, 0.7 + i * 0.045, {
        type: 'highpass',
        freq: 3000,
        attack: 0.001,
        decay: 0.02,
        peak: 0.35,
      });
    tone(kit, 0.3, {
      type: 'sawtooth',
      freq: 80,
      toFreq: 320,
      attack: 0.3,
      decay: 1.8,
      peak: 0.12,
      filter: 900,
    });
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
};

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
