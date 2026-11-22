'use client';

/**
 * Imagem própria do crítico: a conta de criador pode enviar uma imagem sua para uma aura (fica no
 * armazenamento dela, fora do código). No crítico, quem rolou é o "dono": a imagem dele é buscada,
 * assinada e carregada antes de o efeito começar (até ~1 s; sem ela, o efeito sai sem a imagem).
 */
import { signedMediaUrls } from '@codexveil/database';
import { preferencesSchema, type DiceAura } from '@codexveil/validation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { criticalAuraBurst, criticalFailBurst } from './aura-fx';
import { auraSoundEnabled } from './aura-sound';

const cache = new Map<string, Promise<HTMLImageElement | null>>();

async function ownerId(owner: string | null | undefined): Promise<string | null> {
  if (owner) return owner;
  const { data } = await getSupabaseBrowserClient().auth.getUser();
  return data.user?.id ?? null;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Imagem própria do dono para esta aura (ou nada). Guardada por 40 min (o link assinado dura 1 h). */
export function loadAuraArt(
  owner: string | null | undefined,
  aura: DiceAura,
): Promise<HTMLImageElement | null> {
  const run = async () => {
    const id = await ownerId(owner);
    if (!id) return null;
    const client = getSupabaseBrowserClient();
    const { data } = await client.from('profiles').select('preferences').eq('id', id).maybeSingle();
    const path = preferencesSchema.safeParse(data?.preferences).data?.auraArt[aura];
    if (!path) return null;
    const urls = await signedMediaUrls(client, [path]);
    return urls[path] ? loadImage(urls[path]) : null;
  };
  const key = `${owner ?? 'eu'}:${aura}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = run().catch(() => null);
    cache.set(key, promise);
    window.setTimeout(() => cache.delete(key), 40 * 60_000);
  }
  return promise;
}

const soundCache = new Map<string, Promise<string | null>>();

/** Link assinado do som próprio do dono para esta aura (ou nada). */
export function loadAuraSound(
  owner: string | null | undefined,
  aura: DiceAura,
): Promise<string | null> {
  const run = async () => {
    const id = await ownerId(owner);
    if (!id) return null;
    const client = getSupabaseBrowserClient();
    const { data } = await client.from('profiles').select('preferences').eq('id', id).maybeSingle();
    const path = preferencesSchema.safeParse(data?.preferences).data?.auraSound[aura];
    if (!path) return null;
    const urls = await signedMediaUrls(client, [path]);
    return urls[path] ?? null;
  };
  const key = `${owner ?? 'eu'}:${aura}`;
  let promise = soundCache.get(key);
  if (!promise) {
    promise = run().catch(() => null);
    soundCache.set(key, promise);
    window.setTimeout(() => soundCache.delete(key), 40 * 60_000);
  }
  return promise;
}

/** Toca o som próprio (no máximo 8 s, sumindo no fim). */
function playCustomSound(url: string) {
  const audio = new Audio(url);
  audio.volume = 0.8;
  void audio.play().catch(() => undefined);
  window.setTimeout(() => {
    const fade = window.setInterval(() => {
      audio.volume = Math.max(0, audio.volume - 0.1);
      if (audio.volume <= 0) {
        window.clearInterval(fade);
        audio.pause();
      }
    }, 80);
  }, 8_000);
}

/** Esquece a imagem guardada (depois de trocar ou remover em "Meus dados"). */
export function forgetAuraArt() {
  cache.clear();
  soundCache.clear();
}

/** Crítico ou falha com a imagem própria do dono, se houver (espera no máximo ~1 s por ela). */
export async function playAuraBurst(
  aura: DiceAura,
  kind: 'critical' | 'fumble',
  owner?: string | null,
) {
  const art = await Promise.race([
    loadAuraArt(owner, aura),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1_000)),
  ]);
  if (kind === 'fumble') return criticalFailBurst(aura, { art });
  // Som próprio do crítico (se o dono enviou um) no lugar do som sintetizado.
  const sound = auraSoundEnabled()
    ? await Promise.race([
        loadAuraSound(owner, aura),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 800)),
      ])
    : null;
  criticalAuraBurst(aura, { art, sound: !sound });
  if (sound) playCustomSound(sound);
}
