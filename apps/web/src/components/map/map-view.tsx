'use client';

import { CAMPAIGN_MEDIA_BUCKET, addMyMapArea, addMyQuickToken, clearMyMapAreas, moveMyToken, quickTokenImagePath, removeMyQuickToken, setMyQuickTokenImage } from '@codexveil/database';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { MAP_AREA_KINDS, activeTurnTokenId, type MapArea } from '@codexveil/domain';
import { CircleDot, Expand, ImageUp, Map as MapIcon, MousePointer2, Plus, Ruler, Shrink, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useRef, useState } from 'react';
import { useCampaignColors } from '@/components/dice/campaign-colors';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { LiveBadge } from '@/components/ui/save-status';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { TextField } from '@/components/ui/field';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { MapBoard, type MapTool } from './map-board';
import { useBoardViewport } from './use-board-viewport';
import { useMapData } from './use-map-data';

/** Mapa ativo da sessão para o jogador: vê a grade e arrasta só o próprio token. */
export function MapView({ campaignId, systemId, myCharacterId }: { campaignId: string; systemId: string; myCharacterId: string | null }) {
  const { toast } = useToast();
  const { map, tokens, imageUrl, tokenImages, tokenSpeeds, inCombat, turn, layerUrls, loaded, live, reload, setData, track } = useMapData(campaignId, 'active');
  const [tool, setTool] = useState<MapTool>('move');
  const [areaKind, setAreaKind] = useState<MapArea['kind']>('circle');
  // Áreas que não chegaram ao mapa (sem a função no banco ou erro): ficam só nesta tela.
  const [localAreas, setLocalAreas] = useState<MapArea[]>([]);
  const userId = useCampaignColors()?.userId ?? null;
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { zoom, setZoom, fullscreen, toggleFullscreen } = useBoardViewport({ boardAreaRef, scrollRef, cols: map?.cols ?? 0, rows: map?.rows ?? 0, min: 0.4, max: 3 });
  if (!loaded) return null;
  if (!map) return <EmptyState title="Nenhum mapa na mesa" description="Quando o mestre mostrar um mapa, ele aparece aqui na hora." />;
  const sharedMine = userId ? map.areas.filter((area) => area.by === userId).length : 0;
  const mine = tokens.some((token) => token.characterId !== null && token.characterId === myCharacterId);
  const activeTokenId = activeTurnTokenId(tokens, turn);

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
        {localAreas.length || sharedMine ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLocalAreas([]);
              if (!sharedMine) return;
              setData((current) => (current.map ? { ...current, map: { ...current.map, areas: current.map.areas.filter((area) => area.by !== userId) } } : current));
              void track(() => clearMyMapAreas(getSupabaseBrowserClient(), map.id)).catch((error: unknown) => {
                toast({ tone: 'danger', title: 'As áreas não foram removidas', description: failureMessage(error, 'Tente novamente.') });
                reload();
              });
            }}
          >
            Limpar minhas áreas
          </Button>
        ) : null}
      </div>
      {userId ? <QuickTokens mapId={map.id} campaignId={campaignId} userId={userId} mine={tokens.filter((token) => token.ownerId === userId)} onChanged={reload} /> : null}
      {tool === 'ruler' ? <p className="mb-2 text-xs text-fg-muted">Arraste de um quadrado a outro para medir.</p> : null}
      {tool === 'area' ? <p className="mb-2 text-xs text-fg-muted">Arraste a partir de um canto de quadrado (círculo: comece no meio do quadrado para centrá-lo ali, como no do seu token). Todos na mesa veem as áreas que você coloca.</p> : null}
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
          layerUrls={layerUrls}
          tokenImages={tokenImages}
                tokenSpeeds={tokenSpeeds}
                freeMovement={!inCombat}
                activeTokenId={activeTokenId}
          isGm={false}
          myCharacterId={myCharacterId}
          myUserId={userId}
          zoom={zoom}
          tool={tool}
          areaKind={areaKind}
          localAreas={localAreas}
          onAddArea={(shape) => {
            // Vai para o mapa de todos; se o banco recusar, fica só nesta tela como prévia.
            setData((current) => (current.map ? { ...current, map: { ...current.map, areas: [...current.map.areas, { ...shape, ...(userId ? { by: userId } : {}) }] } } : current));
            void track(() => addMyMapArea(getSupabaseBrowserClient(), map.id, shape)).catch((error: unknown) => {
              setLocalAreas((current) => [...current, shape]);
              toast({ tone: 'warning', title: 'A área ficou só na sua tela', description: failureMessage(error, 'Os outros jogadores não a veem.') });
              reload();
            });
          }}
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

/** Token rápido do jogador: nome e imagem, entra no centro do mapa e ele arrasta para o lugar. */
function QuickTokens({ mapId, campaignId, userId, mine, onChanged }: { mapId: string; campaignId: string; userId: string; mine: { id: string; label: string; imagePath: string | null }[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = async () => {
    const client = getSupabaseBrowserClient();
    setBusy(true);
    let uploaded: string | null = null;
    try {
      let path: string | null = null;
      if (image) {
        const prepared = await prepareImage(image, 'portrait');
        if (!prepared.ok) {
          toast({ tone: 'danger', title: 'Imagem recusada', description: prepared.message });
          return;
        }
        path = quickTokenImagePath(campaignId, userId, IMAGE_EXTENSIONS[prepared.mimeType]);
        const { error } = await client.storage.from(CAMPAIGN_MEDIA_BUCKET).upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
        if (error) throw error;
        uploaded = path;
      }
      const tokenId = await addMyQuickToken(client, mapId, label.trim());
      if (path) await setMyQuickTokenImage(client, tokenId, path);
      uploaded = null;
      setLabel('');
      setImage(null);
      if (fileRef.current) fileRef.current.value = '';
      onChanged();
    } catch (error) {
      if (uploaded) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([uploaded]);
      toast({ tone: 'danger', title: 'O token não foi colocado', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tokenId: string) => {
    const client = getSupabaseBrowserClient();
    try {
      const path = await removeMyQuickToken(client, tokenId);
      if (path) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([path]);
      onChanged();
    } catch (error) {
      toast({ tone: 'danger', title: 'O token não foi tirado', description: failureMessage(error, 'Tente novamente.') });
    }
  };

  if (!open)
    return (
      <div className="mb-2">
        <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setOpen(true)}>
          Token rápido{mine.length ? ` (${mine.length})` : ''}
        </Button>
      </div>
    );
  return (
    <div className="mb-2 rounded-md border border-line p-2">
      <div className="flex flex-wrap items-end gap-2">
        <TextField id={`token-rapido-${mapId}`} label="Token rápido" placeholder="Ex.: Familiar, Invocação" maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Imagem do token" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
        <Button size="sm" variant="ghost" icon={<ImageUp className="h-4 w-4" aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
          {image ? 'Trocar imagem' : 'Imagem'}
        </Button>
        <Button size="sm" variant="primary" disabled={!label.trim() || busy || mine.length >= 6} onClick={() => void add()}>
          {busy ? 'Colocando…' : 'Pôr no mapa'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Fechar
        </Button>
      </div>
      {image ? <p className="mt-1 text-xs text-fg-muted">Imagem: {image.name}</p> : null}
      <p className="mt-1 text-xs text-fg-muted">Entra no centro do mapa; arraste para o lugar. Até 6 por mapa.</p>
      {mine.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mine.map((token) => (
            <Button key={token.id} size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`Tirar ${token.label}`} onClick={() => void remove(token.id)}>
              {token.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
