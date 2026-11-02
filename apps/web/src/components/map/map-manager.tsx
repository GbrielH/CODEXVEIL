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
  type MapImageRotation,
  type MapToken,
  type SessionMap,
  type SessionMapPatch,
  type Wall,
} from '@codexveil/database';
import {
  DRAWING_COLORS,
  FLOOR_TEXTURES,
  MAP_ICON_KINDS,
  MAP_AREA_KINDS,
  TOKEN_SIZES,
  WALL_STYLES,
  fogCells,
  generateDungeon,
  importOnePageDungeon,
  paintFog,
  paintMapTexture,
  pointInPolygon,
  rectsFromCells,
  tokenSizeLabels,
  tokenSizeSquares,
  visibilityPolygon,
  wallBlocksSight,
  type MapArea,
  type MapDrawing,
  type DungeonSize,
  type FloorTexture,
  type MapIconKind,
  type TokenSize,
  type WallStyle,
} from '@codexveil/domain';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { Castle, CircleDot, Eraser, ExternalLink, Hash, Expand, Shrink, EyeOff, ImageUp, Map as MapIcon, Minus, MousePointer2, Pencil, Plus, Radio, RotateCw, Ruler, Square, SquareDashed, StickyNote, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useConfirm } from '@/components/ui/use-confirm';
import { Button, buttonClasses } from '@/components/ui/button';
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
import { useBoardViewport } from './use-board-viewport';
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
  { tool: 'room', label: 'Sala numerada', icon: <Hash className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'icon', label: 'Ícone', icon: <CircleDot className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'texture', label: 'Textura', icon: <Square className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'erase-drawing', label: 'Apagar desenho', icon: <Eraser className="h-4 w-4" aria-hidden="true" /> },
];

