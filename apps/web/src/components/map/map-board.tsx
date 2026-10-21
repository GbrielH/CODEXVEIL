'use client';

import type { MapToken, SessionMap, Wall } from '@codexveil/database';
import { cellRect, fogCells, formatMeters, gridDistance, pointInPolygon, tokenSizeSquares, visibilityPolygon, wallBlocksSight, type GridRect, type Point, type WallStyle } from '@codexveil/domain';
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useCampaignColors } from '@/components/dice/campaign-colors';
import { WallPatterns, WallShape } from './wall-art';

/** Ferramenta do mestre no tabuleiro. */
export type MapTool = 'move' | 'reveal' | 'hide' | 'wall' | 'erase-wall';

const CELL = 40;
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
}: MapBoardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const colors = useCampaignColors();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ tokenId: string; offsetX: number; offsetY: number; x: number; y: number } | null>(null);
  const [area, setArea] = useState<{ start: Point; end: Point } | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);

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
    if (moved.length) setTrails((current) => [...current.filter((trail) => !moved.some((entry) => entry.id === trail.id)), ...moved]);
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

  const onBoardDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!isGm) return;
    const point = toGrid(event);
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
    if (drag) setDrag({ ...drag, x: point.x - drag.offsetX, y: point.y - drag.offsetY });
    else if (area) setArea({ ...area, end: toCell(point) });
    else if (tool === 'wall') setHover({ x: Math.round(point.x), y: Math.round(point.y) });
  };

  const onBoardUp = () => {
    if (drag) {
      const token = tokens.find((entry) => entry.id === drag.tokenId);
      if (token) {
        const side = tokenSizeSquares[token.size];
        const x = Math.max(0, Math.min(map.cols - side, Math.round(drag.x)));
        const y = Math.max(0, Math.min(map.rows - side, Math.round(drag.y)));
        if (x !== token.x || y !== token.y) onMoveToken?.(token, x, y);
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

      {imageUrl ? (
        <image
          href={imageUrl}
          x={map.imageOffsetX}
          y={map.imageOffsetY}
          width={map.cols * map.imageScale}
          height={map.rows * map.imageScale * 10}
          preserveAspectRatio="xMinYMin meet"
        />
      ) : null}
      {map.showGrid ? <rect x="0" y="0" width={map.cols} height={map.rows} fill={`url(#grade-${uid})`} /> : null}

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

      {/* Rastros dos últimos movimentos (linha tracejada e distância). */}
      {trails.filter((trail) => tokens.some((token) => token.id === trail.id && visibleToMe(token))).map((trail) => {
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
            const { squares, meters } = gridDistance(token, target, systemId);
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={target.x} y={target.y} width={side} height={side} fill="rgba(243,226,179,0.12)" stroke="#f3e2b3" strokeWidth={0.04} strokeDasharray="0.15 0.1" />
                <DistanceTag x={target.x + side / 2} y={target.y - 0.15} text={`${formatMeters(meters)} (${squares} ${squares === 1 ? 'quadrado' : 'quadrados'})`} />
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
function DistanceTag({ x, y, text }: { x: number; y: number; text: string }) {
  const width = Math.max(1.2, text.length * 0.2 + 0.3);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-width / 2} y={-0.5} width={width} height={0.42} rx={0.12} fill="rgba(20,16,12,0.9)" stroke="#f3e2b3" strokeWidth={0.03} />
      <text y={-0.29} textAnchor="middle" dominantBaseline="central" fontSize={0.26} fontWeight={700} fill="#f3e2b3">
        {text}
      </text>
    </g>
  );
}
