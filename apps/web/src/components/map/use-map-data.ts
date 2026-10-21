'use client';

import { getActiveMap, getSessionMap, listMapTokens, signedMediaUrls, type MapToken, type SessionMap } from '@codexveil/database';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

/** Um mapa específico (id), o ativo da campanha (jogadores) ou nenhum. */
export type MapSelector = { id: string } | 'active' | null;

export interface MapData {
  map: SessionMap | null;
  tokens: MapToken[];
  imageUrl: string | null;
}

async function load(campaignId: string, mapId: MapSelector): Promise<MapData> {
  const client = getSupabaseBrowserClient();
  if (!mapId) return { map: null, tokens: [], imageUrl: null };
  const map = mapId === 'active' ? await getActiveMap(client, campaignId) : await getSessionMap(client, mapId.id);
  if (!map) return { map: null, tokens: [], imageUrl: null };
  const [tokens, urls] = await Promise.all([listMapTokens(client, map.id), map.imagePath ? signedMediaUrls(client, [map.imagePath]) : Promise.resolve({} as Record<string, string>)]);
  return { map, tokens, imageUrl: map.imagePath ? (urls[map.imagePath] ?? null) : null };
}

/**
 * Mapa (o ativo, para jogadores, ou um escolhido pelo mestre) com os tokens e a URL da imagem,
 * recarregado em tempo real quando o mestre ou outro jogador muda algo.
 */
export function useMapData(campaignId: string, mapId: MapSelector) {
  const [data, setData] = useState<MapData>({ map: null, tokens: [], imageUrl: null });
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    load(campaignId, mapId)
      .then((next) => {
        setData(next);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [campaignId, mapId]);

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

  return { ...data, loaded, live, reload, setData };
}
