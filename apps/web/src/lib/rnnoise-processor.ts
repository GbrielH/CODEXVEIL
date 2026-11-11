import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';

/** Arquivos do RNNoise servidos pelo próprio site (copiados de @sapphi-red/web-noise-suppressor, MIT). */
const ASSETS = {
  worklet: '/audio/rnnoise/workletProcessor.js',
  wasm: '/audio/rnnoise/rnnoise.wasm',
  simd: '/audio/rnnoise/rnnoise_simd.wasm',
};

let wasmCache: Promise<ArrayBuffer> | null = null;

/**
 * Redução de ruído forte no microfone com o RNNoise (rede neural pequena, roda no navegador, sem
 * custo nem servidor). Remove teclado, ventilador, barulho de rua e conversa ao fundo bem melhor
 * que o filtro embutido do WebRTC. O RNNoise trabalha em 48 kHz: o processador usa um
 * AudioContext próprio nessa taxa e entrega ao LiveKit a faixa já limpa.
 */
export class RnnoiseProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = 'rnnoise';
  processedTrack?: MediaStreamTrack;
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private node?: RnnoiseWorkletNode;

  async init({ track }: AudioProcessorOptions): Promise<void> {
    const context = new AudioContext({ sampleRate: 48000 });
    await context.audioWorklet.addModule(ASSETS.worklet);
    wasmCache ??= loadRnnoise({ url: ASSETS.wasm, simdUrl: ASSETS.simd });
    const wasmBinary = await wasmCache;
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const node = new RnnoiseWorkletNode(context, { maxChannels: 1, wasmBinary });
    const destination = context.createMediaStreamDestination();
    source.connect(node).connect(destination);
    // Navegadores suspendem o áudio sem gesto do usuário; a chamada começou com um clique.
    if (context.state === 'suspended') await context.resume();
    this.context = context;
    this.source = source;
    this.node = node;
    this.processedTrack = destination.stream.getAudioTracks()[0];
  }

  async restart(options: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.init(options);
  }

  async destroy(): Promise<void> {
    this.source?.disconnect();
    this.node?.destroy();
    this.node?.disconnect();
    await this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.source = undefined;
    this.node = undefined;
    this.processedTrack = undefined;
  }
}

/** O navegador tem o necessário (AudioWorklet e WebAssembly)? */
export function supportsRnnoise(): boolean {
  return typeof window !== 'undefined' && typeof AudioWorkletNode !== 'undefined' && typeof WebAssembly !== 'undefined';
}
