'use client';

import type { DiceRoll } from '@codexveil/database';
import { naturalD20 } from '@codexveil/domain';
import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { playAuraBurst } from './aura-media';
import { useCampaignColors } from './campaign-colors';
import { loadCharacterLook } from './dice-look';

/** Mais ou menos quando os dados 3D dos outros param (o efeito sai junto com o resultado). */
const LANDING_DELAY_MS = 1_400;

/**
 * Efeitos de crítico e falha crítica com aura em qualquer página da campanha. Nas páginas com a
 * caixinha de dados quem dispara é ela (com a animação dos dados); nas demais (Anotações,
 * Biblioteca, Quadros…) este ouvinte dispara o efeito da aura de quem rolou.
 */
export function CampaignRollEffects({ campaignId }: { campaignId: string }) {
  const colors = useCampaignColors();
  const seen = useRef<Set<string> | null>(null);

  // Rolagens que já existiam ao abrir a página não disparam nada.
  useEffect(() => {
    let active = true;
    void getSupabaseBrowserClient()
      .from('dice_rolls')
      .select('id')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (active) seen.current = new Set((data ?? []).map((row) => row.id));
      });
    return () => {
      active = false;
    };
  }, [campaignId]);

  useRealtimeRefresh(
    `efeitos-rolagem:${campaignId}`,
    [{ table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` }],
    () => {
      const known = seen.current;
      if (!known) return;
      void getSupabaseBrowserClient()
        .from('dice_rolls')
        .select('id, user_id, character_id, dice')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(async ({ data }) => {
          for (const row of (data ?? []).reverse()) {
            if (known.has(row.id)) continue;
            known.add(row.id);
            // Com a caixinha na página, o efeito já sai por ela.
            // Com a caixinha ou a mesa grande na página, o efeito já sai por elas (senão sairia duas vezes).
            const page = document.documentElement.dataset;
            if (page.diceTray === 'on' || page.diceTable === 'on') continue;
            const natural = naturalD20({ dice: row.dice as unknown as DiceRoll['dice'] });
            if (natural !== 20 && natural !== 1) continue;
            const look =
              (row.character_id ? await loadCharacterLook(row.character_id) : null) ??
              colors?.lookOfCharacter(row.character_id) ??
              colors?.lookOfUser(row.user_id) ??
              null;
            const aura = look?.aura;
            if (!aura) continue;
            window.setTimeout(
              () => void playAuraBurst(aura, natural === 20 ? 'critical' : 'fumble', row.user_id),
              LANDING_DELAY_MS,
            );
          }
        });
    },
  );

  return null;
}
