import type { MapToken, SessionMap } from '@codexveil/database';
import { fogCells, formatMeters, gridDistance, pointInPolygon, tokenSizeSquares, visibilityPolygon, wallBlocksSight, type WallStyle } from '@codexveil/domain';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Line, Mask, Path, Pattern, Polygon, Rect, Text as SvgText } from 'react-native-svg';

const CELL = 36;

/** Cor e espessura de cada estilo de parede (versão simplificada das texturas do site). */
const WALL_LOOK: Record<WallStyle, { fill: string; edge: string; thickness: number }> = {
  stone: { fill: '#77736b', edge: '#4a4740', thickness: 0.32 },
  brick: { fill: '#9b4a32', edge: '#d8c7a8', thickness: 0.3 },
  ruin: { fill: '#6b675f', edge: '#3d3a34', thickness: 0.3 },
  wood: { fill: '#7a4f2c', edge: '#3f2715', thickness: 0.22 },
  sandstone: { fill: '#c9a66b', edge: '#8f6c3a', thickness: 0.34 },
  hedge: { fill: '#3a6c32', edge: '#2f5a2a', thickness: 0.36 },
  iron: { fill: 'none', edge: '#55595f', thickness: 0.12 },
  invisible: { fill: 'none', edge: 'none', thickness: 0 },
};
const CREATURE_COLOR = '#571F2B';
const MARKER_COLOR = '#b58a2a';

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words.length === 1 ? words[0]!.slice(0, 2) : `${words[0]![0]}${words[1]![0]}`).toUpperCase();
}

/**
 * Mapa ativo para o jogador (só ver e mover o próprio token): imagem ajustada pelo mestre,
 * grade de 1,5 m, tokens, névoa opaca e linha de visão. Toque no seu token e depois no
 * quadrado de destino.
 */
