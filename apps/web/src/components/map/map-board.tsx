'use client';

import type { MapImage, MapToken, SessionMap, Wall } from '@codexveil/database';
import {
  areaCells,
  areaOutline,
  cellRect,
  fogCells,
  formatMeters,
  gridDistance,
  pointInPolygon,
  snapMeters,
  tokenSizeSquares,
  movementCrossesWall,
  visibilityPolygon,
  wallBlocksSight,
  type GridRect,
  type MapArea,
  type MapDrawing,
  type Point,
  type WallStyle,
} from '@codexveil/domain';
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useCampaignColors } from '@/components/dice/campaign-colors';
import { WallPatterns, WallShape } from './wall-art';

/** Ferramenta do mestre no tabuleiro. */
export type MapTool = 'move' | 'image' | 'ruler' | 'area' | 'reveal' | 'hide' | 'wall' | 'erase-wall' | 'draw' | 'note' | 'erase-drawing';

export const CELL = 40;
const CREATURE_COLOR = '#571F2B';
const MARKER_COLOR = '#b58a2a';

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words.length === 1 ? words[0]!.slice(0, 2) : `${words[0]![0]}${words[1]![0]}`).toUpperCase();
}

interface MapBoardProps {
  map: SessionMap;
  tokens: MapToken[];
  imageUrl: string | null;
  /** Deslocamento de cada token em metros: a etiqueta do arrasto fica vermelha ao passar. */
  tokenSpeeds?: Record<string, number>;
  /**
   * Movimentação livre (fora de combate): arrastar não mostra linha, metros nem limite de
   * deslocamento, e os movimentos não deixam rastro.
   */
  freeMovement?: boolean;
  /** URL de cada imagem (camada) do mapa (caminho → URL). */
  layerUrls?: Record<string, string>;
  /** Camada selecionada (ferramenta "imagem" do mestre). */
  selectedLayer?: number | null;
  onSelectLayer?: (index: number | null) => void;
  /** Mestre moveu uma camada (nova posição em quadrados). */
  onMoveLayer?: (index: number, x: number, y: number) => void;
  /** URL da imagem de cada token (id → URL). */
  tokenImages?: Record<string, string>;
  /** Sistema da campanha (regra de distância na diagonal). */
  systemId: string;
  /** Estilo da parede desenhada pelo mestre. */
  wallStyle?: WallStyle;
  /** Mestre: vê tudo (névoa translúcida, paredes, tokens ocultos) e move qualquer token. */
  isGm: boolean;
  /** Personagem do jogador (só ele pode ser arrastado pelo jogador). */
  myCharacterId: string | null;
  zoom: number;
  tool?: MapTool;
  selectedTokenId?: string | null;
  onSelectToken?: (tokenId: string | null) => void;
  onMoveToken?: (token: MapToken, x: number, y: number) => void;
  onPaintFog?: (area: GridRect, reveal: boolean) => void;
  onAddWall?: (wall: Wall) => void;
  onRemoveWall?: (index: number) => void;
  /** Forma da área de magia desenhada com a ferramenta "área". */
  areaKind?: MapArea['kind'];
  /** Cor dos desenhos e anotações. */
  drawColor?: string;
  /** Áreas só desta tela (prévia do jogador, não gravadas). */
  localAreas?: MapArea[];
  /** Desenhos e anotações só do mestre. */
  secretDrawings?: MapDrawing[];
  onAddArea?: (area: MapArea) => void;
  onAddDrawing?: (drawing: MapDrawing) => void;
  /** Mestre clicou com a ferramenta "anotação": abre a janela do texto. */
  onRequestNote?: (point: Point) => void;
  /** Apaga um desenho: índice na lista pública ou na secreta. */
  onRemoveDrawing?: (index: number, secret: boolean) => void;
}

/**
 * Tabuleiro da grade (SVG): imagem ajustada pelo mestre, linhas dos quadrados, tokens, paredes,
 * névoa e linha de visão. Coordenadas em quadrados; cada quadrado = 1,5 m.
 */
