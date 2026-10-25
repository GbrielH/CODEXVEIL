'use client';

import { moveMyToken } from '@codexveil/database';
import { MAP_AREA_KINDS, type MapArea } from '@codexveil/domain';
import { CircleDot, Expand, Map as MapIcon, MousePointer2, Ruler, Shrink, ZoomIn, ZoomOut } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { LiveBadge } from '@/components/ui/save-status';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { MapBoard, type MapTool } from './map-board';
import { useBoardViewport } from './use-board-viewport';
import { useMapData } from './use-map-data';

/** Mapa ativo da sessão para o jogador: vê a grade e arrasta só o próprio token. */
export function MapView({ campaignId, systemId, myCharacterId }: { campaignId: string; systemId: string; myCharacterId: string | null }) {
  const { toast } = useToast();
  const { map, tokens, imageUrl, tokenImages, tokenSpeeds, loaded, live, reload, setData, track } = useMapData(campaignId, 'active');
  const [tool, setTool] = useState<MapTool>('move');
  const [areaKind, setAreaKind] = useState<MapArea['kind']>('circle');
  const [localAreas, setLocalAreas] = useState<MapArea[]>([]);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { zoom, setZoom, fullscreen, toggleFullscreen } = useBoardViewport({ boardAreaRef, scrollRef, cols: map?.cols ?? 0, rows: map?.rows ?? 0, min: 0.4, max: 3 });
  if (!loaded) return null;
  if (!map) return <EmptyState title="Nenhum mapa na mesa" description="Quando o mestre mostrar um mapa, ele aparece aqui na hora." />;
  const mine = tokens.some((token) => token.characterId !== null && token.characterId === myCharacterId);

  return (
    <Card>
      <CardHeader
        icon={<MapIcon className="h-5 w-5" aria-hidden="true" />}
        title={map.name}
        description={`${mine ? 'Arraste o seu token para se mover. Cada quadrado = 1,5 m.' : 'Cada quadrado = 1,5 m. O mestre ainda não colocou o seu personagem no mapa.'} Use a roda do mouse para aproximar ou afastar.`}
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
      <div className="mb-2 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Ferramentas do mapa">
        {(
          [
            { tool: 'move', label: 'Mover', icon: <MousePointer2 className="h-4 w-4" aria-hidden="true" /> },
            { tool: 'ruler', label: 'Régua', icon: <Ruler className="h-4 w-4" aria-hidden="true" /> },
            { tool: 'area', label: 'Área de magia', icon: <CircleDot className="h-4 w-4" aria-hidden="true" /> },
          ] as const
        ).map((entry) => (
          <Button key={entry.tool} size="sm" variant={tool === entry.tool ? 'primary' : 'secondary'} icon={entry.icon} aria-pressed={tool === entry.tool} onClick={() => setTool(entry.tool)}>
            {entry.label}
          </Button>
        ))}
        {tool === 'area'
          ? MAP_AREA_KINDS.map((entry) => (
              <Button key={entry.kind} size="sm" variant={areaKind === entry.kind ? 'primary' : 'ghost'} onClick={() => setAreaKind(entry.kind)}>
                {entry.label}
              </Button>
            ))
          : null}
        {localAreas.length ? (
          <Button size="sm" variant="ghost" onClick={() => setLocalAreas([])}>
            Limpar minhas áreas
          </Button>
        ) : null}
      </div>
      {tool === 'ruler' ? <p className="mb-2 text-xs text-fg-muted">Arraste de um quadrado a outro para medir.</p> : null}
      {tool === 'area' ? <p className="mb-2 text-xs text-fg-muted">Arraste a partir de um canto de quadrado. Só você vê as suas áreas (prévia para planejar a magia).</p> : null}
      <div ref={boardAreaRef} className={fullscreen ? 'relative bg-canvas p-2' : 'relative'}>
      <Button
        size="sm"
        variant="secondary"
        className="absolute top-2 right-2 z-10 shadow"
        icon={fullscreen ? <Shrink className="h-4 w-4" aria-hidden="true" /> : <Expand className="h-4 w-4" aria-hidden="true" />}
        onClick={toggleFullscreen}
      >
        {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
      </Button>
      {/* `flex` + `m-auto`: o tabuleiro menor que a área fica centralizado; maior, rola normalmente. */}
      <div ref={scrollRef} className={fullscreen ? 'flex h-[calc(100vh-1rem)] overflow-auto rounded-md border border-line' : 'flex h-[calc(100vh-14rem)] min-h-[24rem] overflow-auto rounded-md border border-line'}>
        <div className="m-auto">
        <MapBoard
          systemId={systemId}
          map={map}
          tokens={tokens}
          imageUrl={imageUrl}
          tokenImages={tokenImages}
                tokenSpeeds={tokenSpeeds}
          isGm={false}
          myCharacterId={myCharacterId}
          zoom={zoom}
          tool={tool}
          areaKind={areaKind}
          localAreas={localAreas}
          onAddArea={(shape) => setLocalAreas((current) => [...current, shape])}
          onMoveToken={(token, x, y) => {
            setData((current) => ({ ...current, tokens: current.tokens.map((entry) => (entry.id === token.id ? { ...entry, x, y } : entry)) }));
            void track(() => moveMyToken(getSupabaseBrowserClient(), token.id, x, y)).catch((error: unknown) => {
              toast({ tone: 'danger', title: 'O token não foi movido', description: failureMessage(error, 'Tente novamente.') });
              reload();
            });
          }}
        />
        </div>
      </div>
      </div>
    </Card>
  );
}
