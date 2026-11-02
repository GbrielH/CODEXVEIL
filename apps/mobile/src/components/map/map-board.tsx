import type { MapToken, SessionMap } from '@codexveil/database';
import { areaCells, areaOutline, fogCells, formatMeters, gridDistance, pointInPolygon, tokenSizeSquares, visibilityPolygon, wallBlocksSight, type MapIconKind, type WallStyle } from '@codexveil/domain';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Line, Mask, Path, Pattern, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

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

function MapIconShape({ icon, color }: { icon: MapIconKind; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 0.09, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (icon === 'chest') return <G><Rect x=".14" y=".34" width=".72" height=".48" rx=".08" {...common} /><Path d="M.16 .5h.68M.5 .5v.17" {...common} /></G>;
  if (icon === 'door') return <G><Path d="M.2 .86V.15h.6v.71M.28 .86V.25h.44v.61" {...common} /><Circle cx=".62" cy=".56" r=".035" fill={color} /></G>;
  if (icon === 'secret-door') return <G><Path d="M.14 .78h.72M.22 .78V.22h.56v.56" {...common} strokeDasharray={[0.12, 0.08]} /><SvgText x=".5" y=".62" textAnchor="middle" fontSize=".5" fontWeight="700" fill={color}>?</SvgText></G>;
  if (icon === 'trap') return <G><Path d="M.5 .12l.4 .72H.1zM.5 .38v.22" {...common} /><Circle cx=".5" cy=".71" r=".035" fill={color} /></G>;
  if (icon === 'stairs') return <Path d="M.12 .82h.2V.65h.2V.48h.2V.31h.2" {...common} />;
  if (icon === 'campfire') return <G><Path d="M.25 .82l.5-.18M.25 .64l.5 .18M.5 .66c-.22-.18-.18-.38.02-.58.02.18.2.24.2.43 0 .13-.09.25-.22.15z" {...common} /></G>;
  if (icon === 'altar') return <G><Path d="M.18 .78h.64M.28 .72l.08-.4h.28l.08.4M.24 .28h.52v.12H.24zM.5 .14v.22M.42 .22h.16" {...common} /></G>;
  return <G><Path d="M.2 .42a.3.3 0 1 1 .6 0c0 .17-.1.26-.18.34v.12H.38V.76C.3 .68.2 .59.2 .42z" {...common} /><Circle cx=".39" cy=".42" r=".055" fill={color} /><Circle cx=".61" cy=".42" r=".055" fill={color} /></G>;
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
  layers,
  systemId,
  myCharacterId,
  zoom,
  selected,
  namedTokenId = null,
  freeMovement = false,
  colorOfCharacter,
  onTapCell,
  maxHeight = 520,
}: {
  map: SessionMap;
  tokens: MapToken[];
  imageUrl: string | null;
  tokenImages: Record<string, string>;
  /** Imagens do mapa (camadas) com URL e proporção. */
  layers: { path: string; x: number; y: number; width: number; rotation?: number; url: string; aspect: number }[];
  /** Sistema da campanha (regra de distância na diagonal). */
  systemId: string;
  myCharacterId: string | null;
  zoom: number;
  /** Token do jogador selecionado para mover. */
  selected: boolean;
  /** Token tocado: mostra o nome por cima dele. */
  namedTokenId?: string | null;
  /** Fora de combate: os movimentos não deixam rastro com metros. */
  freeMovement?: boolean;
  colorOfCharacter: (characterId: string | null) => string | null;
  onTapCell: (x: number, y: number) => void;
  /** Altura máxima da área rolável (na tela cheia, a altura da tela). */
  maxHeight?: number;
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
    if (moved.length && !freeMovement) setTrails((current) => [...current.filter((trail) => !moved.some((entry) => entry.id === trail.id)), ...moved]);
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
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight }}>
        <Pressable onPress={onPress} accessibilityLabel={`Mapa ${map.name}, ${map.cols} por ${map.rows} quadrados de 1,5 metro`}>
          <Svg width={map.cols * size} height={map.rows * size} viewBox={`0 0 ${map.cols} ${map.rows}`} style={{ backgroundColor: '#16130f' }}>
            <Defs>
              <Pattern id="grade" width="1" height="1" patternUnits="userSpaceOnUse">
                <Path d="M1 0H0V1" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.2 / CELL} />
              </Pattern>
              <Pattern id="piso-stone" width="1" height="1" patternUnits="userSpaceOnUse"><Rect width="1" height="1" fill="#68645d" /><Path d="M0 .5h1M.5 0v.5M.25 .5V1M.75 .5V1" stroke="#8b867d" strokeWidth=".04" /></Pattern>
              <Pattern id="piso-dirt" width="1" height="1" patternUnits="userSpaceOnUse"><Rect width="1" height="1" fill="#765435" /><Circle cx=".2" cy=".28" r=".06" fill="#9b7650" /><Circle cx=".72" cy=".68" r=".08" fill="#5c3f29" /></Pattern>
              <Pattern id="piso-wood" width="1" height="1" patternUnits="userSpaceOnUse"><Rect width="1" height="1" fill="#80542e" /><Path d="M0 .25h1M0 .75h1M.35 0v.25M.7 .25v.5M.25 .75V1" stroke="#b47a45" strokeWidth=".04" /></Pattern>
              <Pattern id="piso-grass" width="1" height="1" patternUnits="userSpaceOnUse"><Rect width="1" height="1" fill="#496c36" /><Path d="M.2 .8l.05-.25.08.2M.7 .45l.05-.25.08.2" stroke="#7e9d55" strokeWidth=".04" fill="none" /></Pattern>
              <Pattern id="piso-water" width="1" height="1" patternUnits="userSpaceOnUse"><Rect width="1" height="1" fill="#356b82" /><Path d="M-.1 .3q.25-.18.5 0t.5 0M.1 .72q.25-.18.5 0t.5 0" stroke="#69a9bd" strokeWidth=".05" fill="none" /></Pattern>
              {sight ? (
                <Mask id="visao">
                  <Rect x="0" y="0" width={map.cols} height={map.rows} fill="white" />
                  <Polygon points={sight.map((point) => `${point.x},${point.y}`).join(' ')} fill="black" />
                </Mask>
              ) : null}
            </Defs>
            {layers.length
              ? layers.map((layer, index) => (
                  (() => {
                    // Girada de lado (90°/270°), a área ocupada troca largura e altura; gira no centro dela (como no site).
                    const height = layer.width * layer.aspect;
                    const rotation = layer.rotation ?? 0;
                    const sideways = rotation === 90 || rotation === 270;
                    const cx = layer.x + (sideways ? height : layer.width) / 2;
                    const cy = layer.y + (sideways ? layer.width : height) / 2;
                    return (
                      <SvgImage
                        key={`${layer.path}-${index}`}
                        href={{ uri: layer.url }}
                        x={cx - layer.width / 2}
                        y={cy - height / 2}
                        width={layer.width}
                        height={height}
                        preserveAspectRatio="none"
                        {...(rotation ? { transform: `rotate(${rotation} ${cx} ${cy})` } : {})}
                      />
                    );
                  })()
                ))
              : imageUrl
                ? (
                  <SvgImage
                    href={{ uri: imageUrl }}
                    x={map.imageOffsetX}
                    y={map.imageOffsetY}
                    width={map.cols * map.imageScale}
                    height={map.rows * map.imageScale * 10}
                    preserveAspectRatio="xMinYMin meet"
                  />
                )
                : null}
            {map.drawings.map((drawing, index) => drawing.type === 'texture' ? <Rect key={`piso-${index}`} x={drawing.x} y={drawing.y} width={drawing.width} height={drawing.height} fill={`url(#piso-${drawing.texture})`} /> : null)}
            {map.showGrid ? <Rect x="0" y="0" width={map.cols} height={map.rows} fill="url(#grade)" /> : null}
            {map.areas.map((shape, index) => {
              const cells = areaCells(shape, map.cols, map.rows);
              const color = shape.color ?? '#e8862a';
              return (
                <G key={`area-${index}`}>
                  <Path d={cells.map((cell) => `M${cell.x} ${cell.y}h1v1h-1z`).join('')} fill={color} opacity={0.28} />
                  <Polygon points={areaOutline(shape).map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth={0.06} />
                </G>
              );
            })}
            {map.drawings.map((drawing, index) =>
              drawing.type === 'texture' ? null : drawing.type === 'path' ? (
                <Polyline key={`desenho-${index}`} points={drawing.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={drawing.color} strokeWidth={0.08} strokeLinecap="round" strokeLinejoin="round" />
              ) : drawing.type === 'icon' ? (
                <G key={`icone-${index}`} transform={`translate(${drawing.x} ${drawing.y})`}>
                  <Rect x=".04" y=".04" width=".92" height=".92" rx=".12" fill="rgba(20,16,12,.72)" stroke={drawing.color} strokeWidth=".035" />
                  <MapIconShape icon={drawing.icon} color={drawing.color} />
                </G>
              ) : (
                <G key={`nota-${index}`}>
                  <Rect x={drawing.x} y={drawing.y - 0.25} width={Math.max(1, drawing.text.length * 0.17 + 0.4)} height={0.5} rx={0.08} fill="rgba(20,16,12,0.88)" stroke={drawing.color} strokeWidth={0.04} />
                  <SvgText x={drawing.x + 0.2} y={drawing.y + 0.1} fontSize={0.28} fill={drawing.color}>
                    {drawing.text}
                  </SvgText>
                </G>
              ),
            )}
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
            {(freeMovement ? [] : trails)
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
            {(() => {
              const token = namedTokenId ? visible.find((entry) => entry.id === namedTokenId) : null;
              if (!token?.label) return null;
              const half = tokenSizeSquares[token.size] / 2;
              const width = Math.max(1.2, token.label.length * 0.2 + 0.3);
              return (
                <G>
                  <Rect x={token.x + half - width / 2} y={token.y - 0.65} width={width} height={0.42} rx={0.12} fill="rgba(20,16,12,0.9)" stroke="#f3e2b3" strokeWidth={0.03} />
                  <SvgText x={token.x + half} y={token.y - 0.35} textAnchor="middle" fontSize={0.26} fontWeight="700" fill="#f3e2b3">
                    {token.label}
                  </SvgText>
                </G>
              );
            })()}
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