export function MapBoard({
  map,
  tokens,
  imageUrl,
  tokenImages = {},
  layerUrls = {},
  tokenSpeeds = {},
  freeMovement = false,
  selectedLayer = null,
  onSelectLayer,
  onMoveLayer,
  systemId,
  wallStyle = 'stone',
  isGm,
  myCharacterId,
  zoom,
  tool = 'move',
  selectedTokenId = null,
  onSelectToken,
  onMoveToken,
  onPaintFog,
  onAddWall,
  onRemoveWall,
  areaKind = 'circle',
  drawColor = '#f3e2b3',
  localAreas = [],
  secretDrawings = [],
  onAddArea,
  onAddDrawing,
  onRequestNote,
  onRemoveDrawing,
}: MapBoardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const colors = useCampaignColors();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ tokenId: string; offsetX: number; offsetY: number; x: number; y: number } | null>(null);
  const [area, setArea] = useState<{ start: Point; end: Point } | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [ruler, setRuler] = useState<{ start: Point; end: Point; active: boolean } | null>(null);
  const [areaDraft, setAreaDraft] = useState<{ origin: Point; point: Point } | null>(null);
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  // Token clicado: mostra o nome por cima dele por alguns segundos.
  const [namedToken, setNamedToken] = useState<string | null>(null);
  const nameTimer = useRef<number | null>(null);
  const showName = (tokenId: string | null) => {
    if (nameTimer.current) window.clearTimeout(nameTimer.current);
    setNamedToken(tokenId);
    if (tokenId) nameTimer.current = window.setTimeout(() => setNamedToken(null), 4000);
  };
  useEffect(() => () => {
    if (nameTimer.current) window.clearTimeout(nameTimer.current);
  }, []);
  const [layerDrag, setLayerDrag] = useState<{ index: number; offsetX: number; offsetY: number; x: number; y: number } | null>(null);
  // Proporção (altura/largura) de cada imagem, para o contorno e a área de arrastar.
  const [aspects, setAspects] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    for (const [path, url] of Object.entries(layerUrls)) {
      if (aspects[path]) continue;
      const image = new Image();
      image.onload = () => {
        if (active && image.naturalWidth) setAspects((current) => ({ ...current, [path]: image.naturalHeight / image.naturalWidth }));
      };
      image.src = url;
    }
    return () => {
      active = false;
    };
  }, [layerUrls, aspects]);

  // Rastro dos movimentos (de todos, inclusive vindos do tempo real): linha e distância por 6 s.
  const [lastTokens, setLastTokens] = useState(tokens);
  const [trails, setTrails] = useState<{ id: string; label: string; from: Point; to: Point; side: number; meters: number }[]>([]);
  if (lastTokens !== tokens) {
    const before = new Map(lastTokens.map((token) => [token.id, token]));
    const moved = tokens.flatMap((token) => {
      const old = before.get(token.id);
      if (!old || (old.x === token.x && old.y === token.y)) return [];
      const { meters } = gridDistance(old, token, systemId);
      return [{ id: token.id, label: token.label, from: { x: old.x, y: old.y }, to: { x: token.x, y: token.y }, side: tokenSizeSquares[token.size], meters }];
    });
    setLastTokens(tokens);
    if (moved.length && !freeMovement) setTrails((current) => [...current.filter((trail) => !moved.some((entry) => entry.id === trail.id)), ...moved]);
  }
  useEffect(() => {
    if (trails.length === 0) return;
    const timer = window.setTimeout(() => setTrails([]), 6000);
    return () => window.clearTimeout(timer);
  }, [trails]);

  const myToken = tokens.find((token) => token.kind === 'character' && token.characterId === myCharacterId) ?? null;

  const toGrid = (event: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  const toCell = (point: Point): Point => ({ x: Math.floor(point.x), y: Math.floor(point.y) });

  /**
   * Por que o token não pode ir para `target` (ou `null` se pode): outro token já ocupa algum
   * dos quadrados, ou (jogadores) o caminho em linha reta atravessa uma parede.
   */
  const blockedReason = (token: MapToken, target: Point): string | null => {
    const side = tokenSizeSquares[token.size];
    const occupied = tokens.some((other) => {
      if (other.id === token.id || !visibleToMe(other)) return false;
      const otherSide = tokenSizeSquares[other.size];
      return target.x < other.x + otherSide && other.x < target.x + side && target.y < other.y + otherSide && other.y < target.y + side;
    });
    if (occupied) return 'quadrado ocupado';
    if (!isGm && movementCrossesWall(map.walls, { x: token.x + side / 2, y: token.y + side / 2 }, { x: target.x + side / 2, y: target.y + side / 2 }))
      return 'parede no caminho';
    return null;
  };

  const canDrag = (token: MapToken) => tool === 'move' && (isGm || (token.kind === 'character' && token.characterId !== null && token.characterId === myCharacterId));

  const unrevealedPath = useMemo(() => {
    if (!map.fogEnabled) return '';
    const revealed = fogCells(map.fogRevealed);
    let path = '';
    for (let y = 0; y < map.rows; y += 1) {
      for (let x = 0; x < map.cols; x += 1) if (!revealed.has(`${x},${y}`)) path += `M${x} ${y}h1v1h-1z`;
    }
    return path;
  }, [map.fogEnabled, map.fogRevealed, map.cols, map.rows]);

  // Linha de visão (só para o jogador, com o mapa configurado e o token dele no mapa).
  const sight = useMemo(() => {
    if (isGm || !map.lineOfSight || !myToken) return null;
    const side = tokenSizeSquares[myToken.size];
    const origin = { x: myToken.x + side / 2, y: myToken.y + side / 2 };
    const blocking = map.walls.filter((wall) => wallBlocksSight(wall[4])).map(([x1, y1, x2, y2]) => [x1, y1, x2, y2] as [number, number, number, number]);
    return visibilityPolygon(origin, blocking, map.cols, map.rows, myToken.visionRadius);
  }, [isGm, map.lineOfSight, map.walls, map.cols, map.rows, myToken]);
  const sightPoints = sight ? sight.map((point) => `${point.x},${point.y}`).join(' ') : null;
  // Fora da linha de visão os tokens nem aparecem (só o próprio).
  const visibleToMe = (token: MapToken) => {
    if (!sight || token.id === myToken?.id) return true;
    const side = tokenSizeSquares[token.size];
    return pointInPolygon({ x: token.x + side / 2, y: token.y + side / 2 }, sight);
  };

  const center = (point: Point): Point => ({ x: Math.floor(point.x) + 0.5, y: Math.floor(point.y) + 0.5 });

  const onBoardDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    showName(null);
    const point = toGrid(event);
    if (tool === 'ruler') {
      event.currentTarget.setPointerCapture(event.pointerId);
      const cell = center(point);
      setRuler({ start: cell, end: cell, active: true });
      return;
    }
    if (tool === 'area') {
      event.currentTarget.setPointerCapture(event.pointerId);
      // Cone parte de um canto de quadrado; a linha, do centro (pinta uma fileira só). O círculo
      // parte do que estiver mais perto: clicar no meio de um quadrado (o do próprio token) centra ali.
      const fx = point.x - Math.floor(point.x);
      const fy = point.y - Math.floor(point.y);
      const nearCenter = fx > 0.25 && fx < 0.75 && fy > 0.25 && fy < 0.75;
      const origin =
        areaKind === 'line' || (areaKind === 'circle' && nearCenter) ? center(point) : { x: Math.round(point.x), y: Math.round(point.y) };
      setAreaDraft({ origin, point: origin });
      return;
    }
    if (!isGm) return;
    if (tool === 'draw') {
      event.currentTarget.setPointerCapture(event.pointerId);
      setStroke([[point.x, point.y]]);
      return;
    }
    if (tool === 'note') {
      onRequestNote?.(point);
      return;
    }
    if (tool === 'reveal' || tool === 'hide') {
      event.currentTarget.setPointerCapture(event.pointerId);
      const cell = toCell(point);
      setArea({ start: cell, end: cell });
    } else if (tool === 'wall') {
      const corner = { x: Math.round(point.x), y: Math.round(point.y) };
      if (!wallStart) setWallStart(corner);
      else {
        if (corner.x !== wallStart.x || corner.y !== wallStart.y) onAddWall?.([wallStart.x, wallStart.y, corner.x, corner.y, wallStyle]);
        setWallStart(null);
      }
    } else if (tool === 'move') {
      onSelectToken?.(null);
    }
  };

  const onBoardMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = toGrid(event);
    if (layerDrag) {
      setLayerDrag({ ...layerDrag, x: point.x - layerDrag.offsetX, y: point.y - layerDrag.offsetY });
      return;
    }
    if (ruler?.active) {
      setRuler({ ...ruler, end: center(point) });
      return;
    }
    if (areaDraft) {
      setAreaDraft({ ...areaDraft, point });
      return;
    }
    if (stroke) {
      const last = stroke[stroke.length - 1]!;
      if (Math.hypot(point.x - last[0], point.y - last[1]) > 0.15) setStroke([...stroke, [point.x, point.y]]);
      return;
    }
    if (drag) setDrag({ ...drag, x: point.x - drag.offsetX, y: point.y - drag.offsetY });
    else if (area) setArea({ ...area, end: toCell(point) });
    else if (tool === 'wall') setHover({ x: Math.round(point.x), y: Math.round(point.y) });
  };

  const draftArea = (draft: { origin: Point; point: Point }): MapArea => {
    const dx = draft.point.x - draft.origin.x;
    const dy = draft.point.y - draft.origin.y;
    const meters = snapMeters(Math.hypot(dx, dy) * 1.5);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return areaKind === 'circle'
      ? { kind: 'circle', x: draft.origin.x, y: draft.origin.y, meters }
      : { kind: areaKind, x: draft.origin.x, y: draft.origin.y, angle, meters };
  };

  const onBoardUp = () => {
    if (layerDrag) {
      onMoveLayer?.(layerDrag.index, Math.round(layerDrag.x * 4) / 4, Math.round(layerDrag.y * 4) / 4);
      setLayerDrag(null);
    }
    if (ruler?.active) setRuler({ ...ruler, active: false });
    if (areaDraft) {
      onAddArea?.(draftArea(areaDraft));
      setAreaDraft(null);
    }
    if (stroke) {
      if (stroke.length > 1) {
        onAddDrawing?.({ type: 'path', points: stroke.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]), color: drawColor });
      }
      setStroke(null);
    }
    if (drag) {
      const token = tokens.find((entry) => entry.id === drag.tokenId);
      if (token) {
        const side = tokenSizeSquares[token.size];
        const x = Math.max(0, Math.min(map.cols - side, Math.round(drag.x)));
        const y = Math.max(0, Math.min(map.rows - side, Math.round(drag.y)));
        if ((x !== token.x || y !== token.y) && !blockedReason(token, { x, y })) onMoveToken?.(token, x, y);
      }
      setDrag(null);
    }
    if (area) {
      onPaintFog?.(cellRect(area.start, area.end, map.cols, map.rows), tool === 'reveal');
      setArea(null);
    }
  };

  const tokenColor = (token: MapToken) =>
    token.kind === 'character' ? (colors?.colorOfCharacter(token.characterId) ?? '#3b4cb8') : token.kind === 'creature' ? CREATURE_COLOR : MARKER_COLOR;

  const ordered = tokens.filter(visibleToMe).sort((a, b) => tokenSizeSquares[b.size] - tokenSizeSquares[a.size]);
  const preview = area ? cellRect(area.start, area.end, map.cols, map.rows) : null;
  const shownAreas = [...map.areas.map((entry) => ({ area: entry, local: false })), ...localAreas.map((entry) => ({ area: entry, local: true }))];
  if (areaDraft) shownAreas.push({ area: draftArea(areaDraft), local: true });
  const drawingItems = [
    ...map.drawings.map((drawing, index) => ({ drawing, index, secret: false })),
    ...(isGm ? secretDrawings.map((drawing, index) => ({ drawing, index, secret: true })) : []),
  ];

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${map.cols} ${map.rows}`}
      width={map.cols * CELL * zoom}
      height={map.rows * CELL * zoom}
      className="block touch-none select-none"
      style={{ background: '#16130f', cursor: tool === 'move' ? 'default' : 'crosshair' }}
      onPointerDown={onBoardDown}
      onPointerMove={onBoardMove}
      onPointerUp={onBoardUp}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={`Mapa ${map.name}: ${map.cols} por ${map.rows} quadrados de 1,5 m`}
    >
      <defs>
        <pattern id={`grade-${uid}`} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.2 / CELL} />
        </pattern>
        <WallPatterns uid={uid} />
        {sightPoints ? (
          <mask id={`visao-${uid}`}>
            <rect x="0" y="0" width={map.cols} height={map.rows} fill="white" />
            <polygon points={sightPoints} fill="black" />
          </mask>
        ) : null}
      </defs>

      {/* Imagens (camadas): o mestre arrasta com a ferramenta "Imagem". */}
      {map.images.map((layer: MapImage, index) => {
        const url = layerUrls[layer.path] ?? (index === 0 ? imageUrl : null);
        if (!url) return null;
        const dragging = layerDrag?.index === index;
        const x = dragging ? layerDrag.x : layer.x;
        const y = dragging ? layerDrag.y : layer.y;
        const height = layer.width * (aspects[layer.path] ?? 1);
        // Girada de lado (90°/270°), a área ocupada troca largura e altura; gira em torno do centro dela.
        const rotation = layer.rotation ?? 0;
        const sideways = rotation === 90 || rotation === 270;
        const boxWidth = sideways ? height : layer.width;
        const boxHeight = sideways ? layer.width : height;
        const centerX = x + boxWidth / 2;
        const centerY = y + boxHeight / 2;
        const active = isGm && tool === 'image';
        return (
          <g key={`${layer.path}-${index}`}>
            <image
              href={url}
              x={centerX - layer.width / 2}
              y={centerY - height / 2}
              width={layer.width}
              height={height}
              preserveAspectRatio="none"
              transform={rotation ? `rotate(${rotation} ${centerX} ${centerY})` : undefined}
            />
            {active ? (
              <rect
                x={x}
                y={y}
                width={boxWidth}
                height={boxHeight}
                fill="transparent"
                stroke={selectedLayer === index ? '#f3e2b3' : 'rgba(243,226,179,0.35)'}
                strokeWidth={0.06}
                strokeDasharray="0.3 0.15"
                style={{ cursor: 'move' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelectLayer?.(index);
                  svgRef.current?.setPointerCapture(event.pointerId);
                  const point = toGrid(event);
                  setLayerDrag({ index, offsetX: point.x - layer.x, offsetY: point.y - layer.y, x: layer.x, y: layer.y });
                }}
              />
            ) : null}
          </g>
        );
      })}
      {map.showGrid ? <rect x="0" y="0" width={map.cols} height={map.rows} fill={`url(#grade-${uid})`} /> : null}

      {/* Áreas de magia: quadrados atingidos e contorno. */}
      {shownAreas.map(({ area: shape, local }, index) => {
        const cells = areaCells(shape, map.cols, map.rows);
        const outline = areaOutline(shape)
          .map((point) => `${point.x},${point.y}`)
          .join(' ');
        const color = shape.color ?? (local ? '#4fc3d9' : '#e8862a');
        return (
          <g key={`area-${index}`} style={{ pointerEvents: 'none' }}>
            <path d={cells.map((cell) => `M${cell.x} ${cell.y}h1v1h-1z`).join('')} fill={color} opacity={0.28} />
            <polygon points={outline} fill="none" stroke={color} strokeWidth={0.06} strokeDasharray={local ? '0.2 0.12' : undefined} />
            <DistanceTag
              x={shape.x}
              y={shape.kind === 'circle' ? shape.y - shape.meters / 1.5 - 0.15 : shape.y - 0.2}
              text={`${formatMeters(shape.meters)} · ${cells.length} quadr.`}
            />
          </g>
        );
      })}

      {/* Desenhos e anotações (os secretos só o mestre vê, tracejados). */}
      {drawingItems.map(({ drawing, index, secret }) => {
        const erasing = tool === 'erase-drawing';
        const onErase = (event: ReactPointerEvent) => {
          event.stopPropagation();
          onRemoveDrawing?.(index, secret);
        };
        if (drawing.type === 'path') {
          const points = drawing.points.map(([x, y]) => `${x},${y}`).join(' ');
          return (
            <g key={`desenho-${secret ? 's' : 'p'}-${index}`} style={{ pointerEvents: erasing ? 'auto' : 'none', cursor: erasing ? 'pointer' : 'default' }} onPointerDown={erasing ? onErase : undefined}>
              <polyline points={points} fill="none" stroke={drawing.color} strokeWidth={0.08} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={secret ? '0.25 0.12' : undefined} />
              {erasing ? <polyline points={points} fill="none" stroke="rgba(224,64,64,0.25)" strokeWidth={0.4} /> : null}
            </g>
          );
        }
        const width = Math.max(1, drawing.text.length * 0.17 + 0.4);
        return (
          <g
            key={`nota-${secret ? 's' : 'p'}-${index}`}
            transform={`translate(${drawing.x} ${drawing.y})`}
            style={{ pointerEvents: erasing ? 'auto' : 'none', cursor: erasing ? 'pointer' : 'default' }}
            onPointerDown={erasing ? onErase : undefined}
          >
            <rect x={0} y={-0.25} width={width} height={0.5} rx={0.08} fill="rgba(20,16,12,0.88)" stroke={drawing.color} strokeWidth={0.04} strokeDasharray={secret ? '0.15 0.08' : undefined} />
            <text x={0.2} y={0} dominantBaseline="central" fontSize={0.28} fill={drawing.color}>
              {secret ? '🔒 ' : ''}
              {drawing.text}
            </text>
          </g>
        );
      })}
      {stroke && stroke.length > 1 ? (
        <polyline points={stroke.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={drawColor} strokeWidth={0.08} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
      ) : null}

      {/* Paredes desenhadas no estilo escolhido (todos veem; a invisível só o mestre). */}
      {map.walls.map((wall, index) => (
        <WallShape key={`${wall.join(',')}-${index}`} wall={wall} uid={uid} isGm={isGm} />
      ))}

      {ordered.map((token) => {
        const side = tokenSizeSquares[token.size];
        const dragging = drag?.tokenId === token.id;
        const x = dragging ? drag.x : token.x;
        const y = dragging ? drag.y : token.y;
        const radius = (side / 2) * (token.size === 'tiny' ? 0.6 : 0.9);
        const color = tokenColor(token);
        const mine = token.characterId !== null && token.characterId === myCharacterId;
        return (
          <g
            key={token.id}
            transform={`translate(${x + side / 2} ${y + side / 2})`}
            opacity={token.isHidden ? 0.45 : 1}
            style={{ cursor: canDrag(token) ? 'grab' : 'default' }}
            onPointerDown={(event) => {
              if (tool !== 'move') return;
              event.stopPropagation();
              onSelectToken?.(token.id);
              showName(token.id);
              if (!canDrag(token)) return;
              svgRef.current?.setPointerCapture(event.pointerId);
              const point = toGrid(event);
              setDrag({ tokenId: token.id, offsetX: point.x - token.x, offsetY: point.y - token.y, x: token.x, y: token.y });
            }}
          >
            <title>{token.label || 'Token'}</title>
            {tokenImages[token.id] ? (
              <>
                <clipPath id={`token-${uid}-${token.id}`}>
                  <circle r={radius} />
                </clipPath>
                <circle r={radius} fill={color} />
                <image
                  href={tokenImages[token.id]}
                  x={-radius}
                  y={-radius}
                  width={radius * 2}
                  height={radius * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#token-${uid}-${token.id})`}
                />
              </>
            ) : null}
            <circle
              r={radius}
              fill={tokenImages[token.id] ? 'none' : color}
              stroke={selectedTokenId === token.id ? '#f3e2b3' : mine ? '#ffffff' : 'rgba(0,0,0,0.6)'}
              strokeWidth={selectedTokenId === token.id || mine ? 0.09 : 0.05}
              strokeDasharray={token.isHidden ? '0.15 0.1' : undefined}
            />
            {tokenImages[token.id] ? null : (
            <text textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.75} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none' }}>
              {initials(token.label)}
            </text>
            )}
          </g>
        );
      })}

      {/* Nome do token clicado, por cima dele por alguns segundos. */}
      {namedToken && !drag
        ? (() => {
            const token = tokens.find((entry) => entry.id === namedToken && visibleToMe(entry));
            if (!token?.label) return null;
            const side = tokenSizeSquares[token.size];
            return (
              <g style={{ pointerEvents: 'none' }}>
                <DistanceTag x={token.x + side / 2} y={token.y - 0.15} text={token.label} />
              </g>
            );
          })()
        : null}

      {/* Rastros dos últimos movimentos (linha tracejada e distância). */}
      {(freeMovement ? [] : trails).filter((trail) => tokens.some((token) => token.id === trail.id && visibleToMe(token))).map((trail) => {
        const half = trail.side / 2;
        return (
          <g key={`rastro-${trail.id}`} style={{ pointerEvents: 'none' }}>
            <line x1={trail.from.x + half} y1={trail.from.y + half} x2={trail.to.x + half} y2={trail.to.y + half} stroke="#f3e2b3" strokeWidth={0.06} strokeDasharray="0.2 0.14" />
            <circle cx={trail.from.x + half} cy={trail.from.y + half} r={0.1} fill="#f3e2b3" />
            <DistanceTag x={trail.to.x + half} y={trail.to.y - 0.15} text={`${trail.label ? `${trail.label}: ` : ''}${formatMeters(trail.meters)}`} />
          </g>
        );
      })}
      {drag
        ? (() => {
            const token = tokens.find((entry) => entry.id === drag.tokenId);
            if (!token) return null;
            const side = tokenSizeSquares[token.size];
            const target = { x: Math.max(0, Math.min(map.cols - side, Math.round(drag.x))), y: Math.max(0, Math.min(map.rows - side, Math.round(drag.y))) };
            const moved = target.x !== token.x || target.y !== token.y;
            const blocked = moved ? blockedReason(token, target) : null;
            // Destino proibido (ocupado ou atrás de parede): vermelho com o motivo; ao soltar, volta.
            if (blocked)
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={target.x} y={target.y} width={side} height={side} fill="rgba(239,68,68,0.22)" stroke="#ef4444" strokeWidth={0.05} strokeDasharray="0.15 0.1" />
                  <DistanceTag x={target.x + side / 2} y={target.y - 0.15} color="#ef4444" text={`Não dá: ${blocked}`} />
                </g>
              );
            // Movimentação livre: só o quadrado de destino, sem linha nem metros.
            if (freeMovement)
              return (
                <rect x={target.x} y={target.y} width={side} height={side} fill="rgba(243,226,179,0.12)" stroke="#f3e2b3" strokeWidth={0.04} strokeDasharray="0.15 0.1" style={{ pointerEvents: 'none' }} />
              );
            const { squares, meters } = gridDistance(token, target, systemId);
            const limit = tokenSpeeds[token.id];
            // Passou do deslocamento: fica vermelho, mas não impede o movimento.
            const over = limit !== undefined && meters > limit;
            const tone = over ? '#ef4444' : '#f3e2b3';
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={token.x + side / 2} y1={token.y + side / 2} x2={target.x + side / 2} y2={target.y + side / 2} stroke={tone} strokeWidth={0.06} strokeDasharray="0.2 0.14" />
                <rect x={target.x} y={target.y} width={side} height={side} fill={over ? 'rgba(239,68,68,0.18)' : 'rgba(243,226,179,0.12)'} stroke={tone} strokeWidth={0.04} strokeDasharray="0.15 0.1" />
                <DistanceTag
                  x={target.x + side / 2}
                  y={target.y - 0.15}
                  color={tone}
                  text={`${formatMeters(meters)}${limit !== undefined ? ` de ${formatMeters(limit)}` : ` (${squares} ${squares === 1 ? 'quadrado' : 'quadrados'})`}${over ? ' · passou do deslocamento' : ''}`}
                />
              </g>
            );
          })()
        : null}

      {/* Névoa: opaca para o jogador, translúcida para o mestre. */}
      {unrevealedPath ? <path d={unrevealedPath} fill="#050505" opacity={isGm ? 0.55 : 1} style={{ pointerEvents: 'none' }} /> : null}
      {sightPoints ? <rect x="0" y="0" width={map.cols} height={map.rows} fill="#050505" opacity={0.92} mask={`url(#visao-${uid})`} style={{ pointerEvents: 'none' }} /> : null}

      {isGm
        ? map.walls.map((wall, index) => (
            <g key={`${wall.join(',')}-${index}`}>
              {tool === 'erase-wall' ? (
                <line
                  x1={wall[0]}
                  y1={wall[1]}
                  x2={wall[2]}
                  y2={wall[3]}
                  stroke="rgba(224,64,64,0.35)"
                  strokeWidth={0.5}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onRemoveWall?.(index);
                  }}
                />
              ) : null}
            </g>
          ))
        : null}
      {ruler && (ruler.start.x !== ruler.end.x || ruler.start.y !== ruler.end.y) ? (
        <g style={{ pointerEvents: 'none' }}>
          <line x1={ruler.start.x} y1={ruler.start.y} x2={ruler.end.x} y2={ruler.end.y} stroke="#4fc3d9" strokeWidth={0.07} />
          <circle cx={ruler.start.x} cy={ruler.start.y} r={0.12} fill="#4fc3d9" />
          <circle cx={ruler.end.x} cy={ruler.end.y} r={0.12} fill="#4fc3d9" />
          <DistanceTag
            x={ruler.end.x}
            y={ruler.end.y - 0.25}
            text={`${formatMeters(gridDistance(ruler.start, ruler.end, systemId).meters)} (${gridDistance(ruler.start, ruler.end, systemId).squares} quadr.)`}
          />
        </g>
      ) : null}
      {isGm && tool === 'wall' && wallStart ? (
        <line x1={wallStart.x} y1={wallStart.y} x2={hover?.x ?? wallStart.x} y2={hover?.y ?? wallStart.y} stroke="#e04040" strokeWidth={0.08} strokeDasharray="0.2 0.15" />
      ) : null}
      {isGm && tool === 'wall' && hover ? <circle cx={hover.x} cy={hover.y} r={0.12} fill="#e04040" /> : null}
      {preview ? (
        <rect
          x={preview[0]}
          y={preview[1]}
          width={preview[2]}
          height={preview[3]}
          fill={tool === 'reveal' ? 'rgba(243,226,179,0.25)' : 'rgba(0,0,0,0.5)'}
          stroke="#f3e2b3"
          strokeWidth={0.05}
          style={{ pointerEvents: 'none' }}
        />
      ) : null}
    </svg>
  );
}

/** Etiqueta de distância sobre o mapa (em unidades de quadrado). */
function DistanceTag({ x, y, text, color = '#f3e2b3' }: { x: number; y: number; text: string; color?: string }) {
  const width = Math.max(1.2, text.length * 0.2 + 0.3);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-width / 2} y={-0.5} width={width} height={0.42} rx={0.12} fill="rgba(20,16,12,0.9)" stroke={color} strokeWidth={0.03} />
      <text y={-0.29} textAnchor="middle" dominantBaseline="central" fontSize={0.26} fontWeight={700} fill={color}>
        {text}
      </text>
    </g>
  );
}
