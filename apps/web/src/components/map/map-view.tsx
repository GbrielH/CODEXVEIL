'use client';

import { moveMyToken } from '@codexveil/database';
import { Map as MapIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { LiveBadge } from '@/components/ui/save-status';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { MapBoard } from './map-board';
import { useMapData } from './use-map-data';

/** Mapa ativo da sessão para o jogador: vê a grade e arrasta só o próprio token. */
export function MapView({ campaignId, systemId, myCharacterId }: { campaignId: string; systemId: string; myCharacterId: string | null }) {
  const { toast } = useToast();
  const { map, tokens, imageUrl, tokenImages, loaded, live, reload, setData, track } = useMapData(campaignId, 'active');
  const [zoom, setZoom] = useState(1);
  if (!loaded || !map) return null;
  const mine = tokens.some((token) => token.characterId !== null && token.characterId === myCharacterId);

  return (
    <Card>
      <CardHeader
        icon={<MapIcon className="h-5 w-5" aria-hidden="true" />}
        title={map.name}
        description={mine ? 'Arraste o seu token para se mover. Cada quadrado = 1,5 m.' : 'Cada quadrado = 1,5 m. O mestre ainda não colocou o seu personagem no mapa.'}
        action={
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Diminuir o zoom" onClick={() => setZoom((value) => Math.max(0.4, value - 0.2))}>
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Aumentar o zoom" onClick={() => setZoom((value) => Math.min(3, value + 0.2))}>
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </Button>
            <LiveBadge status={live} />
          </div>
        }
      />
      <div className="max-h-[75vh] overflow-auto rounded-md border border-line">
        <MapBoard
          systemId={systemId}
          map={map}
          tokens={tokens}
          imageUrl={imageUrl}
          tokenImages={tokenImages}
          isGm={false}
          myCharacterId={myCharacterId}
          zoom={zoom}
          onMoveToken={(token, x, y) => {
            setData((current) => ({ ...current, tokens: current.tokens.map((entry) => (entry.id === token.id ? { ...entry, x, y } : entry)) }));
            void track(() => moveMyToken(getSupabaseBrowserClient(), token.id, x, y)).catch((error: unknown) => {
              toast({ tone: 'danger', title: 'O token não foi movido', description: failureMessage(error, 'Tente novamente.') });
              reload();
            });
          }}
        />
      </div>
    </Card>
  );
}
