'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  addMapToken,
  campaignMapPath,
  createSessionMap,
  deleteMapToken,
  deleteSessionMap,
  getCampaignTurn,
  getMapFollowsTurn,
  getMapSecrets,
  mapsWithCharacter,
  setMapFollowsTurn,
  listCampaignMaps,
  saveMapSecrets,
  setActiveMap,
  updateMapToken,
  updateSessionMap,
  type MapToken,
  type SessionMap,
  type SessionMapPatch,
} from '@codexveil/database';
import {
  DRAWING_COLORS,
  MAP_AREA_KINDS,
  TOKEN_SIZES,
  WALL_STYLES,
  fogCells,
  paintFog,
  pointInPolygon,
  rectsFromCells,
  tokenSizeLabels,
  tokenSizeSquares,
  visibilityPolygon,
  wallBlocksSight,
  type MapArea,
  type MapDrawing,
  type TokenSize,
  type WallStyle,
} from '@codexveil/domain';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { CircleDot, Eraser, Expand, Shrink, EyeOff, ImageUp, Map as MapIcon, Minus, MousePointer2, Pencil, Plus, Radio, Ruler, Square, SquareDashed, StickyNote, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { Modal } from '@/components/ui/modal';
import { LiveBadge } from '@/components/ui/save-status';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { MapBoard, type MapTool } from './map-board';
import { useMapData } from './use-map-data';

export interface MapCharacter {
  id: string;
  name: string;
}
export interface MapCreature {
  id: string;
  name: string;
  size: TokenSize;
}

export interface MapSession {
  id: string;
  number: number;
  title: string;
}

interface MapManagerProps {
  campaignId: string;
  /** Sessões da campanha (o mapa pertence a uma delas). */
  sessions: MapSession[];
  /** Sessão em andamento/atual: escolhida por padrão ao criar e ao abrir. */
  sessionId: string;
  systemId: string;
  characters: MapCharacter[];
  creatures: MapCreature[];
  /** Campanha ativa (arquivada: só leitura). */
  canManage: boolean;
}

const TOOLS: { tool: MapTool; label: string; icon: ReactNode }[] = [
  { tool: 'move', label: 'Mover', icon: <MousePointer2 className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'image', label: 'Imagem', icon: <ImageUp className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'reveal', label: 'Revelar névoa', icon: <SquareDashed className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'hide', label: 'Cobrir com névoa', icon: <Square className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'wall', label: 'Parede', icon: <Minus className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'erase-wall', label: 'Apagar parede', icon: <Eraser className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'ruler', label: 'Régua', icon: <Ruler className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'area', label: 'Área de magia', icon: <CircleDot className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'draw', label: 'Desenhar', icon: <Pencil className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'note', label: 'Anotação', icon: <StickyNote className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'erase-drawing', label: 'Apagar desenho', icon: <Eraser className="h-4 w-4" aria-hidden="true" /> },
];

/** Sem alcance definido e sem linha de visão, a névoa automática abre 6 quadrados (9 m). */
const DEFAULT_REVEAL_RADIUS = 6;

/**
 * Mesa do mestre na grade: cria mapas da sessão, envia e ajusta a imagem sob a grade de 1,5 m,
 * ativa o mapa para os jogadores, coloca tokens (personagens, criaturas, marcadores), pinta a
 * névoa de guerra e desenha paredes para a linha de visão opcional.
 */
export function MapManager({ campaignId, sessions, sessionId, systemId, characters, creatures, canManage }: MapManagerProps) {
  const { toast } = useToast();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [maps, setMaps] = useState<SessionMap[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<MapTool>('move');
  const [zoom, setZoom] = useState(1);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [markerLabel, setMarkerLabel] = useState('');
  const [wallStyle, setWallStyle] = useState<WallStyle>('stone');
  const [areaKind, setAreaKind] = useState<MapArea['kind']>('circle');
  const [drawColor, setDrawColor] = useState<string>(DRAWING_COLORS[0]);
  const [drawSecret, setDrawSecret] = useState(false);
  const [secrets, setSecrets] = useState<MapDrawing[]>([]);
  const [noteAt, setNoteAt] = useState<{ x: number; y: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  /** Novos tokens entram ocultos? (por padrão sim enquanto o mapa não está sendo mostrado). */
  const [addHiddenChoice, setAddHiddenChoice] = useState<boolean | null>(null);
  const [followsTurn, setFollowsTurn] = useState(true);
  const saveTimer = useRef<number | null>(null);
  const pendingPatch = useRef<{ mapId: string; patch: SessionMapPatch } | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const sizeLabels = tokenSizeLabels(systemId);
  const selectedKey = useMemo(() => (selectedId ? { id: selectedId } : null), [selectedId]);

  const { map, tokens, imageUrl, tokenImages, layerUrls, live, reload, setData, track } = useMapData(campaignId, selectedKey);
  const [newSessionId, setNewSessionId] = useState(sessionId);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const sessionLabel = (id: string) => {
    const found = sessions.find((entry) => entry.id === id);
    return found ? `Sessão ${found.number} · ${found.title}` : 'Sessão';
  };
  // Mapas da sessão atual primeiro; depois os das outras sessões.
  const pickDefault = (list: SessionMap[]) => list.find((entry) => entry.isActive)?.id ?? list.find((entry) => entry.sessionId === sessionId)?.id ?? list[0]?.id ?? null;

  const reloadMaps = useCallback(async () => {
    try {
      const next = await listCampaignMaps(getSupabaseBrowserClient(), campaignId);
      setMaps(next);
      setSelectedId((current) => current ?? pickDefault(next));
    } catch {
      // Mantém a lista anterior.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pickDefault só lê a sessão atual.
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    listCampaignMaps(getSupabaseBrowserClient(), campaignId)
      .then((next) => {
        if (!active) return;
        setMaps(next);
        setSelectedId((current) => current ?? pickDefault(next));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pickDefault só lê a sessão atual.
  }, [campaignId]);

  const fail = (title: string, error: unknown) => toast({ tone: 'danger', title, description: failureMessage(error, 'Tente novamente.') });

  /**
   * Atualiza o mapa na tela na hora e grava. Mudanças seguidas se somam numa só gravação (antes
   * uma cancelava a outra e a primeira "voltava").
   */
  const patchMap = (patch: SessionMapPatch, delay = 0) => {
    if (!map) return;
    setData((current) => (current.map ? { ...current, map: { ...current.map, ...patch } } : current));
    const mapId = map.id;
    pendingPatch.current = pendingPatch.current && pendingPatch.current.mapId === mapId ? { mapId, patch: { ...pendingPatch.current.patch, ...patch } } : { mapId, patch };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const pending = pendingPatch.current;
      pendingPatch.current = null;
      if (!pending) return;
      void track(() => updateSessionMap(getSupabaseBrowserClient(), pending.mapId, pending.patch)).catch((error: unknown) => {
        fail('O mapa não foi salvo', error);
        reload();
      });
    }, delay);
  };

  const patchToken = (token: MapToken, patch: Partial<Pick<MapToken, 'label' | 'x' | 'y' | 'size' | 'isHidden' | 'visionRadius' | 'imagePath'>>) => {
    setData((current) => ({ ...current, tokens: current.tokens.map((entry) => (entry.id === token.id ? { ...entry, ...patch } : entry)) }));
    void track(() => updateMapToken(getSupabaseBrowserClient(), token.id, patch)).catch((error: unknown) => {
      fail('O token não foi alterado', error);
      reload();
    });
  };

  const uploadTokenImage = async (target: MapToken, original: File) => {
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'portrait');
      if (!prepared.ok) {
        toast({ tone: 'danger', title: 'Imagem recusada', description: prepared.message });
        return;
      }
      const path = campaignMapPath(campaignId, `token-${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`);
      const bucket = client.storage.from(CAMPAIGN_MEDIA_BUCKET);
      const { error } = await bucket.upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (error) throw error;
      const previous = target.imagePath;
      await track(() => updateMapToken(client, target.id, { imagePath: path }));
      if (previous) await bucket.remove([previous]);
      reload();
    } catch (error) {
      fail('A imagem do token não foi enviada', error);
    } finally {
      if (tokenInputRef.current) tokenInputRef.current.value = '';
    }
  };

  const removeTokenImage = async (target: MapToken) => {
    if (!target.imagePath) return;
    const previous = target.imagePath;
    patchToken(target, { imagePath: null });
    await getSupabaseBrowserClient().storage.from(CAMPAIGN_MEDIA_BUCKET).remove([previous]);
  };

  // Desenhos e anotações só do mestre (tabela separada; o banco não envia aos jogadores).
  const mapId = map?.id ?? null;
  useEffect(() => {
    if (!mapId) return;
    let active = true;
    getMapSecrets(getSupabaseBrowserClient(), mapId)
      .then((next) => {
        if (active) setSecrets(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mapId]);

  const saveSecrets = (next: MapDrawing[]) => {
    if (!map) return;
    setSecrets(next);
    saveMapSecrets(getSupabaseBrowserClient(), map.id, campaignId, next).catch((error: unknown) => fail('A anotação secreta não foi salva', error));
  };

  const addDrawing = (drawing: MapDrawing) => {
    if (!map) return;
    if (drawSecret) saveSecrets([...secrets, drawing]);
    else patchMap({ drawings: [...map.drawings, drawing] });
  };

  // Névoa automática: abre o que os tokens dos jogadores enxergam (paredes bloqueiam quando a
  // linha de visão está ligada). Calculado aqui, na tela do mestre, e gravado na névoa.
  const autoRevealKey = map && map.fogEnabled && map.fogAutoReveal ? `${map.id}:${tokens.map((token) => `${token.id}@${token.x},${token.y}`).join('|')}:${map.walls.length}:${map.lineOfSight}` : null;
  const lastRevealKey = useRef<string | null>(null);
  useEffect(() => {
    if (!autoRevealKey || !map || autoRevealKey === lastRevealKey.current) return;
    lastRevealKey.current = autoRevealKey;
    const blocking = map.lineOfSight ? map.walls.filter((wall) => wallBlocksSight(wall[4])).map(([x1, y1, x2, y2]) => [x1, y1, x2, y2] as [number, number, number, number]) : [];
    const revealed = fogCells(map.fogRevealed);
    const before = revealed.size;
    for (const token of tokens) {
      if (token.kind !== 'character') continue;
      const side = tokenSizeSquares[token.size];
      const radius = token.visionRadius || (map.lineOfSight ? 0 : DEFAULT_REVEAL_RADIUS);
      const polygon = visibilityPolygon({ x: token.x + side / 2, y: token.y + side / 2 }, blocking, map.cols, map.rows, radius);
      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, polygon)) revealed.add(`${x},${y}`);
      }
    }
    if (revealed.size > before) patchMap({ fogRevealed: rectsFromCells(revealed) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave já resume mapa, tokens e paredes.
  }, [autoRevealKey]);

  const createMap = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const mapId = await createSessionMap(getSupabaseBrowserClient(), { campaignId, sessionId: newSessionId, name });
      setNewName('');
      await reloadMaps();
      setSelectedId(mapId);
    } catch (error) {
      fail('O mapa não foi criado', error);
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (original: File) => {
    if (!map) return;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'map');
      if (!prepared.ok) {
        toast({ tone: 'danger', title: 'Imagem recusada', description: prepared.message });
        return;
      }
      const path = campaignMapPath(campaignId, `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`);
      const bucket = client.storage.from(CAMPAIGN_MEDIA_BUCKET);
      const { error } = await bucket.upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (error) throw error;
      // Nova camada no canto de cima, com a largura do mapa; o mestre arrasta e ajusta.
      const layers = [...map.images, { path, x: 0, y: 0, width: map.cols }];
      await track(() => updateSessionMap(client, map.id, { images: layers }));
      setSelectedLayer(layers.length - 1);
      setTool('image');
      toast({ tone: 'success', title: 'Imagem adicionada ao mapa.', description: 'Com a ferramenta "Imagem", arraste para posicionar e ajuste a largura até os quadrados combinarem (1 quadrado = 1,5 m).' });
      reload();
    } catch (error) {
      fail('A imagem não foi enviada', error);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toggleActive = async () => {
    if (!map) return;
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      await setActiveMap(client, campaignId, map.isActive ? null : map.id);
      // Posições iniciais: os tokens dos jogadores preparados ocultos aparecem ao mostrar o mapa.
      const prepared = map.isActive ? [] : tokens.filter((entry) => entry.kind === 'character' && entry.isHidden);
      await Promise.all(prepared.map((entry) => updateMapToken(client, entry.id, { isHidden: false })));
      toast({
        tone: 'success',
        title: map.isActive ? 'Mapa escondido dos jogadores.' : 'Mapa ativo: os jogadores já estão vendo.',
        description: prepared.length ? `${prepared.length} ${prepared.length === 1 ? 'personagem apareceu' : 'personagens apareceram'} na posição que você marcou.` : undefined,
      });
      await reloadMaps();
      reload();
    } catch (error) {
      fail('O mapa não foi ativado', error);
    } finally {
      setBusy(false);
    }
  };

  const removeMap = async () => {
    if (!map || !window.confirm(`Apagar o mapa "${map.name}" e os tokens dele?`)) return;
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      await deleteSessionMap(client, map.id);
      if (map.imagePath) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([map.imagePath]);
      setSelectedId(null);
      await reloadMaps();
    } catch (error) {
      fail('O mapa não foi apagado', error);
    } finally {
      setBusy(false);
    }
  };

  // Evita o mesmo token entrar duas vezes num clique só (a lista pode avisar a escolha duas vezes).
  const adding = useRef<string | null>(null);
  const addToken = async (input: { kind: MapToken['kind']; characterId?: string; creatureId?: string; label: string; size: TokenSize; isHidden?: boolean }) => {
    if (!map) return;
    const key = `${input.kind}:${input.characterId ?? input.creatureId ?? input.label}`;
    if (adding.current === key) return;
    adding.current = key;
    // Começa no centro do mapa; o mestre arrasta para o lugar.
    const side = tokenSizeSquares[input.size];
    const x = Math.max(0, Math.floor((map.cols - side) / 2));
    const y = Math.max(0, Math.floor((map.rows - side) / 2));
    try {
      await addMapToken(getSupabaseBrowserClient(), { mapId: map.id, campaignId, ...input, isHidden: input.isHidden ?? addHidden, x, y });
      reload();
    } catch (error) {
      fail('O token não foi adicionado', error);
    } finally {
      adding.current = null;
    }
  };

  const token = tokens.find((entry) => entry.id === selectedToken) ?? null;
  const addHidden = addHiddenChoice ?? !map?.isActive;

  // Tela cheia do tabuleiro (botão e tecla Esc do navegador).
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === boardAreaRef.current && boardAreaRef.current !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boardAreaRef.current?.requestFullscreen();
  };

  // Em combate, o mapa mostrado segue o personagem da vez (opção da campanha).
  useEffect(() => {
    let active = true;
    getMapFollowsTurn(getSupabaseBrowserClient(), campaignId)
      .then((value) => {
        if (active) setFollowsTurn(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);
  const lastTurnCharacter = useRef<string | null>(null);
  const followTurn = useCallback(async () => {
    if (!followsTurn || !canManage) return;
    const client = getSupabaseBrowserClient();
    const turn = await getCampaignTurn(client, campaignId).catch(() => null);
    const characterId = turn && turn.status === 'active' ? turn.activeCharacterId : null;
    if (!characterId || characterId === lastTurnCharacter.current) return;
    lastTurnCharacter.current = characterId;
    const mapIds = await mapsWithCharacter(client, campaignId, characterId).catch(() => [] as string[]);
    if (mapIds.length === 0) return;
    const current = maps.find((entry) => entry.isActive);
    // Entre vários mapas com o personagem, prefere os da mesma sessão do mapa mostrado.
    const target = mapIds.find((id) => maps.find((entry) => entry.id === id)?.sessionId === current?.sessionId) ?? mapIds[0]!;
    if (current?.id === target) return;
    await setActiveMap(client, campaignId, target);
    setSelectedId(target);
    await reloadMaps();
  }, [followsTurn, canManage, campaignId, maps, reloadMaps]);
  useRealtimeRefresh(`mapa-turno:${campaignId}`, [{ table: 'campaign_turns', filter: `campaign_id=eq.${campaignId}` }], () => void followTurn(), followsTurn && canManage);

  const onMap = new Set(tokens.map((entry) => entry.characterId).filter(Boolean));

  return (
    <Card>
      <CardHeader
        icon={<MapIcon className="h-5 w-5" aria-hidden="true" />}
        title="Mapa da sessão"
        description="Cada quadrado = 1,5 m. Ative um mapa para os jogadores verem; eles movem só o próprio token."
        action={map ? <LiveBadge status={live} /> : undefined}
      />

      <div className="flex flex-wrap items-end gap-2">
        {maps.length ? (
          <SelectField id={`${id}-mapa`} label="Cenário (todos os mapas da campanha)" value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value || null)} className="min-w-64">
            {[...maps]
              .sort((a, b) => (sessions.find((entry) => entry.id === b.sessionId)?.number ?? 0) - (sessions.find((entry) => entry.id === a.sessionId)?.number ?? 0))
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {sessionLabel(entry.sessionId)} — {entry.name}
                  {entry.isActive ? ' (ativo)' : ''}
                </option>
              ))}
          </SelectField>
        ) : null}
        {canManage ? (
          <>
            <SelectField id={`${id}-sessao`} label="Sessão do novo mapa" value={newSessionId} onChange={(event) => setNewSessionId(event.target.value)} className="min-w-48">
              {sessions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  Sessão {entry.number} · {entry.title}
                </option>
              ))}
            </SelectField>
            <TextField id={`${id}-novo`} label="Nome do mapa" placeholder="Ex.: Taverna do Javali" maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} />
            <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} disabled={!newName.trim()} loading={busy && !map} onClick={() => void createMap()}>
              Criar mapa
            </Button>
          </>
        ) : null}
      </div>

      {map ? (
        <div className="mt-4 flex flex-col gap-4">
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={map.isActive ? 'secondary' : 'primary'} icon={<Radio className="h-4 w-4" aria-hidden="true" />} loading={busy} onClick={() => void toggleActive()}>
                {map.isActive ? 'Esconder dos jogadores' : 'Mostrar aos jogadores'}
              </Button>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0])} />
              <Button variant="secondary" icon={<ImageUp className="h-4 w-4" aria-hidden="true" />} disabled={busy} onClick={() => inputRef.current?.click()}>
                Adicionar imagem
              </Button>
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} disabled={busy} onClick={() => void removeMap()}>
                Apagar mapa
              </Button>
            </div>
          ) : null}

          {canManage ? (
            <fieldset className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-3 lg:grid-cols-6">
              <legend className="px-1 text-xs text-fg-muted">Ajuste da imagem e da grade</legend>
              <div className="flex flex-col gap-2 sm:col-span-3 lg:col-span-6">
                {map.images.length === 0 ? (
                  <p className="text-xs text-fg-muted">Sem imagem: use “Adicionar imagem”. Dá para pôr várias e arrastar cada uma com a ferramenta “Imagem”.</p>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <SelectField
                      id={`${id}-camada`}
                      label="Imagem selecionada"
                      value={selectedLayer === null ? '' : String(selectedLayer)}
                      onChange={(event) => {
                        setSelectedLayer(event.target.value === '' ? null : Number(event.target.value));
                        setTool('image');
                      }}
                      className="min-w-40"
                    >
                      <option value="">Escolha…</option>
                      {map.images.map((_, index) => (
                        <option key={index} value={index}>
                          Imagem {index + 1}
                          {index === map.images.length - 1 && map.images.length > 1 ? ' (por cima)' : ''}
                        </option>
                      ))}
                    </SelectField>
                    {selectedLayer !== null && map.images[selectedLayer] ? (
                      <>
                        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-fg-secondary">
                          Largura: {map.images[selectedLayer].width.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} quadrados
                          <input
                            type="range"
                            min={1}
                            max={Math.max(200, map.cols * 3)}
                            step={0.25}
                            value={map.images[selectedLayer].width}
                            onChange={(event) =>
                              patchMap({ images: map.images.map((layer, index) => (index === selectedLayer ? { ...layer, width: Number(event.target.value) } : layer)) }, 400)
                            }
                            className="accent-wine-500"
                          />
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={selectedLayer === map.images.length - 1}
                          onClick={() => {
                            const layer = map.images[selectedLayer]!;
                            patchMap({ images: [...map.images.filter((_, index) => index !== selectedLayer), layer] });
                            setSelectedLayer(map.images.length - 1);
                          }}
                        >
                          Trazer para a frente
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                          onClick={() => {
                            const layer = map.images[selectedLayer]!;
                            patchMap({ images: map.images.filter((_, index) => index !== selectedLayer) });
                            setSelectedLayer(null);
                            void getSupabaseBrowserClient().storage.from(CAMPAIGN_MEDIA_BUCKET).remove([layer.path]);
                          }}
                        >
                          Tirar imagem
                        </Button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                Colunas
                <NumberInput value={map.cols} min={4} max={200} onCommit={(value) => value && patchMap({ cols: value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                Linhas
                <NumberInput value={map.rows} min={4} max={200} onCommit={(value) => value && patchMap({ rows: value })} />
              </label>
              <div className="flex flex-wrap gap-4 sm:col-span-3 lg:col-span-6">
                <CheckboxField id={`${id}-grade`} label="Mostrar linhas da grade" checked={map.showGrid} onChange={(event) => patchMap({ showGrid: event.target.checked })} />
                <CheckboxField id={`${id}-nevoa`} label="Névoa de guerra" checked={map.fogEnabled} onChange={(event) => patchMap({ fogEnabled: event.target.checked })} />
                <CheckboxField
                  id={`${id}-visao`}
                  label="Linha de visão"
                  description="Cada jogador só vê o que o token dele enxerga (paredes bloqueiam)."
                  checked={map.lineOfSight}
                  onChange={(event) => patchMap({ lineOfSight: event.target.checked })}
                />
                {map.fogEnabled ? (
                  <CheckboxField
                    id={`${id}-nevoa-auto`}
                    label="Névoa se revela sozinha"
                    description="Abre o que os tokens dos jogadores enxergam ao se mover (precisa desta tela aberta)."
                    checked={map.fogAutoReveal}
                    onChange={(event) => patchMap({ fogAutoReveal: event.target.checked })}
                  />
                ) : null}
              </div>
            </fieldset>
          ) : null}

          <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Ferramentas do mapa">
            {TOOLS.filter((entry) => canManage || entry.tool === 'move' || entry.tool === 'ruler')
              .filter((entry) => map.fogEnabled || (entry.tool !== 'reveal' && entry.tool !== 'hide'))
              .map((entry) => (
                <Button key={entry.tool} size="sm" variant={tool === entry.tool ? 'primary' : 'secondary'} icon={entry.icon} aria-pressed={tool === entry.tool} onClick={() => setTool(entry.tool)}>
                  {entry.label}
                </Button>
              ))}
            {canManage && map.fogEnabled ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => patchMap({ fogRevealed: [[0, 0, map.cols, map.rows]] })}>
                  Revelar tudo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => patchMap({ fogRevealed: [] })}>
                  Cobrir tudo
                </Button>
              </>
            ) : null}
            {canManage && map.areas.length ? (
              <Button size="sm" variant="ghost" onClick={() => patchMap({ areas: [] })}>
                Limpar áreas
              </Button>
            ) : null}
            {canManage && map.walls.length ? (
              <Button size="sm" variant="ghost" onClick={() => window.confirm('Apagar todas as paredes?') && patchMap({ walls: [] })}>
                Limpar paredes
              </Button>
            ) : null}
            <span className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="ghost" aria-label="Diminuir o zoom" onClick={() => setZoom((value) => Math.max(0.3, value - 0.2))}>
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Aumentar o zoom" onClick={() => setZoom((value) => Math.min(3, value + 0.2))}>
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </Button>
            </span>
          </div>
          {tool === 'image' ? <p className="text-xs text-fg-muted">Arraste uma imagem para posicioná-la dentro da grade; a largura fica no ajuste acima.</p> : null}
          {tool === 'ruler' ? <p className="text-xs text-fg-muted">Arraste de um quadrado a outro para medir (diagonal pela regra do sistema).</p> : null}
          {tool === 'area' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Forma da área">
                {MAP_AREA_KINDS.map((entry) => (
                  <Button key={entry.kind} size="sm" variant={areaKind === entry.kind ? 'primary' : 'ghost'} role="radio" aria-checked={areaKind === entry.kind} onClick={() => setAreaKind(entry.kind)}>
                    {entry.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-fg-muted">
                Arraste a partir de um canto de quadrado: o tamanho segue de 1,5 em 1,5 m e os quadrados atingidos ficam destacados. Todos veem as áreas que você coloca.
              </p>
            </div>
          ) : null}
          {tool === 'draw' || tool === 'note' ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5" role="radiogroup" aria-label="Cor">
                {DRAWING_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={drawColor === color}
                    aria-label={`Cor ${color}`}
                    onClick={() => setDrawColor(color)}
                    className={cx('h-6 w-6 rounded-full border', drawColor === color ? 'ring-2 ring-parchment-300' : 'border-line-strong')}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <CheckboxField id={`${id}-segredo`} label="Só eu vejo (armadilhas, segredos)" checked={drawSecret} onChange={(event) => setDrawSecret(event.target.checked)} />
              <p className="text-xs text-fg-muted">{tool === 'draw' ? 'Arraste para desenhar.' : 'Clique no mapa para escrever uma anotação.'}</p>
            </div>
          ) : null}
          {tool === 'wall' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Estilo da parede">
                {WALL_STYLES.map((style) => (
                  <Button key={style.id} size="sm" variant={wallStyle === style.id ? 'primary' : 'ghost'} role="radio" aria-checked={wallStyle === style.id} onClick={() => setWallStyle(style.id)}>
                    {style.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-fg-muted">
                Clique em dois cantos de quadrado para desenhar uma parede. Todas bloqueiam a linha de visão, menos a grade de ferro; a invisível só você vê.
              </p>
            </div>
          ) : null}
          {tool === 'reveal' || tool === 'hide' ? <p className="text-xs text-fg-muted">Arraste sobre os quadrados para {tool === 'reveal' ? 'revelar' : 'cobrir'} a área.</p> : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div ref={boardAreaRef} className={cx('relative bg-canvas', fullscreen && 'p-2')}>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 z-10 shadow"
              icon={fullscreen ? <Shrink className="h-4 w-4" aria-hidden="true" /> : <Expand className="h-4 w-4" aria-hidden="true" />}
              onClick={toggleFullscreen}
            >
              {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            </Button>
            <div className={cx('overflow-auto rounded-md border border-line', fullscreen ? 'h-[calc(100vh-1rem)]' : 'h-[calc(100vh-14rem)] min-h-[28rem]')}>
              <MapBoard
                systemId={systemId}
                map={map}
                tokens={tokens}
                imageUrl={imageUrl}
                tokenImages={tokenImages}
                layerUrls={layerUrls}
                selectedLayer={selectedLayer}
                onSelectLayer={setSelectedLayer}
                onMoveLayer={(index, x, y) => patchMap({ images: map.images.map((layer, position) => (position === index ? { ...layer, x, y } : layer)) })}
                wallStyle={wallStyle}
                isGm
                myCharacterId={null}
                zoom={zoom}
                tool={canManage ? tool : 'move'}
                selectedTokenId={selectedToken}
                onSelectToken={setSelectedToken}
                onMoveToken={(moved, x, y) => canManage && patchToken(moved, { x, y })}
                onPaintFog={(area, reveal) => patchMap({ fogRevealed: paintFog(map.fogRevealed, area, reveal) })}
                onAddWall={(wall) => patchMap({ walls: [...map.walls, wall] })}
                onRemoveWall={(index) => patchMap({ walls: map.walls.filter((_, position) => position !== index) })}
                areaKind={areaKind}
                drawColor={drawColor}
                secretDrawings={secrets}
                onAddArea={(shape) => patchMap({ areas: [...map.areas, shape] })}
                onAddDrawing={addDrawing}
                onRequestNote={(point) => {
                  setNoteText('');
                  setNoteAt(point);
                }}
                onRemoveDrawing={(index, secret) =>
                  secret ? saveSecrets(secrets.filter((_, position) => position !== index)) : patchMap({ drawings: map.drawings.filter((_, position) => position !== index) })
                }
              />
            </div>
            </div>

            {canManage ? (
              <aside className="flex flex-col gap-4">
                {token ? (
                  <section className="flex flex-col gap-2 rounded-md border border-parchment-300/40 p-3" aria-label="Token selecionado">
                    <TextField id={`${id}-rotulo`} label="Nome no token" maxLength={80} value={token.label} onChange={(event) => patchToken(token, { label: event.target.value })} />
                    <SelectField id={`${id}-porte`} label="Tamanho" value={token.size} onChange={(event) => patchToken(token, { size: event.target.value as TokenSize })}>
                      {TOKEN_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {sizeLabels[size]} ({tokenSizeSquares[size]}×{tokenSizeSquares[size]})
                        </option>
                      ))}
                    </SelectField>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={tokenInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) => event.target.files?.[0] && void uploadTokenImage(token, event.target.files[0])}
                      />
                      <Button size="sm" variant="secondary" icon={<ImageUp className="h-4 w-4" aria-hidden="true" />} onClick={() => tokenInputRef.current?.click()}>
                        {token.imagePath ? 'Trocar imagem' : 'Imagem do token'}
                      </Button>
                      {token.imagePath ? (
                        <Button size="sm" variant="ghost" onClick={() => void removeTokenImage(token)}>
                          Tirar imagem
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-xs text-fg-muted">Sem imagem própria, o token usa a foto do personagem ou a imagem da criatura.</p>
                    {token.kind === 'character' ? (
                      <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                        Alcance da visão (quadrados; 0 = sem limite)
                        <NumberInput value={token.visionRadius} min={0} max={200} onCommit={(value) => patchToken(token, { visionRadius: value ?? 0 })} />
                      </label>
                    ) : null}
                    <CheckboxField id={`${id}-oculto`} label="Oculto dos jogadores" checked={token.isHidden} onChange={(event) => patchToken(token, { isHidden: event.target.checked })} />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                      onClick={() => {
                        setSelectedToken(null);
                        deleteMapToken(getSupabaseBrowserClient(), token.id)
                          .then(reload)
                          .catch((error: unknown) => fail('O token não foi removido', error));
                      }}
                    >
                      Tirar do mapa
                    </Button>
                  </section>
                ) : (
                  <p className="text-xs text-fg-muted">Clique num token para editar; arraste para mover.</p>
                )}

                <section className="flex flex-col gap-2" aria-label="Adicionar tokens">
                  <p className="eyebrow">Adicionar ao mapa</p>
                  <CheckboxField
                    id={`${id}-entrar-oculto`}
                    label="Entrar oculto (só você vê)"
                    description="Bom para preparar posições: os personagens aparecem quando você mostrar o mapa."
                    checked={addHidden}
                    onChange={(event) => setAddHiddenChoice(event.target.checked)}
                  />
                  <p className="text-xs text-fg-muted">
                    Personagens dos jogadores, criaturas da biblioteca e marcadores. Cada um entra no centro do mapa; arraste para o lugar.
                  </p>
                  {characters.length === 0 ? (
                    <p className="text-xs text-fg-muted">Nenhum personagem de jogador na campanha ainda: eles aparecem aqui quando cada jogador vincula o personagem.</p>
                  ) : characters.every((character) => onMap.has(character.id)) ? (
                    <p className="text-xs text-fg-muted">Todos os personagens já estão no mapa.</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {characters.filter((character) => !onMap.has(character.id)).map((character) => (
                      <Button key={character.id} size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => void addToken({ kind: 'character', characterId: character.id, label: character.name, size: 'medium' })}>
                        {character.name}
                      </Button>
                    ))}
                  </div>
                  {creatures.length === 0 ? (
                    <p className="text-xs text-fg-muted">Sem criaturas na biblioteca: crie monstros e NPCs na aba Biblioteca para colocá-los aqui.</p>
                  ) : null}
                  {creatures.length ? (
                    <SelectField
                      id={`${id}-criatura`}
                      label="Criatura da biblioteca"
                      value=""
                      onChange={(event) => {
                        const creature = creatures.find((entry) => entry.id === event.target.value);
                        if (creature) void addToken({ kind: 'creature', creatureId: creature.id, label: creature.name, size: creature.size });
                      }}
                    >
                      <option value="">Escolha…</option>
                      {creatures.map((creature) => (
                        <option key={creature.id} value={creature.id}>
                          {creature.name} · {sizeLabels[creature.size]}
                        </option>
                      ))}
                    </SelectField>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <TextField id={`${id}-marcador`} label="Marcador" placeholder="Ex.: Baú" maxLength={80} value={markerLabel} onChange={(event) => setMarkerLabel(event.target.value)} />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!markerLabel.trim()}
                      onClick={() => {
                        void addToken({ kind: 'marker', label: markerLabel.trim(), size: 'medium' });
                        setMarkerLabel('');
                      }}
                    >
                      Pôr
                    </Button>
                  </div>
                </section>
                <CheckboxField
                  id={`${id}-segue-turno`}
                  label="No combate, o mapa segue o turno"
                  description="Na vez de cada personagem, os jogadores veem o mapa onde está o token dele. Desligado, você troca o mapa à mão."
                  checked={followsTurn}
                  onChange={(event) => {
                    const value = event.target.checked;
                    setFollowsTurn(value);
                    lastTurnCharacter.current = null;
                    setMapFollowsTurn(getSupabaseBrowserClient(), campaignId, value).catch((error: unknown) => fail('A opção não foi salva', error));
                  }}
                />
                <p className={cx('flex items-center gap-1.5 text-xs text-fg-muted')}>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Tokens ocultos aparecem translúcidos só para você.
                </p>
              </aside>
            ) : null}
          </div>
        </div>
      ) : maps.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">Nenhum mapa nesta sessão. Crie um, envie a imagem e ajuste a grade.</p>
      ) : null}
      <Modal open={noteAt !== null} onClose={() => setNoteAt(null)} title="Nova anotação" description={drawSecret ? 'Só você vai ver esta anotação.' : 'Todos na mesa vão ver esta anotação.'}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const text = noteText.trim();
            if (noteAt && text) addDrawing({ type: 'note', x: noteAt.x, y: noteAt.y, text: text.slice(0, 120), color: drawColor });
            setNoteAt(null);
          }}
        >
          <TextField id={`${id}-nota`} label="Texto da anotação" maxLength={120} autoFocus value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Ex.: Armadilha de fosso" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNoteAt(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!noteText.trim()}>
              Pôr no mapa
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
