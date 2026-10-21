'use client';

import { getActiveMap, getSessionMap, listMapTokens, signedMediaUrls, tokenImagePaths, type MapToken, type SessionMap } from '@codexveil/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

/** Um mapa específico (id), o ativo da campanha (jogadores) ou nenhum. */
export type MapSelector = { id: string } | 'active' | null;

export interface MapData {
  map: SessionMap | null;
  tokens: MapToken[];
  imageUrl: string | null;
  /** URL da imagem de cada token (id → URL assinada). */
  tokenImages: Record<string, string>;
}

async function load(campaignId: string, mapId: MapSelector): Promise<MapData> {
  const client = getSupabaseBrowserClient();
  if (!mapId) return { map: null, tokens: [], imageUrl: null, tokenImages: {} };
  const map = mapId === 'active' ? await getActiveMap(client, campaignId) : await getSessionMap(client, mapId.id);
  if (!map) return { map: null, tokens: [], imageUrl: null, tokenImages: {} };
  const tokens = await listMapTokens(client, map.id);
  const paths = await tokenImagePaths(client, tokens).catch((): Record<string, string> => ({}));
  const urls = await signedMediaUrls(client, [map.imagePath, ...Object.values(paths)]);
  const tokenImages = Object.fromEntries(Object.entries(paths).flatMap(([id, path]) => (urls[path] ? [[id, urls[path]]] : [])));
  return { map, tokens, imageUrl: map.imagePath ? (urls[map.imagePath] ?? null) : null, tokenImages };
}

/**
 * Mapa (o ativo, para jogadores, ou um escolhido pelo mestre) com os tokens e a URL da imagem,
 * recarregado em tempo real quando o mestre ou outro jogador muda algo.
 */
export function useMapData(campaignId: string, mapId: MapSelector) {
  const [data, setData] = useState<MapData>({ map: null, tokens: [], imageUrl: null, tokenImages: {} });
  const [loaded, setLoaded] = useState(false);

  // Só a resposta mais recente vale (respostas antigas chegando depois desfaziam mudanças), e
  // recargas do tempo real esperam os salvamentos locais em andamento terminarem.
  const sequence = useRef(0);
  const saving = useRef(0);
  const stale = useRef(false);

  const reload = useCallback(() => {
    if (saving.current > 0) {
      stale.current = true;
      return;
    }
    const request = ++sequence.current;
    load(campaignId, mapId)
      .then((next) => {
        if (request !== sequence.current) return;
        setData(next);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [campaignId, mapId]);

  /** Envolve um salvamento: enquanto ele roda, a tela não é sobrescrita por recargas. */
  const track = useCallback(
    async (save: () => Promise<unknown>) => {
      saving.current += 1;
      sequence.current += 1;
      try {
        await save();
      } finally {
        saving.current -= 1;
        if (saving.current === 0 && stale.current) {
          stale.current = false;
          reload();
        }
      }
    },
    [reload],
  );

  useEffect(() => {
    let active = true;
    load(campaignId, mapId)
      .then((next) => {
        if (!active) return;
        setData(next);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [campaignId, mapId]);

  const live = useRealtimeRefresh(
    `grade:${campaignId}:${mapId === null ? 'nenhum' : mapId === 'active' ? 'ativo' : mapId.id}`,
    [
      { table: 'session_maps', filter: `campaign_id=eq.${campaignId}` },
      { table: 'map_tokens', filter: `campaign_id=eq.${campaignId}` },
    ],
    reload,
  );

  // Jogadores: quando o mestre esconde o mapa, o banco deixa de enviar a linha (RLS) e o tempo
  // real não avisa; uma conferência periódica tira o mapa da tela.
  useEffect(() => {
    if (mapId !== 'active') return;
    const timer = window.setInterval(reload, 20000);
    return () => window.clearInterval(timer);
  }, [mapId, reload]);

  return { ...data, loaded, live, reload, setData, track };
}
