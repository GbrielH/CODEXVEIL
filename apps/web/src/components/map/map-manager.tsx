'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  addMapToken,
  campaignMapPath,
  createSessionMap,
  deleteMapToken,
  deleteSessionMap,
  listSessionMaps,
  setActiveMap,
  updateMapToken,
  updateSessionMap,
  type MapToken,
  type SessionMap,
  type SessionMapPatch,
} from '@codexveil/database';
import { TOKEN_SIZES, WALL_STYLES, paintFog, tokenSizeLabels, tokenSizeSquares, type TokenSize, type WallStyle } from '@codexveil/domain';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { Eraser, EyeOff, ImageUp, Map as MapIcon, Minus, MousePointer2, Plus, Radio, Square, SquareDashed, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { LiveBadge } from '@/components/ui/save-status';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
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

interface MapManagerProps {
  campaignId: string;
  sessionId: string;
  systemId: string;
  characters: MapCharacter[];
  creatures: MapCreature[];
  /** Campanha ativa (arquivada: só leitura). */
  canManage: boolean;
}

const TOOLS: { tool: MapTool; label: string; icon: ReactNode }[] = [
  { tool: 'move', label: 'Mover', icon: <MousePointer2 className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'reveal', label: 'Revelar névoa', icon: <SquareDashed className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'hide', label: 'Cobrir com névoa', icon: <Square className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'wall', label: 'Parede', icon: <Minus className="h-4 w-4" aria-hidden="true" /> },
  { tool: 'erase-wall', label: 'Apagar parede', icon: <Eraser className="h-4 w-4" aria-hidden="true" /> },
];

/**
 * Mesa do mestre na grade: cria mapas da sessão, envia e ajusta a imagem sob a grade de 1,5 m,
 * ativa o mapa para os jogadores, coloca tokens (personagens, criaturas, marcadores), pinta a
 * névoa de guerra e desenha paredes para a linha de visão opcional.
 */
export function MapManager({ campaignId, sessionId, systemId, characters, creatures, canManage }: MapManagerProps) {
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
  const saveTimer = useRef<number | null>(null);
  const pendingPatch = useRef<{ mapId: string; patch: SessionMapPatch } | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const sizeLabels = tokenSizeLabels(systemId);
  const selectedKey = useMemo(() => (selectedId ? { id: selectedId } : null), [selectedId]);

  const { map, tokens, imageUrl, tokenImages, live, reload, setData, track } = useMapData(campaignId, selectedKey);

  const reloadMaps = useCallback(async () => {
    try {
      const next = await listSessionMaps(getSupabaseBrowserClient(), sessionId);
      setMaps(next);
      setSelectedId((current) => current ?? next.find((entry) => entry.isActive)?.id ?? next[0]?.id ?? null);
    } catch {
      // Mantém a lista anterior.
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    listSessionMaps(getSupabaseBrowserClient(), sessionId)
      .then((next) => {
        if (!active) return;
        setMaps(next);
        setSelectedId((current) => current ?? next.find((entry) => entry.isActive)?.id ?? next[0]?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sessionId]);

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

  const createMap = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const mapId = await createSessionMap(getSupabaseBrowserClient(), { campaignId, sessionId, name });
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
      const previous = map.imagePath;
      await updateSessionMap(client, map.id, { imagePath: path });
      if (previous) await bucket.remove([previous]);
      toast({ tone: 'success', title: 'Imagem do mapa enviada.', description: 'Ajuste o tamanho até os quadrados combinarem com o desenho (1 quadrado = 1,5 m).' });
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
      await setActiveMap(getSupabaseBrowserClient(), campaignId, map.isActive ? null : map.id);
      toast({ tone: 'success', title: map.isActive ? 'Mapa escondido dos jogadores.' : 'Mapa ativo: os jogadores já estão vendo.' });
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

  const addToken = async (input: { kind: MapToken['kind']; characterId?: string; creatureId?: string; label: string; size: TokenSize; isHidden?: boolean }) => {
    if (!map) return;
    // Começa no centro do mapa; o mestre arrasta para o lugar.
    const side = tokenSizeSquares[input.size];
    const x = Math.max(0, Math.floor((map.cols - side) / 2));
    const y = Math.max(0, Math.floor((map.rows - side) / 2));
    try {
      await addMapToken(getSupabaseBrowserClient(), { mapId: map.id, campaignId, ...input, x, y });
      reload();
    } catch (error) {
      fail('O token não foi adicionado', error);
    }
  };

  const token = tokens.find((entry) => entry.id === selectedToken) ?? null;
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
          <SelectField id={`${id}-mapa`} label="Mapa" value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value || null)} className="min-w-48">
            {maps.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.isActive ? ' (ativo)' : ''}
              </option>
            ))}
          </SelectField>
        ) : null}
        {canManage ? (
          <>
            <TextField id={`${id}-novo`} label="Novo mapa" placeholder="Ex.: Taverna do Javali" maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} />
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
                {map.imagePath ? 'Trocar imagem' : 'Enviar imagem'}
              </Button>
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} disabled={busy} onClick={() => void removeMap()}>
                Apagar mapa
              </Button>
            </div>
          ) : null}

          {canManage ? (
            <fieldset className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-3 lg:grid-cols-6">
              <legend className="px-1 text-xs text-fg-muted">Ajuste da imagem e da grade</legend>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary sm:col-span-3 lg:col-span-2">
                Tamanho da imagem ({Math.round(map.imageScale * 100)}%)
                <input
                  type="range"
                  min={0.1}
                  max={4}
                  step={0.01}
                  value={map.imageScale}
                  onChange={(event) => patchMap({ imageScale: Number(event.target.value) }, 400)}
                  className="accent-wine-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                Mover imagem → (quadrados)
                <NumberInput value={map.imageOffsetX} decimal min={-500} max={500} onCommit={(value) => patchMap({ imageOffsetX: value ?? 0 })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                Mover imagem ↓ (quadrados)
                <NumberInput value={map.imageOffsetY} decimal min={-500} max={500} onCommit={(value) => patchMap({ imageOffsetY: value ?? 0 })} />
              </label>
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
              </div>
            </fieldset>
          ) : null}

          <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Ferramentas do mapa">
            {TOOLS.filter((entry) => canManage || entry.tool === 'move')
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
            <div className="max-h-[75vh] overflow-auto rounded-md border border-line">
              <MapBoard
                systemId={systemId}
                map={map}
                tokens={tokens}
                imageUrl={imageUrl}
                tokenImages={tokenImages}
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
              />
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
                      label="Criatura da biblioteca (entra oculta)"
                      value=""
                      onChange={(event) => {
                        const creature = creatures.find((entry) => entry.id === event.target.value);
                        if (creature) void addToken({ kind: 'creature', creatureId: creature.id, label: creature.name, size: creature.size, isHidden: true });
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
    </Card>
  );
}