const ICON_LABELS: Record<MapIconKind, string> = { chest: 'Baú', door: 'Porta', 'secret-door': 'Porta secreta', trap: 'Armadilha', stairs: 'Escada', campfire: 'Fogueira', altar: 'Altar', skull: 'Caveira' };
const TEXTURE_LABELS: Record<FloorTexture, string> = { stone: 'Pedra', dirt: 'Terra', wood: 'Madeira', grass: 'Grama', water: 'Água' };

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
  const dungeonInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [tool, setTool] = useState<MapTool>('move');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [markerLabel, setMarkerLabel] = useState('');
  const [wallStyle, setWallStyle] = useState<WallStyle>('stone');
  const [areaKind, setAreaKind] = useState<MapArea['kind']>('circle');
  const [drawColor, setDrawColor] = useState<string>(DRAWING_COLORS[0]);
  const [drawSecret, setDrawSecret] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<MapIconKind>('chest');
  const [floorTexture, setFloorTexture] = useState<FloorTexture>('stone');
  const [dungeonSeed, setDungeonSeed] = useState('codexveil');
  const [dungeonSize, setDungeonSize] = useState<DungeonSize>('medium');
  const [secrets, setSecrets] = useState<MapDrawing[]>([]);
  const [noteAt, setNoteAt] = useState<{ x: number; y: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [drawingMenu, setDrawingMenu] = useState<{ index: number; secret: boolean; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<{ index: number; secret: boolean } | null>(null);
  const [editText, setEditText] = useState('');
  const [nameDraft, setNameDraft] = useState<{ mapId: string; value: string } | null>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Novos tokens entram ocultos? (por padrão sim enquanto o mapa não está sendo mostrado). */
  const [addHiddenChoice, setAddHiddenChoice] = useState<boolean | null>(null);
  const [followsTurn, setFollowsTurn] = useState(true);
  const saveTimer = useRef<number | null>(null);
  const pendingPatch = useRef<{ mapId: string; patch: SessionMapPatch } | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const sizeLabels = tokenSizeLabels(systemId);
  const selectedKey = useMemo(() => (selectedId ? { id: selectedId } : null), [selectedId]);

  const { map, tokens, imageUrl, tokenImages, tokenSpeeds, inCombat, layerUrls, live, reload, setData, track } = useMapData(campaignId, selectedKey);
  const { zoom, setZoom, fullscreen, toggleFullscreen } = useBoardViewport({ boardAreaRef, scrollRef, cols: map?.cols ?? 0, rows: map?.rows ?? 0, min: 0.3, max: 3 });
  const [newSessionId, setNewSessionId] = useState(sessionId);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const sessionMaps = maps.filter((entry) => entry.sessionId === newSessionId);
  // Abre nos mapas da sessão atual: o ativo, senão o primeiro preparado.
  const pickDefault = (list: SessionMap[]) => {
    const inSession = list.filter((entry) => entry.sessionId === sessionId);
    return inSession.find((entry) => entry.isActive)?.id ?? inSession[0]?.id ?? null;
  };

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

  const mapName = nameDraft && nameDraft.mapId === mapId ? nameDraft.value : map?.name ?? '';

  const saveSecrets = (next: MapDrawing[]) => {
    if (!map) return;
    setSecrets(next);
    saveMapSecrets(getSupabaseBrowserClient(), map.id, campaignId, next).catch((error: unknown) => fail('A anotação secreta não foi salva', error));
  };

  /** Sala numerada: o número público ("N") e a legenda secreta ("N. descrição") andam juntos. */
  const roomNumberOf = (index: number, secret: boolean): string | null => {
    const drawing = (secret ? secrets : map?.drawings ?? [])[index];
    if (drawing?.type !== 'note') return null;
    const match = secret ? /^(\d+)\.\s/.exec(drawing.text) : /^(\d+)$/.exec(drawing.text.trim());
    return match ? match[1]! : null;
  };
  const roomPublicIndex = (number: string) => (map?.drawings ?? []).findIndex((drawing) => drawing.type === 'note' && drawing.text.trim() === number);
  const roomSecretIndex = (number: string) => secrets.findIndex((drawing) => drawing.type === 'note' && drawing.text.startsWith(`${number}. `));

  const openEdit = (index: number, secret: boolean) => {
    const number = roomNumberOf(index, secret);
    if (number) {
      const legend = secrets[roomSecretIndex(number)];
      setEditText(legend?.type === 'note' ? legend.text.slice(number.length + 2) : '');
    } else {
      const drawing = (secret ? secrets : map?.drawings ?? [])[index];
      setEditText(drawing?.type === 'note' ? drawing.text : '');
    }
    setEditing({ index, secret });
  };

  const saveEdit = () => {
    if (!map || !editing) return;
    const text = editText.trim();
    const number = roomNumberOf(editing.index, editing.secret);
    if (number) {
      const secretIndex = roomSecretIndex(number);
      const publicNote = map.drawings[roomPublicIndex(number)];
      const color = publicNote?.type === 'note' ? publicNote.color : drawColor;
      const at = publicNote?.type === 'note' ? publicNote : { x: 0, y: 0 };
      const legend: MapDrawing = { type: 'note', x: at.x, y: at.y + 0.5, text: `${number}. ${text}`.slice(0, 120), color };
      if (!text) saveSecrets(secrets.filter((_, position) => position !== secretIndex));
      else if (secretIndex >= 0) saveSecrets(secrets.map((drawing, position) => (position === secretIndex && drawing.type === 'note' ? { ...drawing, text: legend.type === 'note' ? legend.text : drawing.text } : drawing)));
      else saveSecrets([...secrets, legend]);
    } else if (text) {
      const edit = (list: MapDrawing[]) => list.map((drawing, position) => (position === editing.index && drawing.type === 'note' ? { ...drawing, text: text.slice(0, 120) } : drawing));
      if (editing.secret) saveSecrets(edit(secrets));
      else patchMap({ drawings: edit(map.drawings) });
    }
    setEditing(null);
  };

  const removeNote = (index: number, secret: boolean) => {
    if (!map) return;
    const number = roomNumberOf(index, secret);
    const publicIndex = number ? roomPublicIndex(number) : secret ? -1 : index;
    const secretIndex = number ? roomSecretIndex(number) : secret ? index : -1;
    if (secretIndex >= 0) saveSecrets(secrets.filter((_, position) => position !== secretIndex));
    if (publicIndex >= 0) patchMap({ drawings: map.drawings.filter((_, position) => position !== publicIndex) });
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

  /** Próximo número de sala: um a mais que o maior número já posto no mapa. */
  const nextRoomNumber = () =>
    1 + Math.max(0, ...(map?.drawings ?? []).flatMap((drawing) => (drawing.type === 'note' && /^\d+$/.test(drawing.text) ? [Number(drawing.text)] : [])));

  /** Sala numerada: o número fica visível a todos; a descrição, só para o mestre (legenda). */
  const addRoom = (point: { x: number; y: number }, description: string) => {
    if (!map) return;
    const number = String(nextRoomNumber());
    patchMap({ drawings: [...map.drawings, { type: 'note', x: point.x, y: point.y, text: number, color: DRAWING_COLORS[0] }] });
    if (description) saveSecrets([...secrets, { type: 'note', x: point.x, y: point.y + 0.7, text: `${number}. ${description}`.slice(0, 120), color: DRAWING_COLORS[1] }]);
  };

  /** Masmorra do One Page Dungeon (watabou): mapa novo com grade, paredes, névoa, números e legenda. */
  const importDungeon = async (file: File) => {
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const dungeon = importOnePageDungeon(JSON.parse(await file.text()) as unknown);
      const mapId = await createSessionMap(client, { campaignId, sessionId: newSessionId, name: dungeon.title, cols: dungeon.cols, rows: dungeon.rows });
      await updateSessionMap(client, mapId, {
        walls: dungeon.walls.map(([x1, y1, x2, y2]) => [x1, y1, x2, y2, 'stone'] as Wall),
        fogEnabled: true,
        lineOfSight: true,
        drawings: [
          ...dungeon.labels.map((label) => ({ type: 'note' as const, x: label.x, y: label.y, text: label.ref, color: DRAWING_COLORS[0] })),
          ...dungeon.doors.map((door) => ({ type: 'icon' as const, x: Math.floor(door.x), y: Math.floor(door.y), icon: door.secret ? 'secret-door' as const : 'door' as const, color: DRAWING_COLORS[0] })),
        ],
      });
      const legend = dungeon.legend.flatMap((entry) => {
        const label = dungeon.labels.find((item) => item.ref === entry.ref);
        return label ? [{ type: 'note' as const, x: label.x, y: label.y + 0.7, text: `${entry.ref}. ${entry.text}`.slice(0, 120), color: DRAWING_COLORS[1] }] : [];
      });
      if (legend.length) await saveMapSecrets(client, mapId, campaignId, legend);
      await reloadMaps();
      setSelectedId(mapId);
      toast({
        tone: 'success',
        title: `Masmorra “${dungeon.title}” importada.`,
        description: `${dungeon.stats.rects} salas e corredores, ${dungeon.walls.length} paredes e ${dungeon.legend.length} notas na legenda (só você vê). Névoa e linha de visão já estão ligadas.`,
      });
    } catch (error) {
      if (error instanceof SyntaxError) toast({ tone: 'danger', title: 'Arquivo inválido', description: 'Envie o JSON exportado pelo One Page Dungeon.' });
      else if (error instanceof Error && !('code' in error)) toast({ tone: 'danger', title: 'Não deu para importar', description: error.message });
      else fail('A masmorra não foi importada', error);
    } finally {
      setBusy(false);
      if (dungeonInputRef.current) dungeonInputRef.current.value = '';
    }
  };

  const createGeneratedDungeon = async () => {
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const dungeon = generateDungeon(dungeonSeed, dungeonSize);
      const mapId = await createSessionMap(client, { campaignId, sessionId: newSessionId, name: dungeon.title, cols: dungeon.cols, rows: dungeon.rows });
      await updateSessionMap(client, mapId, {
        walls: dungeon.walls.map(([x1, y1, x2, y2]) => [x1, y1, x2, y2, 'stone'] as Wall),
        fogEnabled: true,
        lineOfSight: true,
        drawings: [
          ...dungeon.labels.map((label) => ({ type: 'note' as const, x: label.x, y: label.y, text: label.ref, color: DRAWING_COLORS[0] })),
          ...dungeon.doors.map((door) => ({ type: 'icon' as const, x: Math.floor(door.x), y: Math.floor(door.y), icon: door.secret ? 'secret-door' as const : 'door' as const, color: DRAWING_COLORS[0] })),
        ],
      });
      await reloadMaps();
      setSelectedId(mapId);
      toast({ tone: 'success', title: `Masmorra “${dungeon.title}” criada.`, description: `${dungeon.labels.length} salas numeradas, ${dungeon.doors.length} portas, névoa e linha de visão ligadas.` });
    } catch (error) {
      fail('A masmorra não foi gerada', error);
    } finally {
      setBusy(false);
    }
  };

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
    if (!map) return;
    const ok = await confirm({
      title: 'Apagar o mapa?',
      description: `"${map.name}" e os tokens dele serão apagados.`,
      confirmLabel: 'Apagar',
    });
    if (!ok) return;
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
      {confirmDialog}
      <CardHeader
        icon={<MapIcon className="h-5 w-5" aria-hidden="true" />}
        title="Mapa da sessão"
        description="Cada quadrado = 1,5 m. Ative um mapa para os jogadores verem; eles movem só o próprio token."
        action={map ? <LiveBadge status={live} /> : undefined}
      />
      {canManage ? <MapTutorial /> : null}
      {canManage && map && roomLegend(secrets).length ? (
        <details open className="mb-4 rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer font-medium text-fg">Legenda das salas (só você vê)</summary>
          <ol className="mt-2 flex flex-col gap-1 text-fg-secondary">
            {roomLegend(secrets).map((entry) => (
              <li key={`${entry.number}-${entry.text}`}>
                <strong className="text-fg">{entry.number}.</strong> {entry.text}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          id={`${id}-sessao`}
          label="Sessão"
          value={newSessionId}
          onChange={(event) => {
            const next = event.target.value;
            setNewSessionId(next);
            const inSession = maps.filter((entry) => entry.sessionId === next);
            setSelectedId(inSession.find((entry) => entry.isActive)?.id ?? inSession[0]?.id ?? null);
          }}
          className="min-w-48"
        >
          {sessions.map((entry) => (
            <option key={entry.id} value={entry.id}>
              Sessão {entry.number} · {entry.title}
            </option>
          ))}
        </SelectField>
        {sessionMaps.length ? (
          <SelectField id={`${id}-mapa`} label="Mapa desta sessão" value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value || null)} className="min-w-64">
            {sessionMaps.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.isActive ? ' (ativo)' : ''}
              </option>
            ))}
          </SelectField>
        ) : (
          <p className="pb-2 text-sm text-fg-muted">Nenhum mapa preparado para esta sessão.</p>
        )}
        {canManage ? (
          <details className="w-full rounded-lg border border-line p-3" open={sessionMaps.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-fg">Novo mapa: criar, importar ou gerar masmorra</summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className="w-full text-xs text-fg-muted">O mapa novo entra na sessão escolhida acima. Durante o jogo, use para improvisar.</p>
            <TextField id={`${id}-novo`} label="Nome do mapa" placeholder="Ex.: Taverna do Javali" maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} />
            <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} disabled={!newName.trim()} loading={busy && !map} onClick={() => void createMap()}>
              Criar mapa
            </Button>
            <input
              ref={dungeonInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importDungeon(file);
              }}
            />
            <Button variant="secondary" icon={<Castle className="h-4 w-4" aria-hidden="true" />} disabled={busy} onClick={() => dungeonInputRef.current?.click()}>
              Importar masmorra
            </Button>
            <TextField id={`${id}-semente`} label="Semente da masmorra" maxLength={40} value={dungeonSeed} onChange={(event) => setDungeonSeed(event.target.value)} />
            <SelectField id={`${id}-tamanho-masmorra`} label="Tamanho" value={dungeonSize} onChange={(event) => setDungeonSize(event.target.value as DungeonSize)}>
              <option value="small">Pequena</option>
              <option value="medium">Média</option>
              <option value="large">Grande</option>
            </SelectField>
            <Button variant="secondary" icon={<Castle className="h-4 w-4" aria-hidden="true" />} disabled={busy} onClick={() => void createGeneratedDungeon()}>
              Gerar masmorra
            </Button>
          </div>
          </details>
        ) : null}
      </div>
      {canManage ? (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-sunken/40 p-3 text-sm sm:flex-row sm:items-start">
          <Castle className="mt-0.5 h-5 w-5 shrink-0 text-fg-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-fg-secondary">
            <p className="font-medium text-fg">Mapas prontos com os geradores do watabou</p>
            <p className="mt-1">
              Nos geradores gratuitos do watabou há reino, cidade, vila, caverna, masmorra e casa. Gere a <strong>masmorra</strong> (One Page Dungeon),
              exporte em <strong>JSON</strong> e clique em <strong>Importar masmorra</strong>. O mapa nasce pronto:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>grade do tamanho certo e paredes de pedra em volta das salas e corredores;</li>
              <li>névoa e linha de visão já ligadas;</li>
              <li>números das salas visíveis para todos;</li>
              <li>legenda só para o mestre.</li>
            </ul>
            <p className="mt-1 text-xs text-fg-muted">
              Os outros geradores (reino, cidade, vila, caverna e casa) exportam imagem: baixe em PNG, crie o mapa e envie como imagem de fundo.
            </p>
          </div>
          <a
            href="https://watabou.github.io/"
            target="_blank"
            rel="noreferrer"
            className={buttonClasses('secondary', 'sm', 'shrink-0 gap-2')}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Abrir geradores
          </a>
        </div>
      ) : null}

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
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = mapName.trim();
                  if (name && name !== map.name) {
                    patchMap({ name });
                    setMaps((current) => current.map((entry) => (entry.id === map.id ? { ...entry, name } : entry)));
                  }
                }}
              >
                <TextField id={`${id}-renomear`} label="Nome do mapa" maxLength={80} value={mapName} onChange={(event) => setNameDraft({ mapId: map.id, value: event.target.value })} />
                <Button type="submit" variant="secondary" disabled={!mapName.trim() || mapName.trim() === map.name}>
                  Renomear
                </Button>
              </form>
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
                          icon={<RotateCw className="h-4 w-4" aria-hidden="true" />}
                          onClick={() =>
                            patchMap({
                              images: map.images.map((layer, index) =>
                                index === selectedLayer ? { ...layer, rotation: (((layer.rotation ?? 0) + 90) % 360) as MapImageRotation } : layer,
                              ),
                            })
                          }
                        >
                          Girar 90°
                        </Button>
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
              <Button size="sm" variant="ghost" onClick={async () => {
                  if (await confirm({ title: 'Apagar todas as paredes?', confirmLabel: 'Apagar' })) patchMap({ walls: [] });
                }}>
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
                Arraste a partir de um canto de quadrado (círculo: comece no meio do quadrado para centrá-lo nele): o tamanho segue de 1,5 em 1,5 m e os quadrados atingidos ficam destacados. Todos veem as áreas que você coloca.
              </p>
            </div>
          ) : null}
          {tool === 'draw' || tool === 'note' || tool === 'icon' ? (
            <div className="flex flex-wrap items-center gap-3">
              {tool === 'icon' ? (
                <SelectField id={`${id}-icone`} label="Ícone" value={selectedIcon} onChange={(event) => setSelectedIcon(event.target.value as MapIconKind)}>
                  {MAP_ICON_KINDS.map((icon) => <option key={icon} value={icon}>{ICON_LABELS[icon]}</option>)}
                </SelectField>
              ) : null}
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
              <p className="text-xs text-fg-muted">{tool === 'draw' ? 'Arraste para desenhar.' : tool === 'icon' ? 'Clique em um quadrado para colocar; use Mover para arrastar ou Apagar desenho para remover.' : 'Clique no mapa para escrever uma anotação.'}</p>
            </div>
          ) : null}
          {tool === 'texture' ? (
            <div className="flex flex-wrap items-end gap-3">
              <SelectField id={`${id}-textura`} label="Textura do chão" value={floorTexture} onChange={(event) => setFloorTexture(event.target.value as FloorTexture)}>
                {FLOOR_TEXTURES.map((texture) => <option key={texture} value={texture}>{TEXTURE_LABELS[texture]}</option>)}
              </SelectField>
              <p className="text-xs text-fg-muted">Arraste sobre os quadrados. A pintura é compactada em retângulos leves e aparece no site e no app.</p>
            </div>
          ) : null}
          {tool === 'room' ? (
            <p className="text-xs text-fg-muted">
              Clique numa sala: o próximo número ({nextRoomNumber()}) aparece para todos e a descrição fica na legenda, só para você.
            </p>
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
            <div ref={scrollRef} className={cx('flex overflow-auto rounded-md border border-line', fullscreen ? 'h-[calc(100vh-1rem)]' : 'h-[calc(100vh-14rem)] min-h-[28rem]')}>
              <div className="m-auto">
              <MapBoard
                systemId={systemId}
                map={map}
                tokens={tokens}
                imageUrl={imageUrl}
                tokenImages={tokenImages}
                tokenSpeeds={tokenSpeeds}
                freeMovement={!inCombat}
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
                selectedIcon={selectedIcon}
                floorTexture={floorTexture}
                secretDrawings={secrets}
                onAddArea={(shape) => patchMap({ areas: [...map.areas, shape] })}
                onAddDrawing={addDrawing}
                onPaintTexture={(area, texture) => patchMap({ drawings: paintMapTexture(map.drawings, area, texture) })}
                onRequestNote={(point) => {
                  setNoteText('');
                  setNoteAt(point);
                }}
                onMoveDrawing={(index, secret, x, y) => {
                  const move = (list: MapDrawing[]) => list.map((drawing, position) => (position === index && (drawing.type === 'note' || drawing.type === 'icon') ? { ...drawing, x, y } : drawing));
                  if (secret) saveSecrets(move(secrets));
                  else patchMap({ drawings: move(map.drawings) });
                }}
                onDrawingMenu={canManage ? (index, secret, x, y) => setDrawingMenu({ index, secret, x, y }) : undefined}
                onRemoveDrawing={(index, secret) =>
                  secret ? saveSecrets(secrets.filter((_, position) => position !== index)) : patchMap({ drawings: map.drawings.filter((_, position) => position !== index) })
                }
              />
              </div>
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
      <Modal
        open={noteAt !== null}
        onClose={() => setNoteAt(null)}
        title={tool === 'room' ? `Sala ${nextRoomNumber()}` : 'Nova anotação'}
        description={
          tool === 'room'
            ? 'O número aparece para todos. A descrição (o que tem na sala) fica na legenda, só para você.'
            : drawSecret
              ? 'Só você vai ver esta anotação.'
              : 'Todos na mesa vão ver esta anotação.'
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const text = noteText.trim();
            if (noteAt && tool === 'room') addRoom(noteAt, text);
            else if (noteAt && text) addDrawing({ type: 'note', x: noteAt.x, y: noteAt.y, text: text.slice(0, 120), color: drawColor });
            setNoteAt(null);
          }}
        >
          <TextField
            id={`${id}-nota`}
            label={tool === 'room' ? 'O que tem na sala (opcional)' : 'Texto da anotação'}
            maxLength={110}
            autoFocus
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder={tool === 'room' ? 'Ex.: Altar profanado, 2 esqueletos' : 'Ex.: Armadilha de fosso'}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNoteAt(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={tool !== 'room' && !noteText.trim()}>
              Pôr no mapa
            </Button>
          </div>
        </form>
      </Modal>
      {drawingMenu ? createPortal(
        <div className="fixed inset-0 z-50" onClick={() => setDrawingMenu(null)} onContextMenu={(event) => { event.preventDefault(); setDrawingMenu(null); }}>
          <div role="menu" className="absolute flex min-w-36 flex-col rounded-md border border-line bg-surface p-1 shadow-lg" style={{ left: drawingMenu.x, top: drawingMenu.y }} onClick={(event) => event.stopPropagation()}>
            <button type="button" role="menuitem" className="flex items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={() => { openEdit(drawingMenu.index, drawingMenu.secret); setDrawingMenu(null); }}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
            </button>
            <button type="button" role="menuitem" className="flex items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-danger hover:bg-sunken" onClick={() => { removeNote(drawingMenu.index, drawingMenu.secret); setDrawingMenu(null); }}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar
            </button>
          </div>
        </div>
      , document.body) : null}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && roomNumberOf(editing.index, editing.secret) ? `Sala ${roomNumberOf(editing.index, editing.secret)}` : 'Editar anotação'}
        description={editing && roomNumberOf(editing.index, editing.secret) ? 'A descrição fica na legenda, só para você. Deixe em branco para tirar.' : undefined}
      >
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); saveEdit(); }}>
          <TextField id={`${id}-editar-nota`} label="Texto" maxLength={110} autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/** Legenda das salas numeradas (anotações secretas "N. descrição"), em ordem. */