export function MapBoard({
  map,
  tokens,
  imageUrl,
  tokenImages,
  systemId,
  myCharacterId,
  zoom,
  selected,
  colorOfCharacter,
  onTapCell,
}: {
  map: SessionMap;
  tokens: MapToken[];
  imageUrl: string | null;
  tokenImages: Record<string, string>;
  /** Sistema da campanha (regra de distância na diagonal). */
  systemId: string;
  myCharacterId: string | null;
  zoom: number;
  /** Token do jogador selecionado para mover. */
  selected: boolean;
  colorOfCharacter: (characterId: string | null) => string | null;
  onTapCell: (x: number, y: number) => void;
}) {
  const size = CELL * zoom;

  // Rastro dos movimentos (de todos): linha tracejada e distância por 6 s.
  const [lastTokens, setLastTokens] = useState(tokens);
  const [trails, setTrails] = useState<{ id: string; label: string; fx: number; fy: number; tx: number; ty: number; half: number; meters: number }[]>([]);
  if (lastTokens !== tokens) {
    const before = new Map(lastTokens.map((token) => [token.id, token]));
    const moved = tokens.flatMap((token) => {
      const old = before.get(token.id);
      if (!old || (old.x === token.x && old.y === token.y)) return [];
      return [{ id: token.id, label: token.label, fx: old.x, fy: old.y, tx: token.x, ty: token.y, half: tokenSizeSquares[token.size] / 2, meters: gridDistance(old, token, systemId).meters }];
    });
    setLastTokens(tokens);
    if (moved.length) setTrails((current) => [...current.filter((trail) => !moved.some((entry) => entry.id === trail.id)), ...moved]);
  }
  useEffect(() => {
    if (trails.length === 0) return;
    const timer = setTimeout(() => setTrails([]), 6000);
    return () => clearTimeout(timer);
  }, [trails]);
  const myToken = tokens.find((token) => token.kind === 'character' && token.characterId === myCharacterId) ?? null;

  const unrevealed = useMemo(() => {
    if (!map.fogEnabled) return '';
    const revealed = fogCells(map.fogRevealed);
    let path = '';
    for (let y = 0; y < map.rows; y += 1) for (let x = 0; x < map.cols; x += 1) if (!revealed.has(`${x},${y}`)) path += `M${x} ${y}h1v1h-1z`;
    return path;
  }, [map.fogEnabled, map.fogRevealed, map.cols, map.rows]);

  const sight = useMemo(() => {
    if (!map.lineOfSight || !myToken) return null;
    const side = tokenSizeSquares[myToken.size];
    const blocking = map.walls.filter((wall) => wallBlocksSight(wall[4])).map(([x1, y1, x2, y2]) => [x1, y1, x2, y2] as [number, number, number, number]);
    return visibilityPolygon({ x: myToken.x + side / 2, y: myToken.y + side / 2 }, blocking, map.cols, map.rows, myToken.visionRadius);
  }, [map.lineOfSight, map.walls, map.cols, map.rows, myToken]);

  const visible = tokens.filter((token) => {
    if (!sight || token.id === myToken?.id) return true;
    const side = tokenSizeSquares[token.size];
    return pointInPolygon({ x: token.x + side / 2, y: token.y + side / 2 }, sight);
  });

  const onPress = (event: GestureResponderEvent) => {
    const x = Math.floor(event.nativeEvent.locationX / size);
    const y = Math.floor(event.nativeEvent.locationY / size);
    if (x >= 0 && y >= 0 && x < map.cols && y < map.rows) onTapCell(x, y);
  };

  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 520 }}>
        <Pressable onPress={onPress} accessibilityLabel={`Mapa ${map.name}, ${map.cols} por ${map.rows} quadrados de 1,5 metro`}>
          <Svg width={map.cols * size} height={map.rows * size} viewBox={`0 0 ${map.cols} ${map.rows}`} style={{ backgroundColor: '#16130f' }}>
            <Defs>
              <Pattern id="grade" width="1" height="1" patternUnits="userSpaceOnUse">
                <Path d="M1 0H0V1" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.2 / CELL} />
              </Pattern>
              {sight ? (
                <Mask id="visao">
                  <Rect x="0" y="0" width={map.cols} height={map.rows} fill="white" />
                  <Polygon points={sight.map((point) => `${point.x},${point.y}`).join(' ')} fill="black" />
                </Mask>
              ) : null}
            </Defs>
            {imageUrl ? (
              <SvgImage
                href={{ uri: imageUrl }}
                x={map.imageOffsetX}
                y={map.imageOffsetY}
                width={map.cols * map.imageScale}
                height={map.rows * map.imageScale * 10}
                preserveAspectRatio="xMinYMin meet"
              />
            ) : null}
            {map.showGrid ? <Rect x="0" y="0" width={map.cols} height={map.rows} fill="url(#grade)" /> : null}
            {map.walls.map(([x1, y1, x2, y2, style], index) => {
              const look = WALL_LOOK[style];
              if (style === 'invisible') return null;
              const length = Math.hypot(x2 - x1, y2 - y1);
              const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
              return (
                <G key={`parede-${index}`} transform={`translate(${x1} ${y1}) rotate(${angle})`}>
                  {style === 'iron' ? (
                    Array.from({ length: Math.max(2, Math.round(length / 0.25)) + 1 }, (_, bar) => {
                      const bars = Math.max(2, Math.round(length / 0.25));
                      const bx = (bar / bars) * length;
                      return <Line key={bar} x1={bx} y1={-0.18} x2={bx} y2={0.18} stroke={look.edge} strokeWidth={0.05} />;
                    })
                  ) : (
                    <Rect
                      x={-look.thickness / 4}
                      y={-look.thickness / 2}
                      width={length + look.thickness / 2}
                      height={look.thickness}
                      rx={style === 'hedge' ? look.thickness / 2 : 0.03}
                      fill={look.fill}
                      stroke={look.edge}
                      strokeWidth={0.04}
                      strokeDasharray={style === 'ruin' ? [Math.max(0.4, length / 3), 0.18] : undefined}
                    />
                  )}
                </G>
              );
            })}
            {[...visible]
              .sort((a, b) => tokenSizeSquares[b.size] - tokenSizeSquares[a.size])
              .map((token) => {
                const side = tokenSizeSquares[token.size];
                const radius = (side / 2) * (token.size === 'tiny' ? 0.6 : 0.9);
                const mine = token.id === myToken?.id;
                const color =
                  token.kind === 'character' ? (colorOfCharacter(token.characterId) ?? '#3b4cb8') : token.kind === 'creature' ? CREATURE_COLOR : MARKER_COLOR;
                const image = tokenImages[token.id];
                if (image) {
                  return (
                    <G key={token.id}>
                      <Defs>
                        <ClipPath id={`token-${token.id}`}>
                          <Circle cx={token.x + side / 2} cy={token.y + side / 2} r={radius} />
                        </ClipPath>
                      </Defs>
                      <Circle cx={token.x + side / 2} cy={token.y + side / 2} r={radius} fill={color} />
                      <SvgImage
                        href={{ uri: image }}
                        x={token.x + side / 2 - radius}
                        y={token.y + side / 2 - radius}
                        width={radius * 2}
                        height={radius * 2}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#token-${token.id})`}
                      />
                      <Circle cx={token.x + side / 2} cy={token.y + side / 2} r={radius} fill="none" stroke={mine && selected ? '#f3e2b3' : mine ? '#ffffff' : color} strokeWidth={mine ? 0.12 : 0.08} />
                    </G>
                  );
                }
                return (
                  <Circle
                    key={token.id}
                    cx={token.x + side / 2}
                    cy={token.y + side / 2}
                    r={radius}
                    fill={color}
                    stroke={mine && selected ? '#f3e2b3' : mine ? '#ffffff' : 'rgba(0,0,0,0.6)'}
                    strokeWidth={mine ? 0.12 : 0.05}
                  />
                );
              })}
            {visible.filter((token) => !tokenImages[token.id]).map((token) => {
              const side = tokenSizeSquares[token.size];
              const radius = (side / 2) * (token.size === 'tiny' ? 0.6 : 0.9);
              return (
                <SvgText key={`t-${token.id}`} x={token.x + side / 2} y={token.y + side / 2 + radius * 0.27} textAnchor="middle" fontSize={radius * 0.75} fontWeight="700" fill="#ffffff">
                  {initials(token.label)}
                </SvgText>
              );
            })}
            {trails
              .filter((trail) => visible.some((token) => token.id === trail.id))
              .map((trail) => {
                const text = `${trail.label ? `${trail.label}: ` : ''}${formatMeters(trail.meters)}`;
                const width = Math.max(1.2, text.length * 0.2 + 0.3);
                return (
                  <G key={`rastro-${trail.id}`}>
                    <Line x1={trail.fx + trail.half} y1={trail.fy + trail.half} x2={trail.tx + trail.half} y2={trail.ty + trail.half} stroke="#f3e2b3" strokeWidth={0.06} strokeDasharray={[0.2, 0.14]} />
                    <Rect x={trail.tx + trail.half - width / 2} y={trail.ty - 0.65} width={width} height={0.42} rx={0.12} fill="rgba(20,16,12,0.9)" stroke="#f3e2b3" strokeWidth={0.03} />
                    <SvgText x={trail.tx + trail.half} y={trail.ty - 0.35} textAnchor="middle" fontSize={0.26} fontWeight="700" fill="#f3e2b3">
                      {text}
                    </SvgText>
                  </G>
                );
              })}
            {unrevealed ? <Path d={unrevealed} fill="#050505" /> : null}
            {sight ? <Rect x="0" y="0" width={map.cols} height={map.rows} fill="#050505" opacity={0.92} mask="url(#visao)" /> : null}
            {myToken && selected ? (
              <Rect
                x={myToken.x}
                y={myToken.y}
                width={tokenSizeSquares[myToken.size]}
                height={tokenSizeSquares[myToken.size]}
                fill="none"
                stroke="#f3e2b3"
                strokeWidth={0.06}
                strokeDasharray="0.2 0.12"
              />
            ) : null}
          </Svg>
        </Pressable>
      </ScrollView>
    </ScrollView>
  );
}