export function roomLegend(secrets: readonly MapDrawing[]): { number: number; text: string }[] {
  return secrets
    .flatMap((drawing) => {
      if (drawing.type !== 'note') return [];
      const match = /^(\d+)\.\s+(.*)$/s.exec(drawing.text);
      return match ? [{ number: Number(match[1]), text: match[2]! }] : [];
    })
    .sort((a, b) => a.number - b.number);
}

/**
 * Tutorial do mapa para o mestre: o passo a passo das ferramentas e a importação de masmorras do
 * One Page Dungeon (watabou). Fica recolhido; aberto, ensina do zero.
 */
function MapTutorial() {
  return (
    <details className="mb-4 rounded-lg border border-line bg-sunken/40 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-fg">Como usar o mapa (tutorial do mestre)</summary>
      <div className="mt-3 flex flex-col gap-4 text-fg-secondary">
        <section>
          <h3 className="font-display text-fg">1. Monte o cenário</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Escolha a sessão, dê um nome e clique em <strong>Criar mapa</strong>.</li>
            <li>Envie a imagem do mapa e, com a ferramenta <strong>Imagem</strong>, arraste e ajuste a largura até os quadrados combinarem (1 quadrado = 1,5 m).</li>
            <li>Com <strong>Parede</strong>, desenhe as paredes: elas bloqueiam a visão quando a linha de visão está ligada.</li>
            <li>Sem imagem de fundo, use <strong>Textura</strong> para pintar pedra, terra, madeira, grama ou água diretamente nos quadrados.</li>
            <li>Use <strong>Ícone</strong> para marcar baús, portas, armadilhas, escadas, fogueiras, altares e caveiras. Marque “Só eu vejo” para segredos; com <strong>Mover</strong> você reposiciona.</li>
            <li>Ligue a <strong>névoa</strong> e use <strong>Revelar névoa</strong>/<strong>Cobrir com névoa</strong> para mostrar só o que o grupo descobriu (ou a névoa automática, que abre o que os tokens enxergam).</li>
          </ol>
        </section>
        <section>
          <h3 className="font-display text-fg">2. Masmorra pronta em um minuto</h3>
          <p className="mt-1">Informe uma <strong>semente</strong>, escolha pequena, média ou grande e clique em <strong>Gerar masmorra</strong>. O gerador do Codexveil cria salas, corredores, portas, números, paredes, névoa e linha de visão sem serviço externo.</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Abra os{' '}
              <a href="https://watabou.github.io/" target="_blank" rel="noreferrer" className="text-fg-brand underline-offset-2 hover:underline">
                geradores do watabou
              </a>{' '}
              (gratuitos), escolha <strong>Dungeon</strong> (One Page Dungeon) e gere masmorras até gostar de uma.
            </li>
            <li>No menu de exportação do gerador, salve em <strong>JSON</strong>.</li>
            <li>Aqui, escolha a sessão e clique em <strong>Importar masmorra</strong> com esse arquivo.</li>
            <li>O Codexveil cria o mapa com a grade, as paredes, a névoa e a linha de visão já ligadas, os números das salas para todos e a legenda só para você.</li>
            <li>
              Para o visual, exporte também a imagem (PNG) no gerador e envie como imagem do mapa; ajuste a largura para os quadrados baterem com as paredes.
            </li>
          </ol>
          <p className="mt-1 text-xs text-fg-muted">
            Outros geradores do watabou (cidade, vila, caverna, casa) exportam só imagem: envie como imagem do mapa e desenhe as paredes que importam.
          </p>
        </section>
        <section>
          <h3 className="font-display text-fg">3. Salas numeradas e legenda</h3>
          <p className="mt-1">
            Com <strong>Sala numerada</strong>, clique numa sala: o próximo número aparece para todos, e o que tem nela (monstros, armadilhas, tesouro) fica
            na legenda abaixo do mapa, só para você.
          </p>
        </section>
        <section>
          <h3 className="font-display text-fg">4. Durante o jogo</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li><strong>Ative</strong> o mapa para os jogadores verem; cada um move só o próprio token.</li>
            <li>Ponha personagens e criaturas da biblioteca como tokens; tokens novos entram ocultos até você mostrar.</li>
            <li>Use a <strong>Régua</strong> para distâncias e <strong>Área de magia</strong> para cones, esferas e linhas.</li>
          </ul>
        </section>
      </div>
    </details>
  );
}
